import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { FileContributor } from './contributors.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { DynamicContributorContext } from './types.js';

describe('FileContributor', () => {
    const testDir = join(process.cwd(), 'test-files');
    const mockContext: DynamicContributorContext = {
        mcpManager: {} as any,
    };

    beforeEach(async () => {
        // Create test directory and files
        await mkdir(testDir, { recursive: true });

        // Create test files
        await writeFile(
            join(testDir, 'test1.md'),
            '# Test Document 1\n\nThis is the first test document.'
        );
        await writeFile(join(testDir, 'test2.txt'), 'This is a plain text file.\nSecond line.');
        await writeFile(join(testDir, 'large.md'), 'x'.repeat(200000)); // Large file for testing
        await writeFile(join(testDir, 'invalid.json'), '{"key": "value"}'); // Invalid file type
    });

    afterEach(async () => {
        // Clean up test files
        await rm(testDir, { recursive: true, force: true });
    });

    test('should read single markdown file with default options', async () => {
        const contributor = new FileContributor('test', 0, [join(testDir, 'test1.md')]);
        const result = await contributor.getContent(mockContext);

        expect(result).toContain('<fileContext>');
        expect(result).toContain('test-files/test1.md');
        expect(result).toContain('# Test Document 1');
        expect(result).toContain('This is the first test document.');
        expect(result).toContain('</fileContext>');
    });

    test('should read multiple files with separator', async () => {
        const contributor = new FileContributor(
            'test',
            0,
            [join(testDir, 'test1.md'), join(testDir, 'test2.txt')],
            {
                separator: '\n\n===\n\n',
            }
        );
        const result = await contributor.getContent(mockContext);

        expect(result).toContain('# Test Document 1');
        expect(result).toContain('This is a plain text file.');
        expect(result).toContain('===');
    });

    test('should handle missing files with skip mode', async () => {
        const contributor = new FileContributor(
            'test',
            0,
            [join(testDir, 'missing.md'), join(testDir, 'test1.md')],
            {
                errorHandling: 'skip',
            }
        );
        const result = await contributor.getContent(mockContext);

        expect(result).toContain('# Test Document 1');
        expect(result).not.toContain('missing.md');
    });

    test('should handle missing files with placeholder mode', async () => {
        const contributor = new FileContributor(
            'test',
            0,
            [join(testDir, 'missing.md'), join(testDir, 'test1.md')],
            {
                errorHandling: 'placeholder',
            }
        );
        const result = await contributor.getContent(mockContext);

        expect(result).toContain('# Test Document 1');
        expect(result).toContain('test-files/missing.md could not be read:');
    });

    test('should throw error for missing files with error mode', async () => {
        const contributor = new FileContributor('test', 0, [join(testDir, 'missing.md')], {
            errorHandling: 'error',
        });

        await expect(contributor.getContent(mockContext)).rejects.toThrow('Failed to read file');
    });

    test('should skip large files with skip mode', async () => {
        const contributor = new FileContributor(
            'test',
            0,
            [join(testDir, 'large.md'), join(testDir, 'test1.md')],
            {
                maxFileSize: 1000,
                errorHandling: 'skip',
            }
        );
        const result = await contributor.getContent(mockContext);

        expect(result).toContain('# Test Document 1');
        expect(result).not.toContain('large.md');
    });

    test('should handle invalid file types with placeholder mode', async () => {
        const contributor = new FileContributor(
            'test',
            0,
            [join(testDir, 'invalid.json'), join(testDir, 'test1.md')],
            {
                errorHandling: 'placeholder',
            }
        );
        const result = await contributor.getContent(mockContext);

        expect(result).toContain('# Test Document 1');
        expect(result).toContain('test-files/invalid.json skipped: not a .md or .txt file');
    });

    test('should exclude filenames when configured', async () => {
        const contributor = new FileContributor('test', 0, [join(testDir, 'test1.md')], {
            includeFilenames: false,
        });
        const result = await contributor.getContent(mockContext);

        expect(result).toContain('# Test Document 1');
        expect(result).not.toContain('test-files/test1.md');
    });

    test('should include metadata when configured', async () => {
        const contributor = new FileContributor('test', 0, [join(testDir, 'test1.md')], {
            includeMetadata: true,
        });
        const result = await contributor.getContent(mockContext);

        expect(result).toContain('*File size:');
        expect(result).toContain('Modified:');
    });

    test('should return empty context when no files can be loaded', async () => {
        const contributor = new FileContributor('test', 0, [join(testDir, 'missing.md')], {
            errorHandling: 'skip',
        });
        const result = await contributor.getContent(mockContext);

        expect(result).toBe('<fileContext>No files could be loaded</fileContext>');
    });
});
