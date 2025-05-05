import { describe, it, expect } from 'vitest';
import { getUserId } from './user-info.js';

describe('getUserId', () => {
    it('returns the default user id', () => {
        expect(getUserId()).toBe('default-user');
    });
});
