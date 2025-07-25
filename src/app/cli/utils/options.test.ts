import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { validateCliOptions } from './options.js';

describe('validateCliOptions', () => {
    it('does not throw for minimal valid options', () => {
        const opts = { agent: 'config.yml', mode: 'cli', webPort: '8080' };
        expect(() => validateCliOptions(opts)).not.toThrow();
    });

    it('throws ZodError for missing agent', () => {
        const opts = { mode: 'cli', webPort: '8080' };
        expect(() => validateCliOptions(opts)).toThrow(ZodError);
    });
});
