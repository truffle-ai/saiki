/**
 * Internal representation of a message in a conversation.
 * Standardizes message format across different LLM providers.
 */
export interface InternalMessage {
    /**
     * The role of the entity sending the message.
     * - 'system': System instructions or context
     * - 'user': End-user input
     * - 'assistant': LLM response
     * - 'tool': Result from a tool execution
     */
    role: 'system' | 'user' | 'assistant' | 'tool';

    /**
     * The content of the message.
     * - String for regular messages
     * - null if message only contains tool calls
     */
    content: string | null;

    /**
     * Tool calls made by the assistant.
     * Only present in assistant messages when the LLM requests tool execution.
     */
    toolCalls?: Array<{
        /**
         * Unique identifier for this tool call
         */
        id: string;

        /**
         * The type of tool call (currently only 'function' is supported)
         */
        type: 'function';

        /**
         * Function call details
         */
        function: {
            /**
             * Name of the function to call
             */
            name: string;

            /**
             * Arguments for the function in JSON string format
             */
            arguments: string;
        };
    }>;

    /**
     * ID of the tool call this message is responding to.
     * Only present in tool messages.
     */
    toolCallId?: string;

    /**
     * Name of the tool that produced this result.
     * Only present in tool messages.
     */
    name?: string;
}
