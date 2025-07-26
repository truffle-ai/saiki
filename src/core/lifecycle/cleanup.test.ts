import { vi, describe, it, expect, beforeEach } from 'vitest';
import { cleanupManager } from './cleanup.js';
import { logger } from '@core/logger/logger.js';

// Mock the logger to prevent console output during tests
vi.mock('@core/logger/logger.js', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('CleanupManager', () => {
    // Reset the singleton instance before each test to ensure a clean state
    beforeEach(() => {
        // Reset the singleton instance state
        (cleanupManager as any).cleanupTasks = [];
        (cleanupManager as any).isShuttingDown = false;

        // Reset the mock logger's call history
        vi.clearAllMocks();
    });

    it('should execute all cleanup tasks on shutdown', async () => {
        // Arrange
        // Explicitly type the mock functions to return Promise<void>
        const cleanupSpy1 = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const cleanupSpy2 = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

        // Act
        cleanupManager.addCleanupTask(cleanupSpy1);
        cleanupManager.addCleanupTask(cleanupSpy2);

        await cleanupManager.executeCleanup();

        // Assert
        expect(cleanupSpy1).toHaveBeenCalledTimes(1);
        expect(cleanupSpy2).toHaveBeenCalledTimes(1);
        expect(logger.info).toHaveBeenCalledWith('Starting graceful shutdown...');
        expect(logger.info).toHaveBeenCalledWith('Graceful shutdown completed');
    });

    it('should handle cleanup task failures gracefully', async () => {
        // Arrange
        const failingTask = vi
            .fn<() => Promise<void>>()
            .mockRejectedValue(new Error('Cleanup failed'));
        const successTask = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

        // Act
        cleanupManager.addCleanupTask(failingTask);
        cleanupManager.addCleanupTask(successTask);

        await cleanupManager.executeCleanup();

        // Assert
        expect(failingTask).toHaveBeenCalledTimes(1);
        expect(successTask).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Cleanup task'),
            expect.any(Error)
        );
        expect(logger.info).toHaveBeenCalledWith('Graceful shutdown completed');
    });

    it('should not add tasks after shutdown has started', async () => {
        // Arrange
        const initialTask = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const lateTask = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

        cleanupManager.addCleanupTask(initialTask);

        // Act
        const cleanupPromise = cleanupManager.executeCleanup();

        // Assert
        // We expect adding a task here to throw an error
        expect(() => cleanupManager.addCleanupTask(lateTask)).toThrow(
            'Cannot add cleanup tasks during shutdown'
        );

        // Wait for the initial cleanup to finish
        await cleanupPromise;
        expect(initialTask).toHaveBeenCalledTimes(1);
        expect(lateTask).not.toHaveBeenCalled();
    });

    it('should not execute cleanup more than once', async () => {
        // Arrange
        const cleanupSpy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
        cleanupManager.addCleanupTask(cleanupSpy);

        // Act
        const firstCleanup = cleanupManager.executeCleanup();
        const secondCleanup = cleanupManager.executeCleanup();

        await Promise.all([firstCleanup, secondCleanup]);

        // Assert
        expect(cleanupSpy).toHaveBeenCalledTimes(1);
        expect(logger.info).toHaveBeenCalledWith('Starting graceful shutdown...');
        // The logger info for completion should also only be called once
        expect(logger.info).toHaveBeenCalledWith('Graceful shutdown completed');
        expect(logger.info).toHaveBeenCalledTimes(2); // One for start, one for finish
    });

    it('should timeout a long-running task', async () => {
        // Arrange
        vi.useFakeTimers();

        // A task that will never resolve on its own. It's important to type it correctly.
        const longRunningTask = vi.fn<() => Promise<void>>(() => new Promise(() => {}));
        const successTask = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

        cleanupManager.addCleanupTask(longRunningTask);
        cleanupManager.addCleanupTask(successTask);

        const cleanupPromise = cleanupManager.executeCleanup();

        // Act
        // Advance time by just under the timeout
        vi.advanceTimersByTime(4999);
        await Promise.resolve(); // Allow promises to resolve
        expect(longRunningTask).toHaveBeenCalledTimes(1);

        // Advance time past the timeout
        vi.advanceTimersByTime(1);
        await Promise.resolve();

        await cleanupPromise;

        // Assert
        expect(longRunningTask).toHaveBeenCalledTimes(1);
        expect(successTask).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Cleanup task'),
            expect.objectContaining({ message: 'Cleanup timeout' })
        );

        vi.useRealTimers();
    });

    it('should allow a cleanup task to be removed', async () => {
        // Arrange
        const taskToRemove = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const remainingTask = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

        cleanupManager.addCleanupTask(taskToRemove);
        cleanupManager.addCleanupTask(remainingTask);

        // Act
        cleanupManager.removeCleanupTask(taskToRemove);
        await cleanupManager.executeCleanup();

        // Assert
        expect(taskToRemove).not.toHaveBeenCalled();
        expect(remainingTask).toHaveBeenCalledTimes(1);
    });
});
