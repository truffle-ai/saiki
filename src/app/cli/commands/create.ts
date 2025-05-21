import fs from 'fs-extra';
import inquirer from 'inquirer';
import path from 'path';
import chalk from 'chalk';
import { logger } from '@core/index.js'; // Using logger for command output
import { createRequire } from 'module';
import { executeWithTimeout } from '../utils/execute.js';
import * as p from '@clack/prompts';
import {
    addScriptsToPackageJson,
    getPackageManager,
    getPackageManagerInstallCommand,
} from '../utils/package-mgmt.js';

// const require = createRequire(import.meta.url);

// // TODO: Improve interactive CLI with more configurability (npm, pnpm, yarn + customize src directory?)
// export async function createSaikiProject(projectNameFromArg?: string /* options?: object */) {
//     try {
//         let projectName = projectNameFromArg;
//         if (!projectName) {
//             const answers = await inquirer.prompt([
//                 {
//                     type: 'input',
//                     name: 'projectName',
//                     message: 'What do you want to name your Saiki project?',
//                     validate: (input: string) => {
//                         if (/^[A-Za-z0-9_-]+$/.test(input)) return true;
//                         return 'Project name may only include letters, numbers, underscores, and hyphens.';
//                     },
//                 },
//             ]);
//             projectName = answers.projectName;
//         }

//         if (!projectName) {
//             logger.error('Project name is required.');
//             return;
//         }

//         const projectPath = path.resolve(process.cwd(), projectName);

//         logger.info(
//             chalk.blueBright(`Creating new Saiki project in ${chalk.green(projectPath)}...`)
//         );

//         if (await fs.pathExists(projectPath)) {
//             const { overwrite } = await inquirer.prompt([
//                 {
//                     type: 'confirm',
//                     name: 'overwrite',
//                     message: chalk.yellow(`Directory ${projectName} already exists. Overwrite?`),
//                     default: false,
//                 },
//             ]);
//             if (!overwrite) {
//                 logger.info('Project creation cancelled.');
//                 return;
//             }
//             logger.info(`Overwriting directory ${projectName}...`);
//             await fs.remove(projectPath);
//         }

//         await fs.mkdir(projectPath);

//         // 1. Initialize git repository
//         logger.info(chalk.blue('Initializing git repository...'));
//         await executeWithTimeout('git', ['init'], { cwd: projectPath });

//         // 2. Initialize npm project (package.json)
//         logger.info(chalk.blue('Initializing npm project (package.json)...'));
//         const saikiPackageName = '@truffle-ai/saiki'; // Confirmed from Saiki's own package.json
//         const dependenciesToInstall = `${saikiPackageName} yaml dotenv`;
//         logger.info(chalk.blue(`Installing dependencies: ${chalk.cyan(dependenciesToInstall)}...`));
//         await executeWithTimeout('npm', ['install', ...dependenciesToInstall.split(' ')], { cwd: projectPath });

//         // 4. Create .gitignore
//         logger.info(chalk.blue('Creating .gitignore...'));
//         const gitignoreContent = ['node_modules', '.env', 'dist', '*.log'].join('\n');
//         await fs.writeFile(path.join(projectPath, '.gitignore'), gitignoreContent);

//         // 5. Create .env
//         logger.info(chalk.blue('Creating .env...'));
//         const envExampleContent = [
//             '# Fill in your API keys here',
//             '',
//             '# OpenAI API Key (if using OpenAI provider in any of your agents)',
//             'OPENAI_API_KEY=your_openai_api_key_here',
//             '',
//             '# Google Generative AI API Key (if using Google provider in any of your agents)',
//             '# GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here',
//             '',
//             '# Anthropic API Key (if using Anthropic provider in any of your agents)',
//             '# ANTHROPIC_API_KEY=your_anthropic_api_key_here',
//             '',
//             '# Log level for Saiki (optional: error, warn, info, http, verbose, debug, silly)',
//             '# Set log level to warn/error to reduce logs, or debug/silly to see more',
//             'SAIKI_LOG_LEVEL=info',
//             '',
//         ].join('\n');
//         await fs.writeFile(path.join(projectPath, '.env'), envExampleContent);

//         // 6. Copy Saiki configuration file from installed package
//         logger.info(chalk.blue('Copying Saiki configuration file...'));
//         // Locate the Saiki package installation directory
//         const pkgJsonPath = require.resolve('@truffle-ai/saiki/package.json');
//         const pkgDir = path.dirname(pkgJsonPath);
//         // Build path to the configuration template inside the package
//         const templateConfigSrc = path.join(pkgDir, 'configuration', 'saiki.yml');
//         const destConfigDir = path.join(projectPath, 'src', 'saiki', 'agents');
//         await fs.mkdirp(destConfigDir);
//         await fs.copy(templateConfigSrc, path.join(destConfigDir, 'saiki.yml'));

//         // 7. Create basic entry point for the project
//         logger.info(chalk.blue('Creating src/saiki/index.ts...'));
//         const indexTsLines = [
//             "import 'dotenv/config';",
//             "import { loadConfigFile, SaikiAgent } from '@truffle-ai/saiki';",
//             '',
//             '// 1. Initialize the agent from the config file',
//             '// Every agent is defined by its own config file',
//             "const config = await loadConfigFile('./src/saiki/agents/saiki.yml');",
//             'export const agent = await SaikiAgent.create(config);',
//             '',
//             '// 2. Run the agent',
//             'const response = await agent.run("Hello saiki! What are the files in this directory");',
//             'console.log("Agent response:", response);',
//             '',
//             '// 3. Read Saiki documentation to understand more about using Saiki: https://github.com/truffle-ai/saiki',
//         ];
//         const indexTsContent = indexTsLines.join('\n');
//         // Ensure the directory exists before writing the file
//         await fs.writeFile(path.join(projectPath, 'src', 'saiki', 'index.ts'), indexTsContent);

//         // 8. Install TypeScript devDependencies
//         logger.info(chalk.blue('Installing TypeScript devDependencies...'));
//         await executeWithTimeout('npm', ['install', 'typescript', 'ts-node', '@types/node', '--save-dev'], {
//             cwd: projectPath,
//         });

//         // 9. Create tsconfig.json
//         logger.info(chalk.blue('Creating tsconfig.json...'));
//         const tsconfig = {
//             compilerOptions: {
//                 target: 'ES2022',
//                 module: 'ESNext',
//                 moduleResolution: 'node',
//                 strict: true,
//                 esModuleInterop: true,
//                 forceConsistentCasingInFileNames: true,
//                 skipLibCheck: true,
//                 outDir: 'dist',
//                 rootDir: 'src',
//             },
//             include: ['src/**/*.ts'],
//         };
//         await fs.writeFile(
//             path.join(projectPath, 'tsconfig.json'),
//             JSON.stringify(tsconfig, null, 2)
//         );

//         // 10. Update package.json scripts and type
//         logger.info(chalk.blue('Updating package.json for TypeScript start script...'));
//         const packageJsonPath = path.join(projectPath, 'package.json');
//         const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
//         packageJson.type = 'module';
//         packageJson.scripts = {
//             ...packageJson.scripts,
//             build: 'tsc',
//             start: 'node dist/saiki/index.js',
//             dev: 'node --loader ts-node/esm src/saiki/index.ts',
//         };
//         // Remove default test script if it exists
//         if (packageJson.scripts.test === 'echo "Error: no test specified" && exit 1') {
//             delete packageJson.scripts.test;
//         }
//         await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

//         // 11. Final instructions
//         logger.info(chalk.greenBright('Saiki project created successfully!'));
//         logger.info(chalk.yellow('Next steps:'));
//         logger.info('1. Navigate to your project: ' + chalk.cyan('cd ' + projectName));
//         logger.info('2. Add your API key(s) to ' + chalk.cyan('.env'));
//         logger.info(
//             '3. Change the config file to your liking: ' +
//                 chalk.cyan('./src/saiki/agents/saiki.yml')
//         );
//         logger.info('4. Run the example to get started: ' + chalk.cyan('npm run dev'));
//         logger.info(
//             '5. Read Saiki documentation to understand more about using Saiki: ' +
//                 chalk.cyan('https://github.com/truffle-ai/saiki')
//         );
//     } catch (error) {
//         logger.error(chalk.red('\\nFailed to create Saiki project:'));
//         if (error instanceof Error) {
//             logger.error(chalk.red(error.message));
//             if (error.stack) {
//                 logger.debug(error.stack);
//             }
//         } else {
//             logger.error(chalk.red(String(error)));
//         }
//         process.exit(1);
//     }
// }

export async function createSaikiProject2(name?: string) {
    p.intro(chalk.inverse('Saiki Create'));

    const projectName =
        name ??
        (
            await p.text({
                message: 'What do you want to name your Saiki project?',
                placeholder: 'my-saiki-project',
                defaultValue: 'my-saiki-project',
            })
        ).toString();

    if (p.isCancel(projectName)) {
        p.cancel('Project creation cancelled');
        process.exit(0);
    }

    const spinner = p.spinner();
    const projectPath = path.resolve(process.cwd(), projectName);

    spinner.start(`Creating saiki project in ${projectPath}...`);
    try {
        await fs.mkdir(projectPath);
    } catch (error) {
        // if the directory already exists, ask the user if they want to overwrite it
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
    spinner.stop('Project initialized successfully!');

    // Move to the new project directory
    process.chdir(projectPath);

    // initialize package.json
    spinner.start('Initializing package.json...');
    await executeWithTimeout('npm', ['init', '-y'], { cwd: projectPath });
    spinner.stop('package.json initialized successfully!');

    // initialize git repository
    spinner.start('Initializing git repository...');
    await executeWithTimeout('git', ['init'], { cwd: projectPath });
    // add .gitignore
    await fs.writeFile('.gitignore', 'node_modules\n.env\ndist\n.saiki\n*.log');
    spinner.stop('Git repository initialized successfully!');

    // update package.json and module type
    spinner.start('Updating package.json and module type for typescript...');
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
    packageJson.type = 'module';
    packageJson.scripts = {
        ...packageJson.scripts,
        build: 'tsc',
        start: 'node dist/saiki/index.js',
        dev: 'node --loader ts-node/esm src/saiki/index.ts',
    };
    await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));
    spinner.stop('package.json updated successfully!');

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

    spinner.stop('Dependencies installed successfully!');

    // setup tsconfig.json
    spinner.start('Setting up tsconfig.json...');
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
    spinner.stop('tsconfig.json setup successfully!');

    // install saiki
    spinner.start('Installing Saiki...');
    const label = 'latest';
    await executeWithTimeout(packageManager, [installCommand, `@truffle-ai/saiki@${label}`], {
        cwd: projectPath,
    });
    spinner.stop('Saiki installed successfully!');

    p.outro(chalk.inverse('Saiki project created successfully!'));

    // TODO: saiki.yml, install saiki ,and .env setup - can do in init command
    // make sure to use
    //     p.note(
    //         `1. Navigate to your project: ${chalk.cyan(`cd ${projectName}`)}
    //   2. Add your API key(s) to ${chalk.cyan('.env')}
    //   3. Change the config file to your liking: ${chalk.cyan('./src/saiki/agents/saiki.yml')}
    //   4. Run the example to get started: ${chalk.cyan(`${packageManager} run dev`)}
    //   5. Read Saiki documentation to understand more about using Saiki: ${chalk.cyan('https://github.com/truffle-ai/saiki')}`,
    //         chalk.yellow('Next steps:')
    //     );

    //         // copy saiki.yml
    //     spinner.start("Copying saiki config files...")
    //     const saikiDir = path.join(projectPath, 'src', 'saiki');
    //     await fs.copy(path.join(projectPath, 'node_modules', '@truffle-ai', 'saiki', 'configuration', 'saiki.yml'), path.join(saikiDir, 'agents', 'saiki.yml'));
    //     spinner.stop("Saiki config files copied successfully!")

    //     // setup .env
    //     spinner.start("Setting up .env...")
    //     await fs.writeFile(".env", `
    // OPENAI_API_KEY=your_openai_api_key_here
    // GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here
    // ANTHROPIC_API_KEY=your_anthropic_api_key_here
    // SAIKI_LOG_LEVEL=info
    //     `)
    //     spinner.stop(".env setup successfully!")
}
