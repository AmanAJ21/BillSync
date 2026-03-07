import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from '../route';
import { createUser, generateToken } from '@/lib/auth';
import { clearDatabase } from '@/lib/test/setup';
import SystemConfig from '@/lib/models/SystemConfig';

// Mock the internal API validation
vi.mock('@/lib/utils/internal-api', () => ({
  validateInternalRequest: vi.fn(() => null),
  addInternalHeaders: vi.fn((response) => response),
}));

describe.sequential('Admin Config [key] API', () => {
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

    // Create test configuration
    await SystemConfig.create({
      key: 'payment_timeout_seconds',
      value: 30,
      category: 'payment',
      description: 'Payment processing timeout',
      lastModifiedBy: adminUser._id.toString(),
      lastModifiedAt: new Date(),
    });
  });

  describe('GET /api/admin/config/[key]', () => {
    it('should return 401 for unauthenticated user', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config/payment_timeout_seconds', {
        method: 'GET',
      });

      const response = await GET(request, { params: { key: 'payment_timeout_seconds' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 403 for regular user', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config/payment_timeout_seconds', {
        method: 'GET',
        headers: {
          cookie: `token=${regularToken}`,
        },
      });

      const response = await GET(request, { params: { key: 'payment_timeout_seconds' } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Admin access required');
    });

    it('should return configuration when found', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config/payment_timeout_seconds', {
        method: 'GET',
        headers: {
          cookie: `token=${adminToken}`,
        },
      });

      const response = await GET(request, { params: { key: 'payment_timeout_seconds' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.config.key).toBe('payment_timeout_seconds');
      expect(data.config.value).toBe(30);
      expect(data.config.category).toBe('payment');
    });

    it('should return 404 when configuration not found', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config/nonexistent', {
        method: 'GET',
        headers: {
          cookie: `token=${adminToken}`,
        },
      });

      const response = await GET(request, { params: { key: 'nonexistent' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Configuration not found');
    });

    it('should return 400 for invalid key parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config/', {
        method: 'GET',
        headers: {
          cookie: `token=${adminToken}`,
        },
      });

      const response = await GET(request, { params: { key: '' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid configuration key');
    });
  });

  describe('PUT /api/admin/config/[key]', () => {
    it('should return 401 for unauthenticated user', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config/payment_timeout_seconds', {
        method: 'PUT',
        body: JSON.stringify({ value: 60 }),
      });

      const response = await PUT(request, { params: { key: 'payment_timeout_seconds' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 403 for regular user', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config/payment_timeout_seconds', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${regularToken}`,
        },
        body: JSON.stringify({ value: 60 }),
      });

      const response = await PUT(request, { params: { key: 'payment_timeout_seconds' } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Admin access required');
    });

    it('should update configuration successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config/payment_timeout_seconds', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({ value: 60, description: 'Updated timeout' }),
      });

      const response = await PUT(request, { params: { key: 'payment_timeout_seconds' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.config.value).toBe(60);
      expect(data.config.description).toBe('Updated timeout');

      // Verify the configuration was actually updated in the database
      const updatedConfig = await SystemConfig.findOne({ key: 'payment_timeout_seconds' });
      expect(updatedConfig?.value).toBe(60);
    });

    it('should return 400 when value is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config/payment_timeout_seconds', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({ description: 'No value provided' }),
      });

      const response = await PUT(request, { params: { key: 'payment_timeout_seconds' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Configuration value is required');
    });

    it('should return 400 for invalid key parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config/', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({ value: 60 }),
      });

      const response = await PUT(request, { params: { key: '' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid configuration key');
    });

    it('should return 404 when configuration not found', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/config/nonexistent', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({ value: 60 }),
      });

      const response = await PUT(request, { params: { key: 'nonexistent' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Configuration not found');
    });

    it('should allow value of 0 or false', async () => {
      // Create a boolean config for testing
      await SystemConfig.create({
        key: 'email_enabled',
        value: true,
        category: 'notification',
        description: 'Email notifications enabled',
        lastModifiedBy: adminUser._id.toString(),
        lastModifiedAt: new Date(),
      });

      const request = new NextRequest('http://localhost:3000/api/admin/config/email_enabled', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({ value: false }),
      });

      const response = await PUT(request, { params: { key: 'email_enabled' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.config.value).toBe(false);
    });

    it('should handle null and undefined values correctly', async () => {
      // Test null value
      const requestNull = new NextRequest('http://localhost:3000/api/admin/config/payment_timeout_seconds', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({ value: null }),
      });

      const responseNull = await PUT(requestNull, { params: { key: 'payment_timeout_seconds' } });
      expect(responseNull.status).toBe(400);

      // Test undefined value (missing value field)
      const requestUndefined = new NextRequest('http://localhost:3000/api/admin/config/payment_timeout_seconds', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({}),
      });

      const responseUndefined = await PUT(requestUndefined, { params: { key: 'payment_timeout_seconds' } });
      expect(responseUndefined.status).toBe(400);
    });
  });
});