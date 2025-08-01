import { z } from 'zod';
import { Tool, ToolExecutionContext } from '../types.js';
import type { SchedulerService, CreateScheduledTaskOptions } from '../../utils/scheduler.js';

/**
 * Create a new scheduled task
 * Allows agents to schedule one-time or recurring tasks for themselves
 */
export function createSchedulerCreateTool(scheduler: SchedulerService): Tool {
    return {
        id: 'scheduler_create_task',
        description:
            'Create a scheduled task. For one-time tasks: omit recurring field. For recurring tasks: include recurring object with pattern (daily/weekly/monthly/custom) and optional interval. Cannot convert one-time to recurring later. For custom intervals, use milliseconds (30000 = 30 seconds).',
        inputSchema: z.object({
            message: z.string().describe('Message to send to agent when task executes'),
            scheduledFor: z.string().describe('When to execute (ISO 8601 format)'),
            recurring: z
                .object({
                    pattern: z
                        .enum(['daily', 'weekly', 'monthly', 'custom'])
                        .describe('Pattern: daily, weekly, monthly, or custom'),
                    interval: z
                        .number()
                        .optional()
                        .describe(
                            'For custom: interval in milliseconds (e.g. 30000 for 30 seconds, 60000 for 1 minute)'
                        ),
                })
                .optional()
                .describe(
                    'Include for recurring tasks, omit for one-time. Use pattern: "custom" with interval for specific time periods'
                ),
            maxExecutions: z.number().optional().describe('Max executions (0 = unlimited)'),
            enabled: z.boolean().optional().describe('Enable immediately (default: true)'),
        }),

        execute: async (input: any, context?: ToolExecutionContext) => {
            try {
                const {
                    message,
                    scheduledFor,
                    sessionId,
                    recurring,
                    maxExecutions,
                    enabled = true,
                    metadata,
                } = input;

                // Parse the scheduled time
                const scheduledDate = new Date(scheduledFor);
                if (isNaN(scheduledDate.getTime())) {
                    return {
                        success: false,
                        error: 'Invalid scheduledFor date format. Use ISO 8601 format (e.g. "2024-01-15T10:30:00Z")',
                    };
                }

                // Validate future date
                if (scheduledDate <= new Date()) {
                    return {
                        success: false,
                        error: 'Scheduled time must be in the future',
                    };
                }

                // Build options
                const options: CreateScheduledTaskOptions = {
                    message,
                    scheduledFor: scheduledDate,
                    enabled,
                    sessionId: sessionId || context?.sessionId,
                    metadata: {
                        ...metadata,
                        createdBy: 'agent',
                        createdAt: new Date().toISOString(),
                    },
                };

                // Add recurring configuration if specified
                if (recurring) {
                    // Validate that pattern is provided
                    if (!recurring.pattern) {
                        return {
                            success: false,
                            error: 'Recurring tasks MUST include a "pattern" field. Valid patterns: "daily", "weekly", "monthly", "custom". For custom patterns, also include "interval" in milliseconds.',
                        };
                    }

                    // Warn about very small intervals that might cause issues
                    if (
                        recurring.pattern === 'custom' &&
                        recurring.interval &&
                        recurring.interval < 1000
                    ) {
                        return {
                            success: false,
                            error: `Interval too small: ${recurring.interval}ms. Minimum recommended: 1000ms (1 second). For 30 seconds, use 30000.`,
                        };
                    }

                    options.recurring = recurring;
                    if (maxExecutions) {
                        options.maxExecutions = maxExecutions;
                    }
                }

                const taskId = scheduler.createTask(options);
                const task = scheduler.getTask(taskId)!;

                const _recurringText = recurring
                    ? `recurring ${recurring.pattern}${recurring.interval ? ` (every ${recurring.interval / 1000}s)` : ''}`
                    : 'one-time';

                return {
                    success: true,
                    taskId,
                    message: `✅ Task created successfully: "${message}"`,
                    task: {
                        id: task.id,
                        message: task.message,
                        scheduledFor: task.scheduledFor.toISOString(),
                        nextExecution: task.nextExecution?.toISOString(),
                        recurring: !!task.recurring,
                        recurringPattern: task.recurring?.pattern,
                        recurringInterval: task.recurring?.interval,
                        maxExecutions: task.maxExecutions,
                        enabled: task.enabled,
                        sessionId: task.sessionId,
                        executionCount: task.executionCount,
                    },
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to create task: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    };
}

/**
 * List and search scheduled tasks
 * Allows agents to view their scheduled tasks with filtering options
 */
export function createSchedulerListTool(scheduler: SchedulerService): Tool {
    return {
        id: 'scheduler_list_tasks',
        description: 'List scheduled tasks with optional filtering.',
        inputSchema: z.object({
            enabled: z.boolean().optional().describe('Filter by enabled status'),
            recurring: z.boolean().optional().describe('Filter by recurring status'),
            sessionId: z.string().optional().describe('Filter by session ID'),
            includeCompleted: z.boolean().optional().describe('Include completed tasks'),
        }),

        execute: async (input: any, context?: ToolExecutionContext) => {
            try {
                const { enabled, recurring, sessionId, includeCompleted = false } = input;

                // Build filter
                const filter: any = {};
                if (enabled !== undefined) filter.enabled = enabled;
                if (recurring !== undefined) filter.recurring = recurring;
                if (sessionId) filter.sessionId = sessionId;
                else if (context?.sessionId) filter.sessionId = context.sessionId;

                const tasks = scheduler.listTasks(filter);

                // Filter out completed tasks unless requested
                const filteredTasks = includeCompleted
                    ? tasks
                    : tasks.filter((task) => task.enabled || task.recurring);

                if (filteredTasks.length === 0) {
                    return {
                        success: true,
                        tasks: [],
                        count: 0,
                        message: '📋 No scheduled tasks found',
                    };
                }

                const taskList = filteredTasks.map((task) => {
                    const _recurringText = task.recurring
                        ? `${task.recurring.pattern}${task.recurring.interval ? ` (${task.recurring.interval / 1000}s)` : ''}`
                        : 'one-time';

                    return {
                        id: task.id,
                        message: task.message,
                        scheduledFor: task.scheduledFor.toISOString(),
                        nextExecution: task.nextExecution?.toISOString(),
                        recurring: !!task.recurring,
                        recurringPattern: task.recurring?.pattern,
                        recurringInterval: task.recurring?.interval,
                        maxExecutions: task.maxExecutions,
                        enabled: task.enabled,
                        sessionId: task.sessionId,
                        executionCount: task.executionCount,
                        lastExecution: task.lastExecution?.toISOString(),
                        createdAt: task.createdAt.toISOString(),
                    };
                });

                return {
                    success: true,
                    tasks: taskList,
                    count: taskList.length,
                    message: `📋 Found ${taskList.length} scheduled task${taskList.length !== 1 ? 's' : ''}`,
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to list tasks: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    };
}

/**
 * Get detailed information about a specific scheduled task
 */
export function createSchedulerGetTool(scheduler: SchedulerService): Tool {
    return {
        id: 'scheduler_get_task',
        description: 'Get details for a specific task.',
        inputSchema: z.object({
            taskId: z.string().describe('Task ID'),
        }),

        execute: async (input: any, _context?: ToolExecutionContext) => {
            try {
                const { taskId } = input;

                const task = scheduler.getTask(taskId);
                if (!task) {
                    return {
                        success: false,
                        error: `Task not found: ${taskId}`,
                    };
                }

                return {
                    success: true,
                    task: {
                        id: task.id,
                        message: task.message,
                        scheduledFor: task.scheduledFor.toISOString(),
                        nextExecution: task.nextExecution?.toISOString(),
                        recurring: !!task.recurring,
                        recurringPattern: task.recurring?.pattern,
                        recurringInterval: task.recurring?.interval,
                        maxExecutions: task.maxExecutions,
                        enabled: task.enabled,
                        sessionId: task.sessionId,
                        executionCount: task.executionCount,
                        lastExecution: task.lastExecution?.toISOString(),
                        createdAt: task.createdAt.toISOString(),
                        metadata: task.metadata,
                    },
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to get task: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    };
}

/**
 * Update an existing scheduled task
 */
export function createSchedulerUpdateTool(scheduler: SchedulerService): Tool {
    return {
        id: 'scheduler_update_task',
        description:
            'Update task schedule or enabled status. Cannot add/remove recurring - delete and recreate for that.',
        inputSchema: z.object({
            taskId: z.string().describe('Task ID to update'),
            scheduledFor: z.string().optional().describe('New execution time (ISO 8601 format)'),
            enabled: z.boolean().optional().describe('Enable or disable task'),
        }),

        execute: async (input: any, _context?: ToolExecutionContext) => {
            try {
                const {
                    taskId,
                    message,
                    scheduledFor,
                    enabled,
                    recurring,
                    maxExecutions,
                    metadata,
                } = input;

                const task = scheduler.getTask(taskId);
                if (!task) {
                    return {
                        success: false,
                        error: `Task not found: ${taskId}`,
                    };
                }

                // Update schedule if provided
                if (scheduledFor) {
                    const newDate = new Date(scheduledFor);
                    if (isNaN(newDate.getTime())) {
                        return {
                            success: false,
                            error: 'Invalid scheduledFor date format. Use ISO 8601 format',
                        };
                    }
                    if (newDate <= new Date()) {
                        return {
                            success: false,
                            error: 'Scheduled time must be in the future',
                        };
                    }
                    scheduler.updateTaskSchedule(taskId, newDate);
                }

                // Update enabled status if provided
                if (enabled !== undefined) {
                    scheduler.setTaskEnabled(taskId, enabled);
                }

                // For other updates, we need to recreate the task
                // This is a limitation of the current scheduler service
                if (message || recurring !== undefined || maxExecutions !== undefined || metadata) {
                    return {
                        success: false,
                        error: 'Partial updates not supported. Use delete and recreate for message, recurring, or metadata changes.',
                    };
                }

                const updatedTask = scheduler.getTask(taskId)!;

                return {
                    success: true,
                    message: `✅ Task updated successfully: ${taskId}`,
                    task: {
                        id: updatedTask.id,
                        message: updatedTask.message,
                        scheduledFor: updatedTask.scheduledFor.toISOString(),
                        nextExecution: updatedTask.nextExecution?.toISOString(),
                        recurring: !!updatedTask.recurring,
                        recurringPattern: updatedTask.recurring?.pattern,
                        recurringInterval: updatedTask.recurring?.interval,
                        maxExecutions: updatedTask.maxExecutions,
                        enabled: updatedTask.enabled,
                        sessionId: updatedTask.sessionId,
                        executionCount: updatedTask.executionCount,
                    },
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to update task: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    };
}

/**
 * Enable or disable a scheduled task
 */
export function createSchedulerToggleTool(scheduler: SchedulerService): Tool {
    return {
        id: 'scheduler_toggle_task',
        description: 'Enable or disable a task.',
        inputSchema: z.object({
            taskId: z.string().describe('Task ID'),
            enabled: z.boolean().describe('Enable (true) or disable (false)'),
        }),

        execute: async (input: any, _context?: ToolExecutionContext) => {
            try {
                const { taskId, enabled } = input;

                const success = scheduler.setTaskEnabled(taskId, enabled);
                if (!success) {
                    return {
                        success: false,
                        error: `Task not found: ${taskId}`,
                    };
                }

                const task = scheduler.getTask(taskId)!;

                return {
                    success: true,
                    message: `✅ Task ${enabled ? 'enabled' : 'disabled'} successfully: ${taskId}`,
                    task: {
                        id: task.id,
                        message: task.message,
                        scheduledFor: task.scheduledFor.toISOString(),
                        nextExecution: task.nextExecution?.toISOString(),
                        recurring: !!task.recurring,
                        recurringPattern: task.recurring?.pattern,
                        recurringInterval: task.recurring?.interval,
                        maxExecutions: task.maxExecutions,
                        enabled: task.enabled,
                        sessionId: task.sessionId,
                        executionCount: task.executionCount,
                    },
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to toggle task: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    };
}

/**
 * Delete a scheduled task
 */
export function createSchedulerDeleteTool(scheduler: SchedulerService): Tool {
    return {
        id: 'scheduler_delete_task',
        description: 'Delete a task permanently.',
        inputSchema: z.object({
            taskId: z.string().describe('Task ID'),
        }),

        execute: async (input: any, _context?: ToolExecutionContext) => {
            try {
                const { taskId } = input;

                const success = scheduler.deleteTask(taskId);
                if (!success) {
                    return {
                        success: false,
                        error: `Task not found: ${taskId}`,
                    };
                }

                return {
                    success: true,
                    message: `🗑️ Task deleted successfully: ${taskId}`,
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to delete task: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    };
}

/**
 * Get scheduler statistics and status
 */
export function createSchedulerStatsTool(scheduler: SchedulerService): Tool {
    return {
        id: 'scheduler_get_stats',
        description: 'Get scheduler statistics.',
        inputSchema: z.object({}),

        execute: async (_input: any, _context?: ToolExecutionContext) => {
            try {
                const stats = scheduler.getStats();

                return {
                    success: true,
                    stats: {
                        totalTasks: stats.totalTasks,
                        enabledTasks: stats.enabledTasks,
                        recurringTasks: stats.recurringTasks,
                        pendingExecutions: stats.pendingExecutions,
                        isRunning: stats.isRunning,
                        disabledTasks: stats.totalTasks - stats.enabledTasks,
                        oneTimeTasks: stats.totalTasks - stats.recurringTasks,
                    },
                    message: `📊 Scheduler Statistics: ${stats.totalTasks} total tasks, ${stats.enabledTasks} enabled, ${stats.recurringTasks} recurring`,
                };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to get scheduler stats: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    };
}

// Legacy tool for backward compatibility
export function createSchedulerTool(scheduler: SchedulerService): Tool {
    return {
        id: 'schedule_task',
        description:
            'Schedule tasks for the agent. Use "interval" to make recurring (e.g. 30000 = every 30 seconds).',
        inputSchema: z.discriminatedUnion('action', [
            // Create a task
            z.object({
                action: z.literal('create'),
                message: z.string().describe('What the agent should do (e.g. "Tell me a joke")'),
                interval: z
                    .number()
                    .optional()
                    .describe(
                        'Repeat every X milliseconds (30000 = 30sec). Omit for one-time task.'
                    ),
                delayStart: z
                    .number()
                    .optional()
                    .describe(
                        'Wait X milliseconds before first execution. Default: start immediately.'
                    ),
                maxRuns: z
                    .number()
                    .optional()
                    .describe('Stop after X executions (for recurring tasks)'),
            }),

            // List tasks
            z.object({
                action: z.literal('list'),
            }),

            // Delete a task
            z.object({
                action: z.literal('delete'),
                taskId: z.string().describe('Task ID to delete'),
            }),
        ]),

        execute: async (input: any, _context?: ToolExecutionContext) => {
            switch (input.action) {
                case 'create': {
                    const { message, interval, delayStart = 0, maxRuns } = input;

                    // Calculate start time
                    const startTime = new Date(Date.now() + delayStart);

                    // Build options
                    const options: CreateScheduledTaskOptions = {
                        message,
                        scheduledFor: startTime,
                        enabled: true,
                    };

                    // Add recurring config if interval specified
                    if (interval) {
                        options.recurring = {
                            pattern: 'custom',
                            interval: interval,
                        };
                        if (maxRuns) {
                            options.maxExecutions = maxRuns;
                        }
                    }

                    const taskId = scheduler.createTask(options);
                    const task = scheduler.getTask(taskId)!;

                    const recurringText = interval
                        ? `every ${interval / 1000}s${maxRuns ? ` (max ${maxRuns} times)` : ''}`
                        : 'once';

                    return {
                        success: true,
                        taskId,
                        message: `✅ Task scheduled ${recurringText}: "${message}"`,
                        task: {
                            id: task.id,
                            message: task.message,
                            recurring: !!task.recurring,
                            interval: task.recurring?.interval,
                            nextRun: task.nextExecution?.toISOString(),
                        },
                    };
                }

                case 'list': {
                    const tasks = scheduler.listTasks({ enabled: true });

                    if (tasks.length === 0) {
                        return {
                            success: true,
                            tasks: [],
                            message: '📋 No scheduled tasks',
                        };
                    }

                    const taskList = tasks.map((task) => {
                        const recurringText = task.recurring
                            ? `(every ${(task.recurring.interval || 0) / 1000}s)`
                            : '(one-time)';

                        return {
                            id: task.id,
                            message: task.message,
                            type: recurringText,
                            executions: task.executionCount,
                            nextRun: task.nextExecution?.toISOString(),
                        };
                    });

                    return {
                        success: true,
                        tasks: taskList,
                        message: `📋 ${tasks.length} scheduled task${tasks.length !== 1 ? 's' : ''}`,
                    };
                }

                case 'delete': {
                    const { taskId } = input;
                    const success = scheduler.deleteTask(taskId);

                    if (!success) {
                        return {
                            success: false,
                            message: `❌ Task not found: ${taskId}`,
                        };
                    }

                    return {
                        success: true,
                        message: `🗑️ Task deleted: ${taskId}`,
                    };
                }

                default:
                    return {
                        success: false,
                        message: '❌ Invalid action. Use: create, list, or delete',
                    };
            }
        },
    };
}
