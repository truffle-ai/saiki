import type { SaikiAgent } from '@core/index.js';
import { logger } from '@core/index.js';

export function registerGracefulShutdown(agent: SaikiAgent): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGUSR2'];

    let isShuttingDown = false;

    signals.forEach((signal) => {
        process.on(signal, async () => {
            if (isShuttingDown) return; // Prevent multiple shutdowns
            isShuttingDown = true;

            logger.info(`Received ${signal}, shutting down gracefully...`);
            try {
                await agent.stop(); // Use existing comprehensive shutdown
                process.exit(0);
            } catch (error) {
                logger.error('Shutdown error:', error);
                process.exit(1);
            }
        });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
        console.error('Uncaught exception:', error);
        if (!isShuttingDown) {
            isShuttingDown = true;
            try {
                await agent.stop();
            } catch (innerError) {
                logger.error('Error during shutdown initiated by uncaughtException:', innerError);
            }
        }
        process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
        console.error('Unhandled rejection:', reason);
        if (!isShuttingDown) {
            isShuttingDown = true;
            try {
                await agent.stop();
            } catch (innerError) {
                logger.error('Error during shutdown initiated by unhandledRejection:', innerError);
            }
        }
        process.exit(1);
    });
}
