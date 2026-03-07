import { describe, it, expect } from 'vitest';

describe('AdminLayout', () => {
  it('can import admin layout component without errors', async () => {
    const { default: AdminLayout } = await import('./layout');
    expect(AdminLayout).toBeDefined();
    expect(typeof AdminLayout).toBe('function');
  });

  it('admin layout component has correct display name', async () => {
    const { default: AdminLayout } = await import('./layout');
    expect(AdminLayout.name).toBe('AdminLayout');
  });
});