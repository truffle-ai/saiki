/**
 * Conversation Commands Module
 *
 * This module provides centralized access to all conversation-related commands and utilities.
 * It serves as the main entry point for conversation management functionality in the CLI.
 *
 * Exports:
 * - sessionCommands: Complete session command definition with all subcommands
 * - historyCommand: Standalone history command
 * - searchCommand: Standalone search command
 * - conversationCommands: Array of all conversation-related commands
 * - Formatter utilities from helpers (re-exported for convenience)
 */

export { sessionCommands, historyCommand, searchCommand } from './conversation-commands.js';
export { formatSessionInfo, formatHistoryMessage } from './helpers/formatters.js';

// Export all conversation commands as a convenient array
import { sessionCommands, historyCommand, searchCommand } from './conversation-commands.js';
export const conversationCommands = [sessionCommands, historyCommand, searchCommand];
