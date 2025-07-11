import { SystemPromptContributor, DynamicContributorContext } from './types.js';
import { readFile, stat } from 'fs/promises';
import { resolve, extname } from 'path';

export class StaticContributor implements SystemPromptContributor {
    constructor(
        public id: string,
        public priority: number,
        private content: string
    ) {}

    async getContent(_context: DynamicContributorContext): Promise<string> {
        return this.content;
    }
}

export class DynamicContributor implements SystemPromptContributor {
    constructor(
        public id: string,
        public priority: number,
        private promptGenerator: (context: DynamicContributorContext) => Promise<string>
    ) {}

    async getContent(context: DynamicContributorContext): Promise<string> {
        return this.promptGenerator(context);
    }
}

export interface FileContributorOptions {
    includeFilenames?: boolean | undefined;
    separator?: string | undefined;
    errorHandling?: 'skip' | 'error' | undefined;
    maxFileSize?: number | undefined;
    includeMetadata?: boolean | undefined;
}

export class FileContributor implements SystemPromptContributor {
    constructor(
        public id: string,
        public priority: number,
        private files: string[],
        private options: FileContributorOptions = {}
    ) {}

    async getContent(_context: DynamicContributorContext): Promise<string> {
        const {
            includeFilenames = true,
            separator = '\n\n---\n\n',
            errorHandling = 'skip',
            maxFileSize = 100000,
            includeMetadata = false,
        } = this.options;

        const fileParts: string[] = [];

        for (const filePath of this.files) {
            try {
                // Resolve relative paths
                const resolvedPath = resolve(filePath);

                // Check if file is .md or .txt
                const ext = extname(resolvedPath).toLowerCase();
                if (ext !== '.md' && ext !== '.txt') {
                    if (errorHandling === 'error') {
                        throw new Error(`File ${filePath} is not a .md or .txt file`);
                    }
                    continue;
                }

                // Check file size
                const stats = await stat(resolvedPath);
                if (stats.size > maxFileSize) {
                    if (errorHandling === 'error') {
                        throw new Error(
                            `File ${filePath} exceeds maximum size of ${maxFileSize} bytes`
                        );
                    }
                    continue;
                }

                // Read file content (always utf-8)
                const content = await readFile(resolvedPath, { encoding: 'utf-8' });

                // Build file part
                let filePart = '';

                if (includeFilenames) {
                    filePart += `## ${filePath}\n\n`;
                }

                if (includeMetadata) {
                    filePart += `*File size: ${stats.size} bytes, Modified: ${stats.mtime.toISOString()}*\n\n`;
                }

                filePart += content;

                fileParts.push(filePart);
            } catch (error: any) {
                if (errorHandling === 'error') {
                    throw new Error(`Failed to read file ${filePath}: ${error.message || error}`);
                }
                // 'skip' mode - do nothing, continue to next file
            }
        }

        if (fileParts.length === 0) {
            return '<fileContext>No files could be loaded</fileContext>';
        }

        const combinedContent = fileParts.join(separator);
        return `<fileContext>\n${combinedContent}\n</fileContext>`;
    }
}
