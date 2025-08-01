import { ZodError, ZodIssueCode, ZodType } from 'zod';

/**
 * Generic severity enum so we can flag warnings vs errors in one list.
 */
export type Severity = 'error' | 'warning';

/**
 * A single validation / business-logic issue that occurred while performing an operation.
 * The generic parameter `C` lets callers attach domain-specific context without
 * forcing that context on every consumer.
 */
export interface Issue<C = unknown> {
    /** Category or machine-readable code for the issue (e.g. 'schema', 'business'). */
    code: string;
    /** Human-readable message. */
    message: string;
    /** Dot-notation path if the issue refers to a specific field. */
    path?: string;
    /** error | warning (default error) */
    severity?: Severity;
    /** Arbitrary contextual data. */
    context?: C;
}

/**
 * Canonical result container.
 *   ok      – true when the operation succeeded.
 *   data    – payload when ok is true.
 *   issues  – array of issues (possibly empty).
 */
export interface Result<T, C = unknown> {
    ok: boolean;
    data?: T;
    issues: Issue<C>[];
}

/* ------------------------------------------------------------------ */
/* Constructors                                                       */
/* ------------------------------------------------------------------ */

export const ok = <T, C = unknown>(data: T, issues: Issue<C>[] = []): Result<T, C> => ({
    ok: true,
    data,
    issues,
});

export const fail = <T = never, C = unknown>(issues: Issue<C>[]): Result<T, C> => ({
    ok: false,
    issues,
});

/* ------------------------------------------------------------------ */
/* Zod helper                                                         */
/* ------------------------------------------------------------------ */

/**
 * Convert a ZodError into an Issue list and wrap in fail().
 * Maps to 'schema_validation' by default - domain functions can override with specific codes.
 */
export function fromZod<C = unknown>(error: ZodError, ctx?: Partial<C>): Result<never, C> {
    const issues: Issue<C>[] = error.errors.map((z) => ({
        code: 'schema_validation', // Generic code - domains can remap if needed
        message: z.message,
        path: z.path.join('.'),
        severity: 'error',
        context: ctx as C,
    }));
    return fail(issues);
}

/**
 * Convenience wrapper: validates data with schema.safeParse and returns Result.
 */
export function zodResult<T, C = unknown>(
    schema: ZodType<T>,
    data: unknown,
    ctx?: Partial<C>
): Result<T, C> {
    const parsed = schema.safeParse(data);
    return parsed.success ? ok(parsed.data) : fromZod(parsed.error, ctx);
}

/* ------------------------------------------------------------------ */
/* Utility helpers                                                    */
/* ------------------------------------------------------------------ */

/** Merge multiple Result objects. If any is fail, the merged result is fail. */
export function mergeResults<T, C = unknown>(...results: Result<any, C>[]): Result<T, C> {
    const issues: Issue<C>[] = results.flatMap((r) => r.issues);
    const firstFail = results.find((r) => !r.ok);
    if (firstFail) {
        return fail(issues);
    }
    // Typescript: we know every result is ok, but we only have one payload to return.
    // Caller can ignore data or we could return undefined.
    const firstOk = results.find((r) => r.ok && r.data !== undefined);
    return ok(firstOk?.data as T, issues);
}

/**
 * Log issues using Saiki logger with appropriate level.
 * The function signature is kept generic so utils can be used in core and app layers.
 */
export function logIssues<C = unknown>(
    where: string,
    result: Result<any, C>,
    logger: { error: Function; warn: Function }
) {
    result.issues.forEach((i) => {
        const logFn = i.severity === 'warning' ? logger.warn : logger.error;
        logFn(`${where}: ${i.message}`, i.context);
    });
}
