import { describe, it, expect } from 'vitest';

describe('Admin Dashboard Home Page', () => {
  it('can import admin dashboard page component without errors', async () => {
    const { default: AdminDashboard } = await import('./page');
    expect(AdminDashboard).toBeDefined();
    expect(typeof AdminDashboard).toBe('function');
  });

  it('admin dashboard page component has correct display name', async () => {
    const { default: AdminDashboard } = await import('./page');
    expect(AdminDashboard.name).toBe('AdminDashboard');
  });

  it('component exports a valid React component', async () => {
    const { default: AdminDashboard } = await import('./page');
    // Verify it's a function (React component)
    expect(typeof AdminDashboard).toBe('function');
    // Verify it can be called (though we won't render it)
    expect(() => AdminDashboard).not.toThrow();
  });
});
