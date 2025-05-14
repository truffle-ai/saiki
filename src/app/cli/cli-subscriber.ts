import { logger } from '../../core/utils/logger.js';
import boxen from 'boxen';
import chalk from 'chalk';
import { EventSubscriber } from '../api/types.js';
import { EventEmitter } from 'events';

/**
 * Wrapper class to store methods describing how the CLI should handle agent events
 *
 * Minimum expected event handler methods (for LLMService events)
 *   - onThinking(): void
 *   - onChunk(text: string): void
 *   - onToolCall(toolName: string, args: any): void
 *   - onToolResult(toolName: string, result: any): void
 *   - onResponse(text: string): void
 *   - onError(error: Error): void
 *   - onConversationReset(): void
 */
export class CLISubscriber implements EventSubscriber {
    private accumulatedResponse: string = '';
    private currentLines: number = 0;

    subscribe(eventBus: EventEmitter): void {
        eventBus.on('llmservice:thinking', this.onThinking.bind(this));
        eventBus.on('llmservice:chunk', this.onChunk.bind(this));
        eventBus.on('llmservice:toolCall', this.onToolCall.bind(this));
        eventBus.on('llmservice:toolResult', this.onToolResult.bind(this));
        eventBus.on('llmservice:response', this.onResponse.bind(this));
        eventBus.on('llmservice:error', this.onError.bind(this));
        eventBus.on('llmservice:conversationReset', this.onConversationReset.bind(this));
    }

    onThinking(): void {
        logger.info('AI thinking...', null, 'yellow');
    }

    onChunk(text: string): void {
        // Append the new chunk to the accumulated response
        this.accumulatedResponse += text;

        // Generate the new box with the accumulated response
        const box = boxen(chalk.white(this.accumulatedResponse), {
            padding: 1,
            borderColor: 'yellow',
            title: '🤖 AI Response',
            titleAlignment: 'center',
        });

        // Count the number of lines in the new box
        const newLines = box.split('\n').length;

        // Move cursor up to the start of the previous box (if it exists)
        if (this.currentLines > 0) {
            process.stdout.write(`\x1b[${this.currentLines}A`);
        }

        // Print the new box (this overwrites the old one)
        process.stdout.write(box);

        // Update the line count
        this.currentLines = newLines;

        // Move cursor to the end of the box to allow logs below
        process.stdout.write('\n');
    }

    onToolCall(toolName: string, args: any): void {
        logger.toolCall(toolName, args);
    }

    onToolResult(toolName: string, result: any): void {
        logger.toolResult(result);
    }

    onResponse(text: string): void {
        // Clear the accumulated state since we got the final response
        this.accumulatedResponse = '';
        this.currentLines = 0;

        // Use the logger's displayAIResponse for consistent formatting
        logger.displayAIResponse({ content: text });
    }

    onError(error: Error): void {
        // Clear any partial response state
        this.accumulatedResponse = '';
        this.currentLines = 0;

        logger.error(`❌ Error: ${error.message}`, null, 'red');
    }

    onConversationReset(): void {
        // Clear any partial response state
        this.accumulatedResponse = '';
        this.currentLines = 0;

        logger.info('🔄 Conversation history cleared.', null, 'blue');
    }
}
