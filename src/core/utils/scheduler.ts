import { EventEmitter } from 'events';
import { logger } from '../logger/index.js';
import type { AgentEventBus } from '../events/index.js';

/**
 * Configuration for a scheduled task
 */
export interface ScheduledTask {
    id: string;
    message: string;
    sessionId?: string;
    metadata?: Record<string, any>;

    // Schedule configuration
    scheduledFor: Date;
    recurring?: {
        pattern: 'daily' | 'weekly' | 'monthly' | 'custom';
        interval?: number; // For custom patterns (in milliseconds)
        cron?: string; // For cron expressions (future enhancement)
    };

    // Execution tracking
    nextExecution?: Date;
    lastExecution?: Date;
    executionCount: number;
    maxExecutions?: number; // Limit recurring executions

    // State
    enabled: boolean;
    createdAt: Date;
}

/**
 * Options for creating a scheduled task
 */
export interface CreateScheduledTaskOptions {
    message: string;
    scheduledFor: Date;
    sessionId?: string;
    metadata?: Record<string, any>;
    recurring?: {
        pattern: 'daily' | 'weekly' | 'monthly' | 'custom';
        interval?: number;
        cron?: string;
    };
    maxExecutions?: number;
    enabled?: boolean;
}

/**
 * Scheduler service that can emit time-based events to trigger agent processing
 *
 * Features:
 * - One-time scheduled messages
 * - Recurring messages (daily, weekly, monthly, custom intervals)
 * - Cron-like expressions (future enhancement)
 * - Task management (enable/disable, list, delete)
 * - Integration with AgentEventBus
 */
export class SchedulerService extends EventEmitter {
    private tasks = new Map<string, ScheduledTask>();
    private timers = new Map<string, NodeJS.Timeout>();
    private isRunning = false;
    private cleanupInterval?: NodeJS.Timeout;

    constructor(
        private eventBus: AgentEventBus,
        private cleanupIntervalMs = 60000 // Clean up completed tasks every minute
    ) {
        super();
    }

    /**
     * Start the scheduler service
     */
    start(): void {
        if (this.isRunning) {
            logger.warn('Scheduler service is already running');
            return;
        }

        this.isRunning = true;

        // Schedule all existing tasks
        for (const task of this.tasks.values()) {
            if (task.enabled) {
                this.scheduleTask(task);
            }
        }

        // Set up periodic cleanup
        this.cleanupInterval = setInterval(() => {
            this.cleanupCompletedTasks();
        }, this.cleanupIntervalMs);

        logger.info('Scheduler service started', null, 'green');
    }

    /**
     * Stop the scheduler service
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        // Clear all timers
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();

        // Clear cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined as any;
        }

        logger.info('Scheduler service stopped');
    }

    /**
     * Create a new scheduled task
     */
    createTask(options: CreateScheduledTaskOptions): string {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const task: ScheduledTask = {
            id: taskId,
            message: options.message,
            scheduledFor: options.scheduledFor,
            nextExecution: options.scheduledFor,
            executionCount: 0,
            enabled: options.enabled !== false, // Default to true
            createdAt: new Date(),
        };

        // Add optional properties only if they exist
        if (options.sessionId) {
            task.sessionId = options.sessionId;
        }
        if (options.metadata) {
            task.metadata = options.metadata;
        }
        if (options.recurring) {
            task.recurring = options.recurring;
        }
        if (options.maxExecutions) {
            task.maxExecutions = options.maxExecutions;
        }

        this.tasks.set(taskId, task);

        if (this.isRunning && task.enabled) {
            this.scheduleTask(task);
        }

        logger.info(`Scheduled task created: ${taskId} for ${task.scheduledFor.toISOString()}`);
        return taskId;
    }

    /**
     * Get a task by ID
     */
    getTask(taskId: string): ScheduledTask | undefined {
        return this.tasks.get(taskId);
    }

    /**
     * List all tasks with optional filtering
     */
    listTasks(filter?: {
        enabled?: boolean;
        recurring?: boolean;
        sessionId?: string;
    }): ScheduledTask[] {
        const tasks = Array.from(this.tasks.values());

        if (!filter) {
            return tasks;
        }

        return tasks.filter((task) => {
            if (filter.enabled !== undefined && task.enabled !== filter.enabled) {
                return false;
            }
            if (filter.recurring !== undefined && !!task.recurring !== filter.recurring) {
                return false;
            }
            if (filter.sessionId && task.sessionId !== filter.sessionId) {
                return false;
            }
            return true;
        });
    }

    /**
     * Enable or disable a task
     */
    setTaskEnabled(taskId: string, enabled: boolean): boolean {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }

        task.enabled = enabled;

        if (enabled && this.isRunning) {
            this.scheduleTask(task);
        } else {
            this.unscheduleTask(taskId);
        }

        logger.info(`Task ${taskId} ${enabled ? 'enabled' : 'disabled'}`);
        return true;
    }

    /**
     * Delete a task
     */
    deleteTask(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }

        this.unscheduleTask(taskId);
        this.tasks.delete(taskId);

        logger.info(`Task ${taskId} deleted`);
        return true;
    }

    /**
     * Update the next execution time for a task
     */
    updateTaskSchedule(taskId: string, newScheduledFor: Date): boolean {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }

        task.scheduledFor = newScheduledFor;
        task.nextExecution = newScheduledFor;

        if (task.enabled && this.isRunning) {
            this.unscheduleTask(taskId);
            this.scheduleTask(task);
        }

        logger.info(`Task ${taskId} rescheduled for ${newScheduledFor.toISOString()}`);
        return true;
    }

    /**
     * Get scheduler statistics
     */
    getStats(): {
        totalTasks: number;
        enabledTasks: number;
        recurringTasks: number;
        pendingExecutions: number;
        isRunning: boolean;
    } {
        const tasks = Array.from(this.tasks.values());
        const enabledTasks = tasks.filter((t) => t.enabled);
        const recurringTasks = tasks.filter((t) => t.recurring);
        const pendingExecutions = this.timers.size;

        return {
            totalTasks: tasks.length,
            enabledTasks: enabledTasks.length,
            recurringTasks: recurringTasks.length,
            pendingExecutions,
            isRunning: this.isRunning,
        };
    }

    /**
     * Schedule a task for execution
     */
    private scheduleTask(task: ScheduledTask): void {
        const now = new Date();
        const delay = task.nextExecution!.getTime() - now.getTime();

        if (delay <= 0) {
            // Execute immediately if scheduled time has passed
            this.executeTask(task);
            return;
        }

        // Clear existing timer if any
        this.unscheduleTask(task.id);

        // Schedule the task
        const timer = setTimeout(() => {
            this.executeTask(task);
        }, delay);

        this.timers.set(task.id, timer);

        logger.debug(`Task ${task.id} scheduled to execute in ${Math.round(delay / 1000)}s`);
    }

    /**
     * Remove a task from the scheduler
     */
    private unscheduleTask(taskId: string): void {
        const timer = this.timers.get(taskId);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(taskId);
        }
    }

    /**
     * Execute a scheduled task
     */
    private executeTask(task: ScheduledTask): void {
        try {
            logger.info(`Executing scheduled task: ${task.id}`);

            // Update execution tracking
            task.lastExecution = new Date();
            task.executionCount++;

            // Emit the trigger event
            this.eventBus.emit('saiki:triggerConversation', {
                message: task.message,
                sessionId: task.sessionId,
                metadata: {
                    ...task.metadata,
                    triggeredBy: 'scheduler',
                    taskId: task.id,
                    executionCount: task.executionCount,
                },
                source: 'scheduler',
            });

            // Handle recurring tasks
            if (task.recurring && task.enabled) {
                // Check if we've reached max executions
                if (task.maxExecutions && task.executionCount >= task.maxExecutions) {
                    logger.info(
                        `Task ${task.id} reached max executions (${task.maxExecutions}), disabling`
                    );
                    task.enabled = false;
                    return;
                }

                // Calculate next execution time
                const nextExecution = this.calculateNextExecution(task);
                if (nextExecution) {
                    task.nextExecution = nextExecution;
                    task.scheduledFor = nextExecution;
                    this.scheduleTask(task);
                }
            } else {
                // One-time task, mark as completed
                task.enabled = false;
            }

            // Emit completion event
            this.emit('taskExecuted', {
                taskId: task.id,
                executionTime: task.lastExecution,
                executionCount: task.executionCount,
                isRecurring: !!task.recurring,
                nextExecution: task.nextExecution,
            });
        } catch (error) {
            logger.error(
                `Error executing scheduled task ${task.id}: ${error instanceof Error ? error.message : String(error)}`
            );

            // Emit error event
            this.emit('taskError', {
                taskId: task.id,
                error: error instanceof Error ? error.message : String(error),
                executionTime: new Date(),
            });
        }
    }

    /**
     * Calculate the next execution time for a recurring task
     */
    private calculateNextExecution(task: ScheduledTask): Date | null {
        if (!task.recurring || !task.lastExecution) {
            return null;
        }

        const lastExecution = task.lastExecution;
        let nextExecution: Date;

        switch (task.recurring.pattern) {
            case 'daily':
                nextExecution = new Date(lastExecution.getTime() + 24 * 60 * 60 * 1000);
                break;

            case 'weekly':
                nextExecution = new Date(lastExecution.getTime() + 7 * 24 * 60 * 60 * 1000);
                break;

            case 'monthly':
                nextExecution = new Date(lastExecution);
                nextExecution.setMonth(nextExecution.getMonth() + 1);
                break;

            case 'custom':
                if (!task.recurring.interval) {
                    logger.error(`Custom recurring task ${task.id} missing interval`);
                    return null;
                }
                nextExecution = new Date(lastExecution.getTime() + task.recurring.interval);
                break;

            default:
                logger.error(
                    `Unknown recurring pattern for task ${task.id}: ${task.recurring.pattern}`
                );
                return null;
        }

        return nextExecution;
    }

    /**
     * Clean up completed (non-recurring, disabled) tasks
     */
    private cleanupCompletedTasks(): void {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        let cleanedCount = 0;

        for (const [taskId, task] of this.tasks.entries()) {
            // Clean up non-recurring tasks that have been completed for more than an hour
            if (
                !task.enabled &&
                !task.recurring &&
                task.lastExecution &&
                task.lastExecution < oneHourAgo
            ) {
                this.tasks.delete(taskId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.debug(`Cleaned up ${cleanedCount} completed tasks`);
        }
    }
}
