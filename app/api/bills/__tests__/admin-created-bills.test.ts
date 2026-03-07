import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { createUser, generateToken } from '@/lib/auth';
import { clearDatabase } from '@/lib/test/setup';
import Bill from '@/lib/models/Bill';

// Mock the internal API validation
vi.mock('@/lib/utils/internal-api', () => ({
  validateInternalRequest: vi.fn(() => null),
  addInternalHeaders: vi.fn((response) => response),
}));

/**
 * Test Suite: Admin-Created Bills Visibility
 * 
 * Validates: Requirements 8.4, 8.5
 * Property 30: Admin-Created Bill Visibility
 * 
 * For any bill created by an admin for a specific user, that bill should appear 
 * in the target user's bill list and be payable by that user.
 */

describe.sequential('Feature: admin-role-management - Admin-Created Bills Visibility', () => {
  let regularUser: any;
  let userToken: string;

  beforeEach(async () => {
    await clearDatabase();

    // Create regular user
    regularUser = await createUser(`user-${Date.now()}@test.com`, 'password123', 'Regular User');

    // Generate token
    userToken = generateToken(regularUser._id!.toString(), 'regular');
  });

  /**
   * Unit Test: Admin creates bill for user, user can see it
   * Validates: Requirements 8.4
   */
  it('should show admin-created bills in user bill list', async () => {
    // Simulate admin creating a bill for the user (using Bill model directly)
    await Bill.create({
      userId: regularUser._id!.toString(),
      billId: `BILL-${Date.now()}-admin1`,
      provider: 'BESCOM',
      billType: 'electricity',
      amount: 1500,
      dueDate: new Date('2024-12-31'),
      accountNumber: 'ACC123',
      description: 'Monthly electricity bill',
      status: 'pending',
    });

    // User fetches their bills
    const userRequest = new NextRequest('http://localhost:3000/api/bills', {
      method: 'GET',
      headers: {
        'Cookie': `token=${userToken}`,
      },
    });

    const userResponse = await GET(userRequest);
    expect(userResponse.status).toBe(200);

    const userData = await userResponse.json();
    expect(userData.bills).toBeDefined();
    expect(userData.bills).toHaveLength(1);
    
    const bill = userData.bills[0];
    expect(bill.provider).toBe('BESCOM');
    expect(bill.billType).toBe('electricity');
    expect(bill.amount).toBe(1500);
    expect(bill.userId).toBe(regularUser._id!.toString());
    expect(bill.status).toBe('pending');
  });

  /**
   * Unit Test: Multiple admin-created bills appear in user list
   * Validates: Requirements 8.4
   */
  it('should show multiple admin-created bills in user bill list', async () => {
    // Simulate admin creating multiple bills for the user
    await Bill.create([
      {
        userId: regularUser._id!.toString(),
        billId: `BILL-${Date.now()}-1`,
        provider: 'BESCOM',
        billType: 'electricity',
        amount: 1500,
        dueDate: new Date('2024-12-31'),
        status: 'pending',
      },
      {
        userId: regularUser._id!.toString(),
        billId: `BILL-${Date.now()}-2`,
        provider: 'BWSSB',
        billType: 'water',
        amount: 500,
        dueDate: new Date('2024-12-25'),
        status: 'pending',
      },
      {
        userId: regularUser._id!.toString(),
        billId: `BILL-${Date.now()}-3`,
        provider: 'Airtel',
        billType: 'mobile',
        amount: 799,
        dueDate: new Date('2024-12-20'),
        status: 'pending',
      },
    ]);

    // User fetches their bills
    const userRequest = new NextRequest('http://localhost:3000/api/bills', {
      method: 'GET',
      headers: {
        'Cookie': `token=${userToken}`,
      },
    });

    const userResponse = await GET(userRequest);
    expect(userResponse.status).toBe(200);

    const userData = await userResponse.json();
    expect(userData.bills).toHaveLength(3);
    
    // Verify all bills belong to the user
    userData.bills.forEach((bill: any) => {
      expect(bill.userId).toBe(regularUser._id!.toString());
    });

    // Verify bills are sorted by due date
    const providers = userData.bills.map((b: any) => b.provider);
    expect(providers).toEqual(['Airtel', 'BWSSB', 'BESCOM']);
  });

  /**
   * Unit Test: Admin-created bills can be updated by user (payment simulation)
   * Validates: Requirements 8.5
   */
  it('should allow users to update status of admin-created bills', async () => {
    // Simulate admin creating a bill
    const createdBill = await Bill.create({
      userId: regularUser._id!.toString(),
      billId: `BILL-${Date.now()}-update`,
      provider: 'BESCOM',
      billType: 'electricity',
      amount: 1500,
      dueDate: new Date('2024-12-31'),
      status: 'pending',
    });

    // User updates the bill status (simulating payment)
    const updatedBill = await Bill.findByIdAndUpdate(
      createdBill._id,
      { status: 'paid' },
      { new: true }
    );

    expect(updatedBill).toBeDefined();
    expect(updatedBill?.status).toBe('paid');
    expect(updatedBill?.userId).toBe(regularUser._id!.toString());
  });

  /**
   * Unit Test: Admin-created bills are isolated per user
   * Validates: Requirements 8.2, 8.3
   */
  it('should not show admin-created bills to other users', async () => {
    // Create another user
    const otherUser = await createUser(`other-${Date.now()}@test.com`, 'password123', 'Other User');
    const otherToken = generateToken(otherUser._id!.toString(), 'regular');

    // Simulate admin creating a bill for regularUser
    await Bill.create({
      userId: regularUser._id!.toString(),
      billId: `BILL-${Date.now()}-isolated`,
      provider: 'BESCOM',
      billType: 'electricity',
      amount: 1500,
      dueDate: new Date('2024-12-31'),
      status: 'pending',
    });

    // Other user fetches their bills
    const otherUserRequest = new NextRequest('http://localhost:3000/api/bills', {
      method: 'GET',
      headers: {
        'Cookie': `token=${otherToken}`,
      },
    });

    const otherUserResponse = await GET(otherUserRequest);
    const otherUserData = await otherUserResponse.json();

    // Other user should not see the bill
    expect(otherUserData.bills).toHaveLength(0);

    // Regular user should see the bill
    const regularUserRequest = new NextRequest('http://localhost:3000/api/bills', {
      method: 'GET',
      headers: {
        'Cookie': `token=${userToken}`,
      },
    });

    const regularUserResponse = await GET(regularUserRequest);
    const regularUserData = await regularUserResponse.json();

    expect(regularUserData.bills).toHaveLength(1);
    expect(regularUserData.bills[0].userId).toBe(regularUser._id!.toString());
  });

  /**
   * Unit Test: User-created and admin-created bills both appear in user list
   * Validates: Requirements 8.1, 8.4
   */
  it('should show both user-created and admin-created bills in user list', async () => {
    // User creates their own bill
    await Bill.create({
      userId: regularUser._id!.toString(),
      billId: `BILL-${Date.now()}-user`,
      provider: 'User Provider',
      billType: 'internet',
      amount: 999,
      dueDate: new Date('2024-12-15'),
      status: 'pending',
    });

    // Simulate admin creating a bill for the user
    await Bill.create({
      userId: regularUser._id!.toString(),
      billId: `BILL-${Date.now()}-admin`,
      provider: 'Admin Provider',
      billType: 'electricity',
      amount: 1500,
      dueDate: new Date('2024-12-31'),
      status: 'pending',
    });

    // User fetches their bills
    const userRequest = new NextRequest('http://localhost:3000/api/bills', {
      method: 'GET',
      headers: {
        'Cookie': `token=${userToken}`,
      },
    });

    const userResponse = await GET(userRequest);
    const userData = await userResponse.json();

    // User should see both bills
    expect(userData.bills).toHaveLength(2);
    
    const providers = userData.bills.map((b: any) => b.provider).sort();
    expect(providers).toContain('User Provider');
    expect(providers).toContain('Admin Provider');
  });

  /**
   * Edge Case: Admin creates bill with all optional fields
   * Validates: Requirements 8.4
   */
  it('should show admin-created bills with all optional fields', async () => {
    await Bill.create({
      userId: regularUser._id!.toString(),
      billId: `BILL-${Date.now()}-complete`,
      provider: 'Complete Provider',
      billType: 'gas',
      amount: 750,
      dueDate: new Date('2024-12-28'),
      accountNumber: 'ACC-FULL-123',
      description: 'Complete bill with all fields',
      status: 'pending',
    });

    const userRequest = new NextRequest('http://localhost:3000/api/bills', {
      method: 'GET',
      headers: {
        'Cookie': `token=${userToken}`,
      },
    });

    const userResponse = await GET(userRequest);
    const userData = await userResponse.json();

    expect(userData.bills).toHaveLength(1);
    
    const bill = userData.bills[0];
    expect(bill.accountNumber).toBe('ACC-FULL-123');
    expect(bill.description).toBe('Complete bill with all fields');
  });

  /**
   * Edge Case: Empty bill list when no bills created
   * Validates: Requirements 8.2
   */
  it('should return empty array when user has no bills', async () => {
    const userRequest = new NextRequest('http://localhost:3000/api/bills', {
      method: 'GET',
      headers: {
        'Cookie': `token=${userToken}`,
      },
    });

    const userResponse = await GET(userRequest);
    const userData = await userResponse.json();

    expect(userData.bills).toHaveLength(0);
  });
});
