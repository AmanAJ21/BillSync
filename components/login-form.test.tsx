import { describe, it, expect } from 'vitest';

describe('LoginForm', () => {
  it('can import login form component without errors', async () => {
    const { LoginForm } = await import('./login-form');
    expect(LoginForm).toBeDefined();
    expect(typeof LoginForm).toBe('function');
  });

  it('login form component has correct display name', async () => {
    const { LoginForm } = await import('./login-form');
    expect(LoginForm.name).toBe('LoginForm');
  });
});
