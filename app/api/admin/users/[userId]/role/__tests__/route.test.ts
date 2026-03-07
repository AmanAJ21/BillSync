import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from '../route';
import { createUser, generateToken } from '@/lib/auth';
import { clearDatabase } from '@/lib/test/setup';

// Mock the internal API validation
vi.mock('@/lib/utils/internal-api', () => ({
  validateInternalRequest: vi.fn(() => null),
  addInternalHeaders: vi.fn((response) => response),
}));

describe.sequential('PATCH /api/admin/users/[userId]/role', () => {
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

  it('should update user role from regular to admin', async () => {
    const request = new NextRequest(`http://localhost:3000/api/admin/users/${regularUser._id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `token=${adminToken}`,
      },
      body: JSON.stringify({ role: 'admin' }),
    });

    const response = await PATCH(request, { params: { userId: regularUser._id!.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.role).toBe('admin');
    expect(data.user.email).toBe('user@test.com');
  });

  it('should update user role from admin to regular', async () => {
    // First make the regular user an admin
    const { getDatabase } = await import('@/lib/mongodb');
    const { ObjectId } = await import('mongodb');
    const db = await getDatabase();
    await db.collection('users').updateOne(
      { _id: new ObjectId(regularUser._id) },
      { $set: { role: 'admin' } }
    );

    const request = new NextRequest(`http://localhost:3000/api/admin/users/${regularUser._id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `token=${adminToken}`,
      },
      body: JSON.stringify({ role: 'regular' }),
    });

    const response = await PATCH(request, { params: { userId: regularUser._id!.toString() } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.role).toBe('regular');
  });

  it('should prevent admin from changing their own role to regular', async () => {
    const request = new NextRequest(`http://localhost:3000/api/admin/users/${adminUser._id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `token=${adminToken}`,
      },
      body: JSON.stringify({ role: 'regular' }),
    });

    const response = await PATCH(request, { params: { userId: adminUser._id!.toString() } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Cannot change your own role to regular');
  });

  it('should return 400 for invalid role', async () => {
    const request = new NextRequest(`http://localhost:3000/api/admin/users/${regularUser._id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `token=${adminToken}`,
      },
      body: JSON.stringify({ role: 'invalid' }),
    });

    const response = await PATCH(request, { params: { userId: regularUser._id!.toString() } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Role must be either "regular" or "admin"');
  });

  it('should return 400 for missing role', async () => {
    const request = new NextRequest(`http://localhost:3000/api/admin/users/${regularUser._id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `token=${adminToken}`,
      },
      body: JSON.stringify({}),
    });

    const response = await PATCH(request, { params: { userId: regularUser._id!.toString() } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Role must be either "regular" or "admin"');
  });

  it('should return 404 for non-existent user', async () => {
    const fakeUserId = '507f1f77bcf86cd799439011';
    const request = new NextRequest(`http://localhost:3000/api/admin/users/${fakeUserId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `token=${adminToken}`,
      },
      body: JSON.stringify({ role: 'admin' }),
    });

    const response = await PATCH(request, { params: { userId: fakeUserId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('should return 400 for invalid user ID format', async () => {
    const invalidUserId = 'invalid-id';
    const request = new NextRequest(`http://localhost:3000/api/admin/users/${invalidUserId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `token=${adminToken}`,
      },
      body: JSON.stringify({ role: 'admin' }),
    });

    const response = await PATCH(request, { params: { userId: invalidUserId } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid user ID format');
  });

  it('should return 403 for regular user', async () => {
    const request = new NextRequest(`http://localhost:3000/api/admin/users/${regularUser._id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `token=${regularToken}`,
      },
      body: JSON.stringify({ role: 'admin' }),
    });

    const response = await PATCH(request, { params: { userId: regularUser._id!.toString() } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Admin access required');
  });

  it('should return 401 for unauthenticated user', async () => {
    const request = new NextRequest(`http://localhost:3000/api/admin/users/${regularUser._id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'admin' }),
    });

    const response = await PATCH(request, { params: { userId: regularUser._id!.toString() } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });
});