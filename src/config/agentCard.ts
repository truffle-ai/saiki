import type { AgentCard } from './types.js';
import type { AgentCardOverride } from './schemas.js';

/**
 * Minimal runtime context needed to establish defaults
 * if not provided in AgentCardOverride.
 */
export interface MinimalAgentCardContext {
    defaultName: string; // Ultimate fallback name if not in overrides
    defaultVersion: string; // Ultimate fallback version if not in overrides
    defaultBaseUrl: string; // Used to construct default URL if not in overrides
    webSubscriber?: unknown; // To determine default pushNotification capability
}

const DEFAULT_CHAT_TOOL_NAME = 'chat';
const DEFAULT_CHAT_TOOL_DESCRIPTION =
    'Allows you to chat with the an AI agent. Send a message to interact.';

/**
 * Creates the final AgentCard.
 * It establishes a full default structure based on minimal context and static defaults,
 * then merges the user-provided overrides (AgentCardOverride) on top.
 */
export function createAgentCard(
    context: MinimalAgentCardContext,
    overrides: AgentCardOverride // This is Partial<AgentCard> via Zod
): AgentCard {
    const { defaultName, defaultVersion, defaultBaseUrl, webSubscriber } = context;

    // Start with a fully-formed default structure
    const defaultAgentCardData: AgentCard = {
        name: defaultName,
        description:
            'Alfred is an AI assistant capable of chat and task delegation, accessible via multiple protocols.',
        url: `${defaultBaseUrl}/mcp`,
        version: defaultVersion,
        provider: undefined,
        documentationUrl: undefined,
        capabilities: {
            streaming: true,
            pushNotifications: !!webSubscriber,
            stateTransitionHistory: false,
        },
        authentication: {
            schemes: [],
            credentials: undefined,
        },
        defaultInputModes: ['application/json', 'text/plain'],
        defaultOutputModes: ['application/json', 'text/event-stream', 'text/plain'],
        skills: [
            {
                id: DEFAULT_CHAT_TOOL_NAME,
                name: DEFAULT_CHAT_TOOL_NAME,
                description: DEFAULT_CHAT_TOOL_DESCRIPTION,
                tags: ['chat', 'AI', 'assistant', 'mcp', 'natural language'],
                examples: [
                    `Send a JSON-RPC request to /mcp with method: "${DEFAULT_CHAT_TOOL_NAME}" and params: {"message":"Your query..."}`,
                    'Alternatively, use a compatible MCP client library.',
                ],
                inputModes: ['text/plain'],
                outputModes: ['text/plain'],
            },
        ],
    };

    // Merge overrides onto the defaults
    // If a top-level optional field (like provider, documentationUrl) is in overrides, it's used.
    // Otherwise, the default (which might be undefined) is used.
    const finalCard: AgentCard = {
        name: overrides.name ?? defaultAgentCardData.name,
        description: overrides.description ?? defaultAgentCardData.description,
        url: overrides.url ?? defaultAgentCardData.url,
        version: overrides.version ?? defaultAgentCardData.version,
        provider: 'provider' in overrides ? overrides.provider : defaultAgentCardData.provider,
        documentationUrl:
            'documentationUrl' in overrides
                ? overrides.documentationUrl
                : defaultAgentCardData.documentationUrl,
        capabilities: {
            ...defaultAgentCardData.capabilities,
            ...(overrides.capabilities ?? {}),
        },
        authentication: {
            ...defaultAgentCardData.authentication,
            ...(overrides.authentication ?? {}),
            credentials:
                overrides.authentication && 'credentials' in overrides.authentication
                    ? overrides.authentication.credentials
                    : defaultAgentCardData.authentication.credentials,
        },
        defaultInputModes:
            overrides.defaultInputModes && overrides.defaultInputModes.length > 0
                ? overrides.defaultInputModes
                : defaultAgentCardData.defaultInputModes,
        defaultOutputModes:
            overrides.defaultOutputModes && overrides.defaultOutputModes.length > 0
                ? overrides.defaultOutputModes
                : defaultAgentCardData.defaultOutputModes,
        // User-defined skills from overrides replace the default skill(s).
        skills:
            overrides.skills && overrides.skills.length > 0
                ? overrides.skills
                : defaultAgentCardData.skills,
    };

    return finalCard;
}
