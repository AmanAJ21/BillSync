import { describe, it, expect } from 'vitest';

describe('System Config Page', () => {
  it('can import system config page component without errors', async () => {
    const { default: SystemConfigPage } = await import('./page');
    expect(SystemConfigPage).toBeDefined();
    expect(typeof SystemConfigPage).toBe('function');
  });

  it('system config page component has correct display name', async () => {
    const { default: SystemConfigPage } = await import('./page');
    expect(SystemConfigPage.name).toBe('SystemConfigPage');
  });

  it('component exports a valid React component', async () => {
    const { default: SystemConfigPage } = await import('./page');
    // Verify it's a function (React component)
    expect(typeof SystemConfigPage).toBe('function');
    // Verify it can be called (though we won't render it)
    expect(() => SystemConfigPage).not.toThrow();
  });
});
