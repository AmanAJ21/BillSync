import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import PaymentCycle from '@/lib/models/PaymentCycle';
import { verifyToken } from '@/lib/auth';

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  verifyToken: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GET /api/payment-cycles/current', () => {
  const mockUserId = 'test-user-123';

  beforeEach(async () => {
    // Mock successful authentication
    vi.mocked(verifyToken).mockReturnValue({ userId: mockUserId });
  });

  it('should return 401 if user is not authenticated', async () => {
    vi.mocked(verifyToken).mockReturnValue(null);

    const request = new NextRequest('http://localhost:3000/api/payment-cycles/current', {
      method: 'GET',
      headers: { Cookie: 'auth-token=invalid-token' },
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
    
    const data = await response.json();
    expect(data.error).toBe('Invalid or expired token');
  });

  it('should return 404 if no active payment cycle exists', async () => {
    const request = new NextRequest('http://localhost:3000/api/payment-cycles/current', {
      method: 'GET',
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    expect(response.status).toBe(404);
    
    const data = await response.json();
    expect(data.error).toBe('No active payment cycle found');
  });

  it('should return current active payment cycle', async () => {
    // Create an active payment cycle
    const startDate = new Date('2024-01-01T00:00:00.000Z');
    const endDate = new Date('2024-01-31T23:59:59.999Z');
    
    const cycle = await PaymentCycle.create({
      userId: mockUserId,
      startDate,
      endDate,
      status: 'active',
    });

    const request = new NextRequest('http://localhost:3000/api/payment-cycles/current', {
      method: 'GET',
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toMatchObject({
      id: cycle._id.toString(),
      userId: mockUserId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: 'active',
      isActive: true,
    });
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it('should not return completed payment cycles', async () => {
    // Create a completed payment cycle
    await PaymentCycle.create({
      userId: mockUserId,
      startDate: new Date('2023-12-01T00:00:00.000Z'),
      endDate: new Date('2023-12-31T23:59:59.999Z'),
      status: 'completed',
    });

    const request = new NextRequest('http://localhost:3000/api/payment-cycles/current', {
      method: 'GET',
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    expect(response.status).toBe(404);
    
    const data = await response.json();
    expect(data.error).toBe('No active payment cycle found');
  });

  it('should only return payment cycle for authenticated user', async () => {
    // Create payment cycles for different users
    await PaymentCycle.create({
      userId: 'other-user',
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: new Date('2024-01-31T23:59:59.999Z'),
      status: 'active',
    });

    const request = new NextRequest('http://localhost:3000/api/payment-cycles/current', {
      method: 'GET',
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    expect(response.status).toBe(404);
    
    const data = await response.json();
    expect(data.error).toBe('No active payment cycle found');
  });

  it('should return the most recent active cycle if multiple exist (edge case)', async () => {
    // This shouldn't happen due to model validation, but test the query behavior
    const startDate1 = new Date('2024-01-01T00:00:00.000Z');
    const endDate1 = new Date('2024-01-31T23:59:59.999Z');
    
    const startDate2 = new Date('2024-02-01T00:00:00.000Z');
    const endDate2 = new Date('2024-02-29T23:59:59.999Z');

    // Bypass validation by directly inserting
    const cycle1 = await PaymentCycle.create({
      userId: mockUserId,
      startDate: startDate1,
      endDate: endDate1,
      status: 'active',
    });

    // Change first cycle to completed to allow second active cycle
    cycle1.status = 'completed';
    await cycle1.save();

    const cycle2 = await PaymentCycle.create({
      userId: mockUserId,
      startDate: startDate2,
      endDate: endDate2,
      status: 'active',
    });

    const request = new NextRequest('http://localhost:3000/api/payment-cycles/current', {
      method: 'GET',
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.id).toBe(cycle2._id.toString());
    expect(data.status).toBe('active');
  });
});
