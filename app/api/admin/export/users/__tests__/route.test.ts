import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { createUser, generateToken } from '@/lib/auth';
import { clearDatabase } from '@/lib/test/setup';

// Mock the internal API validation
vi.mock('@/lib/utils/internal-api', () => ({
  validateInternalRequest: vi.fn(() => null),
  addInternalHeaders: vi.fn((response) => response),
}));

describe.sequential('Admin Export Users API', () => {
  let adminUser: any;
  let regularUser: any;
  let adminToken: string;
  let regularToken: string;

  beforeEach(async () => {
    await clearDatabase();

    // Create admin user
    adminUser = await createUser('admin@test.com', 'password123', 'Admin User');
    const { getDatabase } = await import('@/lib/mongodb');
    const db = await getDatabase();
    await db.collection('users').updateOne(
      { email: 'admin@test.com' },
      { $set: { role: 'admin' } }
    );
    adminToken = generateToken(adminUser._id!.toString(), 'admin');

    // Create regular user
    regularUser = await createUser('user@test.com', 'password123', 'Regular User');
    regularToken = generateToken(regularUser._id!.toString(), 'regular');
  });

  describe('POST /api/admin/export/users', () => {
    it('should export users as CSV for admin', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv');
      expect(response.headers.get('Content-Disposition')).toMatch(/attachment; filename="users-export-.*\.csv"/);
      expect(response.headers.get('Cache-Control')).toBe('no-cache');

      const csvContent = await response.text();
      expect(csvContent).toContain('id,email,name,role,createdAt');
      expect(csvContent).toContain('admin@test.com');
      expect(csvContent).toContain('user@test.com');
    });

    it('should export users with role filter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({
          filters: { role: 'admin' }
        }),
      });

      const response = await POST(request);
      const csvContent = await response.text();

      expect(response.status).toBe(200);
      expect(csvContent).toContain('admin@test.com');
      expect(csvContent).not.toContain('user@test.com');
    });

    it('should export users with date range filter', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const endDate = new Date(); // Today

      const request = new NextRequest('http://localhost:3000/api/admin/export/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({
          filters: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }),
      });

      const response = await POST(request);
      const csvContent = await response.text();

      expect(response.status).toBe(200);
      expect(csvContent).toContain('admin@test.com');
      expect(csvContent).toContain('user@test.com');
    });

    it('should handle empty filters', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const csvContent = await response.text();
      expect(csvContent).toContain('id,email,name,role,createdAt');
    });

    it('should handle request without body', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/users', {
        method: 'POST',
        headers: {
          cookie: `token=${adminToken}`,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const csvContent = await response.text();
      expect(csvContent).toContain('id,email,name,role,createdAt');
    });

    it('should return 400 for invalid role filter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({
          filters: { role: 'invalid' }
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid role filter. Must be "regular" or "admin"');
    });

    it('should return 400 for invalid startDate format', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({
          filters: { startDate: 'invalid-date' }
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid startDate format');
    });

    it('should return 400 for invalid endDate format', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({
          filters: { endDate: 'invalid-date' }
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid endDate format');
    });

    it('should return 403 for regular user', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${regularToken}`,
        },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Admin access required');
    });

    it('should return 401 for unauthenticated user', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });
  });
});