import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Tests for AppSidebar - Regular User Navigation
 * 
 * Requirements: 3.5 - Role-Based Navigation Rendering
 * Property 11: For any user role, the navigation menu should contain only 
 * the menu items appropriate for that role.
 */

describe('AppSidebar - Regular User Navigation', () => {
  const sidebarSource = readFileSync(join(__dirname, 'app-sidebar.tsx'), 'utf-8');

  it('can import AppSidebar component without errors', async () => {
    const { AppSidebar } = await import('./app-sidebar');
    expect(AppSidebar).toBeDefined();
    expect(typeof AppSidebar).toBe('function');
  });

  it('should define only regular user navigation items', () => {
    // Verify regular user navigation items are defined
    expect(sidebarSource).toContain('Dashboard');
    expect(sidebarSource).toContain('/dashboard');
    expect(sidebarSource).toContain('Profile');
    expect(sidebarSource).toContain('/dashboard/profile');
    expect(sidebarSource).toContain('Bill');
    expect(sidebarSource).toContain('/dashboard/bill');
    expect(sidebarSource).toContain('Auto-Payments');
    expect(sidebarSource).toContain('/dashboard/auto-payments');
  });

  it('should not contain any admin-specific navigation items', () => {
    // Verify admin menu items are NOT present
    expect(sidebarSource).not.toContain('User Management');
    expect(sidebarSource).not.toContain('Bill Management');
    expect(sidebarSource).not.toContain('Audit Logs');
    expect(sidebarSource).not.toContain('Data Export');
    expect(sidebarSource).not.toContain('System Config');
  });

  it('should not have any links to admin routes', () => {
    // Verify no admin routes are defined
    expect(sidebarSource).not.toContain('/admin/users');
    expect(sidebarSource).not.toContain('/admin/bills');
    expect(sidebarSource).not.toContain('/admin/transactions');
    expect(sidebarSource).not.toContain('/admin/audit-logs');
    expect(sidebarSource).not.toContain('/admin/config');
    expect(sidebarSource).not.toContain('/admin/export');
  });

  it('should use NavMain component for rendering navigation', () => {
    // Verify NavMain is used
    expect(sidebarSource).toContain('NavMain');
    expect(sidebarSource).toContain('navMain');
  });
});
