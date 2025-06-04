import { dirname } from 'path';
import { mkdirSync } from 'fs';
import type { DatabaseBackend } from './database-backend.js';
import { StoragePathResolver } from '../path-resolver.js';
import { logger } from '../../logger/index.js';
import type { BackendConfig } from './types.js';
import { isSaikiProject } from '../../utils/path.js';
import * as path from 'path';
import { homedir } from 'os';

// Dynamic import for better-sqlite3
let Database: any;

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
    private db: any; // Database.Database
    private dbPath: string;
    private config: SQLiteBackendConfig;

    constructor(config: SQLiteBackendConfig) {
        this.config = config;
        // Path will be resolved in connect() method
        this.dbPath = '';
    }

    private async resolveDefaultPath(dbName: string): Promise<string> {
        // Use the enhanced path utilities for robust detection
        const isInSaikiProject = await isSaikiProject();

        const storageDir = isInSaikiProject
            ? path.join(process.cwd(), '.saiki', 'database')
            : path.join(homedir(), '.saiki', 'database');

        const finalPath = path.join(storageDir, dbName);

        logger.info(`SQLite auto-detected ${isInSaikiProject ? 'local' : 'global'} storage`);
        logger.info(`SQLite storage directory: ${storageDir}`);
        logger.debug(`SQLite database file: ${finalPath}`);

        return finalPath;
    }

    private initializeTables(): void {
        logger.debug('SQLite initializing database schema...');

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

        logger.debug(
            'SQLite database schema initialized: kv_store, list_store tables with indexes'
        );
    }

    async connect(): Promise<void> {
        // Dynamic import of better-sqlite3
        if (!Database) {
            try {
                const module = await import('better-sqlite3');
                Database = module.default;
            } catch (error) {
                throw new Error(
                    `Failed to import better-sqlite3: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }

        // Initialize database path - use custom path if provided, otherwise auto-detect
        if (this.config.path) {
            this.dbPath = this.config.path;
            logger.info(`SQLite using custom path: ${this.dbPath}`);
        } else {
            this.dbPath = await this.resolveDefaultPath(this.config.database || 'saiki.db');
        }

        // Ensure directory exists
        const dir = dirname(this.dbPath);
        logger.debug(`SQLite ensuring directory exists: ${dir}`);
        try {
            mkdirSync(dir, { recursive: true });
        } catch (error) {
            // Directory might already exist, that's fine
            logger.debug(`Directory creation result: ${error ? 'exists' : 'created'}`);
        }

        // Initialize SQLite database
        logger.debug(`SQLite initializing database with config:`, {
            readonly: this.config.readonly || false,
            fileMustExist: this.config.fileMustExist || false,
            timeout: this.config.timeout || 5000,
        });

        this.db = new Database(this.dbPath, {
            readonly: this.config.readonly || false,
            fileMustExist: this.config.fileMustExist || false,
            timeout: this.config.timeout || 5000,
            verbose: this.config.verbose
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
        logger.debug('SQLite enabled WAL mode for better concurrency');

        // Create tables if they don't exist
        this.initializeTables();

        logger.info(`✅ SQLite backend successfully connected to: ${this.dbPath}`);
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
                'SELECT value FROM list_store WHERE key = ? ORDER BY sequence ASC LIMIT ? OFFSET ?'
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
