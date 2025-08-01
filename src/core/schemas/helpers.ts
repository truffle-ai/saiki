// schemas/helpers.ts
import { z } from 'zod';
import { SaikiErrorCode } from './errors.js';

/** Trim and require non-empty after trim */
export const NonEmptyTrimmed = z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message: 'Required' });

// /** Optional URL that treats "" as undefined and trims input */
// export const OptionalURL = z.preprocess((v) => {
//     if (typeof v !== 'string') return v;
//     const t = v.trim();
//     return t === '' ? undefined : t;
// }, z.string().url().optional());

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

/**
 * Expand $VAR / ${VAR} using provided env (defaults to process.env),
 * then trim and require non-empty. Input: string → Output: string
 */
export const EnvExpandedString = (env: Record<string, string | undefined> = process.env) =>
    z
        .string()
        .transform((s) =>
            s.replace(
                /\$([A-Z_][A-Z0-9_]*)|\${([A-Z_][A-Z0-9_]*)}/gi,
                (_, v1, v2) => env[v1 || v2] ?? ''
            )
        )
        .transform((s) => s.trim())
        .refine((s) => s.length > 0, {
            message: 'Must be non-empty after env expansion',
        });

export type Severity = 'error' | 'warning';

export interface Issue<C = unknown> {
    code: SaikiErrorCode;
    message: string;
    path?: Array<string | number>;
    severity: Severity;
    context?: C;
}

export interface Result<T, C = unknown> {
    ok: boolean;
    data?: T;
    issues: Issue<C>[];
}

export const ok = <T, C = unknown>(data: T, issues: Issue<C>[] = []): Result<T, C> => ({
    ok: true,
    data,
    issues, // warnings live alongside errors here
});

export const fail = <T = never, C = unknown>(issues: Issue<C>[]): Result<T, C> => ({
    ok: false,
    issues,
});

export function hasErrors<C>(issues: Issue<C>[]) {
    return issues.some((i) => i.severity !== 'warning');
}

export function splitIssues<C>(issues: Issue<C>[]) {
    return {
        errors: issues.filter((i) => i.severity !== 'warning'),
        warnings: issues.filter((i) => i.severity === 'warning'),
    };
}
