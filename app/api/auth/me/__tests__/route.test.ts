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

describe('GET /api/auth/me', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it('should return user info including role for admin user', async () => {
    // Create an admin user
    const adminUser = await createUser('admin-me@test.com', 'password123', 'Admin User');
    // Manually set role to admin
    const { getDatabase } = await import('@/lib/mongodb');
    const db = await getDatabase();
    await db.collection('users').updateOne(
      { email: 'admin-me@test.com' },
      { $set: { role: 'admin' } }
    );

    const token = generateToken(adminUser._id!.toString(), 'admin');

    const request = new NextRequest('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: {
        cookie: `auth-token=${token}`,
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.role).toBe('admin');
    expect(data.user.email).toBe('admin-me@test.com');
    expect(data.user.name).toBe('Admin User');
    expect(data.user.id).toBeDefined();
  });

  it('should return user info including role for regular user', async () => {
    // Create a regular user
    const regularUser = await createUser('user-me@test.com', 'password123', 'Regular User');
    const token = generateToken(regularUser._id!.toString(), 'regular');

    const request = new NextRequest('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: {
        cookie: `auth-token=${token}`,
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.role).toBe('regular');
    expect(data.user.email).toBe('user-me@test.com');
    expect(data.user.name).toBe('Regular User');
    expect(data.user.id).toBeDefined();
  });

  it('should return 401 for missing token', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/me', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('No token provided');
  });

  it('should return 401 for invalid token', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: {
        cookie: 'auth-token=invalid-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid token');
  });

  it('should return 404 for non-existent user', async () => {
    // Generate token for non-existent user
    const token = generateToken('507f1f77bcf86cd799439011', 'regular');

    const request = new NextRequest('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: {
        cookie: `auth-token=${token}`,
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
  });
});