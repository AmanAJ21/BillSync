import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { requireAdmin } from '../../../../../lib/middleware/role';
import { adminBillService } from '../../../../../lib/services/AdminBillService';
import { verifyAuth } from '../../../../../lib/middleware/auth';

// Mock dependencies
vi.mock('../../../../../lib/middleware/role');
vi.mock('../../../../../lib/services/AdminBillService');
vi.mock('../../../../../lib/middleware/auth');

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockVerifyAuth = vi.mocked(verifyAuth);
const mockAdminBillService = vi.mocked(adminBillService);

describe('/api/admin/bills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAdmin.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })
      );

      const request = new NextRequest('http://localhost:3000/api/admin/bills');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return bills with pagination', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockAdminBillService.getAllBills.mockResolvedValue({
        bills: [
          {
            _id: '507f1f77bcf86cd799439011',
            userId: '507f1f77bcf86cd799439012',
            billId: 'BILL-001',
            provider: 'Electric Company',
            billType: 'electricity',
            amount: 150.00,
            dueDate: new Date('2024-02-15'),
            status: 'pending'
          }
        ],
        total: 1,
        page: 1,
        totalPages: 1
      });

      const request = new NextRequest('http://localhost:3000/api/admin/bills?page=1&limit=10');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.bills).toHaveLength(1);
      expect(data.total).toBe(1);
    });

    it('should validate pagination parameters', async () => {
      mockRequireAdmin.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/admin/bills?page=0&limit=200');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid pagination parameters');
    });

    it('should filter bills by status', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockAdminBillService.getAllBills.mockResolvedValue({
        bills: [],
        total: 0,
        page: 1,
        totalPages: 0
      });

      const request = new NextRequest('http://localhost:3000/api/admin/bills?status=paid');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockAdminBillService.getAllBills).toHaveBeenCalledWith(
        { userId: undefined, status: 'paid', startDate: undefined, endDate: undefined },
        { page: 1, limit: 10 }
      );
    });
  });

  describe('POST', () => {
    it('should create a bill successfully', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const mockBill = {
        _id: '507f1f77bcf86cd799439011',
        userId: '507f1f77bcf86cd799439012',
        billId: 'BILL-001',
        provider: 'Electric Company',
        billType: 'electricity',
        amount: 150.00,
        dueDate: new Date('2024-02-15'),
        status: 'pending' as const
      };

      mockAdminBillService.createBill.mockResolvedValue(mockBill);

      const requestBody = {
        userId: '507f1f77bcf86cd799439012',
        provider: 'Electric Company',
        billType: 'electricity',
        amount: 150.00,
        dueDate: '2024-02-15'
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.bill._id).toBe(mockBill._id);
      expect(data.bill.provider).toBe(mockBill.provider);
      expect(data.bill.amount).toBe(mockBill.amount);
    });

    it('should validate required fields', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const requestBody = {
        provider: 'Electric Company',
        // Missing required fields
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Missing required fields');
    });

    it('should validate amount is positive', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const requestBody = {
        userId: '507f1f77bcf86cd799439012',
        provider: 'Electric Company',
        billType: 'electricity',
        amount: -50, // Invalid negative amount
        dueDate: '2024-02-15'
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Amount must be a positive number');
    });

    it('should validate billType', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const requestBody = {
        userId: '507f1f77bcf86cd799439012',
        provider: 'Electric Company',
        billType: 'invalid-type', // Invalid bill type
        amount: 150.00,
        dueDate: '2024-02-15'
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid billType');
    });
  });
});