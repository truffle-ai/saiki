import { useState, useEffect, useRef } from 'react';
import { SaikiAgent } from '@core/index.js';
import { ToolExecutionDetails } from '@core/client/tool-confirmation/types.js';

interface AgentEventState {
    isThinking: boolean;
    streamingText: string;
    isStreaming: boolean;
    finalResponse: string | null;
    pendingTool: ToolExecutionDetails | null;
    error: Error | null;
    conversationReset: boolean;
}

export function useAgentEvents(agent: SaikiAgent): AgentEventState {
    const [isThinking, setIsThinking] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [finalResponse, setFinalResponse] = useState<string | null>(null);
    const [pendingTool, setPendingTool] = useState<ToolExecutionDetails | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [conversationReset, setConversationReset] = useState(false);

    // Use refs to track if we're in a streaming session
    const streamingSessionRef = useRef(false);

    useEffect(() => {
        const eventBus = agent.agentEventBus;

        const handleThinking = () => {
            setIsThinking(true);
            setError(null);
            setFinalResponse(null);
        };

        const handleChunk = ({ content }: { content: string }) => {
            if (!streamingSessionRef.current) {
                // Starting a new streaming session
                streamingSessionRef.current = true;
                setStreamingText(content);
                setIsStreaming(true);
                setIsThinking(false);
            } else {
                // Continuing the streaming session
                setStreamingText((prev) => prev + content);
            }
        };

        const handleResponse = ({ content }: { content: string }) => {
            // End of streaming session
            streamingSessionRef.current = false;
            setStreamingText('');
            setIsStreaming(false);
            setIsThinking(false);
            setFinalResponse(content);

            // Clear the final response after a short delay to prevent re-adding
            setTimeout(() => setFinalResponse(null), 100);
        };

        const handleToolCall = (payload: { toolName: string; args: any }) => {
            // Note: This would need to be integrated with the tool confirmation system
            // For now, we'll just track that a tool is being called
            const toolDetails: ToolExecutionDetails = {
                toolName: payload.toolName,
                args: payload.args,
            };
            setPendingTool(toolDetails);
        };

        const handleToolResult = (payload: { toolName: string; result: any }) => {
            // Clear pending tool when result is received
            setPendingTool(null);
        };

        const handleError = ({ error }: { error: Error }) => {
            streamingSessionRef.current = false;
            setError(error);
            setIsThinking(false);
            setIsStreaming(false);
            setStreamingText('');
            setPendingTool(null);
        };

        const handleConversationReset = () => {
            streamingSessionRef.current = false;
            setStreamingText('');
            setIsStreaming(false);
            setIsThinking(false);
            setFinalResponse(null);
            setPendingTool(null);
            setError(null);
            setConversationReset(true);

            // Clear the reset flag after handling
            setTimeout(() => setConversationReset(false), 100);
        };

        // Subscribe to events
        eventBus.on('llmservice:thinking', handleThinking);
        eventBus.on('llmservice:chunk', handleChunk);
        eventBus.on('llmservice:response', handleResponse);
        eventBus.on('llmservice:toolCall', handleToolCall);
        eventBus.on('llmservice:toolResult', handleToolResult);
        eventBus.on('llmservice:error', handleError);
        eventBus.on('saiki:conversationReset', handleConversationReset);

        // Cleanup subscriptions
        return () => {
            eventBus.off('llmservice:thinking', handleThinking);
            eventBus.off('llmservice:chunk', handleChunk);
            eventBus.off('llmservice:response', handleResponse);
            eventBus.off('llmservice:toolCall', handleToolCall);
            eventBus.off('llmservice:toolResult', handleToolResult);
            eventBus.off('llmservice:error', handleError);
            eventBus.off('saiki:conversationReset', handleConversationReset);
        };
    }, [agent]);

    return {
        isThinking,
        streamingText,
        isStreaming,
        finalResponse,
        pendingTool,
        error,
        conversationReset,
    };
}
