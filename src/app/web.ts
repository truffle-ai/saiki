/** File for all web server starting up code */
import { logger } from '@core/index.js';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Discovers the webui path, starting and configuring the Next.js server
 * TODO: Refactor this to be less hacky and more readable
 * @param webuiPathParam - Optional: The path to the webui directory (auto-discovered if not provided)
 * @param frontPort - The port to run the web server on
 * @param apiUrl - The URL of the API server
 * @param frontUrl - The URL of the web server
 */
export async function startNextJsWebServer(
    apiUrl: string,
    frontPort: number = 3000,
    frontUrl: string = `http://localhost:${frontPort}`
): Promise<boolean> {
    // Path discovery logic from index.ts

    // If no path was provided, try to automatically detect it
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    logger.debug(`Script directory for web mode: ${scriptDir}`);

    // Try to find the webui directory - could be in different locations depending on installation type
    let webuiPath = path.resolve(scriptDir, 'webui');

    // If not found in expected location for dist, check other possible locations
    if (!existsSync(webuiPath)) {
        // Check for source directory (common in dev mode and npm link)
        const srcPath = path.resolve(scriptDir, '..', '..', 'src', 'app', 'webui');
        if (existsSync(srcPath)) {
            webuiPath = srcPath;
            logger.debug(`Found webui in source path: ${webuiPath}`);
        } else {
            // Check for cwd + src path (another npm link scenario)
            const cwdPath = path.resolve(process.cwd(), 'src', 'app', 'webui');
            if (existsSync(cwdPath)) {
                webuiPath = cwdPath;
                logger.debug(`Found webui in cwd path: ${webuiPath}`);
            } else {
                logger.warn('Could not locate webui directory. Web UI may not be available.');
                return false;
            }
        }
    } else {
        logger.debug(`Using installed webui path: ${webuiPath}`);
    }

    // Check if webui directory exists and has package.json
    const hasWebUI = existsSync(webuiPath) && existsSync(path.join(webuiPath, 'package.json'));

    if (!hasWebUI) {
        logger.warn(
            'Web UI directory not found. Only API endpoints are available.',
            null,
            'yellow'
        );
        logger.error(
            'This is unexpected as the webui directory should be included in the package. Cut an issue on GitHub if you are seeing this.'
        );
        logger.debug('Possible fixes:');
        logger.debug(
            '  1. Reinstall the package: npm uninstall -g @truffle-ai/saiki && npm install -g @truffle-ai/saiki'
        );
        logger.info('  2. Update to the latest version: npm update -g @truffle-ai/saiki');
        logger.info(
            '  3. Run from source: git clone https://github.com/truffle-ai/saiki.git && cd saiki && npm install && npm run build'
        );
        return false;
    }

    try {
        // Extract API port from API URL
        const apiPort = (() => {
            try {
                return String(new URL(apiUrl).port || 3001);
            } catch {
                return '3001';
            }
        })();

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
            stdio: ['inherit', 'pipe', 'inherit'], // Pipe stdout to capture startup messages
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
                PATH: process.env.PATH,
            },
        });

        // Wait for server to start or error out
        logger.debug(`Waiting for Next.js server to start at: ${frontUrl}`, null, 'cyan');

        const success = await new Promise<boolean>((resolve) => {
            // Set a reasonable timeout (10 seconds)
            const timer = setTimeout(() => {
                logger.info(`Next.js server startup timeout reached, assuming it's running`);
                logger.info(`Next.js web UI available at: ${frontUrl}`, null, 'green');
                resolve(true);
            }, 10000);

            // Handle error event once
            nextProc.once('error', (err) => {
                logger.error(`Next.js dev server failed to start: ${err}`);
                logger.warn('Only API endpoints are available. Web UI could not be started.');
                clearTimeout(timer);
                resolve(false);
            });

            // Handle exit event once
            nextProc.once('exit', (code) => {
                if (code !== 0) {
                    logger.error(`Next.js dev server exited with code ${code}`, null, 'red');
                    logger.warn('Only API endpoints are available. Web UI could not be started.');
                } else {
                    logger.info(`Next.js dev server exited normally`);
                }
                clearTimeout(timer);
                resolve(false);
            });

            // Check stdout for server ready message
            if (nextProc.stdout) {
                nextProc.stdout.on('data', (data) => {
                    const output = data.toString();
                    // Echo Next.js output to console for debugging
                    process.stdout.write(data);

                    // standard Next.js startup success message
                    if (output.includes('Ready in')) {
                        logger.info(`Next.js server started successfully`);
                        logger.info(`Next.js web UI available at: ${frontUrl}`, null, 'green');
                        clearTimeout(timer);
                        resolve(true);
                    }
                });
            }
        });

        return success;
    } catch (err) {
        logger.error(`Failed to spawn Next.js process: ${err}`);
        logger.warn('Only API endpoints are available. Web UI could not be started.');
        return false;
    }
}
