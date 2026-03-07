import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { createUser, generateToken } from '@/lib/auth';
import { clearDatabase } from '@/lib/test/setup';

// Mock the internal API validation
vi.mock('@/lib/utils/internal-api', () => ({
  validateInternalRequest: vi.fn(() => null),
  addInternalHeaders: vi.fn((response) => response),
}));

describe.sequential('Admin Export Transactions API', () => {
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

    // Create some test transactions
    const AutoPaymentRecord = (await import('@/lib/models/AutoPaymentRecord')).default;
    await AutoPaymentRecord.create([
      {
        userId: regularUser._id.toString(),
        billId: 'BILL001',
        amount: 150.00,
        paymentDate: new Date('2024-02-15'),
        transactionId: 'TXN001',
        billProvider: 'Electric Company',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: 'CYCLE001'
      },
      {
        userId: regularUser._id.toString(),
        billId: 'BILL002',
        amount: 75.50,
        paymentDate: new Date('2024-02-20'),
        transactionId: 'TXN002',
        billProvider: 'Water Utility',
        billType: 'water',
        status: 'failed',
        paymentCycleId: 'CYCLE002'
      }
    ]);
  });

  describe('POST /api/admin/export/transactions', () => {
    it('should export transactions as CSV for admin', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv');
      expect(response.headers.get('Content-Disposition')).toMatch(/attachment; filename="transactions-export-.*\.csv"/);
      expect(response.headers.get('Cache-Control')).toBe('no-cache');

      const csvContent = await response.text();
      expect(csvContent).toContain('id,userId,billId,amount,paymentDate,transactionId,billProvider,billType,status,paymentCycleId,createdAt,updatedAt');
      expect(csvContent).toContain('Electric Company');
      expect(csvContent).toContain('Water Utility');
      expect(csvContent).toContain('TXN001');
      expect(csvContent).toContain('TXN002');
    });

    it('should export transactions with status filter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({
          filters: { status: 'success' }
        }),
      });

      const response = await POST(request);
      const csvContent = await response.text();

      expect(response.status).toBe(200);
      expect(csvContent).toContain('Electric Company');
      expect(csvContent).not.toContain('Water Utility');
    });

    it('should export transactions with userId filter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({
          filters: { userId: regularUser._id.toString() }
        }),
      });

      const response = await POST(request);
      const csvContent = await response.text();

      expect(response.status).toBe(200);
      expect(csvContent).toContain('Electric Company');
      expect(csvContent).toContain('Water Utility');
    });

    it('should export transactions with date range filter', async () => {
      const startDate = new Date('2024-02-01');
      const endDate = new Date('2024-02-16');

      const request = new NextRequest('http://localhost:3000/api/admin/export/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({
          filters: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }),
      });

      const response = await POST(request);
      const csvContent = await response.text();

      expect(response.status).toBe(200);
      expect(csvContent).toContain('Electric Company'); // Payment date 2024-02-15
      expect(csvContent).not.toContain('Water Utility'); // Payment date 2024-02-20
    });

    it('should handle empty filters', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const csvContent = await response.text();
      expect(csvContent).toContain('id,userId,billId,amount,paymentDate,transactionId,billProvider,billType,status,paymentCycleId,createdAt,updatedAt');
    });

    it('should handle request without body', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/transactions', {
        method: 'POST',
        headers: {
          cookie: `token=${adminToken}`,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const csvContent = await response.text();
      expect(csvContent).toContain('id,userId,billId,amount,paymentDate,transactionId,billProvider,billType,status,paymentCycleId,createdAt,updatedAt');
    });

    it('should return 400 for invalid status filter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({
          filters: { status: 'invalid' }
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid status filter. Must be "success", "failed", or "settled"');
    });

    it('should return 400 for invalid userId filter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({
          filters: { userId: 123 }
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid userId filter. Must be a string');
    });

    it('should return 400 for invalid startDate format', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({
          filters: { startDate: 'invalid-date' }
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid startDate format');
    });

    it('should return 400 for invalid endDate format', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({
          filters: { endDate: 'invalid-date' }
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid endDate format');
    });

    it('should return 403 for regular user', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${regularToken}`,
        },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Admin access required');
    });

    it('should return 401 for unauthenticated user', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });
  });
});