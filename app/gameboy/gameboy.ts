import { ClientManager } from '../../src/client/manager.js';
import { ILLMService } from '../../src/ai/llm/services/types.js';
import { logger } from '../../src/utils/logger.js';
import { CLISubscriber } from '../cli/cli-subscriber.js';
import { EventEmitter } from 'events';

export async function runGameboy(
    clientManager: ClientManager,
    llmService: ILLMService,
    agentEventBus: EventEmitter
): Promise<void> {
    logger.info('Starting GameBoy agent...', null, 'magenta');

    // Set up CLI subscriber using shared event bus
    const cliSubscriber = new CLISubscriber();
    agentEventBus.on('llmservice:thinking', cliSubscriber.onThinking.bind(cliSubscriber));
    agentEventBus.on('llmservice:chunk', cliSubscriber.onChunk.bind(cliSubscriber));
    agentEventBus.on('llmservice:toolCall', cliSubscriber.onToolCall.bind(cliSubscriber));
    agentEventBus.on('llmservice:toolResult', cliSubscriber.onToolResult.bind(cliSubscriber));
    agentEventBus.on('llmservice:response', cliSubscriber.onResponse.bind(cliSubscriber));
    agentEventBus.on('llmservice:error', cliSubscriber.onError.bind(cliSubscriber));
    agentEventBus.on(
        'llmservice:conversationReset',
        cliSubscriber.onConversationReset.bind(cliSubscriber)
    );

    let gameOver = false;
    // Detect end of game on 'stop' tool call
    agentEventBus.on('llmservice:toolCall', (toolName: string) => {
        if (toolName === 'stop') gameOver = true;
    });

    // Start the game
    const gamePath = "C:\\Users\\nutme\\Desktop\\Dragonballz\\Projects\\Truffle\\gameboy\\roms\\2048.gb";
    await llmService.completeTask(`start ${gamePath}`);

    // Loop: feed screenshots until game ends
    while (!gameOver) {
        const imageBuffer = await clientManager.readResource('screenshot://latest');
        let imageBase64: string | undefined;
        if (
            imageBuffer &&
            Array.isArray(imageBuffer.contents) &&
            imageBuffer.contents.length > 0 &&
            typeof imageBuffer.contents[0].blob === 'string'
        ) {
            imageBase64 = imageBuffer.contents[0].blob;
        } else {
            logger.warn('Could not extract base64 blob from screenshot resource response.', {
                response: imageBuffer,
            });
        }

        if (imageBase64) {
            await llmService.completeTask('screenshot', {
                image: imageBase64,
                mimeType: 'image/png', // Use correct mimeType
            });
        } else {
            logger.warn('Received screenshot resource is not a Buffer. Skipping LLM call.');
        }
    }

    logger.info('Game over!', null, 'magenta');
    process.exit(0);
} 