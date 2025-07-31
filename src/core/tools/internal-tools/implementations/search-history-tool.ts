import { z } from 'zod';
import { InternalTool, ToolExecutionContext } from '../../types.js';
import { SearchService } from '../../../ai/search/search-service.js';
import type { SearchOptions } from '../../../ai/search/types.js';

/**
 * Internal tool for searching conversation history
 */
export function createSearchHistoryTool(searchService: SearchService): InternalTool {
    return {
        id: 'search_history',
        description:
            'Search through conversation history across sessions. Use mode="messages" to search for specific messages, or mode="sessions" to find sessions containing the query. For message search, you can filter by sessionId (specific session), role (user/assistant/system/tool), limit results, and set pagination offset.',
        inputSchema: z.object({
            query: z.string().describe('The search query to find in conversation history'),
            mode: z
                .enum(['messages', 'sessions'])
                .describe(
                    'Search mode: "messages" searches for individual messages, "sessions" finds sessions containing the query'
                ),
            sessionId: z
                .string()
                .optional()
                .describe(
                    'Optional: limit search to a specific session (only for mode="messages")'
                ),
            role: z
                .enum(['user', 'assistant', 'system', 'tool'])
                .optional()
                .describe('Optional: filter by message role (only for mode="messages")'),
            limit: z
                .number()
                .optional()
                .default(20)
                .describe(
                    'Optional: maximum number of results to return (default: 20, only for mode="messages")'
                ),
            offset: z
                .number()
                .optional()
                .default(0)
                .describe('Optional: offset for pagination (default: 0, only for mode="messages")'),
        }),
        // TODO: Enhance to get SearchService via ToolExecutionContext for better separation of concerns
        execute: async (input: any, _context?: ToolExecutionContext) => {
            const { query, mode, sessionId, role, limit, offset } = input;

            if (mode === 'messages') {
                const searchOptions: SearchOptions = {
                    sessionId,
                    role,
                    limit,
                    offset,
                };
                return await searchService.searchMessages(query, searchOptions);
            } else if (mode === 'sessions') {
                return await searchService.searchSessions(query);
            } else {
                throw new Error(`Invalid search mode: ${mode}. Must be 'messages' or 'sessions'.`);
            }
        },
    };
}
