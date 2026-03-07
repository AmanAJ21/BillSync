import { describe, it, expect } from 'vitest';

describe('AdminHeader', () => {
  it('can import admin header component without errors', async () => {
    const { AdminHeader } = await import('./admin-header');
    expect(AdminHeader).toBeDefined();
    expect(typeof AdminHeader).toBe('function');
  });

  it('admin header component has correct display name', async () => {
    const { AdminHeader } = await import('./admin-header');
    expect(AdminHeader.name).toBe('AdminHeader');
  });
});