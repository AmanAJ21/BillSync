import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { DELETE } from '../[id]/route';
import { createUser, generateToken } from '@/lib/auth';
import { clearDatabase } from '@/lib/test/setup';
import Bill from '@/lib/models/Bill';

// Mock the internal API validation
vi.mock('@/lib/utils/internal-api', () => ({
  validateInternalRequest: vi.fn(() => null),
  addInternalHeaders: vi.fn((response) => response),
}));

// Mock mongoose connection
vi.mock('@/lib/mongoose', () => ({
  default: vi.fn(async () => {}),
}));

/**
 * Test Suite: Regular User Bill Isolation
 * 
 * **Validates: Requirements 8.2, 8.3**
 * 
 * This test suite verifies that regular users can only access their own bills
 * and cannot access or modify other users' bills.
 */
describe.sequential('Regular User Bill Isolation - Requirements 8.2, 8.3', () => {
  let user1Id: string;
  let user2Id: string;
  let user1Token: string;
  let user2Token: string;
  let user1Bill1Id: string;
  let user1Bill2Id: string;
  let user2Bill1Id: string;
  let user2Bill2Id: string;

  beforeEach(async () => {
    await clearDatabase();

    // Create two regular users
    const user1 = await createUser(`user1-${Date.now()}@test.com`, 'password123', 'User One');
    const user2 = await createUser(`user2-${Date.now()}@test.com`, 'password123', 'User Two');

    user1Id = user1._id!.toString();
    user2Id = user2._id!.toString();

    user1Token = generateToken(user1Id, 'regular');
    user2Token = generateToken(user2Id, 'regular');

    // Create bills for both users
    const bill1 = await Bill.create({
      userId: user1Id,
      billId: `bill-user1-1-${Date.now()}`,
      provider: 'Electric Company',
      billType: 'electricity',
      amount: 100,
      dueDate: new Date('2024-12-31'),
      status: 'pending',
    });

    const bill2 = await Bill.create({
      userId: user1Id,
      billId: `bill-user1-2-${Date.now()}`,
      provider: 'Water Company',
      billType: 'water',
      amount: 50,
      dueDate: new Date('2024-12-31'),
      status: 'pending',
    });

    const bill3 = await Bill.create({
      userId: user2Id,
      billId: `bill-user2-1-${Date.now()}`,
      provider: 'Gas Company',
      billType: 'gas',
      amount: 75,
      dueDate: new Date('2024-12-31'),
      status: 'pending',
    });

    const bill4 = await Bill.create({
      userId: user2Id,
      billId: `bill-user2-2-${Date.now()}`,
      provider: 'Internet Company',
      billType: 'internet',
      amount: 60,
      dueDate: new Date('2024-12-31'),
      status: 'pending',
    });

    user1Bill1Id = bill1._id.toString();
    user1Bill2Id = bill2._id.toString();
    user2Bill1Id = bill3._id.toString();
    user2Bill2Id = bill4._id.toString();
  });

  describe('GET /api/bills - Bill List Isolation', () => {
    it('should only return bills for authenticated user (user1) - Requirement 8.2', async () => {
      const request = new NextRequest('http://localhost:3000/api/bills', {
        headers: {
          Cookie: `token=${user1Token}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bills).toHaveLength(2);
      expect(data.bills.every((bill: any) => bill.userId === user1Id)).toBe(true);
    });

    it('should only return bills for authenticated user (user2) - Requirement 8.2', async () => {
      const request = new NextRequest('http://localhost:3000/api/bills', {
        headers: {
          Cookie: `token=${user2Token}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bills).toHaveLength(2);
      expect(data.bills.every((bill: any) => bill.userId === user2Id)).toBe(true);
    });

    it('should not include other users bills in response - Requirement 8.3', async () => {
      const request = new NextRequest('http://localhost:3000/api/bills', {
        headers: {
          Cookie: `token=${user1Token}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Verify no bills from user2 are included
      const returnedUserIds = data.bills.map((b: any) => b.userId);
      expect(returnedUserIds.every((id: string) => id === user1Id)).toBe(true);
      expect(returnedUserIds.includes(user2Id)).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      const request = new NextRequest('http://localhost:3000/api/bills');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('DELETE /api/bills/[id] - Cross-User Access Prevention', () => {
    it('should prevent user from deleting another users bill - Requirement 8.3', async () => {
      // User1 tries to delete User2's bill - THIS SHOULD FAIL
      const request = new NextRequest(`http://localhost:3000/api/bills/${user2Bill1Id}`, {
        method: 'DELETE',
        headers: {
          Cookie: `token=${user1Token}`,
        },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: user2Bill1Id }) });
      const data = await response.json();

      // Should return 403 Forbidden
      expect(response.status).toBe(403);
      expect(data.error).toContain('Access denied');

      // Verify the bill still exists
      const bill = await Bill.findById(user2Bill1Id);
      expect(bill).not.toBeNull();
    });

    it('should allow user to delete their own bill', async () => {
      const request = new NextRequest(`http://localhost:3000/api/bills/${user1Bill1Id}`, {
        method: 'DELETE',
        headers: {
          Cookie: `token=${user1Token}`,
        },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: user1Bill1Id }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify the bill is deleted
      const bill = await Bill.findById(user1Bill1Id);
      expect(bill).toBeNull();
    });

    it('should return 401 when not authenticated', async () => {
      const request = new NextRequest(`http://localhost:3000/api/bills/${user1Bill2Id}`, {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: user1Bill2Id }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');

      // Verify the bill still exists
      const bill = await Bill.findById(user1Bill2Id);
      expect(bill).not.toBeNull();
    });

    it('should return 404 when bill does not exist', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011'; // Valid ObjectId format

      const request = new NextRequest(`http://localhost:3000/api/bills/${nonExistentId}`, {
        method: 'DELETE',
        headers: {
          Cookie: `token=${user1Token}`,
        },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: nonExistentId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Bill not found');
    });
  });

  describe('POST /api/bills - Bill Creation Isolation', () => {
    it('should automatically assign userId to created bill', async () => {
      const billData = {
        provider: 'Mobile Company',
        billType: 'mobile',
        amount: 30,
        dueDate: '2024-12-31',
      };

      const request = new NextRequest('http://localhost:3000/api/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `token=${user1Token}`,
        },
        body: JSON.stringify(billData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.bill.userId).toBe(user1Id);

      // Verify bill is in database with correct userId
      const savedBill = await Bill.findOne({ billId: data.bill.billId });
      expect(savedBill?.userId).toBe(user1Id);
    });

    it('should return 401 when not authenticated', async () => {
      const billData = {
        provider: 'Electric Company',
        billType: 'electricity',
        amount: 100,
        dueDate: '2024-12-31',
      };

      const request = new NextRequest('http://localhost:3000/api/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(billData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });
});
