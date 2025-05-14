#!/usr/bin/env node
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import https from 'https';
import { SaikiAgent } from '../../core/ai/agent/SaikiAgent.js';

// Load environment variables (including TELEGRAM_BOT_TOKEN)
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

// Insert concurrency cap and debounce cache for inline queries
const MAX_CONCURRENT_INLINE_QUERIES = process.env.TELEGRAM_INLINE_QUERY_CONCURRENCY
    ? Number(process.env.TELEGRAM_INLINE_QUERY_CONCURRENCY)
    : 5;
let currentInlineQueries = 0;
const INLINE_QUERY_DEBOUNCE_INTERVAL = 2000; // ms
const inlineQueryCache: Record<string, { timestamp: number; results: any[] }> = {};

// Helper to download a file URL and convert it to base64
async function downloadFileAsBase64(
    fileUrl: string
): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
        https
            .get(fileUrl, (res) => {
                if (res.statusCode && res.statusCode >= 400) {
                    return reject(
                        new Error(`Failed to download file: ${res.statusCode} ${res.statusMessage}`)
                    );
                }
                const chunks: Buffer[] = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const contentType =
                        (res.headers['content-type'] as string) || 'application/octet-stream';
                    resolve({ base64: buffer.toString('base64'), mimeType: contentType });
                });
            })
            .on('error', reject);
    });
}

// Insert initTelegramBot to wire up a TelegramBot given pre-initialized services
export function startTelegramBot(agent: SaikiAgent) {
    if (!token) {
        throw new Error('TELEGRAM_BOT_TOKEN is not set');
    }

    const agentEventBus = agent.agentEventBus;

    // Create and start Telegram Bot with polling
    const bot = new TelegramBot(token, { polling: true });
    console.log('Telegram bot started');

    // /start command with sample buttons
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 'Welcome to Saiki AI Bot! Choose an option below:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 Reset Conversation', callback_data: 'reset' }],
                    [{ text: '❓ Help', callback_data: 'help' }],
                ],
            },
        });
    });

    // Handle button callbacks
    bot.on('callback_query', async (callbackQuery) => {
        const action = callbackQuery.data;
        const chatId = callbackQuery.message?.chat.id;
        if (!chatId) return;
        try {
            if (action === 'reset') {
                agent.resetConversation();
                await bot.sendMessage(chatId, '🔄 Conversation has been reset.');
            } else if (action === 'help') {
                await bot.sendMessage(chatId, 'Send me text or images and I will respond.');
            }
            await bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            console.error('Error handling callback query', error);
            // Attempt to notify user of the error
            try {
                await bot.sendMessage(chatId, `Error processing request: ${error.message}`);
            } catch (e) {
                console.error('Failed to send error message for callback query', e);
            }
        }
    });

    // Group chat slash command: /ask <your question>
    bot.onText(/\/ask\s+(.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const question = match?.[1];
        if (!question) {
            return bot.sendMessage(chatId, 'Please provide a question, e.g. `/ask How do I ...?`', {
                parse_mode: 'Markdown',
            });
        }
        try {
            await bot.sendChatAction(chatId, 'typing');
            const answer = await agent.run(question);
            if (answer) {
                await bot.sendMessage(chatId, answer);
            } else {
                await bot.sendMessage(chatId, '🤖 …agent failed to respond');
            }
        } catch (err) {
            console.error('Error handling /ask command', err);
            await bot.sendMessage(chatId, `Error: ${err.message}`);
        }
    });

    // Inline query handler
    bot.on('inline_query', async (inlineQuery) => {
        if (!inlineQuery.query) return;
        const userId = inlineQuery.from.id;
        const queryText = inlineQuery.query.trim();
        const cacheKey = `${userId}:${queryText}`;
        const now = Date.now();
        // Debounce: return cached results if query repeated within interval
        const cached = inlineQueryCache[cacheKey];
        if (cached && now - cached.timestamp < INLINE_QUERY_DEBOUNCE_INTERVAL) {
            return bot.answerInlineQuery(inlineQuery.id, cached.results);
        }
        // Concurrency cap
        if (currentInlineQueries >= MAX_CONCURRENT_INLINE_QUERIES) {
            // Too many concurrent inline queries; respond with empty list
            return bot.answerInlineQuery(inlineQuery.id, []);
        }
        currentInlineQueries++;
        try {
            const queryTimeout = 15000; // 15 seconds timeout
            const resultText = await Promise.race<string>([
                agent.run(inlineQuery.query),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Query timed out')), queryTimeout)
                ),
            ]);
            const results = [
                {
                    type: 'article',
                    id: inlineQuery.id,
                    title: 'AI Answer',
                    input_message_content: { message_text: resultText },
                    description: resultText.substring(0, 100),
                },
            ];
            // Cache the results
            inlineQueryCache[cacheKey] = { timestamp: now, results };
            await bot.answerInlineQuery(inlineQuery.id, results);
        } catch (error) {
            console.error('Error handling inline query', error);
            // Inform user about the error through inline results
            try {
                await bot.answerInlineQuery(inlineQuery.id, [
                    {
                        type: 'article',
                        id: inlineQuery.id,
                        title: 'Error processing query',
                        input_message_content: {
                            message_text: `Sorry, I encountered an error: ${error.message}`,
                        },
                        description: 'Error occurred while processing your request',
                    },
                ]);
            } catch (e) {
                console.error('Failed to send inline query error', e);
            }
        } finally {
            currentInlineQueries--;
        }
    });

    // Message handler with image support and toolCall notifications
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        let userText = msg.text;
        let imageDataInput;

        try {
            // Detect image messages
            if (msg.photo) {
                const photo = msg.photo[msg.photo.length - 1];
                const fileInfo = await bot.getFile(photo.file_id);
                const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
                const { base64, mimeType } = await downloadFileAsBase64(fileUrl);
                imageDataInput = { image: base64, mimeType };
                userText = msg.caption || ''; // Use caption if available
            }
        } catch (err) {
            console.error('Failed to process attached image in Telegram bot', err);
            try {
                await bot.sendMessage(
                    chatId,
                    `🖼️ Error downloading or processing image: ${err.message}`
                );
            } catch (sendError) {
                console.error('Failed to send image error message to user', sendError);
            }
            return; // Stop processing if image handling fails
        }

        // If there's no text (even after checking caption for photos) AND no image data, then nothing to process.
        if (!userText && !imageDataInput) return;
        // If userText is undefined (e.g. only an image was sent with no caption) and no image was processed (e.g. due to an error caught above, though `return` should prevent this)
        // or simply no text was ever present and no image.
        if (userText === undefined && !imageDataInput) return; // Catches case where msg.text was initially undefined and no photo or photo failed

        // Subscribe for toolCall events
        const toolCallHandler = (toolName: string, args: any) => {
            bot.sendMessage(chatId, `Calling *${toolName}* with args: ${JSON.stringify(args)}`, {
                parse_mode: 'Markdown',
            });
        };
        agentEventBus.on('llmservice:toolCall', toolCallHandler);

        try {
            await bot.sendChatAction(chatId, 'typing');
            const responseText = await agent.run(userText || '', imageDataInput);
            await bot.sendMessage(chatId, responseText);
        } catch (error) {
            console.error('Error handling Telegram message', error);
            await bot.sendMessage(chatId, `Error: ${error.message}`);
        } finally {
            agentEventBus.off('llmservice:toolCall', toolCallHandler);
        }
    });

    return bot;
}
