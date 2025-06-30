/**
 * MCP Server Registry
 *
 * This registry contains predefined MCP server configurations that users can
 * interactively select from during the configuration process. Contributors
 * can easily add new MCP servers by adding entries to this registry.
 */

import type { McpServerConfig } from './schemas.js';

export interface McpServerRegistryEntry {
    /** Unique identifier for the server */
    id: string;
    /** Display name for the server */
    name: string;
    /** Brief description of what this server does */
    description: string;
    /** Category for grouping servers */
    category: string;
    /** Server configuration */
    config: McpServerConfig;
    /** Optional setup instructions or requirements */
    setupInstructions?: string;
    /** Required environment variables */
    requiredEnvVars?: string[];
    /** Optional environment variables */
    optionalEnvVars?: string[];
    /** Whether this server requires special setup */
    requiresSetup?: boolean;
    /** Tags for filtering and searching */
    tags: string[];
}

/**
 * MCP Server Registry containing all available predefined servers
 */
export const MCP_SERVER_REGISTRY: Record<string, McpServerRegistryEntry> = {
    filesystem: {
        id: 'filesystem',
        name: 'Filesystem',
        description: 'Read, write, and manage files on your local filesystem',
        category: 'Development',
        config: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
            connectionMode: 'strict',
        },
        setupInstructions: 'No setup required. Works out of the box.',
        tags: ['files', 'local', 'development', 'essential'],
    },

    puppeteer: {
        id: 'puppeteer',
        name: 'Puppeteer (Web Browser)',
        description: 'Automate web browsing, scraping, and interaction with websites',
        category: 'Web',
        config: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@truffle-ai/puppeteer-server'],
            connectionMode: 'lenient',
        },
        setupInstructions: 'Automatically installs Puppeteer server. No additional setup required.',
        tags: ['web', 'browser', 'automation', 'scraping'],
    },

    github: {
        id: 'github',
        name: 'GitHub',
        description: 'Interact with GitHub repositories, issues, and pull requests',
        category: 'Development',
        config: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {
                GITHUB_PERSONAL_ACCESS_TOKEN: '$GITHUB_PERSONAL_ACCESS_TOKEN',
            },
            connectionMode: 'lenient',
        },
        setupInstructions:
            'Requires a GitHub Personal Access Token. Create one at: https://github.com/settings/tokens',
        requiredEnvVars: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
        requiresSetup: true,
        tags: ['git', 'github', 'development', 'repositories'],
    },

    terminal: {
        id: 'terminal',
        name: 'Terminal',
        description: 'Execute shell commands and interact with the terminal',
        category: 'System',
        config: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-terminal'],
            connectionMode: 'lenient',
        },
        setupInstructions: 'No setup required. Provides safe terminal access.',
        tags: ['terminal', 'shell', 'system', 'commands'],
    },

    sqlite: {
        id: 'sqlite',
        name: 'SQLite Database',
        description: 'Query and manage SQLite databases',
        category: 'Database',
        config: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-sqlite'],
            connectionMode: 'lenient',
        },
        setupInstructions: 'Provide database path as needed for your specific use case.',
        tags: ['database', 'sql', 'sqlite', 'data'],
    },

    postgres: {
        id: 'postgres',
        name: 'PostgreSQL Database',
        description: 'Connect and query PostgreSQL databases',
        category: 'Database',
        config: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-postgres'],
            env: {
                POSTGRES_CONNECTION_STRING: '$POSTGRES_CONNECTION_STRING',
            },
            connectionMode: 'lenient',
        },
        setupInstructions:
            'Requires PostgreSQL connection string. Format: postgresql://user:password@host:port/database',
        requiredEnvVars: ['POSTGRES_CONNECTION_STRING'],
        requiresSetup: true,
        tags: ['database', 'sql', 'postgresql', 'data'],
    },

    everart: {
        id: 'everart',
        name: 'EverArt',
        description: 'Generate and manipulate images using EverArt API',
        category: 'AI Services',
        config: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-everart'],
            env: {
                EVERART_API_KEY: '$EVERART_API_KEY',
            },
            connectionMode: 'lenient',
        },
        setupInstructions: 'Requires EverArt API key. Sign up at: https://everart.ai/',
        requiredEnvVars: ['EVERART_API_KEY'],
        requiresSetup: true,
        tags: ['ai', 'images', 'generation', 'art'],
    },

    brave_search: {
        id: 'brave_search',
        name: 'Brave Search',
        description: 'Search the web using Brave Search API',
        category: 'Web',
        config: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-brave-search'],
            env: {
                BRAVE_API_KEY: '$BRAVE_API_KEY',
            },
            connectionMode: 'lenient',
        },
        setupInstructions:
            'Requires Brave Search API key. Get one at: https://api.search.brave.com/',
        requiredEnvVars: ['BRAVE_API_KEY'],
        requiresSetup: true,
        tags: ['search', 'web', 'api', 'information'],
    },

    google_drive: {
        id: 'google_drive',
        name: 'Google Drive',
        description: 'Access and manage Google Drive files and folders',
        category: 'Cloud Storage',
        config: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-gdrive'],
            connectionMode: 'lenient',
        },
        setupInstructions: 'Requires Google Drive API credentials. Follow OAuth setup process.',
        requiresSetup: true,
        tags: ['google', 'drive', 'cloud', 'storage', 'files'],
    },

    slack: {
        id: 'slack',
        name: 'Slack',
        description: 'Send messages and interact with Slack workspaces',
        category: 'Communication',
        config: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-slack'],
            env: {
                SLACK_BOT_TOKEN: '$SLACK_BOT_TOKEN',
            },
            connectionMode: 'lenient',
        },
        setupInstructions:
            'Requires Slack Bot Token. Create a Slack app at: https://api.slack.com/apps',
        requiredEnvVars: ['SLACK_BOT_TOKEN'],
        requiresSetup: true,
        tags: ['slack', 'communication', 'messaging', 'team'],
    },

    notion: {
        id: 'notion',
        name: 'Notion',
        description: 'Manage Notion pages, databases, and content',
        category: 'Productivity',
        config: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@makenotion/notion-mcp-server'],
            env: {
                NOTION_API_KEY: '$NOTION_API_KEY',
            },
            connectionMode: 'lenient',
        },
        setupInstructions:
            'Requires Notion Integration Token. Create one at: https://www.notion.so/my-integrations',
        requiredEnvVars: ['NOTION_API_KEY'],
        requiresSetup: true,
        tags: ['notion', 'productivity', 'notes', 'database'],
    },

    docker: {
        id: 'docker',
        name: 'Docker',
        description: 'Manage Docker containers, images, and compose services',
        category: 'DevOps',
        config: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-docker'],
            connectionMode: 'lenient',
        },
        setupInstructions: 'Requires Docker to be installed and running on your system.',
        requiresSetup: true,
        tags: ['docker', 'containers', 'devops', 'deployment'],
    },

    kubernetes: {
        id: 'kubernetes',
        name: 'Kubernetes',
        description: 'Manage Kubernetes clusters, pods, and resources',
        category: 'DevOps',
        config: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@kubernetes/mcp-server'],
            env: {
                KUBECONFIG: '$KUBECONFIG',
            },
            connectionMode: 'lenient',
        },
        setupInstructions: 'Requires kubectl configured with cluster access.',
        optionalEnvVars: ['KUBECONFIG'],
        requiresSetup: true,
        tags: ['kubernetes', 'k8s', 'devops', 'orchestration'],
    },
};

/**
 * Get all available MCP server categories
 */
export function getMcpServerCategories(): string[] {
    const categories = new Set<string>();
    Object.values(MCP_SERVER_REGISTRY).forEach((server) => categories.add(server.category));
    return Array.from(categories).sort();
}

/**
 * Get MCP servers by category
 */
export function getMcpServersByCategory(category: string): McpServerRegistryEntry[] {
    return Object.values(MCP_SERVER_REGISTRY)
        .filter((server) => server.category === category)
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get MCP servers by tags
 */
export function getMcpServersByTags(tags: string[]): McpServerRegistryEntry[] {
    return Object.values(MCP_SERVER_REGISTRY)
        .filter((server) => tags.some((tag) => server.tags.includes(tag)))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Search MCP servers by name or description
 */
export function searchMcpServers(query: string): McpServerRegistryEntry[] {
    const lowercaseQuery = query.toLowerCase();
    return Object.values(MCP_SERVER_REGISTRY)
        .filter(
            (server) =>
                server.name.toLowerCase().includes(lowercaseQuery) ||
                server.description.toLowerCase().includes(lowercaseQuery) ||
                server.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery))
        )
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get a specific MCP server by ID
 */
export function getMcpServerById(id: string): McpServerRegistryEntry | undefined {
    return MCP_SERVER_REGISTRY[id];
}
