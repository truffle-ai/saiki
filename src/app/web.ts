/** File for all web server starting up code */
import { logger } from '@core/index.js';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';

/**
 * Starts the legacy web server
 * @param webuiPath - The path to the webui directory
 * @param frontPort - The port to run the web server on
 * @param apiUrl - The URL of the API
 * @param frontUrl - The URL of the web server
 */
export async function startLegacyWebServer(
    webuiPath: string,
    frontPort: number,
    apiUrl: string,
    frontUrl: string
): Promise<boolean> {}

// Function to start the Next.js web server
// TODO: Improve this to be more reliable based on different environment types
export async function startNextJsWebServer(
    webuiPath: string,
    frontPort: number,
    apiUrl: string,
    frontUrl: string
): Promise<boolean> {
    try {
        // Extract API port from API URL
        const apiPortMatch = apiUrl.match(/:(\d+)$/);
        const apiPort = apiPortMatch ? apiPortMatch[1] : '3001';

        // Check if node_modules exists - might be needed for global install
        const nodeModulesPath = path.join(webuiPath, 'node_modules');
        const needsInstall =
            !existsSync(nodeModulesPath) || !existsSync(path.join(nodeModulesPath, 'next'));

        if (needsInstall) {
            logger.info(
                'Installing Next.js dependencies (first run after installation)...',
                null,
                'cyanBright'
            );
            try {
                // Run npm install in the webui directory
                const installProc = spawn('npm', ['install', '--omit=dev'], {
                    cwd: webuiPath,
                    stdio: 'inherit',
                });

                // Wait for the installation to complete
                const success = await new Promise<boolean>((resolve) => {
                    installProc.on('error', (err) => {
                        logger.error(`Failed to install dependencies: ${err}`);
                        resolve(false);
                    });

                    installProc.on('exit', (code) => {
                        if (code !== 0) {
                            logger.error(`Dependency installation exited with code ${code}`);
                            resolve(false);
                        } else {
                            logger.info('Dependencies installed successfully');
                            resolve(true);
                        }
                    });
                });

                if (!success) {
                    return false;
                }
            } catch (err) {
                logger.error(`Error during dependency installation: ${err}`);
                return false;
            }
        }

        // We have the webui directory, try to start Next.js
        logger.info(`Launching Next.js dev server on ${frontUrl}`, null, 'cyanBright');

        // Try to find next CLI directly
        const nextBin = path.join(webuiPath, 'node_modules', '.bin', 'next');
        const hasNextBin = existsSync(nextBin);

        // Command to run
        const command = hasNextBin ? nextBin : 'npx';
        const args = hasNextBin
            ? ['dev', '--port', String(frontPort)]
            : ['next', 'dev', '--port', String(frontPort)];

        logger.debug(`Starting Next.js with: ${command} ${args.join(' ')}`);

        const nextProc = spawn(command, args, {
            cwd: webuiPath,
            stdio: 'inherit',
            env: {
                ...process.env,
                NODE_ENV: 'development',
                API_PORT: String(apiPort),
                API_URL: apiUrl,
                FRONTEND_URL: frontUrl,
                NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? apiUrl,
                NEXT_PUBLIC_WS_URL:
                    process.env.NEXT_PUBLIC_WS_URL ??
                    (() => {
                        const ifaces = os.networkInterfaces();
                        for (const list of Object.values(ifaces)) {
                            for (const iface of list ?? []) {
                                if (iface.family === 'IPv4' && !iface.internal) {
                                    return `ws://${iface.address}:${apiPort}`;
                                }
                            }
                        }
                        return `ws://localhost:${apiPort}`;
                    })(),
                NEXT_PUBLIC_FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL ?? frontUrl,
                PATH: process.env.PATH, // Ensure PATH is passed correctly
            },
        });

        nextProc.on('error', (err) => {
            logger.error(`Next.js dev server failed to start: ${err}`);
            logger.warn('Only API endpoints are available. Web UI could not be started.');
            return false;
        });

        nextProc.on('exit', (code) => {
            if (code !== 0) {
                logger.error(`Next.js dev server exited with code ${code}`, null, 'red');
                logger.warn('Only API endpoints are available. Web UI could not be started.');
            }
        });

        logger.info(`Web UI should be available shortly at: ${frontUrl}`, null, 'green');
        return true;
    } catch (err) {
        logger.error(`Failed to spawn Next.js process: ${err}`);
        logger.warn('Only API endpoints are available. Web UI could not be started.');
        return false;
    }
}
