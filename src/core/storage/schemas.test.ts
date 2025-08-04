import { describe, it, expect } from 'vitest';
import {
    StorageSchema,
    type StorageConfig,
    type InMemoryBackendConfig,
    type RedisBackendConfig,
    type SqliteBackendConfig,
    type PostgresBackendConfig,
    type BackendConfig,
} from './schemas.js';

describe('StorageSchema', () => {
    describe('Backend Configuration - In-Memory', () => {
        it('should accept minimal in-memory backend config', () => {
            const config = { type: 'in-memory' as const };
            const result = StorageSchema.parse({
                cache: config,
                database: config,
            });

            expect(result.cache.type).toBe('in-memory');
            expect(result.database.type).toBe('in-memory');
        });

        it('should accept in-memory backend with optional connection options', () => {
            const config: InMemoryBackendConfig = {
                type: 'in-memory',
                maxConnections: 10,
                idleTimeoutMillis: 5000,
                connectionTimeoutMillis: 3000,
            };

            expect(() =>
                StorageSchema.parse({
                    cache: config,
                    database: config,
                })
            ).not.toThrow();
        });
    });

    describe('Backend Configuration - Redis', () => {
        it('should accept Redis backend with URL', () => {
            const config: RedisBackendConfig = {
                type: 'redis',
                url: 'redis://localhost:6379',
            };

            expect(() =>
                StorageSchema.parse({
                    cache: config,
                    database: { type: 'in-memory' },
                })
            ).not.toThrow();
        });

        it('should accept Redis backend with host/port', () => {
            const config: RedisBackendConfig = {
                type: 'redis',
                host: 'localhost',
                port: 6379,
                password: 'secret',
                database: 0,
            };

            expect(() =>
                StorageSchema.parse({
                    cache: config,
                    database: { type: 'in-memory' },
                })
            ).not.toThrow();
        });

        it('should reject Redis backend without URL or host', () => {
            const config = { type: 'redis' };

            expect(() =>
                StorageSchema.parse({
                    cache: config,
                    database: { type: 'in-memory' },
                })
            ).toThrow();
        });
    });

    describe('Backend Configuration - SQLite', () => {
        it('should accept SQLite backend with path', () => {
            const config: SqliteBackendConfig = {
                type: 'sqlite',
                path: '/tmp/saiki.db',
            };

            expect(() =>
                StorageSchema.parse({
                    cache: { type: 'in-memory' },
                    database: config,
                })
            ).not.toThrow();
        });

        it('should accept SQLite backend with database filename', () => {
            const config: SqliteBackendConfig = {
                type: 'sqlite',
                database: 'saiki.db',
            };

            expect(() =>
                StorageSchema.parse({
                    cache: { type: 'in-memory' },
                    database: config,
                })
            ).not.toThrow();
        });

        it('should accept SQLite backend with minimal config', () => {
            const config = { type: 'sqlite' as const };

            expect(() =>
                StorageSchema.parse({
                    cache: { type: 'in-memory' },
                    database: config,
                })
            ).not.toThrow();
        });
    });

    describe('Backend Configuration - PostgreSQL', () => {
        it('should accept PostgreSQL backend with URL', () => {
            const config: PostgresBackendConfig = {
                type: 'postgres',
                url: 'postgresql://user:pass@localhost:5432/saiki',
            };

            expect(() =>
                StorageSchema.parse({
                    cache: { type: 'in-memory' },
                    database: config,
                })
            ).not.toThrow();
        });

        it('should accept PostgreSQL backend with connection string', () => {
            const config: PostgresBackendConfig = {
                type: 'postgres',
                connectionString: 'postgresql://user:pass@localhost:5432/saiki',
            };

            expect(() =>
                StorageSchema.parse({
                    cache: { type: 'in-memory' },
                    database: config,
                })
            ).not.toThrow();
        });

        it('should accept PostgreSQL backend with host/port details', () => {
            const config: PostgresBackendConfig = {
                type: 'postgres',
                host: 'localhost',
                port: 5432,
                database: 'saiki',
                password: 'secret',
            };

            expect(() =>
                StorageSchema.parse({
                    cache: { type: 'in-memory' },
                    database: config,
                })
            ).not.toThrow();
        });

        it('should reject PostgreSQL backend without connection info', () => {
            const config = { type: 'postgres' };

            expect(() =>
                StorageSchema.parse({
                    cache: { type: 'in-memory' },
                    database: config,
                })
            ).toThrow();
        });
    });

    describe('Discriminated Union Validation', () => {
        it('should reject invalid backend type', () => {
            const config = { type: 'invalid-backend' };

            expect(() =>
                StorageSchema.parse({
                    cache: config,
                    database: { type: 'in-memory' },
                })
            ).toThrow();
        });

        it('should provide clear error messages for invalid discriminator', () => {
            const config = { type: 'nosql' };

            try {
                StorageSchema.parse({
                    cache: config,
                    database: { type: 'in-memory' },
                });
            } catch (error: any) {
                expect(error.message).toContain('Invalid backend type');
            }
        });
    });

    describe('Connection Pool Options', () => {
        it('should validate positive connection limits', () => {
            expect(() =>
                StorageSchema.parse({
                    cache: { type: 'in-memory', maxConnections: -1 },
                    database: { type: 'in-memory' },
                })
            ).toThrow();

            expect(() =>
                StorageSchema.parse({
                    cache: { type: 'in-memory', maxConnections: 0 },
                    database: { type: 'in-memory' },
                })
            ).toThrow();

            expect(() =>
                StorageSchema.parse({
                    cache: { type: 'in-memory', maxConnections: 10 },
                    database: { type: 'in-memory' },
                })
            ).not.toThrow();
        });

        it('should validate positive timeout values', () => {
            expect(() =>
                StorageSchema.parse({
                    cache: { type: 'in-memory', idleTimeoutMillis: -1 },
                    database: { type: 'in-memory' },
                })
            ).toThrow();

            expect(() =>
                StorageSchema.parse({
                    cache: { type: 'in-memory', connectionTimeoutMillis: 0 },
                    database: { type: 'in-memory' },
                })
            ).toThrow();

            expect(() =>
                StorageSchema.parse({
                    cache: { type: 'in-memory', idleTimeoutMillis: 5000 },
                    database: { type: 'in-memory' },
                })
            ).not.toThrow();
        });
    });

    describe('Strict Validation', () => {
        it('should reject extra fields on backend configs', () => {
            const configWithExtra = {
                type: 'in-memory',
                unknownField: 'should fail',
            };

            expect(() =>
                StorageSchema.parse({
                    cache: configWithExtra,
                    database: { type: 'in-memory' },
                })
            ).toThrow();
        });

        it('should reject extra fields on storage config', () => {
            const configWithExtra = {
                cache: { type: 'in-memory' },
                database: { type: 'in-memory' },
                unknownField: 'should fail',
            };

            expect(() => StorageSchema.parse(configWithExtra)).toThrow();
        });
    });

    describe('Type Safety', () => {
        it('should have correct type inference for different backends', () => {
            const config: StorageConfig = {
                cache: { type: 'redis', url: 'redis://localhost:6379' },
                database: { type: 'postgres', url: 'postgresql://localhost/saiki' },
            };

            const result = StorageSchema.parse(config);
            expect(result.cache.type).toBe('redis');
            expect(result.database.type).toBe('postgres');
        });

        it('should handle backend config type unions correctly', () => {
            const backends: BackendConfig[] = [
                { type: 'in-memory' },
                { type: 'redis', url: 'redis://localhost:6379' },
                { type: 'sqlite', path: '/tmp/test.db' },
                { type: 'postgres', url: 'postgresql://localhost/test' },
            ];

            backends.forEach((backend) => {
                expect(() =>
                    StorageSchema.parse({
                        cache: backend,
                        database: { type: 'in-memory' },
                    })
                ).not.toThrow();
            });
        });
    });

    describe('Real-world Scenarios', () => {
        it('should handle typical development configuration', () => {
            const devConfig: StorageConfig = {
                cache: { type: 'in-memory' },
                database: { type: 'sqlite', path: './dev.db' },
            };

            const result = StorageSchema.parse(devConfig);
            expect(result).toEqual(devConfig);
        });

        it('should handle production configuration with Redis cache', () => {
            const prodConfig: StorageConfig = {
                cache: {
                    type: 'redis',
                    url: 'redis://cache.example.com:6379',
                    maxConnections: 50,
                    idleTimeoutMillis: 30000,
                },
                database: {
                    type: 'postgres',
                    url: 'postgresql://user:pass@db.example.com:5432/saiki',
                    maxConnections: 20,
                    connectionTimeoutMillis: 5000,
                },
            };

            const result = StorageSchema.parse(prodConfig);
            expect(result).toEqual(prodConfig);
        });

        it('should handle high-availability configuration', () => {
            const haConfig: StorageConfig = {
                cache: {
                    type: 'redis',
                    host: 'redis-cluster.example.com',
                    port: 6379,
                    password: 'cluster-secret',
                    maxConnections: 100,
                },
                database: {
                    type: 'postgres',
                    host: 'postgres-primary.example.com',
                    port: 5432,
                    database: 'saiki_prod',
                    password: 'db-secret',
                    maxConnections: 50,
                },
            };

            const result = StorageSchema.parse(haConfig);
            expect(result).toEqual(haConfig);
        });
    });
});
