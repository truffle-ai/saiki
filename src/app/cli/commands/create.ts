import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { executeWithTimeout } from '../utils/execute.js';
import * as p from '@clack/prompts';
import {
    getPackageManager,
    getPackageManagerInstallCommand,
    addScriptsToPackageJson,
} from '../utils/package-mgmt.js';

/**
 * Creates basic scaffolding for a Saiki project
 * Creates package.json, tsconfig.json, sets up git and gitignore, and sets up initial dependencies
 * @param name - The name of the project
 */
export async function createSaikiProject(name?: string) {
    p.intro(chalk.inverse('Saiki Create'));

    // Basic regex: must start with a letter, contain only letters, numbers, hyphens or underscores
    const nameRegex = /^[a-zA-Z][a-zA-Z0-9-_]*$/;

    let projectName: string;
    if (name) {
        // Validate provided project name
        if (!nameRegex.test(name)) {
            console.log(
                chalk.red(
                    'Invalid project name. Must start with a letter and contain only letters, numbers, hyphens or underscores.'
                )
            );
            process.exit(1);
        }
        projectName = name;
    } else {
        let input;
        do {
            input = await p.text({
                message: 'What do you want to name your Saiki project?',
                placeholder: 'my-saiki-project',
                defaultValue: 'my-saiki-project',
            });

            if (p.isCancel(input)) {
                p.cancel('Project creation cancelled');
                process.exit(0);
            }

            if (!nameRegex.test(input)) {
                console.log(
                    chalk.red(
                        'Invalid project name. Must start with a letter and contain only letters, numbers, hyphens or underscores.'
                    )
                );
            }
        } while (!nameRegex.test(input));
        projectName = input;
    }

    const spinner = p.spinner();
    const projectPath = path.resolve(process.cwd(), projectName);

    spinner.start(`Creating saiki project in ${projectPath}...`);
    try {
        await fs.mkdir(projectPath);
    } catch (error) {
        // if the directory already exists, end the process
        if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
            spinner.stop(
                `Directory "${projectName}" already exists. Please choose a different name or delete the existing directory.`
            );
            process.exit(1);
        } else {
            // If it's not an EEXIST error, rethrow it to be caught by the outer catch
            spinner.stop(`Failed to create project: ${error}`);
            throw error;
        }
    }

    // Move to the new project directory
    process.chdir(projectPath);

    // initialize package.json
    await executeWithTimeout('npm', ['init', '-y'], { cwd: projectPath });

    // initialize git repository
    await executeWithTimeout('git', ['init'], { cwd: projectPath });
    // add .gitignore
    await fs.writeFile('.gitignore', 'node_modules\n.env\ndist\n.saiki\n*.log');

    // update package.json module type
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
    packageJson.type = 'module';
    await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));
    // add scripts for saiki project
    await addScriptsToPackageJson({
        build: 'tsc',
        start: 'node dist/saiki/saiki-example.js',
        dev: 'node --loader ts-node/esm src/saiki/saiki-example.ts',
    });

    spinner.stop('Project files created successfully!');

    spinner.start('Installing dependencies...');
    const packageManager = getPackageManager();
    const installCommand = getPackageManagerInstallCommand(packageManager);

    // install yaml and dotenv
    await executeWithTimeout(packageManager, [installCommand, 'yaml', 'dotenv'], {
        cwd: projectPath,
    });

    // install typescript
    await executeWithTimeout(
        packageManager,
        [installCommand, 'typescript', 'tsx', 'ts-node', '@types/node', '--save-dev'],
        { cwd: projectPath }
    );

    spinner.stop('Dependencies installed!');

    // setup tsconfig.json
    const tsconfig = {
        compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'node',
            strict: true,
            esModuleInterop: true,
            forceConsistentCasingInFileNames: true,
            skipLibCheck: true,
            outDir: 'dist',
            rootDir: 'src',
        },
        include: ['src/**/*.ts'],
        exclude: ['node_modules', 'dist', '.saiki'],
    };
    await fs.writeJSON(path.join(projectPath, 'tsconfig.json'), tsconfig, { spaces: 4 });

    p.outro(chalk.greenBright('Saiki project created successfully!'));

    // Saiki install, .env setup, and saiki.yml and example setup is done in init command
}
