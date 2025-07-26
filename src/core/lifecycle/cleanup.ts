import { logger } from '@core/logger/logger.js';

/**
 * CleanupManager is responsible for managing and executing asynchronous
 * cleanup tasks during the graceful shutdown of an application.
 */
export class CleanupManager {
    // Stores registered cleanup tasks (each returns a Promise<void>)
    private cleanupTasks: Array<() => Promise<void>> = [];

    // Flag to ensure cleanup runs only once and no tasks are added during shutdown
    private isShuttingDown = false;

    /**
     * Registers a new async cleanup task to be executed during shutdown.
     * Throws an error if called after shutdown has started.
     *
     * @param task - An async function to be executed on shutdown
     */
    addCleanupTask(task: () => Promise<void>): void {
        if (this.isShuttingDown) {
            throw new Error('Cannot add cleanup tasks during shutdown');
        }
        this.cleanupTasks.push(task);
    }

    /**
     * Removes a previously registered cleanup task.
     *
     * @param task - The task function to remove from the list
     */
    removeCleanupTask(task: () => Promise<void>): void {
        const index = this.cleanupTasks.indexOf(task);
        if (index > -1) {
            this.cleanupTasks.splice(index, 1);
        }
    }

    /**
     * Executes all registered cleanup tasks.
     * Each task has a timeout of 5 seconds to complete.
     * Ensures graceful shutdown is attempted only once.
     */
    async executeCleanup(): Promise<void> {
        if (this.isShuttingDown) return; // Prevent multiple executions

        this.isShuttingDown = true;
        logger.info('Starting graceful shutdown...');

        // Create an array of cleanup promises with timeout handling
        const cleanupPromises = this.cleanupTasks.map(async (task, index) => {
            try {
                // Each task races against a 5-second timeout
                await Promise.race([
                    task(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Cleanup timeout')), 5000)
                    ),
                ]);
                logger.debug(`Cleanup task ${index + 1} completed`);
            } catch (error) {
                logger.error(`Cleanup task ${index + 1} failed:`, error);
            }
        });

        // Wait for all cleanup tasks to settle (complete or fail)
        await Promise.allSettled(cleanupPromises);
        logger.info('Graceful shutdown completed');
    }
}

// Export a singleton instance of CleanupManager to use throughout the app
export const cleanupManager = new CleanupManager();
