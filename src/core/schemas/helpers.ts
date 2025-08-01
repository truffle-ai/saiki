// schemas/helpers.ts
import { z } from 'zod';
import { SaikiErrorCode } from './errors.js';

/** Trim a string at parse time */
export const Trimmed = z.string().transform((s) => s.trim());

/** Trim and require non-empty after trim */
export const NonEmptyTrimmed = z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message: 'Required' });

/** Optional URL that treats "" as undefined and trims input */
export const OptionalURL = z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    const t = v.trim();
    return t === '' ? undefined : t;
}, z.string().url().optional());

/** Expand $VAR / ${VAR} and trim result */
export const EnvExpandedString = z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    const expanded = v.replace(
        /\$([A-Z_][A-Z0-9_]*)|\${([A-Z_][A-Z0-9_]*)}/gi,
        (_, v1, v2) => process.env[v1 || v2] ?? ''
    );
    return expanded.trim();
}, z.string());

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
