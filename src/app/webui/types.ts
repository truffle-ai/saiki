/**
 * Shared type definitions for WebUI components
 */

export interface JsonSchemaProperty {
    type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
    description?: string;
    default?: any;
    enum?: Array<string | number | boolean>;
    format?: string;
}

export interface JsonSchema {
    type?: 'object';
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
}

export interface McpServer {
    id: string;
    name: string;
    status: 'connected' | 'disconnected' | 'error' | 'unknown';
}

export interface McpTool {
    id: string;
    name: string;
    description?: string;
    inputSchema?: JsonSchema | null;
}

export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: {
        type: string;
        mimeType?: string;
    };
}

// New types for Agent Studio functionality
export interface AgentTemplate {
    id: string;
    name: string;
    description: string;
    category: 'productivity' | 'development' | 'research' | 'creative' | 'data' | 'custom';
    icon?: string;
    prompt: string;
    tools: string[]; // Tool IDs
    settings: {
        temperature?: number;
        maxTokens?: number;
        timeoutMs?: number;
    };
    variables?: AgentVariable[];
    examples?: AgentExample[];
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    isPublic: boolean;
    author?: string;
}

export interface AgentVariable {
    name: string;
    description: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    options?: string[];
    defaultValue?: any;
    required: boolean;
}

export interface AgentExample {
    input: string;
    expectedOutput: string;
    description?: string;
}

export interface WorkflowNode {
    id: string;
    type: 'agent' | 'tool' | 'condition' | 'input' | 'output' | 'delay';
    position: { x: number; y: number };
    data: {
        label: string;
        agentId?: string;
        toolId?: string;
        config?: any;
    };
}

export interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    condition?: string;
}

export interface Workflow {
    id: string;
    name: string;
    description: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ConversationSession {
    id: string;
    name: string;
    agentId?: string;
    messages: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;
    metadata?: {
        totalTokens?: number;
        totalCost?: number;
        duration?: number;
    };
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    toolCalls?: ToolCall[];
    attachments?: MessageAttachment[];
}

export interface ToolCall {
    id: string;
    toolName: string;
    input: any;
    output?: any;
    error?: string;
    duration?: number;
}

export interface MessageAttachment {
    id: string;
    type: 'image' | 'file' | 'url';
    name: string;
    url: string;
    mimeType?: string;
    size?: number;
}

export interface AgentMetrics {
    totalExecutions: number;
    successRate: number;
    averageResponseTime: number;
    popularTools: string[];
    recentActivity: Date[];
}

// LLM Management types
export interface LLMProvider {
    name: string;
    models: string[];
    supportedRouters: string[];
    supportsBaseURL: boolean;
}

export interface LLMConfig {
    config: {
        provider: string;
        model: string;
        apiKey?: string;
        maxTokens?: number;
        temperature?: number;
        baseURL?: string;
    };
    serviceInfo: {
        provider: string;
        model: string;
        router: string;
        configuredMaxTokens?: number;
        modelMaxTokens?: number;
    };
}
