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
                message.channel.send(
                    `⚙️ Calling tool **${toolName}** with args: ${JSON.stringify(args)}`
                );
            };
            agentEventBus.on('llmservice:toolCall', toolCallHandler);

            try {
                await message.channel.sendTyping();
                const responseText = await llmService.completeTask(userText, imageDataInput);
                await message.reply(responseText);
            } catch (error) {
                console.error('Error handling Discord message', error);
                await message.reply(`Error: ${error.message}`);
            } finally {
                agentEventBus.off('llmservice:toolCall', toolCallHandler);
            }
        }
    });

    client.login(token);
    return client;
}
