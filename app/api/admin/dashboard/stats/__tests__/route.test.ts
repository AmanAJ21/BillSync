import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { GET, POST, PUT, DELETE } from '../route';

// Mock dependencies
vi.mock('../../../../../../lib/middleware/role', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('../../../../../../lib/mongoose', () => ({
  default: vi.fn(),
}));

vi.mock('../../../../../../lib/mongodb', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../../../../../../lib/models/AuditLog', () => ({
  default: {
    find: vi.fn(),
  },
}));

describe('Admin Dashboard Stats API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/dashboard/stats', () => {
    const createMockRequest = (url = 'http://localhost:3000/api/admin/dashboard/stats') => {
      return new NextRequest(url);
    };

    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      const { requireAdmin } = await import('../../../../../../lib/middleware/role');
      const unauthorizedResponse = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
      vi.mocked(requireAdmin).mockResolvedValue(unauthorizedResponse);

      const request = createMockRequest();

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('should return 403 when user is not admin', async () => {
      // Arrange
      const { requireAdmin } = await import('../../../../../../lib/middleware/role');
      const forbiddenResponse = NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
      vi.mocked(requireAdmin).mockResolvedValue(forbiddenResponse);

      const request = createMockRequest();

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(403);
    });

    it('should return dashboard statistics for admin user', async () => {
      // Arrange
      const { requireAdmin } = await import('../../../../../../lib/middleware/role');
      const connectDB = (await import('../../../../../../lib/mongoose')).default;
      const { getDatabase } = await import('../../../../../../lib/mongodb');
      const AuditLog = (await import('../../../../../../lib/models/AuditLog')).default;

      vi.mocked(requireAdmin).mockResolvedValue(null);
      vi.mocked(connectDB).mockResolvedValue(undefined);

      // Mock database collections
      const mockUsers = {
        countDocuments: vi.fn().mockResolvedValue(150)
      };
      const mockBills = {
        countDocuments: vi.fn()
          .mockResolvedValueOnce(500) // total bills
          .mockResolvedValueOnce(75)  // pending bills
      };
      const mockAutoPaymentRecords = {
        aggregate: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([{ total: 12500.50 }])
        })
      };

      vi.mocked(getDatabase).mockResolvedValue({
        collection: vi.fn((name) => {
          switch (name) {
            case 'users': return mockUsers;
            case 'bills': return mockBills;
            case 'autopaymentrecords': return mockAutoPaymentRecords;
            default: return {};
          }
        })
      } as any);

      // Mock recent activity
      const mockActivity = [
        {
          _id: '507f1f77bcf86cd799439011',
          adminId: 'admin123',
          operationType: 'bill_create',
          entityType: 'bill',
          timestamp: new Date('2024-01-15T10:30:00Z'),
          details: { provider: 'Electric Company' }
        },
        {
          _id: '507f1f77bcf86cd799439012',
          adminId: 'admin123',
          operationType: 'user_create',
          entityType: 'user',
          timestamp: new Date('2024-01-15T09:15:00Z'),
          details: { role: 'regular' }
        }
      ];

      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockActivity)
      };

      vi.mocked(AuditLog.find).mockReturnValue(mockQuery as any);

      const request = createMockRequest();

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toEqual({
        totalUsers: 150,
        totalBills: 500,
        pendingBills: 75,
        totalRevenue: 12500.50,
        recentActivity: [
          {
            id: '507f1f77bcf86cd799439011',
            adminId: 'admin123',
            action: 'bill_create',
            entityType: 'bill',
            timestamp: new Date('2024-01-15T10:30:00Z'),
            description: 'Created bill for Electric Company'
          },
          {
            id: '507f1f77bcf86cd799439012',
            adminId: 'admin123',
            action: 'user_create',
            entityType: 'user',
            timestamp: new Date('2024-01-15T09:15:00Z'),
            description: 'Created new regular account'
          }
        ]
      });

      // Verify database queries
      expect(mockUsers.countDocuments).toHaveBeenCalledWith();
      expect(mockBills.countDocuments).toHaveBeenCalledWith();
      expect(mockBills.countDocuments).toHaveBeenCalledWith({ status: 'pending' });
      expect(mockAutoPaymentRecords.aggregate).toHaveBeenCalledWith([
        { $match: { status: { $in: ['success', 'settled'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      expect(AuditLog.find).toHaveBeenCalledWith({
        adminId: { $exists: true, $ne: null }
      });
    });

    it('should handle zero revenue when no successful payments exist', async () => {
      // Arrange
      const { requireAdmin } = await import('../../../../../../lib/middleware/role');
      const connectDB = (await import('../../../../../../lib/mongoose')).default;
      const { getDatabase } = await import('../../../../../../lib/mongodb');
      const AuditLog = (await import('../../../../../../lib/models/AuditLog')).default;

      vi.mocked(requireAdmin).mockResolvedValue(null);
      vi.mocked(connectDB).mockResolvedValue(undefined);

      // Mock database collections with zero revenue
      const mockUsers = {
        countDocuments: vi.fn().mockResolvedValue(10)
      };
      const mockBills = {
        countDocuments: vi.fn()
          .mockResolvedValueOnce(20)
          .mockResolvedValueOnce(5)
      };
      const mockAutoPaymentRecords = {
        aggregate: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]) // No revenue records
        })
      };

      vi.mocked(getDatabase).mockResolvedValue({
        collection: vi.fn((name) => {
          switch (name) {
            case 'users': return mockUsers;
            case 'bills': return mockBills;
            case 'autopaymentrecords': return mockAutoPaymentRecords;
            default: return {};
          }
        })
      } as any);

      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([])
      };

      vi.mocked(AuditLog.find).mockReturnValue(mockQuery as any);

      const request = createMockRequest();

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.totalRevenue).toBe(0);
      expect(data.recentActivity).toEqual([]);
    });

    it('should handle database connection errors', async () => {
      // Arrange
      const { requireAdmin } = await import('../../../../../../lib/middleware/role');
      const connectDB = (await import('../../../../../../lib/mongoose')).default;

      vi.mocked(requireAdmin).mockResolvedValue(null);
      vi.mocked(connectDB).mockRejectedValue(new Error('Database connection failed'));

      const request = createMockRequest();

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch dashboard statistics');
    });

    it('should generate correct activity descriptions for different operation types', async () => {
      // Arrange
      const { requireAdmin } = await import('../../../../../../lib/middleware/role');
      const connectDB = (await import('../../../../../../lib/mongoose')).default;
      const { getDatabase } = await import('../../../../../../lib/mongodb');
      const AuditLog = (await import('../../../../../../lib/models/AuditLog')).default;

      vi.mocked(requireAdmin).mockResolvedValue(null);
      vi.mocked(connectDB).mockResolvedValue(undefined);

      // Mock database collections
      const mockUsers = { countDocuments: vi.fn().mockResolvedValue(1) };
      const mockBills = { countDocuments: vi.fn().mockResolvedValue(1) };
      const mockAutoPaymentRecords = {
        aggregate: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([])
        })
      };

      vi.mocked(getDatabase).mockResolvedValue({
        collection: vi.fn((name) => {
          switch (name) {
            case 'users': return mockUsers;
            case 'bills': return mockBills;
            case 'autopaymentrecords': return mockAutoPaymentRecords;
            default: return {};
          }
        })
      } as any);

      // Mock activity with different operation types
      const mockActivity = [
        {
          _id: '1',
          adminId: 'admin123',
          operationType: 'config_update',
          entityType: 'system_config',
          timestamp: new Date(),
          details: { key: 'payment_timeout' }
        },
        {
          _id: '3',
          adminId: 'admin123',
          operationType: 'data_export',
          entityType: 'user',
          timestamp: new Date(),
          details: {}
        }
      ];

      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockActivity)
      };

      vi.mocked(AuditLog.find).mockReturnValue(mockQuery as any);

      const request = createMockRequest();

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.recentActivity[0].description).toBe('Updated system configuration "payment_timeout"');
      expect(data.recentActivity[1].description).toBe('Exported user data');
    });
  });

  describe('POST /api/admin/dashboard/stats', () => {
    it('should return 405 Method Not Allowed', async () => {
      // Act
      const response = await POST();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed. Dashboard statistics are read-only.');
    });
  });

  describe('PUT /api/admin/dashboard/stats', () => {
    it('should return 405 Method Not Allowed', async () => {
      // Act
      const response = await PUT();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed. Dashboard statistics are read-only.');
    });
  });

  describe('DELETE /api/admin/dashboard/stats', () => {
    it('should return 405 Method Not Allowed', async () => {
      // Act
      const response = await DELETE();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed. Dashboard statistics are read-only.');
    });
  });
});