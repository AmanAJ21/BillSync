import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT, DELETE } from '../route';
import { requireAdmin } from '../../../../../../lib/middleware/role';
import { adminBillService } from '../../../../../../lib/services/AdminBillService';
import { verifyAuth } from '../../../../../../lib/middleware/auth';

// Mock dependencies
vi.mock('../../../../../../lib/middleware/role');
vi.mock('../../../../../../lib/services/AdminBillService');
vi.mock('../../../../../../lib/middleware/auth');

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockVerifyAuth = vi.mocked(verifyAuth);
const mockAdminBillService = vi.mocked(adminBillService);

describe('/api/admin/bills/[billId]', () => {
  const mockParams = { params: { billId: '507f1f77bcf86cd799439011' } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PUT', () => {
    it('should update a bill successfully', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const mockUpdatedBill = {
        _id: '507f1f77bcf86cd799439011',
        userId: '507f1f77bcf86cd799439012',
        billId: 'BILL-001',
        provider: 'Electric Company',
        billType: 'electricity',
        amount: 175.00, // Updated amount
        dueDate: new Date('2024-02-15'),
        status: 'pending' as const
      };

      mockAdminBillService.updateBill.mockResolvedValue(mockUpdatedBill);

      const requestBody = {
        amount: 175.00,
        status: 'pending'
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/507f1f77bcf86cd799439011', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      const response = await PUT(request, mockParams);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.bill.amount).toBe(175.00);
    });

    it('should return 404 when bill not found', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      mockAdminBillService.updateBill.mockResolvedValue(null);

      const requestBody = {
        amount: 175.00
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/507f1f77bcf86cd799439011', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      const response = await PUT(request, mockParams);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Bill not found');
    });

    it('should validate billId format', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const invalidParams = { params: { billId: 'invalid-id' } };
      const requestBody = { amount: 175.00 };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/invalid-id', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      const response = await PUT(request, invalidParams);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid bill ID format');
    });

    it('should validate amount is positive', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const requestBody = {
        amount: -50 // Invalid negative amount
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/507f1f77bcf86cd799439011', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      const response = await PUT(request, mockParams);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Amount must be a positive number');
    });

    it('should validate status values', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const requestBody = {
        status: 'invalid-status'
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/507f1f77bcf86cd799439011', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      const response = await PUT(request, mockParams);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid status');
    });
  });

  describe('DELETE', () => {
    it('should delete a bill successfully', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      mockAdminBillService.deleteBill.mockResolvedValue();

      const request = new NextRequest('http://localhost:3000/api/admin/bills/507f1f77bcf86cd799439011', {
        method: 'DELETE'
      });

      const response = await DELETE(request, mockParams);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(mockAdminBillService.deleteBill).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'admin123'
      );
    });

    it('should return 404 when bill not found', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      mockAdminBillService.deleteBill.mockRejectedValue(new Error('Bill not found'));

      const request = new NextRequest('http://localhost:3000/api/admin/bills/507f1f77bcf86cd799439011', {
        method: 'DELETE'
      });

      const response = await DELETE(request, mockParams);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Bill not found');
    });

    it('should validate billId format', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const invalidParams = { params: { billId: 'invalid-id' } };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/invalid-id', {
        method: 'DELETE'
      });

      const response = await DELETE(request, invalidParams);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid bill ID format');
    });
  });
});