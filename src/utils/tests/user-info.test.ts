import { getUserId } from '../user-info.js';

describe('getUserId', () => {
  it('returns the default user id', () => {
    expect(getUserId()).toBe('default-user');
  });
}); 