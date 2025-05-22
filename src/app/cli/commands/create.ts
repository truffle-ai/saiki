import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { executeWithTimeout } from '../utils/execute.js';
import * as p from '@clack/prompts';
import { getPackageManager, getPackageManagerInstallCommand } from '../utils/package-mgmt.js';

export async function createSaikiProject(name?: string) {
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

    // Move to the new project directory
    process.chdir(projectPath);

    // initialize package.json
    await executeWithTimeout('npm', ['init', '-y'], { cwd: projectPath });

    // initialize git repository
    await executeWithTimeout('git', ['init'], { cwd: projectPath });
    // add .gitignore
    await fs.writeFile('.gitignore', 'node_modules\n.env\ndist\n.saiki\n*.log');

    // update package.json and module type
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
    packageJson.type = 'module';
    packageJson.scripts = {
        ...packageJson.scripts,
        build: 'tsc',
        start: 'node dist/saiki/saiki-example.js',
        dev: 'node --loader ts-node/esm src/saiki/saiki-example.ts',
    };
    await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));

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
