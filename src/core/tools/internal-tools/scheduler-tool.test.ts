import { describe, test, expect, beforeEach, vi } from 'vitest';
import { SchedulerService } from '../../utils/scheduler.js';
import { AgentEventBus } from '../../events/index.js';
import {
    createSchedulerCreateTool,
    createSchedulerListTool,
    createSchedulerGetTool,
    createSchedulerUpdateTool,
    createSchedulerToggleTool,
    createSchedulerDeleteTool,
    createSchedulerStatsTool,
    createSchedulerTool, // Legacy tool
} from './scheduler-tool.js';

describe('Scheduler Tools', () => {
    let scheduler: SchedulerService;
    let eventBus: AgentEventBus;

    beforeEach(() => {
        eventBus = new AgentEventBus();
        scheduler = new SchedulerService(eventBus);
        scheduler.start();
    });

    describe('scheduler_create_task', () => {
        test('creates a one-time task successfully', async () => {
            const tool = createSchedulerCreateTool(scheduler);
            const futureDate = new Date(Date.now() + 60000); // 1 minute from now

            const result = await tool.execute({
                message: 'Test one-time task',
                scheduledFor: futureDate.toISOString(),
            });

            expect(result.success).toBe(true);
            expect(result.taskId).toBeDefined();
            expect(result.task.message).toBe('Test one-time task');
            expect(result.task.recurring).toBe(false);
        });

        test('creates a recurring task successfully', async () => {
            const tool = createSchedulerCreateTool(scheduler);
            const futureDate = new Date(Date.now() + 60000);

            const result = await tool.execute({
                message: 'Test recurring task',
                scheduledFor: futureDate.toISOString(),
                recurring: {
                    pattern: 'daily',
                },
                maxExecutions: 5,
            });

            expect(result.success).toBe(true);
            expect(result.taskId).toBeDefined();
            expect(result.task.recurring).toBe(true);
            expect(result.task.recurringPattern).toBe('daily');
            expect(result.task.maxExecutions).toBe(5);
        });

        test('rejects past dates', async () => {
            const tool = createSchedulerCreateTool(scheduler);
            const pastDate = new Date(Date.now() - 60000); // 1 minute ago

            const result = await tool.execute({
                message: 'Test task',
                scheduledFor: pastDate.toISOString(),
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('future');
        });

        test('rejects invalid date format', async () => {
            const tool = createSchedulerCreateTool(scheduler);

            const result = await tool.execute({
                message: 'Test task',
                scheduledFor: 'invalid-date',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid scheduledFor date format');
        });

        test('uses session context when sessionId not provided', async () => {
            const tool = createSchedulerCreateTool(scheduler);
            const futureDate = new Date(Date.now() + 60000);

            const result = await tool.execute(
                {
                    message: 'Test task with session',
                    scheduledFor: futureDate.toISOString(),
                },
                { sessionId: 'test-session' }
            );

            expect(result.success).toBe(true);
            expect(result.task.sessionId).toBe('test-session');
        });
    });

    describe('scheduler_list_tasks', () => {
        test('lists tasks with filtering', async () => {
            const tool = createSchedulerListTool(scheduler);

            // Create some test tasks
            const createTool = createSchedulerCreateTool(scheduler);
            const futureDate = new Date(Date.now() + 60000);

            await createTool.execute({
                message: 'Task 1',
                scheduledFor: futureDate.toISOString(),
            });

            await createTool.execute({
                message: 'Task 2',
                scheduledFor: futureDate.toISOString(),
                recurring: { pattern: 'daily' },
            });

            const result = await tool.execute({
                enabled: true,
            });

            expect(result.success).toBe(true);
            expect(result.tasks.length).toBeGreaterThanOrEqual(2);
            expect(result.count).toBeGreaterThanOrEqual(2);
        });

        test('returns empty list when no tasks match filter', async () => {
            const tool = createSchedulerListTool(scheduler);

            const result = await tool.execute({
                enabled: false,
            });

            expect(result.success).toBe(true);
            expect(result.tasks).toEqual([]);
            expect(result.count).toBe(0);
        });

        test('filters by session ID', async () => {
            const tool = createSchedulerListTool(scheduler);
            const createTool = createSchedulerCreateTool(scheduler);
            const futureDate = new Date(Date.now() + 60000);

            await createTool.execute(
                {
                    message: 'Session task',
                    scheduledFor: futureDate.toISOString(),
                },
                { sessionId: 'test-session' }
            );

            const result = await tool.execute({
                sessionId: 'test-session',
            });

            expect(result.success).toBe(true);
            expect(result.tasks.length).toBeGreaterThan(0);
            expect(result.tasks[0].sessionId).toBe('test-session');
        });
    });

    describe('scheduler_get_task', () => {
        test('retrieves task details successfully', async () => {
            const createTool = createSchedulerCreateTool(scheduler);
            const getTool = createSchedulerGetTool(scheduler);
            const futureDate = new Date(Date.now() + 60000);

            const createResult = await createTool.execute({
                message: 'Test task for retrieval',
                scheduledFor: futureDate.toISOString(),
            });

            const result = await getTool.execute({
                taskId: createResult.taskId,
            });

            expect(result.success).toBe(true);
            expect(result.task.id).toBe(createResult.taskId);
            expect(result.task.message).toBe('Test task for retrieval');
        });

        test('returns error for non-existent task', async () => {
            const tool = createSchedulerGetTool(scheduler);

            const result = await tool.execute({
                taskId: 'non-existent-task',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Task not found');
        });
    });

    describe('scheduler_update_task', () => {
        test('updates task schedule successfully', async () => {
            const createTool = createSchedulerCreateTool(scheduler);
            const updateTool = createSchedulerUpdateTool(scheduler);
            const futureDate = new Date(Date.now() + 60000);
            const newDate = new Date(Date.now() + 120000);

            const createResult = await createTool.execute({
                message: 'Test task for update',
                scheduledFor: futureDate.toISOString(),
            });

            const result = await updateTool.execute({
                taskId: createResult.taskId,
                scheduledFor: newDate.toISOString(),
            });

            expect(result.success).toBe(true);
            expect(result.task.scheduledFor).toBe(newDate.toISOString());
        });

        test('updates task enabled status', async () => {
            const createTool = createSchedulerCreateTool(scheduler);
            const updateTool = createSchedulerUpdateTool(scheduler);
            const futureDate = new Date(Date.now() + 60000);

            const createResult = await createTool.execute({
                message: 'Test task for disable',
                scheduledFor: futureDate.toISOString(),
            });

            const result = await updateTool.execute({
                taskId: createResult.taskId,
                enabled: false,
            });

            expect(result.success).toBe(true);
            expect(result.task.enabled).toBe(false);
        });

        test('returns error for non-existent task', async () => {
            const tool = createSchedulerUpdateTool(scheduler);

            const result = await tool.execute({
                taskId: 'non-existent-task',
                enabled: false,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Task not found');
        });
    });

    describe('scheduler_toggle_task', () => {
        test('enables and disables task successfully', async () => {
            const createTool = createSchedulerCreateTool(scheduler);
            const toggleTool = createSchedulerToggleTool(scheduler);
            const futureDate = new Date(Date.now() + 60000);

            const createResult = await createTool.execute({
                message: 'Test task for toggle',
                scheduledFor: futureDate.toISOString(),
            });

            // Disable the task
            const disableResult = await toggleTool.execute({
                taskId: createResult.taskId,
                enabled: false,
            });

            expect(disableResult.success).toBe(true);
            expect(disableResult.task.enabled).toBe(false);

            // Re-enable the task
            const enableResult = await toggleTool.execute({
                taskId: createResult.taskId,
                enabled: true,
            });

            expect(enableResult.success).toBe(true);
            expect(enableResult.task.enabled).toBe(true);
        });

        test('returns error for non-existent task', async () => {
            const tool = createSchedulerToggleTool(scheduler);

            const result = await tool.execute({
                taskId: 'non-existent-task',
                enabled: false,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Task not found');
        });
    });

    describe('scheduler_delete_task', () => {
        test('deletes task successfully', async () => {
            const createTool = createSchedulerCreateTool(scheduler);
            const deleteTool = createSchedulerDeleteTool(scheduler);
            const futureDate = new Date(Date.now() + 60000);

            const createResult = await createTool.execute({
                message: 'Test task for deletion',
                scheduledFor: futureDate.toISOString(),
            });

            const result = await deleteTool.execute({
                taskId: createResult.taskId,
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain('deleted successfully');

            // Verify task is actually deleted
            const getTool = createSchedulerGetTool(scheduler);
            const getResult = await getTool.execute({
                taskId: createResult.taskId,
            });

            expect(getResult.success).toBe(false);
        });

        test('returns error for non-existent task', async () => {
            const tool = createSchedulerDeleteTool(scheduler);

            const result = await tool.execute({
                taskId: 'non-existent-task',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Task not found');
        });
    });

    describe('scheduler_get_stats', () => {
        test('returns scheduler statistics', async () => {
            const tool = createSchedulerStatsTool(scheduler);

            const result = await tool.execute({});

            expect(result.success).toBe(true);
            expect(result.stats).toBeDefined();
            expect(result.stats.totalTasks).toBeDefined();
            expect(result.stats.enabledTasks).toBeDefined();
            expect(result.stats.recurringTasks).toBeDefined();
            expect(result.stats.pendingExecutions).toBeDefined();
            expect(result.stats.isRunning).toBeDefined();
        });
    });

    describe('Legacy schedule_task tool', () => {
        test('creates task with legacy interface', async () => {
            const tool = createSchedulerTool(scheduler);

            const result = await tool.execute({
                action: 'create',
                message: 'Legacy test task',
                interval: 30000, // 30 seconds
                delayStart: 1000, // 1 second delay
                maxRuns: 3,
            });

            expect(result.success).toBe(true);
            expect(result.taskId).toBeDefined();
            expect(result.task.recurring).toBe(true);
            expect(result.task.interval).toBe(30000);
        });

        test('lists tasks with legacy interface', async () => {
            const tool = createSchedulerTool(scheduler);

            const result = await tool.execute({
                action: 'list',
            });

            expect(result.success).toBe(true);
            expect(result.tasks).toBeDefined();
        });

        test('deletes task with legacy interface', async () => {
            const tool = createSchedulerTool(scheduler);

            // First create a task
            const createResult = await tool.execute({
                action: 'create',
                message: 'Task to delete',
                delayStart: 1000,
            });

            // Then delete it
            const deleteResult = await tool.execute({
                action: 'delete',
                taskId: createResult.taskId,
            });

            expect(deleteResult.success).toBe(true);
        });

        test('handles invalid action', async () => {
            const tool = createSchedulerTool(scheduler);

            const result = await tool.execute({
                action: 'invalid',
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Invalid action');
        });
    });

    describe('Error handling', () => {
        test('handles scheduler service errors gracefully', async () => {
            const tool = createSchedulerCreateTool(scheduler);

            // Mock scheduler to throw error
            vi.spyOn(scheduler, 'createTask').mockImplementation(() => {
                throw new Error('Scheduler service error');
            });

            const result = await tool.execute({
                message: 'Test task',
                scheduledFor: new Date(Date.now() + 60000).toISOString(),
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to create task');
        });
    });
});
