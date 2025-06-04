import * as winston from 'winston';
import chalk from 'chalk';
import boxen from 'boxen';

// Winston logger configuration
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
};

// Available chalk colors for message formatting
type ChalkColor =
    | 'black'
    | 'red'
    | 'green'
    | 'yellow'
    | 'blue'
    | 'magenta'
    | 'cyan'
    | 'white'
    | 'gray'
    | 'grey'
    | 'blackBright'
    | 'redBright'
    | 'greenBright'
    | 'yellowBright'
    | 'blueBright'
    | 'magentaBright'
    | 'cyanBright'
    | 'whiteBright';

// Custom format for console output
const consoleFormat = winston.format.printf(({ level, message, timestamp, color }) => {
    const levelColorMap: Record<string, (text: string) => string> = {
        error: chalk.red,
        warn: chalk.yellow,
        info: chalk.blue,
        http: chalk.cyan,
        verbose: chalk.magenta,
        debug: chalk.gray,
        silly: chalk.gray.dim,
    };

    const colorize = levelColorMap[level] || chalk.white;

    // Apply color to message if specified
    const formattedMessage =
        color && typeof color === 'string' && chalk[color as ChalkColor]
            ? chalk[color as ChalkColor](message)
            : message;

    return `${chalk.dim(timestamp)} ${colorize(level.toUpperCase())}: ${formattedMessage}`;
});

/**
 * Logic to redact sensitive information from logs.
 * This is useful for preventing sensitive information from being logged in production.
 * On by default, we can set the environment variable REDACT_SECRETS to false to disable this behavior.
 */
const SHOULD_REDACT = process.env.REDACT_SECRETS !== 'false';
const SENSITIVE_KEYS = ['apiKey', 'password', 'secret', 'token'];
const MASK_REGEX = new RegExp(
    `(${SENSITIVE_KEYS.join('|')})(["']?\\s*[:=]\\s*)(["'])?.*?\\3`,
    'gi'
);
const maskFormat = winston.format((info) => {
    if (SHOULD_REDACT && typeof info.message === 'string') {
        info.message = info.message.replace(MASK_REGEX, '$1$2$3[REDACTED]$3');
    }
    return info;
});

export interface LoggerOptions {
    level?: string;
    silent?: boolean;
}

// Helper to get default log level from environment or fallback to 'info'
const getDefaultLogLevel = (): string => {
    const envLevel = process.env.SAIKI_LOG_LEVEL;
    if (envLevel && Object.keys(logLevels).includes(envLevel.toLowerCase())) {
        return envLevel.toLowerCase();
    }
    // Enable debug logging if DEBUG environment variable is set
    if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') {
        return 'debug';
    }
    return 'info';
};

export class Logger {
    private logger: winston.Logger;

    constructor(options: LoggerOptions = {}) {
        // Create Winston logger
        this.logger = winston.createLogger({
            levels: logLevels,
            level: options.level || getDefaultLogLevel(),
            silent: options.silent || false,
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                maskFormat(),
                winston.format.errors({ stack: true }),
                winston.format.splat(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.timestamp({ format: 'HH:mm:ss' }),
                        maskFormat(),
                        consoleFormat
                    ),
                }),
            ],
        });
    }

    // General logging methods with optional color parameter
    error(message: string, meta?: any, color?: ChalkColor) {
        this.logger.error(message, { ...meta, color });
    }

    warn(message: string, meta?: any, color?: ChalkColor) {
        this.logger.warn(message, { ...meta, color });
    }

    info(message: string, meta?: any, color?: ChalkColor) {
        this.logger.info(message, { ...meta, color });
    }

    http(message: string, meta?: any, color?: ChalkColor) {
        this.logger.http(message, { ...meta, color });
    }

    verbose(message: string, meta?: any, color?: ChalkColor) {
        this.logger.verbose(message, { ...meta, color });
    }

    debug(message: string | object, meta?: any, color?: ChalkColor) {
        const formattedMessage =
            typeof message === 'string' ? message : JSON.stringify(message, null, 2);
        this.logger.debug(formattedMessage, { ...meta, color });
    }

    silly(message: string, meta?: any, color?: ChalkColor) {
        this.logger.silly(message, { ...meta, color });
    }

    // Display AI response in a box
    displayAIResponse(response: any) {
        if (response.content) {
            console.log(
                boxen(chalk.white(response.content), {
                    padding: 1,
                    borderColor: 'yellow',
                    title: '🤖 AI Response',
                    titleAlignment: 'center',
                })
            );
        } else {
            console.log(chalk.yellow('AI is thinking...'));
        }
    }

    // Tool-related logging
    toolCall(toolName: string, args: any) {
        console.log(
            boxen(
                `${chalk.cyan('Tool Call')}: ${chalk.yellow(toolName)}\n${chalk.dim('Arguments')}:\n${chalk.white(JSON.stringify(args, null, 2))}`,
                { padding: 1, borderColor: 'blue', title: '🔧 Tool Call', titleAlignment: 'center' }
            )
        );
    }

    toolResult(result: any) {
        let displayText = '';
        let isError = false;
        let borderColor = 'green';
        let title = '✅ Tool Result';

        // Check if result indicates an error
        if (result?.error || result?.isError) {
            isError = true;
            borderColor = 'yellow';
            title = '⚠️ Tool Result (Error)';
        }

        // Handle different result formats
        if (result?.content && Array.isArray(result.content)) {
            // Standard MCP format with content array
            result.content.forEach((item: any) => {
                if (item.type === 'text') {
                    displayText += item.text;
                } else if (item.type === 'image' && item.url) {
                    displayText += `[Image URL: ${item.url}]`;
                } else if (item.type === 'image') {
                    displayText += `[Image Data: ${item.mimeType || 'unknown type'}]`;
                } else if (item.type === 'markdown') {
                    displayText += item.markdown;
                } else {
                    displayText += `[Unsupported content type: ${item.type}]`;
                }
                displayText += '\n';
            });
        } else if (result?.message) {
            // Error message format
            displayText = result.message;
            isError = true;
            borderColor = 'red';
            title = '❌ Tool Error';
        } else if (typeof result === 'string') {
            // Plain string response
            displayText = result;
        } else {
            // Fallback for any other format
            try {
                displayText = JSON.stringify(result, null, 2);
            } catch {
                displayText = `[Unparseable result: ${typeof result}]`;
            }
        }

        // Format empty results
        if (!displayText || displayText.trim() === '') {
            displayText = '[Empty result]';
        }

        // Apply color based on error status
        const textColor = isError ? chalk.yellow : chalk.green;
        console.log(
            boxen(textColor(displayText), {
                padding: 1,
                borderColor,
                title,
                titleAlignment: 'center',
            })
        );
    }

    // Configuration
    setLevel(level: string) {
        if (Object.keys(logLevels).includes(level.toLowerCase())) {
            this.logger.level = level.toLowerCase();
            this.debug(`Log level set to: ${level}`);
        } else {
            this.warn(`Invalid log level: ${level}. Using current level: ${this.logger.level}`);
        }
    }

    // Get current log level
    getLevel(): string {
        return this.logger.level;
    }
}

// Export a default instance with log level from environment
export const logger = new Logger();
