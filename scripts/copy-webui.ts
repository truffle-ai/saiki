// Script to copy webui files to dist
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname: string = path.dirname(fileURLToPath(import.meta.url));
const rootDir: string = path.resolve(__dirname, '..');

// Define source and target paths
const sourceDir: string = path.join(rootDir, 'src', 'app', 'webui');
const targetDir: string = path.join(rootDir, 'dist', 'src', 'app', 'webui');

async function copyWebUI(): Promise<void> {
    try {
        // Ensure the target directory doesn't exist to avoid conflicts
        if (fs.existsSync(targetDir)) {
            console.log('Removing existing target directory...');
            await fs.remove(targetDir);
        }

        console.log(`Copying webui from ${sourceDir} to ${targetDir}...`);

        // Copy webui directory to dist (excluding node_modules)
        await fs.copy(sourceDir, targetDir, {
            filter: (src: string): boolean => {
                return (
                    !src.includes('node_modules') && !src.includes('.next') && !src.endsWith('.git')
                );
            },
        });

        console.log('✅ Successfully copied webui directory to dist');
    } catch (err: unknown) {
        console.error('❌ Error copying webui directory:', err);
        process.exit(1);
    }
}

// Execute the copy function
copyWebUI();
