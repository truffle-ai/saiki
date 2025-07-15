#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';
import pdf from 'pdf-parse-debugging-disabled';

// TypeScript module declaration for missing types
// @ts-ignore
declare module 'pdf-parse-debugging-disabled';

interface ParsedDocument {
    content: string;
    metadata: {
        pageCount: number;
        title?: string;
        author?: string;
        subject?: string;
        keywords?: string[];
        creationDate?: string;
        modificationDate?: string;
        fileSize: number;
        fileName: string;
    };
    summary?: string;
}

class DocumentParserMCPServer {
    private server: McpServer;

    constructor() {
        this.server = new McpServer(
            { name: 'talk2pdf', version: '1.0.0' },
            {
                capabilities: {
                    tools: {},
                    resources: {},
                },
            }
        );

        this.registerTools();
    }

    private registerTools(): void {
        // Tool to parse PDF documents
        this.server.tool(
            'parse_pdf',
            'Parse a PDF file and extract its text content and metadata for LLM consumption',
            {
                filePath: z.string().describe('Path to the PDF file to parse'),
                includeMetadata: z
                    .boolean()
                    .optional()
                    .default(true)
                    .describe('Whether to include document metadata'),
                maxPages: z
                    .number()
                    .optional()
                    .describe('Maximum number of pages to parse (default: all pages)'),
            },
            async ({ filePath, includeMetadata = true, maxPages }) => {
                try {
                    // Validate file exists and is a PDF
                    if (!existsSync(filePath)) {
                        throw new Error(`File not found: ${filePath}`);
                    }

                    const fileExtension = extname(filePath).toLowerCase();
                    if (fileExtension !== '.pdf') {
                        throw new Error(`File is not a PDF: ${filePath}`);
                    }

                    // Read and parse the PDF
                    const dataBuffer = readFileSync(filePath);
                    const pdfData = await pdf(dataBuffer, {
                        max: maxPages, // Limit pages if specified
                    });

                    // Extract metadata
                    const metadata = {
                        pageCount: pdfData.numpages,
                        title: pdfData.info?.Title,
                        author: pdfData.info?.Author,
                        subject: pdfData.info?.Subject,
                        keywords: pdfData.info?.Keywords
                            ? pdfData.info.Keywords.split(',').map((k: string) => k.trim())
                            : undefined,
                        creationDate: pdfData.info?.CreationDate,
                        modificationDate: pdfData.info?.ModDate,
                        fileSize: dataBuffer.length,
                        fileName: filePath.split('/').pop() || filePath,
                    };

                    // Create the parsed document object
                    const parsedDocument: ParsedDocument = {
                        content: pdfData.text,
                        metadata: includeMetadata
                            ? metadata
                            : {
                                  pageCount: metadata.pageCount,
                                  fileSize: metadata.fileSize,
                                  fileName: metadata.fileName,
                              },
                    };

                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(parsedDocument, null, 2),
                            },
                        ],
                    };
                } catch (error) {
                    throw new Error(
                        `Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
        );

        // Tool to extract specific sections from PDF
        this.server.tool(
            'extract_section',
            'Extract a specific section or range of pages from a PDF document',
            {
                filePath: z.string().describe('Path to the PDF file'),
                startPage: z
                    .number()
                    .optional()
                    .describe('Starting page number (1-based, default: 1)'),
                endPage: z
                    .number()
                    .optional()
                    .describe('Ending page number (1-based, default: last page)'),
                searchTerm: z.string().optional().describe('Search term to find specific content'),
            },
            async ({ filePath, startPage, endPage, searchTerm }) => {
                try {
                    // Parse the document directly
                    if (!existsSync(filePath)) {
                        throw new Error(`File not found: ${filePath}`);
                    }

                    const fileExtension = extname(filePath).toLowerCase();
                    if (fileExtension !== '.pdf') {
                        throw new Error(`File is not a PDF: ${filePath}`);
                    }

                    const dataBuffer = readFileSync(filePath);
                    const pdfData = await pdf(dataBuffer);

                    let extractedContent = pdfData.text;

                    // If search term is provided, find relevant sections
                    if (searchTerm) {
                        const lines = extractedContent.split('\n');
                        const matchingLines = lines.filter((line: string) =>
                            line.toLowerCase().includes(searchTerm.toLowerCase())
                        );
                        extractedContent = matchingLines.join('\n');
                    }

                    // Note: For page-based extraction, we'd need more sophisticated PDF parsing
                    // This is a simplified version that works with the text content
                    const result = {
                        fileName: filePath.split('/').pop() || filePath,
                        totalPages: pdfData.numpages,
                        extractedContent,
                        searchTerm: searchTerm || null,
                        pageRange: startPage && endPage ? `${startPage}-${endPage}` : 'all',
                        contentLength: extractedContent.length,
                    };

                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(result, null, 2),
                            },
                        ],
                    };
                } catch (error) {
                    throw new Error(
                        `Failed to extract section: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
        );
    }

    async start(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Talk2PDF MCP Server started');
    }
}

// Start the server
const server = new DocumentParserMCPServer();
server.start().catch((error) => {
    console.error('Failed to start Talk2PDF MCP Server:', error);
    process.exit(1);
});
