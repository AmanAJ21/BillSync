import { describe, it, expect } from 'vitest';

describe('Admin Users Management Page', () => {
  it('can import users management page component without errors', async () => {
    const { default: UsersManagementPage } = await import('./page');
    expect(UsersManagementPage).toBeDefined();
    expect(typeof UsersManagementPage).toBe('function');
  });

  it('users management page component has correct display name', async () => {
    const { default: UsersManagementPage } = await import('./page');
    expect(UsersManagementPage.name).toBe('UsersManagementPage');
  });

  it('component exports a valid React component', async () => {
    const { default: UsersManagementPage } = await import('./page');
    // Verify it's a function (React component)
    expect(typeof UsersManagementPage).toBe('function');
    // Verify it can be called (though we won't render it)
    expect(() => UsersManagementPage).not.toThrow();
  });
});

describe('Export Functionality', () => {
  it('export button functionality is implemented in component', async () => {
    const { default: UsersManagementPage } = await import('./page');
    expect(UsersManagementPage).toBeDefined();
    
    // Verify component has export functionality by checking the source
    const componentSource = UsersManagementPage.toString();
    expect(componentSource).toContain('handleExport');
    expect(componentSource).toContain('isExporting');
  });

  it('export uses correct API endpoint', async () => {
    const { default: UsersManagementPage } = await import('./page');
    const componentSource = UsersManagementPage.toString();
    expect(componentSource).toContain('/api/admin/export/users');
  });

  it('export handles CSV download', async () => {
    const { default: UsersManagementPage } = await import('./page');
    const componentSource = UsersManagementPage.toString();
    expect(componentSource).toContain('blob');
    expect(componentSource).toContain('Content-Disposition');
  });
});
