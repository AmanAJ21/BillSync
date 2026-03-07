import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { createUser, generateToken } from '@/lib/auth';
import { clearDatabase } from '@/lib/test/setup';

// Mock the internal API validation
vi.mock('@/lib/utils/internal-api', () => ({
  validateInternalRequest: vi.fn(() => null),
  addInternalHeaders: vi.fn((response) => response),
}));

describe.sequential('Admin Users API', () => {
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

  describe('GET /api/admin/users', () => {
    it('should return paginated users for admin', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/users?page=1&limit=10', {
        method: 'GET',
        headers: {
          cookie: `token=${adminToken}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(2); // admin + regular user
      expect(data.total).toBe(2);
      expect(data.page).toBe(1);
      expect(data.totalPages).toBe(1);
      
      // Check that passwords are not included
      data.users.forEach((user: any) => {
        expect(user.password).toBeUndefined();
      });
    });

    it('should filter users by role', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/users?role=admin', {
        method: 'GET',
        headers: {
          cookie: `token=${adminToken}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(1);
      expect(data.users[0].role).toBe('admin');
    });

    it('should search users by email', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/users?search=admin', {
        method: 'GET',
        headers: {
          cookie: `token=${adminToken}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(1);
      expect(data.users[0].email).toBe('admin@test.com');
    });

    it('should return 403 for regular user', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/users', {
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

    it('should return 401 for unauthenticated user', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should validate pagination parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/users?page=0&limit=200', {
        method: 'GET',
        headers: {
          cookie: `token=${adminToken}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid pagination parameters');
    });
  });

  describe('POST /api/admin/users', () => {
    it('should create new user with admin role', async () => {
      const userData = {
        email: 'newadmin@test.com',
        password: 'password123',
        name: 'New Admin',
        role: 'admin'
      };

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify(userData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('newadmin@test.com');
      expect(data.user.role).toBe('admin');
      expect(data.user.password).toBeUndefined(); // Password should not be returned
    });

    it('should create new user with regular role', async () => {
      const userData = {
        email: 'newuser@test.com',
        password: 'password123',
        name: 'New User',
        role: 'regular'
      };

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify(userData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('newuser@test.com');
      expect(data.user.role).toBe('regular');
    });

    it('should return 400 for missing required fields', async () => {
      const userData = {
        email: 'incomplete@test.com',
        // Missing password, name, role
      };

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify(userData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: email, password, name, role');
    });

    it('should return 400 for invalid role', async () => {
      const userData = {
        email: 'invalid@test.com',
        password: 'password123',
        name: 'Invalid User',
        role: 'invalid'
      };

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify(userData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Role must be either "regular" or "admin"');
    });

    it('should return 400 for invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User',
        role: 'regular'
      };

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify(userData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid email format');
    });

    it('should return 400 for short password', async () => {
      const userData = {
        email: 'short@test.com',
        password: '123',
        name: 'Test User',
        role: 'regular'
      };

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify(userData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Password must be at least 8 characters long');
    });

    it('should return 409 for duplicate email', async () => {
      const userData = {
        email: 'admin@test.com', // Already exists
        password: 'password123',
        name: 'Duplicate User',
        role: 'regular'
      };

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify(userData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('User with this email already exists');
    });

    it('should return 403 for regular user', async () => {
      const userData = {
        email: 'forbidden@test.com',
        password: 'password123',
        name: 'Forbidden User',
        role: 'regular'
      };

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${regularToken}`,
        },
        body: JSON.stringify(userData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Admin access required');
    });
  });
});