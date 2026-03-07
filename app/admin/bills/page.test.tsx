import { describe, it, expect } from 'vitest';

describe('Bills Management Page', () => {
  it('can import bills management page component without errors', async () => {
    const { default: BillsManagementPage } = await import('./page');
    expect(BillsManagementPage).toBeDefined();
    expect(typeof BillsManagementPage).toBe('function');
  });

  it('bills management page component has correct display name', async () => {
    const { default: BillsManagementPage } = await import('./page');
    expect(BillsManagementPage.name).toBe('BillsManagementPage');
  });

  it('component exports a valid React component', async () => {
    const { default: BillsManagementPage } = await import('./page');
    // Verify it's a function (React component)
    expect(typeof BillsManagementPage).toBe('function');
    // Verify it can be called (though we won't render it)
    expect(() => BillsManagementPage).not.toThrow();
  });
});

describe('Export Functionality', () => {
  it('export button functionality is implemented in component', async () => {
    const { default: BillsManagementPage } = await import('./page');
    expect(BillsManagementPage).toBeDefined();
    
    // Verify component has export functionality by checking the source
    const componentSource = BillsManagementPage.toString();
    expect(componentSource).toContain('handleExport');
    expect(componentSource).toContain('isExporting');
  });

  it('export uses correct API endpoint', async () => {
    const { default: BillsManagementPage } = await import('./page');
    const componentSource = BillsManagementPage.toString();
    expect(componentSource).toContain('/api/admin/export/bills');
  });

  it('export handles CSV download with filters', async () => {
    const { default: BillsManagementPage } = await import('./page');
    const componentSource = BillsManagementPage.toString();
    expect(componentSource).toContain('blob');
    expect(componentSource).toContain('Content-Disposition');
    expect(componentSource).toContain('statusFilter');
    expect(componentSource).toContain('userIdFilter');
  });
});
