import Database = require('better-sqlite3');
import { dirname } from 'path';
import { mkdirSync } from 'fs';
import type { DatabaseBackend } from './database-backend.js';
import { StoragePathResolver } from '../path-resolver.js';
import { logger } from '../../logger/index.js';
import type { BackendConfig } from './types.js';

export interface SQLiteBackendConfig {
    type: 'sqlite';
    path?: string; // Optional custom path, if not provided will auto-detect using path resolver
    database?: string; // Database name within the storage directory (default: 'saiki.db')
    // SQLite-specific options
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: boolean;
}

/**
 * SQLite storage backend for local development and production.
 * Implements the DatabaseBackend interface with proper schema and connection handling.
 */
export class SQLiteBackend implements DatabaseBackend {
    private db: Database.Database;
    private dbPath: string;

    constructor(config: SQLiteBackendConfig) {
        // Initialize database path - use sync resolution for constructor
        this.dbPath = config.path || this.resolveDefaultPathSync(config.database || 'saiki.db');

        // Ensure directory exists
        const dir = dirname(this.dbPath);
        try {
            mkdirSync(dir, { recursive: true });
        } catch (error) {
            // Directory might already exist, that's fine
        }

        // Initialize SQLite database
        this.db = new Database(this.dbPath, {
            readonly: config.readonly || false,
            fileMustExist: config.fileMustExist || false,
            timeout: config.timeout || 5000,
            verbose: config.verbose
                ? (message?: unknown, ...additionalArgs: unknown[]) => {
                      logger.debug(
                          typeof message === 'string' || typeof message === 'object'
                              ? message
                              : String(message),
                          ...additionalArgs
                      );
                  }
                : undefined,
        });

        // Enable WAL mode for better concurrency
        this.db.pragma('journal_mode = WAL');

        // Create tables if they don't exist
        this.initializeTables();

        logger.debug(`SQLiteBackend initialized at: ${this.dbPath}`);
    }

    private resolveDefaultPathSync(dbName: string): string {
        // For now, use a simple approach that works synchronously
        // TODO: Consider making backend initialization async to support full path resolution
        const homeDir = require('os').homedir();
        const path = require('path');

        // Check if we're in a Saiki project by looking for package.json or saiki.yml
        const fs = require('fs');
        let useLocal = false;

        try {
            // Look for indicators we're in a Saiki project
            const cwd = process.cwd();
            const packageJsonPath = path.join(cwd, 'package.json');
            const saikiConfigPath = path.join(cwd, 'saiki.yml');

            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                // Check if this is a Saiki project
                if (
                    packageJson.name === '@truffle-ai/saiki' ||
                    (packageJson.dependencies &&
                        (packageJson.dependencies['@truffle-ai/saiki'] ||
                            packageJson.dependencies['saiki'])) ||
                    (packageJson.devDependencies &&
                        (packageJson.devDependencies['@truffle-ai/saiki'] ||
                            packageJson.devDependencies['saiki']))
                ) {
                    useLocal = true;
                }
            } else if (fs.existsSync(saikiConfigPath)) {
                useLocal = true;
            }
        } catch (error) {
            // If we can't determine, default to global
            logger.debug('Could not determine project context, using global storage');
        }

        const storageDir = useLocal
            ? path.join(process.cwd(), '.saiki', 'database')
            : path.join(homeDir, '.saiki', 'database');

        logger.debug(`SQLite using ${useLocal ? 'local' : 'global'} storage: ${storageDir}`);
        return path.join(storageDir, dbName);
    }

    private initializeTables(): void {
        // Create key-value table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS kv_store (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);

        // Create list table for append operations
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS list_store (
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                sequence INTEGER,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                PRIMARY KEY (key, sequence)
            )
        `);

        // Create indexes for better performance
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_kv_store_key ON kv_store(key);
            CREATE INDEX IF NOT EXISTS idx_list_store_key ON list_store(key);
            CREATE INDEX IF NOT EXISTS idx_list_store_sequence ON list_store(key, sequence);
        `);
    }

    async connect(): Promise<void> {
        // This method is now empty as the database is initialized in the constructor
    }

    async disconnect(): Promise<void> {
        if (this.db) {
            this.db.close();
        }
    }

    isConnected(): boolean {
        return this.db !== null;
    }

    getBackendType(): string {
        return 'sqlite';
    }

    // Core operations
    async get<T>(key: string): Promise<T | undefined> {
        this.checkConnection();
        const row = this.db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key) as
            | { value: string }
            | undefined;
        return row ? JSON.parse(row.value) : undefined;
    }

    async set<T>(key: string, value: T): Promise<void> {
        this.checkConnection();
        const serialized = JSON.stringify(value);
        this.db
            .prepare('INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)')
            .run(key, serialized, Date.now());
    }

    async delete(key: string): Promise<void> {
        this.checkConnection();
        this.db.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
        this.db.prepare('DELETE FROM list_store WHERE key = ?').run(key);
    }

    // List operations
    async list(prefix: string): Promise<string[]> {
        this.checkConnection();

        // Get keys from both tables
        const kvKeys = this.db
            .prepare('SELECT key FROM kv_store WHERE key LIKE ?')
            .all(`${prefix}%`) as { key: string }[];
        const listKeys = this.db
            .prepare('SELECT DISTINCT key FROM list_store WHERE key LIKE ?')
            .all(`${prefix}%`) as { key: string }[];

        const allKeys = new Set([
            ...kvKeys.map((row) => row.key),
            ...listKeys.map((row) => row.key),
        ]);

        return Array.from(allKeys).sort();
    }

    async append<T>(key: string, item: T): Promise<void> {
        this.checkConnection();
        const serialized = JSON.stringify(item);
        this.db
            .prepare('INSERT INTO list_store (key, value, sequence) VALUES (?, ?, ?)')
            .run(key, serialized, Date.now());
    }

    async getRange<T>(key: string, start: number, count: number): Promise<T[]> {
        this.checkConnection();
        const rows = this.db
            .prepare(
                'SELECT value FROM list_store WHERE key = ? ORDER BY sequence DESC LIMIT ? OFFSET ?'
            )
            .all(key, count, start) as { value: string }[];

        return rows.map((row) => JSON.parse(row.value));
    }

    // Schema management
    private createTables(): void {
        // Key-value store for settings, user data, etc.
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

        // List storage for messages, activities, etc.
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        item TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

        // Indexes for performance
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_kv_key ON kv(key)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_lists_key ON lists(key)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_lists_created_at ON lists(key, created_at)');
    }

    private checkConnection(): void {
        if (!this.db) {
            throw new Error('SQLiteBackend not connected');
        }
    }

    // Maintenance operations
    async vacuum(): Promise<void> {
        this.checkConnection();
        this.db.exec('VACUUM');
    }

    async getStats(): Promise<{
        kvCount: number;
        listCount: number;
        dbSize: number;
    }> {
        this.checkConnection();

        const kvCount = this.db.prepare('SELECT COUNT(*) as count FROM kv_store').get() as {
            count: number;
        };
        const listCount = this.db.prepare('SELECT COUNT(*) as count FROM list_store').get() as {
            count: number;
        };
        const dbSize = this.db
            .prepare(
                'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()'
            )
            .get() as { size: number };

        return {
            kvCount: kvCount.count,
            listCount: listCount.count,
            dbSize: dbSize.size,
        };
    }
}
