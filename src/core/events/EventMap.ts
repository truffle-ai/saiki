export interface EventMap {
    /** Fired when Saiki conversation is reset */
    'saiki:conversationReset': [];

    /** Fired when MCP server connection succeeds or fails */
    'saiki:mcpServerConnected': [{ name: string; success: boolean; error?: string }];

    /** Fired when available tools list updates */
    'saiki:availableToolsUpdated': [];

    /** Fired when MessageManager conversation is reset */
    'messageManager:conversationReset': [];

    /** LLM service started thinking */
    'llmservice:thinking': [];

    /** LLM service sent a streaming chunk */
    'llmservice:chunk': [string];

    /** LLM service final response */
    'llmservice:response': [string];

    /** LLM service requested a tool call */
    'llmservice:toolCall': [{ toolName: string; args: any }];

    /** LLM service returned a tool result */
    'llmservice:toolResult': [{ toolName: string; result: any }];

    /** LLM service error */
    'llmservice:error': [Error];
}
