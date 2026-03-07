import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
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

describe('/api/admin/bills/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST', () => {
    it('should perform bulk update successfully', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const mockResult = {
        success: true,
        results: [
          { billId: '507f1f77bcf86cd799439011', success: true },
          { billId: '507f1f77bcf86cd799439012', success: true }
        ]
      };

      mockAdminBillService.bulkUpdateBills.mockResolvedValue(mockResult);

      const requestBody = {
        billIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        action: 'update',
        updates: { status: 'paid' }
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/bulk', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.summary.total).toBe(2);
      expect(data.summary.successful).toBe(2);
      expect(data.summary.failed).toBe(0);
    });

    it('should perform bulk delete successfully', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const mockResult = {
        success: true,
        results: [
          { billId: '507f1f77bcf86cd799439011', success: true },
          { billId: '507f1f77bcf86cd799439012', success: false, error: 'Bill not found' }
        ]
      };

      mockAdminBillService.bulkDeleteBills.mockResolvedValue(mockResult);

      const requestBody = {
        billIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        action: 'delete'
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/bulk', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.summary.total).toBe(2);
      expect(data.summary.successful).toBe(1);
      expect(data.summary.failed).toBe(1);
    });

    it('should validate required fields', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const requestBody = {
        billIds: ['507f1f77bcf86cd799439011']
        // Missing action field
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/bulk', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required fields: billIds, action');
    });

    it('should validate billIds array', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const requestBody = {
        billIds: [], // Empty array
        action: 'update',
        updates: { status: 'paid' }
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/bulk', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('billIds must be a non-empty array');
    });

    it('should validate billId format', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const requestBody = {
        billIds: ['507f1f77bcf86cd799439011', 'invalid-id'], // One invalid ID
        action: 'update',
        updates: { status: 'paid' }
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/bulk', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid bill ID format: invalid-id');
    });

    it('should validate action values', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const requestBody = {
        billIds: ['507f1f77bcf86cd799439011'],
        action: 'invalid-action' // Invalid action
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/bulk', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Action must be either "update" or "delete"');
    });

    it('should require updates for update action', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const requestBody = {
        billIds: ['507f1f77bcf86cd799439011'],
        action: 'update'
        // Missing updates field
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/bulk', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Updates object is required for update action');
    });

    it('should limit bulk operation size', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      // Create array with 101 bill IDs (exceeds limit of 100)
      const billIds = Array.from({ length: 101 }, (_, i) => 
        '507f1f77bcf86cd799439' + i.toString().padStart(3, '0')
      );

      const requestBody = {
        billIds,
        action: 'update',
        updates: { status: 'paid' }
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/bulk', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Cannot process more than 100 bills in a single request');
    });

    it('should validate update fields', async () => {
      mockRequireAdmin.mockResolvedValue(null);
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', role: 'admin' }
      });

      const requestBody = {
        billIds: ['507f1f77bcf86cd799439011'],
        action: 'update',
        updates: { 
          amount: -50, // Invalid negative amount
          status: 'paid' 
        }
      };

      const request = new NextRequest('http://localhost:3000/api/admin/bills/bulk', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Amount must be a positive number');
    });
  });
});