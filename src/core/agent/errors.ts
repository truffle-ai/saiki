import type { Issue } from '../utils/result.js';
import { SaikiErrorCode } from '../schemas/errors.js';

/**
 * Base class for SaikiAgent validation errors that occurred during Result->Exception conversion
 * Preserves rich validation context from internal Result pattern for advanced error handling
 */
export class SaikiValidationError extends Error {
    public readonly issues: Issue[];
    public readonly code: SaikiErrorCode;

    constructor(
        message: string,
        issues: Issue[],
        code: SaikiErrorCode = SaikiErrorCode.VALIDATION_ERROR
    ) {
        super(message);
        this.name = 'SaikiValidationError';
        this.issues = issues;
        this.code = code;
    }
}

/**
 * LLM configuration and switching errors
 * Thrown by SaikiAgent.switchLLM() when validation or switching fails
 */
export class SaikiLLMError extends SaikiValidationError {
    constructor(message: string, issues: Issue[]) {
        super(message, issues, SaikiErrorCode.AGENT_LLM_SWITCH_FAILED);
        this.name = 'SaikiLLMError';
    }
}

/**
 * MCP server configuration and connection errors
 * Thrown by SaikiAgent.connectMcpServer() when validation or connection fails
 */
export class SaikiMCPError extends SaikiValidationError {
    constructor(message: string, issues: Issue[]) {
        super(message, issues, SaikiErrorCode.AGENT_MCP_CONNECTION_FAILED);
        this.name = 'SaikiMCPError';
    }
}

/**
 * Input validation errors (text/image/file)
 * Thrown by SaikiAgent.run() when input validation fails
 */
export class SaikiInputError extends SaikiValidationError {
    constructor(message: string, issues: Issue[]) {
        super(message, issues, SaikiErrorCode.VALIDATION_ERROR);
        this.name = 'SaikiInputError';
    }
}
