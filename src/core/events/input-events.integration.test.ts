import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaikiAgent } from '../ai/agent/SaikiAgent.js';
import type { AgentConfig } from '../config/schemas.js';
import { SchedulerService } from '../utils/scheduler.js';
import { logger } from '../logger/index.js';

describe('Input Events Integration: Scheduled Triggers & Event-Driven Processing', () => {
    let agent: SaikiAgent;
    let mockConfig: AgentConfig;

    beforeEach(async () => {
        // Create a minimal config for testing
        mockConfig = {
            systemPrompt: 'You are a helpful AI assistant.',
            llm: {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20240620',
                apiKey: 'test-key',
                router: 'in-built',
            },
            mcpServers: {},
            storage: {
                cache: { type: 'in-memory' },
                database: { type: 'in-memory' },
            },
            sessions: {
                maxSessions: 10,
                sessionTTL: 3600,
            },
            toolConfirmation: {
                mode: 'auto-approve',
                allowedToolsStorage: 'memory',
                timeout: 30000,
            },
        };

        agent = new SaikiAgent(mockConfig);
        await agent.start();

        // Mock the agent.run method to avoid actual LLM calls
        vi.spyOn(agent, 'run').mockResolvedValue('Mocked AI response');
    });

    afterEach(async () => {
        if (agent && agent.isStarted()) {
            await agent.stop();
        }
        vi.restoreAllMocks();
    });

    describe('Input Event Triggers', () => {
        it('should process saiki:triggerConversation events', async () => {
            const runSpy = vi.spyOn(agent, 'run');

            // Trigger a conversation event
            agent.triggerInputEvent('saiki:triggerConversation', {
                message: 'Hello from scheduler!',
                sessionId: 'test-session',
                metadata: { source: 'test' },
                source: 'test-trigger',
            });

            // Wait a bit for async processing
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(runSpy).toHaveBeenCalledWith(
                'Hello from scheduler!',
                undefined,
                'test-session',
                false
            );
        });

        it('should process saiki:webhookReceived events', async () => {
            const runSpy = vi.spyOn(agent, 'run');

            // Trigger a webhook event
            agent.triggerInputEvent('saiki:webhookReceived', {
                webhookId: 'wh_test_123',
                payload: { data: 'test payload' },
                headers: { 'content-type': 'application/json' },
                source: 'github',
                transformedMessage: 'GitHub webhook received with test data',
                sessionId: 'webhook-session',
            });

            // Wait a bit for async processing
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(runSpy).toHaveBeenCalledWith(
                'GitHub webhook received with test data',
                undefined,
                'webhook-session',
                false
            );
        });

        it('should process saiki:externalTrigger events', async () => {
            const runSpy = vi.spyOn(agent, 'run');

            // Trigger an external event
            agent.triggerInputEvent('saiki:externalTrigger', {
                triggerId: 'ext_trigger_123',
                source: 'cron-system',
                data: { jobId: 'daily-report', status: 'completed' },
                message: 'Daily report generation completed',
                sessionId: 'cron-session',
                metadata: { reportDate: '2024-01-15' },
            });

            // Wait a bit for async processing
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(runSpy).toHaveBeenCalledWith(
                'Daily report generation completed',
                undefined,
                'cron-session',
                false
            );
        });

        it('should handle external triggers without explicit message', async () => {
            const runSpy = vi.spyOn(agent, 'run');

            // Trigger an external event without explicit message
            agent.triggerInputEvent('saiki:externalTrigger', {
                triggerId: 'ext_trigger_456',
                source: 'monitoring-system',
                data: { alert: 'CPU usage high', threshold: 90 },
                sessionId: 'monitoring-session',
            });

            // Wait a bit for async processing
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(runSpy).toHaveBeenCalledWith(
                expect.stringContaining('External trigger from monitoring-system:'),
                undefined,
                'monitoring-session',
                false
            );
        });
    });

    describe('Scheduler Service Integration', () => {
        it('should create and execute scheduled tasks', async () => {
            const runSpy = vi.spyOn(agent, 'run');

            // Create a task scheduled for 100ms from now
            const scheduledTime = new Date(Date.now() + 100);
            const taskId = agent.createScheduledTask({
                message: 'Scheduled reminder: Check system status',
                scheduledFor: scheduledTime,
                sessionId: 'scheduled-session',
                metadata: { type: 'reminder' },
            });

            expect(taskId).toMatch(/^task_\d+_\w+$/);

            // Wait for the task to execute
            await new Promise((resolve) => setTimeout(resolve, 200));

            expect(runSpy).toHaveBeenCalledWith(
                'Scheduled reminder: Check system status',
                undefined,
                'scheduled-session',
                false
            );

            // Task should be disabled after execution (one-time task)
            const task = agent.getScheduledTask(taskId);
            expect(task?.enabled).toBe(false);
            expect(task?.executionCount).toBe(1);
        });

        it('should handle recurring scheduled tasks', async () => {
            const runSpy = vi.spyOn(agent, 'run');

            // Create a recurring task with very short interval for testing
            const scheduledTime = new Date(Date.now() + 50);
            const taskId = agent.createScheduledTask({
                message: 'Recurring health check',
                scheduledFor: scheduledTime,
                sessionId: 'health-check-session',
                recurring: {
                    pattern: 'custom',
                    interval: 100, // 100ms for testing
                },
                maxExecutions: 2, // Limit to 2 executions for testing
            });

            // Wait for both executions
            await new Promise((resolve) => setTimeout(resolve, 300));

            expect(runSpy).toHaveBeenCalledTimes(2);
            expect(runSpy).toHaveBeenCalledWith(
                'Recurring health check',
                undefined,
                'health-check-session',
                false
            );

            // Task should be disabled after reaching max executions
            const task = agent.getScheduledTask(taskId);
            expect(task?.enabled).toBe(false);
            expect(task?.executionCount).toBe(2);
        });

        it('should support scheduler management operations', () => {
            const futureTime = new Date(Date.now() + 10000);

            // Create a task
            const taskId = agent.createScheduledTask({
                message: 'Future task',
                scheduledFor: futureTime,
                sessionId: 'future-session',
            });

            // Get the task
            const task = agent.getScheduledTask(taskId);
            expect(task).toBeDefined();
            expect(task?.message).toBe('Future task');
            expect(task?.enabled).toBe(true);

            // List tasks
            const tasks = agent.listScheduledTasks();
            expect(tasks).toHaveLength(1);
            expect(tasks[0]?.id).toBe(taskId);

            // Disable the task
            const disableResult = agent.setScheduledTaskEnabled(taskId, false);
            expect(disableResult).toBe(true);

            const disabledTask = agent.getScheduledTask(taskId);
            expect(disabledTask?.enabled).toBe(false);

            // Update schedule
            const newTime = new Date(Date.now() + 20000);
            const updateResult = agent.updateScheduledTask(taskId, newTime);
            expect(updateResult).toBe(true);

            const updatedTask = agent.getScheduledTask(taskId);
            expect(updatedTask?.scheduledFor.getTime()).toBe(newTime.getTime());

            // Delete the task
            const deleteResult = agent.deleteScheduledTask(taskId);
            expect(deleteResult).toBe(true);

            const deletedTask = agent.getScheduledTask(taskId);
            expect(deletedTask).toBeUndefined();
        });

        it('should provide scheduler statistics', () => {
            // Create some tasks
            const futureTime1 = new Date(Date.now() + 10000);
            const futureTime2 = new Date(Date.now() + 20000);

            agent.createScheduledTask({
                message: 'Task 1',
                scheduledFor: futureTime1,
            });

            agent.createScheduledTask({
                message: 'Task 2',
                scheduledFor: futureTime2,
                recurring: { pattern: 'daily' },
            });

            const stats = agent.getSchedulerStats();
            expect(stats.totalTasks).toBe(2);
            expect(stats.enabledTasks).toBe(2);
            expect(stats.recurringTasks).toBe(1);
            expect(stats.isRunning).toBe(true);
            expect(stats.pendingExecutions).toBe(2);
        });

        it('should filter tasks by criteria', () => {
            const futureTime = new Date(Date.now() + 10000);

            // Create different types of tasks
            agent.createScheduledTask({
                message: 'One-time task',
                scheduledFor: futureTime,
                sessionId: 'session-1',
            });

            const recurringTaskId = agent.createScheduledTask({
                message: 'Recurring task',
                scheduledFor: futureTime,
                sessionId: 'session-2',
                recurring: { pattern: 'daily' },
            });

            // Disable one task
            agent.setScheduledTaskEnabled(recurringTaskId, false);

            // Filter by enabled
            const enabledTasks = agent.listScheduledTasks({ enabled: true });
            expect(enabledTasks).toHaveLength(1);
            expect(enabledTasks[0]?.message).toBe('One-time task');

            // Filter by recurring
            const recurringTasks = agent.listScheduledTasks({ recurring: true });
            expect(recurringTasks).toHaveLength(1);
            expect(recurringTasks[0]?.message).toBe('Recurring task');

            // Filter by session
            const session1Tasks = agent.listScheduledTasks({ sessionId: 'session-1' });
            expect(session1Tasks).toHaveLength(1);
            expect(session1Tasks[0]?.sessionId).toBe('session-1');
        });
    });

    describe('Event-Driven Architecture Integration', () => {
        it('should demonstrate complete event-driven workflow', async () => {
            const runSpy = vi.spyOn(agent, 'run');

            // Step 1: Schedule a task that triggers immediately
            const immediateTime = new Date(Date.now() + 50);
            agent.createScheduledTask({
                message: 'Automated system check initiated',
                scheduledFor: immediateTime,
                sessionId: 'automation-session',
                metadata: {
                    type: 'system-check',
                    priority: 'high',
                    triggered_by: 'scheduler',
                },
            });

            // Step 2: Simulate an external webhook trigger
            setTimeout(() => {
                agent.triggerInputEvent('saiki:webhookReceived', {
                    webhookId: 'gh_webhook_789',
                    payload: {
                        action: 'deployment_completed',
                        environment: 'production',
                        commit: 'abc123',
                    },
                    headers: { 'x-github-event': 'deployment' },
                    source: 'github',
                    transformedMessage: 'Production deployment completed for commit abc123',
                    sessionId: 'deployment-session',
                });
            }, 100);

            // Step 3: Simulate an external monitoring trigger
            setTimeout(() => {
                agent.triggerInputEvent('saiki:externalTrigger', {
                    triggerId: 'monitoring_alert_456',
                    source: 'datadog',
                    data: {
                        alert_type: 'metric',
                        metric: 'cpu_usage',
                        value: 95,
                        threshold: 90,
                        severity: 'warning',
                    },
                    message: 'CPU usage alert: 95% (threshold: 90%)',
                    sessionId: 'monitoring-session',
                    metadata: { alert_id: 'alert_456' },
                });
            }, 150);

            // Wait for all events to process
            await new Promise((resolve) => setTimeout(resolve, 300));

            // Verify all three events were processed
            expect(runSpy).toHaveBeenCalledTimes(3);

            expect(runSpy).toHaveBeenNthCalledWith(
                1,
                'Automated system check initiated',
                undefined,
                'automation-session',
                false
            );

            expect(runSpy).toHaveBeenNthCalledWith(
                2,
                'Production deployment completed for commit abc123',
                undefined,
                'deployment-session',
                false
            );

            expect(runSpy).toHaveBeenNthCalledWith(
                3,
                'CPU usage alert: 95% (threshold: 90%)',
                undefined,
                'monitoring-session',
                false
            );
        });

        it('should handle event processing errors gracefully', async () => {
            // Mock agent.run to throw an error
            const runSpy = vi.spyOn(agent, 'run').mockRejectedValue(new Error('Processing failed'));
            const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

            // Trigger an event that will fail
            agent.triggerInputEvent('saiki:triggerConversation', {
                message: 'This will fail',
                source: 'error-test',
            });

            // Wait for processing
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(runSpy).toHaveBeenCalled();
            // Error should be logged, not thrown
            expect(loggerSpy).toHaveBeenCalled();

            loggerSpy.mockRestore();
        });
    });
});
