---
sidebar_position: 6
---

# Building a Talk2PDF Agent

In this tutorial, we'll build a custom AI agent that can parse PDF documents and make them consumable by LLMs. We'll walk through the process step by step, explaining what we're doing and why.

## What We're Building

We want to create an agent that can:
- Parse PDF files and extract text content
- Search for specific terms within documents  
- Provide intelligent analysis and summaries
- Handle errors gracefully

The key insight is that we'll separate concerns: a custom MCP server handles the low-level PDF parsing, while the agent provides intelligent interaction.

## Step 1: Understanding the Architecture

Our agent will have two main components:
1. **MCP Server**: Handles PDF parsing operations (tools)
2. **Agent**: Provides intelligent analysis and user interaction

This separation allows the agent to focus on understanding and analysis while the MCP server handles the technical PDF processing.

## Step 2: Setting Up the Project

First, we create our directory structure:

```bash
mkdir -p agents/talk2pdf-agent/pdf-server/src
cd agents/talk2pdf-agent
```

The `pdf-server` subdirectory will contain our custom MCP server, keeping the code organized.

## Step 3: Creating the MCP Server

The MCP server is the workhorse that handles PDF parsing. We need to install the right dependencies:

```bash
cd pdf-server
npm init -y
npm install @modelcontextprotocol/sdk pdf-parse-debugging-disabled zod
npm install --save-dev typescript ts-node @types/node @types/pdf-parse
```

**Why these packages?**
- `@modelcontextprotocol/sdk`: The MCP framework
- `pdf-parse-debugging-disabled`: PDF parsing without debug issues
- `zod`: Type validation for our tool parameters
- `ts-node`: Run TypeScript directly without compilation

## Step 4: Building the PDF Parser

Now we create our MCP server. The key insight is that we need two tools:

1. **`parse_pdf`**: Extract all text and metadata from a PDF
2. **`extract_section`**: Search for specific content within a PDF

Here's the core structure:

```typescript
// pdf-server/src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';
import pdf from 'pdf-parse-debugging-disabled';

class Talk2PDFMCPServer {
  private server: McpServer;

  constructor() {
    this.server = new McpServer(
      { name: 'talk2pdf', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {} } }
    );
    this.registerTools();
  }

  private registerTools(): void {
    // We'll add our tools here
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Talk2PDF MCP Server started');
  }
}

// Start the server
const server = new Talk2PDFMCPServer();
server.start().catch((error) => {
  logger.error(`Failed to start Talk2PDF MCP Server: ${error}`);
  process.exit(1);
});
```

**What's happening here?**
- We create an MCP server with the name 'talk2pdf'
- We'll register tools that the agent can call
- The server communicates via stdio (standard input/output)

## Step 5: Adding the Parse Tool

The `parse_pdf` tool is our main workhorse. It needs to:
1. Validate the file exists and is a PDF
2. Extract text content
3. Extract metadata (page count, title, author, etc.)
4. Return structured data

```typescript
this.server.tool(
  'parse_pdf',
  'Parse a PDF file and extract its text content and metadata',
  {
    filePath: z.string().describe('Path to the PDF file'),
    includeMetadata: z.boolean().optional().default(true),
    maxPages: z.number().optional(),
  },
  async ({ filePath, includeMetadata = true, maxPages }) => {
    // Validate file exists and is PDF
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Parse PDF and extract content
    const dataBuffer = readFileSync(filePath);
    const pdfData = await pdf(dataBuffer, { max: maxPages });
    
    // Extract metadata
    const metadata = {
      pageCount: pdfData.numpages,
      title: pdfData.info?.Title,
      author: pdfData.info?.Author,
      fileSize: dataBuffer.length,
      fileName: filePath.split('/').pop() || filePath,
    };
    
    // Return structured result
    const result = {
      content: pdfData.text,
      metadata: includeMetadata ? metadata : {
        pageCount: metadata.pageCount,
        fileSize: metadata.fileSize,
        fileName: metadata.fileName,
      },
    };
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);
```

**Key points:**
- We validate the file first (safety)
- We use `pdf-parse-debugging-disabled` to avoid common issues
- We return JSON so the agent can easily parse the result

## Step 6: Adding the Search Tool

The `extract_section` tool allows searching within PDFs:

```typescript
this.server.tool(
  'extract_section',
  'Extract specific content from a PDF document',
  {
    filePath: z.string().describe('Path to the PDF file'),
    searchTerm: z.string().optional().describe('Search term to find'),
  },
  async ({ filePath, searchTerm }) => {
    // Validate file exists and is PDF
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const fileExtension = extname(filePath).toLowerCase();
    if (fileExtension !== '.pdf') {
      throw new Error(`File is not a PDF: ${filePath}`);
    }
    
    // Parse the PDF
    const pdfData = await pdf(readFileSync(filePath));
    
    let extractedContent = pdfData.text;
    
    // If search term provided, filter content
    if (searchTerm) {
      const lines = extractedContent.split('\n');
      const matchingLines = lines.filter(line => 
        line.toLowerCase().includes(searchTerm.toLowerCase())
      );
      extractedContent = matchingLines.join('\n');
    }
    
    const result = {
      fileName: filePath.split('/').pop() || filePath,
      totalPages: pdfData.numpages,
      extractedContent,
      searchTerm: searchTerm || null,
      contentLength: extractedContent.length,
    };
    
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);
```

**What this does:**
- Parses the PDF to get all text
- If a search term is provided, filters lines containing that term
- Returns the filtered content

## Step 7: Configuring the Agent

Now we create the agent configuration that ties everything together:

```yaml
# agents/talk2pdf-agent/talk2pdf-agent.yml
mcpServers:
  talk2pdf:
    type: stdio
    command: npx
    args:
      - ts-node
      - ./agents/talk2pdf-agent/pdf-server/src/index.ts
    timeout: 30000
    connectionMode: strict

systemPrompt:
  contributors:
    - id: primary
      type: static
      priority: 0
      content: |
        You are a Talk2PDF Agent. You can parse PDF files, extract their text, metadata, and provide summaries or extract specific sections for LLM consumption.
        
        ## Your Capabilities
        - Parse PDF files and extract all text content and metadata
        - Extract specific sections or search for terms within a PDF
        - Provide intelligent analysis, summarization, and insights based on the extracted content
        - Handle errors gracefully and provide clear feedback
        
        Always ask for the file path if not provided. If a file is not a PDF or does not exist, inform the user.

llm:
  provider: openai
  model: gpt-4o-mini
  apiKey: $OPENAI_API_KEY
```

**Key configuration points:**
- The agent connects to our MCP server via stdio
- We use `npx ts-node` to run TypeScript directly (no build step)
- The system prompt tells the agent what it can do and how to behave

## Step 8: Testing the Agent

Now we can test our agent:

```bash
# From the project root
saiki --agent ./agents/talk2pdf-agent/talk2pdf-agent.yml
```

Once started, try these interactions:

**Parse and summarize:**
```
Parse the PDF at /path/to/document.pdf and summarize the key points
```

**Search for content:**
```
Find all mentions of "budget" in the financial report at /path/to/report.pdf
```

## How It All Works Together

1. **User asks a question** about a PDF
2. **Agent understands** what the user wants
3. **Agent calls the appropriate tool** (`parse_pdf` or `extract_section`)
4. **MCP server processes** the PDF and returns structured data
5. **Agent analyzes** the returned data and provides intelligent response
6. **User gets** a helpful, contextual answer

## What We've Accomplished

We've created a complete PDF parsing agent that demonstrates:

- **Separation of concerns**: Tools handle technical operations, agent handles intelligence
- **Error handling**: Proper validation and graceful error messages
- **Flexible architecture**: Easy to extend with more tools
- **Zero-build development**: TypeScript runs directly with `ts-node`

The agent can now parse PDFs, extract content, search for terms, and provide intelligent analysis - all through natural language interaction.

## Next Steps

This pattern can be extended to:
- Add more document formats (DOCX, TXT)
- Implement document comparison
- Add OCR for scanned PDFs
- Create document classification

The key insight is that by separating the technical operations (MCP server) from the intelligence (agent), we create a flexible, maintainable system that's easy to extend and debug. 