import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    CallToolResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z, ZodSchema } from 'zod';
import { execSync, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// --- Configuration ---
const DEFAULT_IMAGE = 'ubuntu:latest';
const WORKSPACE_DIR = path.join(os.homedir(), '.docker-sandbox');
const CONTAINER_WORKSPACE = '/workspace';
const IS_WINDOWS = os.platform() === 'win32';

// --- State ---
interface ContainerInfo {
    id: string;
    name: string;
    image: string;
    status: string;
    createdAt: string;
}

let activeContainer: ContainerInfo | null = null;
let runningProcesses: Map<string, ChildProcess> = new Map();

// --- Helper Functions ---
function ensureWorkspaceExists(): void {
    if (!fs.existsSync(WORKSPACE_DIR)) {
        fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
    }
}

async function safeExecute<T>(
    action: () => Promise<T>
): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
        const result = await action();
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
}

// Improved Docker command execution for Windows compatibility
function runDockerCommand(command: string[]): string {
    try {
        // For Windows, we need to be careful about command construction
        let fullCommand: string;
        if (IS_WINDOWS) {
            // On Windows, use double quotes for arguments with spaces
            fullCommand = ['docker']
                .concat(
                    command.map((arg) => {
                        return arg.includes(' ') ? `"${arg}"` : arg;
                    })
                )
                .join(' ');
        } else {
            fullCommand = ['docker', ...command].join(' ');
        }

        console.log(`Executing Docker command: ${fullCommand}`);
        return execSync(fullCommand, {
            encoding: 'utf-8',
            shell: IS_WINDOWS ? 'cmd.exe' : '/bin/sh',
        }).trim();
    } catch (error: any) {
        console.error(`Docker command failed: ${error.message}`);
        throw new Error(`Docker command failed: ${error.message}`);
    }
}

// --- Container Management Functions ---
async function createContainer(image: string, name?: string): Promise<ContainerInfo> {
    ensureWorkspaceExists();

    const containerName = name || `sandbox-${Date.now()}`;

    try {
        // Pull the image if needed
        runDockerCommand(['pull', image]);

        // Create the container - handle Windows path conversion
        let workspaceMount: string;
        if (IS_WINDOWS) {
            // Convert Windows path to Docker path format
            // For Windows, need to handle drive letter format for Docker
            const driveLetter = WORKSPACE_DIR.charAt(0).toLowerCase();
            const sanitizedPath = WORKSPACE_DIR.substring(2).replace(/\\/g, '/');
            workspaceMount = `${driveLetter}:${sanitizedPath}:${CONTAINER_WORKSPACE}`;
        } else {
            workspaceMount = `${WORKSPACE_DIR}:${CONTAINER_WORKSPACE}`;
        }

        const cmd = [
            'run',
            '-d',
            '--name',
            containerName,
            '-v',
            workspaceMount,
            image,
            'tail',
            '-f',
            '/dev/null', // Keep container running
        ];

        const containerId = runDockerCommand(cmd).trim();

        const containerInfo: ContainerInfo = {
            id: containerId,
            name: containerName,
            image: image,
            status: 'running',
            createdAt: new Date().toISOString(),
        };

        // Update active container
        activeContainer = containerInfo;

        return containerInfo;
    } catch (error: any) {
        throw new Error(`Failed to create container: ${error.message}`);
    }
}

// async function getContainerInfo(nameOrId: string): Promise<ContainerInfo> {
//     try {
//         const output = runDockerCommand(['inspect', nameOrId]);
//         const info = JSON.parse(output)[0];

//         return {
//             id: info.Id,
//             name: info.Name.startsWith('/') ? info.Name.substring(1) : info.Name,
//             image: info.Config.Image,
//             status: info.State.Status,
//             createdAt: info.Created
//         };
//     } catch (error) {
//         throw new Error(`Container not found: ${nameOrId}`);
//     }
// }

async function listContainers(): Promise<ContainerInfo[]> {
    try {
        const output = runDockerCommand([
            'ps',
            '-a',
            '--format',
            '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.CreatedAt}}',
        ]);
        if (!output.trim()) {
            return [];
        }

        return output
            .trim()
            .split('\n')
            .map((line) => {
                const [id, name, image, status, createdAt] = line.split('|');
                return { id, name, image, status, createdAt };
            });
    } catch (error) {
        // Just return empty array on error
        console.error(`Error listing containers: ${error}`);
        return [];
    }
}

async function executeCommand(container: string, command: string[]): Promise<string> {
    try {
        return runDockerCommand(['exec', container, ...command]);
    } catch (error: any) {
        throw new Error(`Command execution failed: ${error.message}`);
    }
}

// --- Tool Definitions ---
const createContainerTool = {
    name: 'docker_create_container',
    description:
        'Creates a new Docker container for running code and processing data in a sandboxed environment.',
    inputSchema: z.object({
        image: z
            .string()
            .default(DEFAULT_IMAGE)
            .describe('Docker image to use (e.g., ubuntu:latest, python:3.11, nodejs:20).'),
        name: z
            .string()
            .optional()
            .describe(
                'Optional name for the container. If not provided, a name will be auto-generated.'
            ),
    }),
    async executeLogic(input: { image: string; name?: string }): Promise<ContainerInfo> {
        return await createContainer(input.image, input.name);
    },
};

const listContainersTool = {
    name: 'docker_list_containers',
    description: 'Lists all Docker containers, including the currently active sandbox container.',
    inputSchema: z.object({}),
    async executeLogic(): Promise<{
        containers: ContainerInfo[];
        activeContainer: ContainerInfo | null;
    }> {
        const containers = await listContainers();
        return {
            containers,
            activeContainer,
        };
    },
};

const executeCommandTool = {
    name: 'docker_execute_command',
    description: 'Executes a command in the active Docker container.',
    inputSchema: z.object({
        command: z
            .string()
            .describe('The command to execute (e.g., "ls -la", "python script.py").'),
        container: z
            .string()
            .optional()
            .describe('Container name or ID. If not provided, the active container will be used.'),
    }),
    async executeLogic(input: { command: string; container?: string }): Promise<string> {
        // Check for active container
        const targetContainer = input.container || activeContainer?.name;
        if (!targetContainer) {
            throw new Error('No active container. Create or select a container first.');
        }

        // Split command into arguments for proper execution
        const cmdParts = input.command.split(' ').filter((part) => part.trim().length > 0);
        if (cmdParts.length === 0) {
            throw new Error('Command cannot be empty');
        }

        return await executeCommand(targetContainer, ['sh', '-c', input.command]);
    },
};

const uploadFileTool = {
    name: 'docker_upload_file',
    description: 'Creates a file in the container workspace with the specified content.',
    inputSchema: z.object({
        fileName: z.string().describe('Name of the file to create in the container workspace.'),
        content: z.string().describe('Content to write to the file.'),
        container: z
            .string()
            .optional()
            .describe('Container name or ID. If not provided, the active container will be used.'),
    }),
    async executeLogic(input: {
        fileName: string;
        content: string;
        container?: string;
    }): Promise<{ filePath: string }> {
        // Ensure workspace exists
        ensureWorkspaceExists();

        // Check for active container
        const targetContainer = input.container || activeContainer?.name;
        if (!targetContainer) {
            throw new Error('No active container. Create or select a container first.');
        }

        // Create the file in the host workspace
        const localPath = path.join(WORKSPACE_DIR, input.fileName);
        const containerPath = path.join(CONTAINER_WORKSPACE, input.fileName);

        // Ensure directory exists
        const dirPath = path.dirname(localPath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Write file
        fs.writeFileSync(localPath, input.content);

        return { filePath: containerPath };
    },
};

const downloadFileTool = {
    name: 'docker_download_file',
    description: 'Reads a file from the container workspace.',
    inputSchema: z.object({
        filePath: z.string().describe('Path to the file in the container workspace.'),
        container: z
            .string()
            .optional()
            .describe('Container name or ID. If not provided, the active container will be used.'),
    }),
    async executeLogic(input: {
        filePath: string;
        container?: string;
    }): Promise<{ content: string }> {
        // Check for active container
        const targetContainer = input.container || activeContainer?.name;
        if (!targetContainer) {
            throw new Error('No active container. Create or select a container first.');
        }

        // Get the local path corresponding to the container path
        let localPath: string;
        if (input.filePath.startsWith(CONTAINER_WORKSPACE)) {
            localPath = path.join(
                WORKSPACE_DIR,
                input.filePath.substring(CONTAINER_WORKSPACE.length + 1)
            );
        } else {
            // Handle relative paths
            localPath = path.join(WORKSPACE_DIR, input.filePath);
        }

        // Check if file exists
        if (!fs.existsSync(localPath)) {
            throw new Error(`File not found: ${input.filePath}`);
        }

        // Read file
        const content = fs.readFileSync(localPath, 'utf-8');
        return { content };
    },
};

const installPackageTool = {
    name: 'docker_install_package',
    description: 'Installs a package in the Docker container.',
    inputSchema: z.object({
        packageManager: z
            .enum(['apt', 'pip', 'npm'])
            .describe('Package manager to use (apt, pip, npm).'),
        packages: z.array(z.string()).describe('List of packages to install.'),
        container: z
            .string()
            .optional()
            .describe('Container name or ID. If not provided, the active container will be used.'),
    }),
    async executeLogic(input: {
        packageManager: 'apt' | 'pip' | 'npm';
        packages: string[];
        container?: string;
    }): Promise<{ output: string }> {
        // Check for active container
        const targetContainer = input.container || activeContainer?.name;
        if (!targetContainer) {
            throw new Error('No active container. Create or select a container first.');
        }

        // Build install command based on package manager
        let installCmd: string;

        switch (input.packageManager) {
            case 'apt':
                // Update package lists first
                await executeCommand(targetContainer, ['apt-get', 'update', '-y']);
                installCmd = `apt-get install -y ${input.packages.join(' ')}`;
                break;
            case 'pip':
                installCmd = `pip install ${input.packages.join(' ')}`;
                break;
            case 'npm':
                installCmd = `npm install -g ${input.packages.join(' ')}`;
                break;
        }

        const output = await executeCommand(targetContainer, ['sh', '-c', installCmd]);
        return { output };
    },
};

const runScriptTool = {
    name: 'docker_run_script',
    description: 'Runs a script in the container workspace with the specified interpreter.',
    inputSchema: z.object({
        scriptPath: z.string().describe('Path to the script in the container workspace.'),
        interpreter: z.string().describe('Interpreter to use (e.g., python, node, bash).'),
        args: z
            .array(z.string())
            .optional()
            .default([])
            .describe('Arguments to pass to the script.'),
        container: z
            .string()
            .optional()
            .describe('Container name or ID. If not provided, the active container will be used.'),
    }),
    async executeLogic(input: {
        scriptPath: string;
        interpreter: string;
        args?: string[];
        container?: string;
    }): Promise<{ output: string }> {
        // Check for active container
        const targetContainer = input.container || activeContainer?.name;
        if (!targetContainer) {
            throw new Error('No active container. Create or select a container first.');
        }

        // Build command
        const command = [input.interpreter, input.scriptPath, ...(input.args || [])].join(' ');

        const output = await executeCommand(targetContainer, ['sh', '-c', command]);
        return { output };
    },
};

const stopContainerTool = {
    name: 'docker_stop_container',
    description: 'Stops and optionally removes a Docker container.',
    inputSchema: z.object({
        container: z
            .string()
            .optional()
            .describe('Container name or ID. If not provided, the active container will be used.'),
        remove: z
            .boolean()
            .optional()
            .default(false)
            .describe('Whether to remove the container after stopping it.'),
    }),
    async executeLogic(input: {
        container?: string;
        remove?: boolean;
    }): Promise<{ status: string }> {
        // Check for active container
        const targetContainer = input.container || activeContainer?.name;
        if (!targetContainer) {
            throw new Error('No active container. Create or select a container first.');
        }

        // Stop container
        runDockerCommand(['stop', targetContainer]);

        // Remove if requested
        if (input.remove) {
            runDockerCommand(['rm', targetContainer]);
            if (activeContainer && activeContainer.name === targetContainer) {
                activeContainer = null;
            }
            return { status: `Container ${targetContainer} stopped and removed` };
        } else {
            return { status: `Container ${targetContainer} stopped` };
        }
    },
};

const listWorkspaceFilesTool = {
    name: 'docker_list_workspace_files',
    description: 'Lists files in the container workspace directory.',
    inputSchema: z.object({
        directory: z
            .string()
            .optional()
            .default('')
            .describe('Directory within the workspace to list files from.'),
        container: z
            .string()
            .optional()
            .describe('Container name or ID. If not provided, the active container will be used.'),
    }),
    async executeLogic(input: {
        directory?: string;
        container?: string;
    }): Promise<{ files: string[] }> {
        // Check for active container
        const targetContainer = input.container || activeContainer?.name;
        if (!targetContainer) {
            throw new Error('No active container. Create or select a container first.');
        }

        const targetDir = path.join(CONTAINER_WORKSPACE, input.directory || '');
        const command = `ls -la ${targetDir}`;

        const output = await executeCommand(targetContainer, ['sh', '-c', command]);

        // Parse ls output to extract filenames
        const lines = output.split('\n').slice(1); // Skip the total line
        const files = lines
            .map((line) => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 9) {
                    return {
                        permissions: parts[0],
                        type: parts[0].charAt(0) === 'd' ? 'directory' : 'file',
                        name: parts.slice(8).join(' '),
                    };
                }
                return null;
            })
            .filter(Boolean);

        return { files: files as any };
    },
};

// Check Docker is installed and running
function checkDockerAvailable(): boolean {
    try {
        execSync('docker info', {
            encoding: 'utf-8',
            shell: IS_WINDOWS ? 'cmd.exe' : '/bin/sh',
        });
        console.log('Docker is available!');
        return true;
    } catch (error) {
        console.error('Docker is not available:', error);
        return false;
    }
}

// Store tools in a map for easy lookup
const availableTools: Record<
    string,
    {
        name: string;
        description: string;
        inputSchema: ZodSchema<any>;
        executeLogic: (input: any) => Promise<any>;
    }
> = {
    [createContainerTool.name]: createContainerTool,
    [listContainersTool.name]: listContainersTool,
    [executeCommandTool.name]: executeCommandTool,
    [uploadFileTool.name]: uploadFileTool,
    [downloadFileTool.name]: downloadFileTool,
    [installPackageTool.name]: installPackageTool,
    [runScriptTool.name]: runScriptTool,
    [stopContainerTool.name]: stopContainerTool,
    [listWorkspaceFilesTool.name]: listWorkspaceFilesTool,
};

// --- Server Initialization (using SDK structure) ---
const server = new Server(
    { name: 'docker-sandbox-server', version: '1.0.0' }, // Server info
    { capabilities: { tools: {} } } // Declare tool capability
);

// Handle ListTools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
    const toolList = Object.values(availableTools).map((tool) => {
        // Basic conversion of Zod schema to JSON Schema format
        const zodToJsonSchema = (schema: ZodSchema<any>) => {
            // Very basic conversion for primitive types
            const schemaDescription: Record<string, any> = {
                type: 'object',
                properties: {},
                required: [],
            };

            // This is a simplified approach - for complex schemas you'd need a full converter
            if (schema instanceof z.ZodObject) {
                const shape = (schema as any)._def.shape();
                for (const [key, value] of Object.entries(shape)) {
                    // Cast value to any to access _def
                    const zodValue = value as any;

                    schemaDescription.properties[key] = {
                        type:
                            zodValue._def.typeName === 'ZodString'
                                ? 'string'
                                : zodValue._def.typeName === 'ZodNumber'
                                  ? 'number'
                                  : zodValue._def.typeName === 'ZodBoolean'
                                    ? 'boolean'
                                    : zodValue._def.typeName === 'ZodEnum'
                                      ? getEnumType(zodValue) // Handle enums
                                      : zodValue._def.typeName === 'ZodArray'
                                        ? 'array'
                                        : 'object', // Use "object" instead of "any"
                    };

                    // Access description and isOptional safely with type assertion
                    if (zodValue.description) {
                        schemaDescription.properties[key].description = zodValue.description;
                    }

                    // Check if this field is required using type assertion
                    if (typeof zodValue.isOptional === 'function' && !zodValue.isOptional()) {
                        schemaDescription.required.push(key);
                    }
                }
            }

            return schemaDescription;
        };

        return {
            name: tool.name,
            description: tool.description,
            // Use our simple converter instead of openapi
            inputSchema: tool.inputSchema ? zodToJsonSchema(tool.inputSchema) : undefined,
        };
    });

    return { tools: toolList };
});

// Handle CallTool request
server.setRequestHandler(
    CallToolRequestSchema,
    async (request): Promise<z.infer<typeof CallToolResultSchema>> => {
        const toolName = request.params.name;
        const rawArgs = request.params.arguments ?? {};

        const tool = availableTools[toolName];

        if (!tool) {
            return {
                content: [{ type: 'text', text: `Error: Unknown tool '${toolName}'` }],
                isError: true,
            };
        }

        try {
            // Validate input arguments using the tool's Zod schema
            const validatedArgs = tool.inputSchema.parse(rawArgs);

            // Use safeExecute to wrap the tool's logic function
            const result = await safeExecute(async () => {
                // Pass validated args to the specific tool logic
                return tool.executeLogic(validatedArgs);
            });

            // Format the result according to CallToolResultSchema
            if (result.success) {
                const responseText =
                    typeof result.data === 'object'
                        ? JSON.stringify(result.data, null, 2)
                        : String(result.data ?? '');

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Tool '${toolName}' executed successfully.\nResult:\n${responseText}`,
                        },
                    ],
                    isError: false,
                };
            } else {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error executing tool '${toolName}': ${result.error}`,
                        },
                    ],
                    isError: true,
                };
            }
        } catch (error: any) {
            let errorMessage = `Error processing tool '${toolName}': `;
            if (error instanceof z.ZodError) {
                errorMessage += `Invalid input arguments: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
            } else {
                errorMessage += error.message || String(error);
            }

            // Return error response conforming to CallToolResultSchema
            return {
                content: [{ type: 'text', text: errorMessage }],
                isError: true,
            };
        }
    }
);

// --- Graceful Shutdown ---
async function cleanup() {
    // Stop any running processes
    for (const [id, process] of runningProcesses.entries()) {
        try {
            process.kill();
            runningProcesses.delete(id);
        } catch (error) {
            // Ignore errors during cleanup
            console.error(`Error during cleanup: ${error}`);
        }
    }

    // Don't automatically stop containers on shutdown
    // If container cleanup is needed, it should be explicitly called
}

process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
});

// --- Start Listening (using SDK structure) ---
async function runServer() {
    console.log('Starting Docker sandbox server...');

    // Ensure workspace directory exists
    ensureWorkspaceExists();

    // Check if Docker is available
    if (!checkDockerAvailable()) {
        console.error(
            'Docker is not available or not running. Please ensure Docker is installed and running.'
        );
        process.exit(1);
    }

    console.log('Connecting to MCP transport...');
    const transport = new StdioServerTransport();

    // Connect server to transport AFTER setting request handlers
    await server.connect(transport);
    console.log('Docker sandbox server connected and ready!');
}

runServer().catch((error: Error | any) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Server failed to start or connect: ${errorMessage}`);
    process.exit(1);
});

// Add this helper function to handle enum types
function getEnumType(enumSchema: any) {
    const values = enumSchema._def.values;
    // Check first value to determine type
    return typeof values[0] === 'string'
        ? 'string'
        : typeof values[0] === 'number'
          ? 'number'
          : 'string';
}
