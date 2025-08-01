// schemas/helpers.ts
import { z, type ZodError, type ZodIssue } from 'zod';
import { SaikiErrorCode } from './errors.js';

/** Trim and require non-empty after trim */
export const NonEmptyTrimmed = z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message: 'Required' });

/** Simple URL check (so we don’t need preprocess JUST to trim before .url()) */
function isValidUrl(s: string): boolean {
    try {
        // Allow only http/https (adjust if you want more)
        const u = new URL(s);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

export const OptionalURL = z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s === '' || isValidUrl(s), { message: 'Invalid URL' })
    .transform((s) => (s === '' ? undefined : s))
    .optional();

// Expand $VAR and ${VAR} using the provided env, then trim.
export const EnvExpandedString = (env: Record<string, string | undefined> = process.env) =>
    z.string().transform((input) => {
        if (typeof input !== 'string') return '';
        const out = input.replace(
            /\$([A-Z_][A-Z0-9_]*)|\${([A-Z_][A-Z0-9_]*)}/gi,
            (_, a, b) => env[a || b] ?? ''
        );
        return out.trim();
    });

// Zod type for non-empty environment expanded string
export const NonEmptyEnvExpandedString = (env: Record<string, string | undefined> = process.env) =>
    EnvExpandedString(env).refine((s) => s.length > 0, {
        message: 'Value is required',
    });

// Zod type for URL that could be pulled from env variables
export const RequiredEnvURL = (env = process.env) =>
    EnvExpandedString(env).refine(
        (s) => {
            try {
                const u = new URL(s);
                return u.protocol === 'http:' || u.protocol === 'https:';
            } catch {
                return false;
            }
        },
        { message: 'Invalid URL' }
    );

/** Severity of an issue */
export type Severity = 'error' | 'warning';

/** Generic issue type for validation results */
export interface Issue<C = unknown> {
    code: SaikiErrorCode;
    message: string;
    path?: Array<string | number>;
    severity: Severity;
    context?: C;
}

/**
 * A result type that can be either successful or failed
 * Denotes validation related results
 * @param T - The type of the data
 * @param C - The type of the context
 * @returns A result type that can be either successful or failed
 */
export interface Result<T, C = unknown> {
    ok: boolean;
    data?: T;
    issues: Issue<C>[];
}

/**
 * Create a successful result
 * @param data - The data to add to the result
 * @param issues - The issues to add to the result
 * @returns A successful result
 */
export const ok = <T, C = unknown>(data: T, issues: Issue<C>[] = []): Result<T, C> => ({
    ok: true,
    data,
    issues, // warnings live alongside errors here
});

/**
 * Create a failed result
 * @param issues - The issues to add to the result
 * @returns A failed result
 */
export const fail = <T = never, C = unknown>(issues: Issue<C>[]): Result<T, C> => ({
    ok: false,
    issues,
});

/**
 * Check if the issues have any errors
 * @param issues - The issues to check
 * @returns True if there are any errors, false otherwise
 */
export function hasErrors<C>(issues: Issue<C>[]) {
    return issues.some((i) => i.severity !== 'warning');
}

/**
 * Split issues into errors and warnings
 * @param issues - The issues to split
 * @returns An object with errors and warnings
 */
export function splitIssues<C>(issues: Issue<C>[]) {
    return {
        errors: issues.filter((i) => i.severity !== 'warning'),
        warnings: issues.filter((i) => i.severity === 'warning'),
    };
}

/**
 * Helper utility to map Zod errors to internal known error codes
 */
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
