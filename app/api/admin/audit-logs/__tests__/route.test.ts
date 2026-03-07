import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { GET, POST, PUT, DELETE } from '../route';

// Mock the middleware
vi.mock('../../../../../lib/middleware/role', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('../../../../../lib/mongoose', () => ({
  default: vi.fn(),
}));

vi.mock('../../../../../lib/models/AuditLog', () => ({
  default: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

describe('Admin Audit Logs API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/audit-logs', () => {
    it('should return audit logs with pagination', async () => {
      // Arrange
      const { requireAdmin } = await import('../../../../../lib/middleware/role');
      const AuditLog = (await import('../../../../../lib/models/AuditLog')).default;
      
      vi.mocked(requireAdmin).mockResolvedValue(null); // Admin authorized
      
      const mockLogs = [
        {
          _id: '1',
          userId: 'admin-123',
          operation: 'POST /api/admin/bills',
          operationType: 'bill_create',
          entityType: 'bill',
          details: { amount: 100 },
          status: 'success',
          timestamp: new Date('2024-01-15T10:00:00Z'),
        },
        {
          _id: '2',
          userId: 'admin-123',
          operation: 'PUT /api/admin/bills/bill-123',
          operationType: 'bill_update',
          entityType: 'bill',
          details: { amount: 120 },
          status: 'success',
          timestamp: new Date('2024-01-16T10:00:00Z'),
        },
      ];

      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockLogs),
      };

      vi.mocked(AuditLog.find).mockReturnValue(mockQuery as any);
      vi.mocked(AuditLog.countDocuments).mockResolvedValue(4);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs?page=1&limit=2');

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.logs).toHaveLength(2);
      expect(data.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 4,
        totalPages: 2,
        hasNextPage: true,
        hasPrevPage: false,
      });
    });

    it('should return 400 for invalid pagination parameters', async () => {
      // Arrange
      const { requireAdmin } = await import('../../../../../lib/middleware/role');
      vi.mocked(requireAdmin).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs?page=0&limit=200');

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid pagination parameters');
    });

    it('should return 400 for invalid operation type', async () => {
      // Arrange
      const { requireAdmin } = await import('../../../../../lib/middleware/role');
      vi.mocked(requireAdmin).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/admin/audit-logs?operationType=invalid_operation'
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid operation type');
    });

    it('should return 403 when accessed by non-admin user', async () => {
      // Arrange
      const { requireAdmin } = await import('../../../../../lib/middleware/role');
      const forbiddenResponse = NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
      vi.mocked(requireAdmin).mockResolvedValue(forbiddenResponse);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs');

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/admin/audit-logs', () => {
    it('should return 405 Method Not Allowed', async () => {
      // Act
      const response = await POST();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(405);
      expect(data.error).toContain('Audit logs cannot be created via API');
    });
  });

  describe('PUT /api/admin/audit-logs', () => {
    it('should return 405 Method Not Allowed', async () => {
      // Act
      const response = await PUT();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(405);
      expect(data.error).toContain('Audit logs cannot be modified');
    });
  });

  describe('DELETE /api/admin/audit-logs', () => {
    it('should return 405 Method Not Allowed', async () => {
      // Act
      const response = await DELETE();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(405);
      expect(data.error).toContain('Audit logs cannot be deleted');
    });
  });
});