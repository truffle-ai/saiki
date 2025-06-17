// Script to clean build artifacts and temporary files
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname: string = path.dirname(fileURLToPath(import.meta.url));
const rootDir: string = path.resolve(__dirname, '..');

async function findAndDeleteFiles(
    dir: string,
    extensions: string[],
    excludeDirs: string[]
): Promise<void> {
    if (!(await fs.pathExists(dir))) {
        return;
    }

    try {
        const items = await fs.readdir(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);

            if (!(await fs.pathExists(fullPath))) {
                continue;
            }

            const stat = await fs.stat(fullPath);

            if (stat.isDirectory()) {
                const pathSegments = fullPath.split(path.sep);
                const isExcluded = excludeDirs.some((excluded) => pathSegments.includes(excluded));
                if (!isExcluded) {
                    await findAndDeleteFiles(fullPath, extensions, excludeDirs);
                }
            } else {
                const shouldDelete = extensions.some((ext) => item.endsWith(ext));
                if (shouldDelete) {
                    await fs.remove(fullPath);
                    console.log(`✅ Deleted: ${path.relative(rootDir, fullPath)}`);
                }
            }
        }
    } catch (err: unknown) {
        console.log(`⚠️  Could not access directory: ${path.relative(rootDir, dir)}`);
    }
}

async function cleanBuildFiles(): Promise<void> {
    try {
        console.log('🧹 Starting build files cleanup...');

        const targetExtensions = ['.tsbuildinfo', '.log'];
        const excludeDirectories = ['node_modules', 'dist'];

        await findAndDeleteFiles(rootDir, targetExtensions, excludeDirectories);

        console.log('✅ Build files cleanup completed');
    } catch (err: unknown) {
        console.error('❌ Error during cleanup:', err);
        process.exit(1);
    }
}

// Execute the cleanup function
cleanBuildFiles();
