import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../login/route';
import { createUser } from '@/lib/auth';
import { clearDatabase } from '@/lib/test/setup';

// Mock the internal API validation
vi.mock('@/lib/utils/internal-api', () => ({
  validateInternalRequest: vi.fn(() => null),
  addInternalHeaders: vi.fn((response) => response),
}));

/**
 * Integration tests for role-based login redirects
 * 
 * These tests verify Requirements 2.2, 2.3, 2.4:
 * - Admin users are redirected to /admin after login
 * - Regular users are redirected to /dashboard after login
 * - The same login interface is used for both user types
 */
describe('Login Flow - Role-Based Redirects Integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it('should redirect admin user to /admin after successful login', async () => {
    // Create an admin user
    await createUser('admin-redirect@test.com', 'password123', 'Admin User');
    
    // Update user role to admin
    const { getDatabase } = await import('@/lib/mongodb');
    const db = await getDatabase();
    await db.collection('users').updateOne(
      { email: 'admin-redirect@test.com' },
      { $set: { role: 'admin' } }
    );

    // Attempt login
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin-redirect@test.com',
        password: 'password123',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    // Verify response
    expect(response.status).toBe(200);
    expect(data.user.role).toBe('admin');
    expect(data.redirect).toBe('/admin');
    expect(data.user.email).toBe('admin-redirect@test.com');
    expect(data.message).toBe('Login successful');

    // Verify auth token cookie is set
    const cookies = response.cookies.getAll();
    const authCookie = cookies.find(c => c.name === 'auth-token');
    expect(authCookie).toBeDefined();
    expect(authCookie?.value).toBeTruthy();
  });

  it('should redirect regular user to /dashboard after successful login', async () => {
    // Create a regular user (default role)
    await createUser('user-redirect@test.com', 'password123', 'Regular User');

    // Attempt login
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user-redirect@test.com',
        password: 'password123',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    // Verify response
    expect(response.status).toBe(200);
    expect(data.user.role).toBe('regular');
    expect(data.redirect).toBe('/dashboard');
    expect(data.user.email).toBe('user-redirect@test.com');
    expect(data.message).toBe('Login successful');

    // Verify auth token cookie is set
    const cookies = response.cookies.getAll();
    const authCookie = cookies.find(c => c.name === 'auth-token');
    expect(authCookie).toBeDefined();
    expect(authCookie?.value).toBeTruthy();
  });

  it('should use the same login endpoint for both admin and regular users', async () => {
    // Create both types of users
    await createUser('admin-same-endpoint@test.com', 'password123', 'Admin User');
    await createUser('user-same-endpoint@test.com', 'password123', 'Regular User');
    
    const { getDatabase } = await import('@/lib/mongodb');
    const db = await getDatabase();
    await db.collection('users').updateOne(
      { email: 'admin-same-endpoint@test.com' },
      { $set: { role: 'admin' } }
    );

    // Test admin login
    const adminRequest = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin-same-endpoint@test.com',
        password: 'password123',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const adminResponse = await POST(adminRequest);
    const adminData = await adminResponse.json();

    // Test regular user login
    const userRequest = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user-same-endpoint@test.com',
        password: 'password123',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const userResponse = await POST(userRequest);
    const userData = await userResponse.json();

    // Both should succeed with different redirects
    expect(adminResponse.status).toBe(200);
    expect(userResponse.status).toBe(200);
    expect(adminData.redirect).toBe('/admin');
    expect(userData.redirect).toBe('/dashboard');
  });

  it('should not reveal user existence on failed login', async () => {
    // Create a user
    await createUser('existing-reveal@test.com', 'password123', 'Existing User');

    // Test with non-existent email
    const nonExistentRequest = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent-reveal@test.com',
        password: 'password123',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const nonExistentResponse = await POST(nonExistentRequest);
    const nonExistentData = await nonExistentResponse.json();

    // Test with wrong password
    const wrongPasswordRequest = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing-reveal@test.com',
        password: 'wrongpassword',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const wrongPasswordResponse = await POST(wrongPasswordRequest);
    const wrongPasswordData = await wrongPasswordResponse.json();

    // Both should return the same generic error
    expect(nonExistentResponse.status).toBe(401);
    expect(wrongPasswordResponse.status).toBe(401);
    expect(nonExistentData.error).toBe('Invalid credentials');
    expect(wrongPasswordData.error).toBe('Invalid credentials');
  });

  it('should include user role in response for both admin and regular users', async () => {
    // Create users
    await createUser('admin-role-response@test.com', 'password123', 'Admin User');
    await createUser('user-role-response@test.com', 'password123', 'Regular User');
    
    const { getDatabase } = await import('@/lib/mongodb');
    const db = await getDatabase();
    await db.collection('users').updateOne(
      { email: 'admin-role-response@test.com' },
      { $set: { role: 'admin' } }
    );

    // Test admin login
    const adminRequest = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin-role-response@test.com',
        password: 'password123',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const adminResponse = await POST(adminRequest);
    const adminData = await adminResponse.json();

    // Test regular user login
    const userRequest = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user-role-response@test.com',
        password: 'password123',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const userResponse = await POST(userRequest);
    const userData = await userResponse.json();

    // Both should include role in user object
    expect(adminData.user).toHaveProperty('role');
    expect(userData.user).toHaveProperty('role');
    expect(adminData.user.role).toBe('admin');
    expect(userData.user.role).toBe('regular');
  });
});
