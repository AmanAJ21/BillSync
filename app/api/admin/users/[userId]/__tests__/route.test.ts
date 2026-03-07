import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { createUser, generateToken } from '@/lib/auth';
import { clearDatabase } from '@/lib/test/setup';

// Mock the internal API validation
vi.mock('@/lib/utils/internal-api', () => ({
  validateInternalRequest: vi.fn(() => null),
  addInternalHeaders: vi.fn((response) => response),
}));

describe.sequential('GET /api/admin/users/[userId]', () => {
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

  it('should return user details for admin', async () => {
    const request = new NextRequest(`http://localhost:3000/api/admin/users/${regularUser._id}`, {
      method: 'GET',
      headers: {
        cookie: `token=${adminToken}`,
      },
    });

    const response = await GET(request, { params: { userId: regularUser._id!.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.email).toBe('user@test.com');
    expect(data.user.name).toBe('Regular User');
    expect(data.user.role).toBe('regular');
    expect(data.user.password).toBeUndefined(); // Password should not be included
    expect(data.billCount).toBeDefined();
    expect(data.lastLogin).toBeDefined();
  });

  it('should return 404 for non-existent user', async () => {
    const fakeUserId = '507f1f77bcf86cd799439011';
    const request = new NextRequest(`http://localhost:3000/api/admin/users/${fakeUserId}`, {
      method: 'GET',
      headers: {
        cookie: `token=${adminToken}`,
      },
    });

    const response = await GET(request, { params: { userId: fakeUserId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('should return 400 for invalid user ID format', async () => {
    const invalidUserId = 'invalid-id';
    const request = new NextRequest(`http://localhost:3000/api/admin/users/${invalidUserId}`, {
      method: 'GET',
      headers: {
        cookie: `token=${adminToken}`,
      },
    });

    const response = await GET(request, { params: { userId: invalidUserId } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid user ID format');
  });

  it('should return 403 for regular user', async () => {
    const request = new NextRequest(`http://localhost:3000/api/admin/users/${regularUser._id}`, {
      method: 'GET',
      headers: {
        cookie: `token=${regularToken}`,
      },
    });

    const response = await GET(request, { params: { userId: regularUser._id!.toString() } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Admin access required');
  });

  it('should return 401 for unauthenticated user', async () => {
    const request = new NextRequest(`http://localhost:3000/api/admin/users/${regularUser._id}`, {
      method: 'GET',
    });

    const response = await GET(request, { params: { userId: regularUser._id!.toString() } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });
});