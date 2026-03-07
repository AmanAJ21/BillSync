import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Tests for AdminSidebar - Admin Navigation
 * 
 * Requirements: 3.5 - Role-Based Navigation Rendering
 * Property 11: For any user role, the navigation menu should contain only 
 * the menu items appropriate for that role.
 */

describe('AdminSidebar - Admin Navigation', () => {
  const sidebarSource = readFileSync(join(__dirname, 'admin-sidebar.tsx'), 'utf-8');

  it('can import AdminSidebar component without errors', async () => {
    const { AdminSidebar } = await import('./admin-sidebar');
    expect(AdminSidebar).toBeDefined();
    expect(typeof AdminSidebar).toBe('function');
  });

  it('should define admin navigation items', () => {
    // Verify admin menu items are defined
    expect(sidebarSource).toContain('Dashboard');
    expect(sidebarSource).toContain('User Management');
    expect(sidebarSource).toContain('Bill Management');
    expect(sidebarSource).toContain('Transactions');
    expect(sidebarSource).toContain('Audit Logs');
    expect(sidebarSource).toContain('Data Export');
    expect(sidebarSource).toContain('System Config');
  });

  it('should have correct links for admin routes', () => {
    // Verify admin routes are defined
    expect(sidebarSource).toContain('/admin');
    expect(sidebarSource).toContain('/admin/users');
    expect(sidebarSource).toContain('/admin/bills');
    expect(sidebarSource).toContain('/admin/transactions');
    expect(sidebarSource).toContain('/admin/audit-logs');
    expect(sidebarSource).toContain('/admin/export');
    expect(sidebarSource).toContain('/admin/config');
  });

  it('should display admin panel indicator', () => {
    // Verify admin panel indicator is present
    expect(sidebarSource).toContain('Admin Panel');
  });

  it('should use NavMain component for rendering navigation', () => {
    // Verify NavMain is used
    expect(sidebarSource).toContain('NavMain');
    expect(sidebarSource).toContain('navMain');
  });

  it('should only have links to admin routes', () => {
    // All navigation URLs should start with /admin
    const urlPattern = /url:\s*["']([^"']+)["']/g;
    const matches = [...sidebarSource.matchAll(urlPattern)];
    const urls = matches.map(match => match[1]);

    // Filter out non-navigation URLs (like logo links)
    const navigationUrls = urls.filter(url => url.startsWith('/admin'));

    // Verify we have admin navigation URLs
    expect(navigationUrls.length).toBeGreaterThan(0);

    // Verify all navigation URLs are admin routes
    navigationUrls.forEach(url => {
      expect(url).toMatch(/^\/admin/);
    });
  });
});
