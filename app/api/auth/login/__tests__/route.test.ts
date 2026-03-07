import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { createUser } from '@/lib/auth';
import { clearDatabase } from '@/lib/test/setup';

// Mock the internal API validation
vi.mock('@/lib/utils/internal-api', () => ({
  validateInternalRequest: vi.fn(() => null),
  addInternalHeaders: vi.fn((response) => response),
}));

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it('should return role and redirect URL for admin user', async () => {
    // Create an admin user
    const adminUser = await createUser('admin-login-test@test.com', 'password123', 'Admin User');
    // Manually set role to admin (since createUser defaults to regular)
    const { getDatabase } = await import('@/lib/mongodb');
    const db = await getDatabase();
    await db.collection('users').updateOne(
      { email: 'admin-login-test@test.com' },
      { $set: { role: 'admin' } }
    );

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin-login-test@test.com',
        password: 'password123',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.role).toBe('admin');
    expect(data.redirect).toBe('/admin');
    expect(data.user.email).toBe('admin-login-test@test.com');
  });

  it('should return role and redirect URL for regular user', async () => {
    // Create a regular user
    await createUser('user-login-test@test.com', 'password123', 'Regular User');

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user-login-test@test.com',
        password: 'password123',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.role).toBe('regular');
    expect(data.redirect).toBe('/dashboard');
    expect(data.user.email).toBe('user-login-test@test.com');
  });

  it('should return error for invalid credentials', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent@test.com',
        password: 'wrongpassword',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid credentials');
  });

  it('should return error for missing credentials', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@test.com',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Email and password are required');
  });
});