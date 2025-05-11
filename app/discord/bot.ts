import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import https from 'https';
import { MCPClientManager } from '../../src/client/manager.js';
import { ILLMService } from '../../src/ai/llm/services/types.js';
import { EventEmitter } from 'events';

// Load environment variables
dotenv.config();
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
    console.error('Missing DISCORD_BOT_TOKEN in environment');
    process.exit(1);
}

// User-based cooldown system for Discord interactions
const userCooldowns = new Map<string, number>();
const RATE_LIMIT_ENABLED = process.env.DISCORD_RATE_LIMIT_ENABLED?.toLowerCase() !== 'false'; // default-on
let COOLDOWN_SECONDS = Number(process.env.DISCORD_RATE_LIMIT_SECONDS ?? 5);

if (Number.isNaN(COOLDOWN_SECONDS) || COOLDOWN_SECONDS < 0) {
    console.error(
        'DISCORD_RATE_LIMIT_SECONDS must be a non-negative number. Defaulting to 5 seconds.'
    );
    COOLDOWN_SECONDS = 5; // Default to a safe value
}

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

// Insert initDiscordBot to wire up a Discord client given pre-initialized services
export function startDiscordBot(services: {
    clientManager: MCPClientManager;
    llmService: ILLMService;
    agentEventBus: EventEmitter;
}) {
    const { clientManager, llmService, agentEventBus } = services;

    // Create Discord client
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages,
        ],
        partials: [Partials.Channel],
    });

    client.once('ready', () => {
        console.log(`Discord bot logged in as ${client.user.tag}`);
    });

    client.on('messageCreate', async (message) => {
        // Ignore bots
        if (message.author.bot) return;

        if (RATE_LIMIT_ENABLED && COOLDOWN_SECONDS > 0) {
            // Only apply cooldown if enabled and seconds > 0
            const now = Date.now();
            const cooldownEnd = userCooldowns.get(message.author.id) || 0;

            if (now < cooldownEnd) {
                const timeLeft = (cooldownEnd - now) / 1000;
                try {
                    await message.reply(
                        `Please wait ${timeLeft.toFixed(1)} more seconds before using this command again.`
                    );
                } catch (replyError) {
                    console.error('Error sending cooldown message:', replyError);
                }
                return;
            }
        }

        let userText: string | undefined = message.content;
        let imageDataInput: any;

        // Handle attachments (images)
        if (message.attachments.size > 0) {
            const attachment = message.attachments.first();
            if (attachment && attachment.url) {
                const { base64, mimeType } = await downloadFileAsBase64(attachment.url);
                imageDataInput = { image: base64, mimeType };
                userText = message.content || '';
            }
        }

        // Only respond to !ask prefix or DMs
        if (!message.guild || (userText && userText.startsWith('!ask '))) {
            if (userText && userText.startsWith('!ask ')) {
                userText = userText.substring(5).trim();
            }
            if (!userText) return;

            // Subscribe to toolCall events
            const toolCallHandler = (toolName: string, args: any) => {
                message.channel
                    .send(`⚙️ Calling tool **${toolName}** with args: ${JSON.stringify(args)}`)
                    .catch((error) => {
                        console.error(
                            `Failed to send tool call notification for ${toolName} to channel ${message.channel.id}:`,
                            error
                        );
                    });
            };
            agentEventBus.on('llmservice:toolCall', toolCallHandler);

            try {
                await message.channel.sendTyping();
                const responseText = await llmService.completeTask(userText, imageDataInput);
                // Handle Discord's 2000 character limit
                const MAX_LENGTH = 1900; // Leave some buffer
                if (responseText.length <= MAX_LENGTH) {
                    await message.reply(responseText);
                } else {
                    // Split into chunks and send multiple messages
                    let remaining = responseText;
                    let isFirst = true;

                    while (remaining.length > 0) {
                        const chunk = remaining.substring(0, MAX_LENGTH);
                        remaining = remaining.substring(MAX_LENGTH);

                        if (isFirst) {
                            await message.reply(chunk);
                            isFirst = false;
                        } else {
                            // For subsequent chunks, use message.channel.send to avoid a chain of replies
                            // and to ensure messages are sent in order.
                            // Adding a small delay can also help with ordering and rate limits.
                            await new Promise((resolve) => setTimeout(resolve, 250)); // 250ms delay
                            await message.channel.send(chunk);
                        }
                    }
                }
            } catch (error) {
                console.error('Error handling Discord message', error);
                try {
                    await message.reply(`Error: ${error.message}`);
                } catch (replyError) {
                    console.error('Error sending error reply:', replyError);
                }
            } finally {
                agentEventBus.off('llmservice:toolCall', toolCallHandler);
                // Set cooldown for the user after processing
                if (RATE_LIMIT_ENABLED && COOLDOWN_SECONDS > 0) {
                    userCooldowns.set(message.author.id, Date.now() + COOLDOWN_SECONDS * 1000);
                }
            }
        }
    });

    client.login(token);
    return client;
}
