import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Setup mocks before imports
const mockUsersCollection = {
  findOne: vi.fn(),
};

const mockDb = {
  collection: vi.fn(() => mockUsersCollection),
};

const mockGetDatabase = vi.fn().mockResolvedValue(mockDb);
const mockVerifyAuth = vi.fn();
const mockUnauthorizedResponse = vi.fn((message: string) => ({
  status: 401,
  json: { error: message },
}));
const mockForbiddenResponse = vi.fn((message: string) => ({
  status: 403,
  json: { error: message },
}));

// Mock the mongodb module
vi.mock('../../mongodb', () => ({
  getDatabase: mockGetDatabase,
}));

// Mock the auth module
vi.mock('../auth', () => ({
  verifyAuth: mockVerifyAuth,
  unauthorizedResponse: mockUnauthorizedResponse,
  forbiddenResponse: mockForbiddenResponse,
}));

// Import after mocks are set up
const { requireAdmin, requireRole } = await import('../role');

describe('Role Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersCollection.findOne.mockReset();
  });

  describe('requireAdmin', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: false,
        error: 'No token provided',
      });

      const request = new NextRequest('http://localhost:3000/api/admin/test');
      const response = await requireAdmin(request);

      expect(response).toBeDefined();
      expect(response?.status).toBe(401);
    });

    it('should return 403 when user is not admin', async () => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: '507f1f77bcf86cd799439011', email: 'user@test.com', name: 'Test User' },
      });

      mockUsersCollection.findOne.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        email: 'user@test.com',
        name: 'Test User',
        role: 'regular',
      });

      const request = new NextRequest('http://localhost:3000/api/admin/test');
      const response = await requireAdmin(request);

      expect(response).toBeDefined();
      expect(response?.status).toBe(403);
    });

    it('should return 403 when user does not exist', async () => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: '507f1f77bcf86cd799439011', email: 'user@test.com', name: 'Test User' },
      });

      mockUsersCollection.findOne.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/admin/test');
      const response = await requireAdmin(request);

      expect(response).toBeDefined();
      expect(response?.status).toBe(403);
    });

    it('should return null when user is admin (authorization passed)', async () => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: '507f1f77bcf86cd799439011', email: 'admin@test.com', name: 'Admin User' },
      });

      mockUsersCollection.findOne.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        email: 'admin@test.com',
        name: 'Admin User',
        role: 'admin',
      });

      const request = new NextRequest('http://localhost:3000/api/admin/test');
      const response = await requireAdmin(request);

      expect(response).toBeNull();
    });
  });

  describe('requireRole', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: false,
        error: 'No token provided',
      });

      const middleware = requireRole('admin');
      const request = new NextRequest('http://localhost:3000/api/test');
      const response = await middleware(request);

      expect(response).toBeDefined();
      expect(response?.status).toBe(401);
    });

    it('should return 403 when user role does not match required role', async () => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: '507f1f77bcf86cd799439011', email: 'user@test.com', name: 'Test User' },
      });

      mockUsersCollection.findOne.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        email: 'user@test.com',
        name: 'Test User',
        role: 'regular',
      });

      const middleware = requireRole('admin');
      const request = new NextRequest('http://localhost:3000/api/test');
      const response = await middleware(request);

      expect(response).toBeDefined();
      expect(response?.status).toBe(403);
    });

    it('should return 403 when user does not exist', async () => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: '507f1f77bcf86cd799439011', email: 'user@test.com', name: 'Test User' },
      });

      mockUsersCollection.findOne.mockResolvedValue(null);

      const middleware = requireRole('admin');
      const request = new NextRequest('http://localhost:3000/api/test');
      const response = await middleware(request);

      expect(response).toBeDefined();
      expect(response?.status).toBe(403);
    });

    it('should return null when user has required admin role', async () => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: '507f1f77bcf86cd799439011', email: 'admin@test.com', name: 'Admin User' },
      });

      mockUsersCollection.findOne.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        email: 'admin@test.com',
        name: 'Admin User',
        role: 'admin',
      });

      const middleware = requireRole('admin');
      const request = new NextRequest('http://localhost:3000/api/test');
      const response = await middleware(request);

      expect(response).toBeNull();
    });

    it('should return null when user has required regular role', async () => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: '507f1f77bcf86cd799439011', email: 'user@test.com', name: 'Test User' },
      });

      mockUsersCollection.findOne.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        email: 'user@test.com',
        name: 'Test User',
        role: 'regular',
      });

      const middleware = requireRole('regular');
      const request = new NextRequest('http://localhost:3000/api/test');
      const response = await middleware(request);

      expect(response).toBeNull();
    });

    it('should format role name correctly in error message', async () => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: '507f1f77bcf86cd799439011', email: 'user@test.com', name: 'Test User' },
      });

      mockUsersCollection.findOne.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        email: 'user@test.com',
        name: 'Test User',
        role: 'regular',
      });

      const middleware = requireRole('admin');
      const request = new NextRequest('http://localhost:3000/api/test');
      await middleware(request);

      expect(mockForbiddenResponse).toHaveBeenCalledWith('Admin access required');
    });
  });
});
