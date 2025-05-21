import { exec } from 'child_process';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import path from 'path';
import yaml from 'yaml';
import chalk from 'chalk';
import { logger } from '@core/index.js'; // Using logger for command output
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Helper to promisify exec
const execPromise = (command: string, options: { cwd: string }) => {
    return new Promise<void>((resolve, reject) => {
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                logger.error(`Error executing: ${command}\\n${stderr}`);
                return reject(new Error(stderr || error.message));
            }
            logger.debug(`${command} stdout: ${stdout}`);
            resolve();
        });
    });
};

export async function handleCreateProject(projectNameFromArg?: string /* options?: object */) {
    try {
        let projectName = projectNameFromArg;
        if (!projectName) {
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'projectName',
                    message: 'What do you want to name your Saiki project?',
                    validate: (input: string) => {
                        if (/^[A-Za-z0-9_-]+$/.test(input)) return true;
                        return 'Project name may only include letters, numbers, underscores, and hyphens.';
                    },
                },
            ]);
            projectName = answers.projectName;
        }

        if (!projectName) {
            logger.error('Project name is required.');
            return;
        }

        const projectPath = path.resolve(process.cwd(), projectName);

        logger.info(
            chalk.blueBright(`Creating new Saiki project in ${chalk.green(projectPath)}...`)
        );

        if (await fs.pathExists(projectPath)) {
            const { overwrite } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'overwrite',
                    message: chalk.yellow(`Directory ${projectName} already exists. Overwrite?`),
                    default: false,
                },
            ]);
            if (!overwrite) {
                logger.info('Project creation cancelled.');
                return;
            }
            logger.info(`Overwriting directory ${projectName}...`);
            await fs.remove(projectPath);
        }

        await fs.mkdir(projectPath);

        // 1. package.json
        logger.info(chalk.blue('Initializing npm project (package.json)...'));
        await execPromise('npm init -y', { cwd: projectPath });

        // 2. Install dependencies
        const saikiPackageName = '@truffle-ai/saiki'; // Confirmed from Saiki's own package.json
        const dependenciesToInstall = `${saikiPackageName} yaml dotenv`;
        logger.info(chalk.blue(`Installing dependencies: ${chalk.cyan(dependenciesToInstall)}...`));
        await execPromise(`npm install ${dependenciesToInstall}`, { cwd: projectPath });

        // 3. .gitignore
        logger.info(chalk.blue('Creating .gitignore...'));
        const gitignoreContent = `node_modules
.env
dist
*.log
`;
        await fs.writeFile(path.join(projectPath, '.gitignore'), gitignoreContent);

        // 4. .env
        logger.info(chalk.blue('Creating .env...'));
        const envExampleContent = [
            '# Saiki Configuration',
            '# Fill in your API keys here',
            '',
            '# OpenAI API Key (if using OpenAI provider)',
            'OPENAI_API_KEY=your_openai_api_key_here',
            '',
            '# Google Generative AI API Key (if using Google provider)',
            '# GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here',
            '',
            '# Anthropic API Key (if using Anthropic provider)',
            '# ANTHROPIC_API_KEY=your_anthropic_api_key_here',
            '',
            '# Log level for Saiki (optional: error, warn, info, http, verbose, debug, silly)',
            'SAIKI_LOG_LEVEL=info',
            '',
        ].join('\n');
        await fs.writeFile(path.join(projectPath, '.env'), envExampleContent);

        // 5. Copy the Saiki config template into the new project
        logger.info(chalk.blue('Copying Saiki configuration file...'));
        // Locate the Saiki package installation directory
        const pkgJsonPath = require.resolve('@truffle-ai/saiki/package.json');
        const pkgDir = path.dirname(pkgJsonPath);
        // Build path to the configuration template inside the package
        const templateConfigSrc = path.join(pkgDir, 'configuration', 'saiki.yml');
        const destConfigDir = path.join(projectPath, 'src', 'saiki', 'agents');
        await fs.mkdirp(destConfigDir);
        await fs.copy(templateConfigSrc, path.join(destConfigDir, 'saiki.yml'));

        // Create minimal TypeScript entry point
        logger.info(chalk.blue('Creating src/saiki/index.ts...'));
        const indexTsLines = [
            "import 'dotenv/config';",
            "import { loadConfigFile, SaikiAgent } from '@truffle-ai/saiki';",
            '',
            '// 1. Initialize the agent from the config file',
            '// Every agent is defined by its own config file',
            "const config = await loadConfigFile('./src/saiki/agents/saiki.yml');",
            'export const agent = await SaikiAgent.create(config);',
            '',
            '// 2. Run the agent',
            'const response = await agent.run("Hello saiki! What are the files in this directory");',
            'console.log("Agent response:", response);',
            '',
            '// 3. Read Saiki documentation to understand more about using Saiki: https://github.com/truffle-ai/saiki',
        ];
        const indexTsContent = indexTsLines.join('\n');
        // Ensure the directory exists
        await fs.writeFile(path.join(projectPath, 'src', 'saiki', 'index.ts'), indexTsContent);

        // Install TypeScript and related devDependencies
        logger.info(chalk.blue('Installing TypeScript devDependencies...'));
        await execPromise('npm install typescript ts-node @types/node --save-dev', {
            cwd: projectPath,
        });

        // Create a basic tsconfig.json
        logger.info(chalk.blue('Creating tsconfig.json...'));
        const tsconfig = {
            compilerOptions: {
                target: 'ES2020',
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
        };
        await fs.writeFile(
            path.join(projectPath, 'tsconfig.json'),
            JSON.stringify(tsconfig, null, 2)
        );

        // 7. Update package.json scripts and type
        logger.info(chalk.blue('Updating package.json for TypeScript start script...'));
        const packageJsonPath = path.join(projectPath, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        packageJson.type = 'module';
        packageJson.scripts = {
            ...packageJson.scripts,
            build: 'tsc',
            start: 'node dist/saiki/index.js',
            dev: 'ts-node-esm src/saiki/index.ts',
        };
        // Remove default test script if it exists
        if (packageJson.scripts.test === 'echo "Error: no test specified" && exit 1') {
            delete packageJson.scripts.test;
        }
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

        // Final instructions
        logger.info(chalk.greenBright('Saiki project created successfully!'));
        logger.info(chalk.yellow('Next steps:'));
        logger.info('1. Navigate to your project: ' + chalk.cyan('cd ' + projectName));
        logger.info('2. Add your API key(s) to ' + chalk.cyan('.env'));
        logger.info(
            '3. Change the config file to your liking: ' +
                chalk.cyan('./src/saiki/agents/saiki.yml')
        );
        logger.info(
            '4. Run the example to get started: ' + chalk.cyan('npm run build && npm start')
        );
        logger.info(
            '5. Read Saiki documentation to understand more about using Saiki: ' +
                chalk.cyan('https://github.com/truffle-ai/saiki')
        );
    } catch (error) {
        logger.error(chalk.red('\\nFailed to create Saiki project:'));
        if (error instanceof Error) {
            logger.error(chalk.red(error.message));
            if (error.stack) {
                logger.debug(error.stack);
            }
        } else {
            logger.error(chalk.red(String(error)));
        }
        process.exit(1);
    }
}
