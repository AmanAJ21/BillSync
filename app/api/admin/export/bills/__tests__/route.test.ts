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

describe.sequential('Admin Export Bills API', () => {
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

    // Create some test bills
    const Bill = (await import('@/lib/models/Bill')).default;
    await Bill.create([
      {
        userId: regularUser._id.toString(),
        billId: 'BILL001',
        provider: 'Electric Company',
        billType: 'electricity',
        amount: 150.00,
        dueDate: new Date('2024-02-15'),
        status: 'pending',
        description: 'Monthly electricity bill'
      },
      {
        userId: regularUser._id.toString(),
        billId: 'BILL002',
        provider: 'Water Utility',
        billType: 'water',
        amount: 75.50,
        dueDate: new Date('2024-02-20'),
        status: 'paid',
        description: 'Monthly water bill'
      }
    ]);
  });

  describe('POST /api/admin/export/bills', () => {
    it('should export bills as CSV for admin', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/bills', {
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
      expect(response.headers.get('Content-Disposition')).toMatch(/attachment; filename="bills-export-.*\.csv"/);
      expect(response.headers.get('Cache-Control')).toBe('no-cache');

      const csvContent = await response.text();
      expect(csvContent).toContain('id,userId,billId,provider,billType,amount,dueDate,status,description,createdAt,updatedAt');
      expect(csvContent).toContain('Electric Company');
      expect(csvContent).toContain('Water Utility');
      expect(csvContent).toContain('BILL001');
      expect(csvContent).toContain('BILL002');
    });

    it('should export bills with status filter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `token=${adminToken}`,
        },
        body: JSON.stringify({
          filters: { status: 'pending' }
        }),
      });

      const response = await POST(request);
      const csvContent = await response.text();

      expect(response.status).toBe(200);
      expect(csvContent).toContain('Electric Company');
      expect(csvContent).not.toContain('Water Utility');
    });

    it('should export bills with userId filter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/bills', {
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

    it('should export bills with date range filter', async () => {
      const startDate = new Date('2024-02-01');
      const endDate = new Date('2024-02-16');

      const request = new NextRequest('http://localhost:3000/api/admin/export/bills', {
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
      expect(csvContent).toContain('Electric Company'); // Due 2024-02-15
      expect(csvContent).not.toContain('Water Utility'); // Due 2024-02-20
    });

    it('should handle empty filters', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/bills', {
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
      expect(csvContent).toContain('id,userId,billId,provider,billType,amount,dueDate,status,description,createdAt,updatedAt');
    });

    it('should handle request without body', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/bills', {
        method: 'POST',
        headers: {
          cookie: `token=${adminToken}`,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const csvContent = await response.text();
      expect(csvContent).toContain('id,userId,billId,provider,billType,amount,dueDate,status,description,createdAt,updatedAt');
    });

    it('should return 400 for invalid status filter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/bills', {
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
      expect(data.error).toBe('Invalid status filter. Must be "pending", "paid", or "overdue"');
    });

    it('should return 400 for invalid userId filter', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/export/bills', {
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
      const request = new NextRequest('http://localhost:3000/api/admin/export/bills', {
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
      const request = new NextRequest('http://localhost:3000/api/admin/export/bills', {
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
      const request = new NextRequest('http://localhost:3000/api/admin/export/bills', {
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
      const request = new NextRequest('http://localhost:3000/api/admin/export/bills', {
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