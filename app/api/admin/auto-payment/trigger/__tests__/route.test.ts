import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/utils/auth-helper', () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('@/lib/services/AutoPaymentService', () => ({
  autoPaymentService: {
    processScheduledPaymentsWithExecution: vi.fn(),
  },
}));

vi.mock('@/lib/utils/internal-api', () => ({
  validateInternalRequest: vi.fn(() => null),
}));

import { authenticateRequest } from '@/lib/utils/auth-helper';
import { autoPaymentService } from '@/lib/services/AutoPaymentService';

describe('POST /api/admin/auto-payment/trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    vi.mocked(authenticateRequest).mockReturnValue({
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      userId: null,
      role: null,
    });

    const request = new NextRequest('http://localhost:3000/api/admin/auto-payment/trigger', {
      method: 'POST',
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 403 if user is not admin', async () => {
    vi.mocked(authenticateRequest).mockReturnValue({
      error: null,
      userId: 'user-123',
      role: 'user',
    });

    const request = new NextRequest('http://localhost:3000/api/admin/auto-payment/trigger', {
      method: 'POST',
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    
    const data = await response.json();
    expect(data.error).toContain('Admin access required');
  });

  it('should successfully trigger auto-payment processing', async () => {
    vi.mocked(authenticateRequest).mockReturnValue({
      error: null,
      userId: 'admin-123',
      role: 'admin',
    });

    const mockResults = [
      {
        billId: 'bill-1',
        userId: 'user-1',
        status: 'success' as const,
        transactionId: 'txn-1',
      },
      {
        billId: 'bill-2',
        userId: 'user-2',
        status: 'skipped' as const,
        reason: 'Not due within 24 hours',
      },
    ];

    vi.mocked(autoPaymentService.processScheduledPaymentsWithExecution).mockResolvedValue(mockResults);

    const request = new NextRequest('http://localhost:3000/api/admin/auto-payment/trigger', {
      method: 'POST',
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.summary.totalProcessed).toBe(2);
    expect(data.summary.successful).toBe(1);
    expect(data.summary.skipped).toBe(1);
    expect(data.results).toHaveLength(2);
  });

  it('should handle processing errors', async () => {
    vi.mocked(authenticateRequest).mockReturnValue({
      error: null,
      userId: 'admin-123',
      role: 'admin',
    });

    vi.mocked(autoPaymentService.processScheduledPaymentsWithExecution).mockRejectedValue(
      new Error('Processing failed')
    );

    const request = new NextRequest('http://localhost:3000/api/admin/auto-payment/trigger', {
      method: 'POST',
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    
    const data = await response.json();
    expect(data.error).toContain('Processing failed');
  });
});
