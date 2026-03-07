import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { createUser, generateToken } from '@/lib/auth';
import { clearDatabase } from '@/lib/test/setup';
import SystemConfig from '@/lib/models/SystemConfig';

// Mock the internal API validation
vi.mock('@/lib/utils/internal-api', () => ({
  validateInternalRequest: vi.fn(() => null),
  addInternalHeaders: vi.fn((response) => response),
}));

describe.sequential('Admin Config API', () => {
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

    // Create test configurations
    await SystemConfig.create({
      key: 'payment_timeout_seconds',
      value: 30,
      category: 'payment',
      description: 'Payment processing timeout',
      lastModifiedBy: adminUser._id.toString(),
      lastModifiedAt: new Date(),
    });

    await SystemConfig.create({
      key: 'email_enabled',
      value: true,
      category: 'notification',
      description: 'Enable email notifications',
      lastModifiedBy: adminUser._id.toString(),
      lastModifiedAt: new Date(),
    });
  });

  describe('GET /api/admin/config', () => {
    it('should return 401 for unauthenticated user', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 403 for regular user', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config', {
        method: 'GET',
        headers: {
          cookie: `token=${regularToken}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Admin access required');
    });

    it('should return all configurations for admin', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config', {
        method: 'GET',
        headers: {
          cookie: `token=${adminToken}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.configs).toHaveLength(2);
      expect(data.configs.some((c: any) => c.key === 'payment_timeout_seconds')).toBe(true);
      expect(data.configs.some((c: any) => c.key === 'email_enabled')).toBe(true);
    });

    it('should filter configurations by category', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config?category=payment', {
        method: 'GET',
        headers: {
          cookie: `token=${adminToken}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.configs).toHaveLength(1);
      expect(data.configs[0].key).toBe('payment_timeout_seconds');
      expect(data.configs[0].category).toBe('payment');
    });

    it('should return 400 for invalid category', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config?category=invalid', {
        method: 'GET',
        headers: {
          cookie: `token=${adminToken}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid category');
    });

    it('should handle all valid category values', async () => {
      const validCategories = ['payment', 'notification', 'auto_payment', 'general'];

      for (const category of validCategories) {
        const request = new NextRequest(`http://localhost:3000/api/admin/config?category=${category}`, {
          method: 'GET',
          headers: {
            cookie: `token=${adminToken}`,
          },
        });

        const response = await GET(request);
        expect(response.status).toBe(200);
      }
    });
  });
});