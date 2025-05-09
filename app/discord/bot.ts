#!/usr/bin/env node
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import https from 'https';
import { loadConfigFile } from '../../src/config/loader.js';
import { DEFAULT_CONFIG_PATH, resolvePackagePath } from '../../src/utils/path.js';
import { createAgentServices } from '../../src/utils/service-initializer.js';
import { AgentConfig } from '../../src/config/types.js';

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

export async function startDiscordBot(cliConfigPath?: string) {
    // Determine configuration path: CLI > Environment Variable > Default
    let configToUse = DEFAULT_CONFIG_PATH;
    if (cliConfigPath) {
        configToUse = cliConfigPath;
    } else if (process.env.DISCORD_CONFIG_PATH) {
        configToUse = process.env.DISCORD_CONFIG_PATH;
    }

    const normalizedConfigPath = resolvePackagePath(
        configToUse,
        configToUse === DEFAULT_CONFIG_PATH // Resolve from package root only if it's the default path
    );

    // Initialize core services
    const { clientManager, llmService, agentEventBus } = await createAgentServices(
        normalizedConfigPath,
        {},
        { runMode: 'web' }
    );

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

    await client.login(token);
}

// Only run directly if not imported (for when running node app/discord/bot.ts)
if (typeof require !== 'undefined' && require.main === module) {
    startDiscordBot().catch((err) => {
        console.error('Failed to start Discord bot', err);
        process.exit(1);
    });
}
