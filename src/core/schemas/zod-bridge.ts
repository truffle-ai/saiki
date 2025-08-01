import type { ZodError, ZodIssue } from 'zod';
import { SaikiErrorCode } from './errors.js';
import type { Issue } from './helpers.js';

export function zodToIssues<C = unknown>(
    err: ZodError,
    severity: 'error' | 'warning' = 'error'
): Issue<C>[] {
    return err.errors.map((e: ZodIssue) => ({
        code: ((e as any).params?.code ?? SaikiErrorCode.SCHEMA_VALIDATION) as SaikiErrorCode,
        message: e.message,
        path: e.path,
        severity,
    }));
}
