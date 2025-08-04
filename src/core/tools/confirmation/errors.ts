export class ToolExecutionDeniedError extends Error {
    public readonly sessionId?: string;

    constructor(toolName: string, sessionId?: string) {
        super(`Tool '${toolName}' was denied by the user.`);
        this.name = 'ToolExecutionDeniedError';
        if (sessionId !== undefined) {
            this.sessionId = sessionId;
        }
    }
}
