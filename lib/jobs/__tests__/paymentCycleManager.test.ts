import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Job } from 'bull';
import { managePaymentCycles } from '../paymentCycleManager';
import { paymentCycleService } from '../../services/PaymentCycleService';
import PaymentCycle from '../../models/PaymentCycle';

// Mock the PaymentCycleService
vi.mock('../../services/PaymentCycleService', () => ({
  paymentCycleService: {
    closePaymentCycle: vi.fn(),
  },
}));

// Mock PaymentCycle model
vi.mock('../../models/PaymentCycle', () => ({
  default: {
    find: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Payment Cycle Manager Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should close active cycles and initialize new ones', async () => {
    // Arrange
    const mockCycles = [
      { _id: 'cycle1', userId: 'user1', status: 'active', endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      { _id: 'cycle2', userId: 'user2', status: 'active', endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    ];

    const mockClosedCycle1 = { _id: 'cycle1', userId: 'user1', status: 'completed' };
    const mockNewCycle1 = { _id: 'cycle3', userId: 'user1', status: 'active' };
    const mockClosedCycle2 = { _id: 'cycle2', userId: 'user2', status: 'completed' };
    const mockNewCycle2 = { _id: 'cycle4', userId: 'user2', status: 'active' };

    vi.mocked(PaymentCycle.find).mockResolvedValue(mockCycles as any);
    vi.mocked(paymentCycleService.closePaymentCycle)
      .mockResolvedValueOnce({ closedCycle: mockClosedCycle1, newCycle: mockNewCycle1 } as any)
      .mockResolvedValueOnce({ closedCycle: mockClosedCycle2, newCycle: mockNewCycle2 } as any);

    const mockJob = {
      id: 'job-123',
      data: { timestamp: new Date() },
    } as Job;

    // Act
    const result = await managePaymentCycles(mockJob);

    // Assert
    expect(PaymentCycle.find).toHaveBeenCalledOnce();
    expect(paymentCycleService.closePaymentCycle).toHaveBeenCalledTimes(2);
    expect(paymentCycleService.closePaymentCycle).toHaveBeenCalledWith('cycle1');
    expect(paymentCycleService.closePaymentCycle).toHaveBeenCalledWith('cycle2');
    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBe(2);
    expect(result.successCount).toBe(2);
    expect(result.errorCount).toBe(0);
  });

  it('should handle errors during cycle closure', async () => {
    // Arrange
    const mockCycles = [
      { _id: 'cycle1', userId: 'user1', status: 'active', endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      { _id: 'cycle2', userId: 'user2', status: 'active', endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    ];

    const mockClosedCycle = { _id: 'cycle2', userId: 'user2', status: 'completed' };
    const mockNewCycle = { _id: 'cycle3', userId: 'user2', status: 'active' };

    vi.mocked(PaymentCycle.find).mockResolvedValue(mockCycles as any);
    vi.mocked(paymentCycleService.closePaymentCycle)
      .mockRejectedValueOnce(new Error('Closure failed'))
      .mockResolvedValueOnce({ closedCycle: mockClosedCycle, newCycle: mockNewCycle } as any);

    const mockJob = {
      id: 'job-456',
      data: { timestamp: new Date() },
    } as Job;

    // Act
    const result = await managePaymentCycles(mockJob);

    // Assert
    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.errorCount).toBe(1);
  });

  it('should handle no active cycles to close', async () => {
    // Arrange
    vi.mocked(PaymentCycle.find).mockResolvedValue([]);

    const mockJob = {
      id: 'job-empty',
      data: { timestamp: new Date() },
    } as Job;

    // Act
    const result = await managePaymentCycles(mockJob);

    // Assert
    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBe(0);
    expect(result.successCount).toBe(0);
    expect(result.errorCount).toBe(0);
  });

  it('should throw error if PaymentCycle.find fails', async () => {
    // Arrange
    const mockError = new Error('Database error');
    vi.mocked(PaymentCycle.find).mockRejectedValue(mockError);

    const mockJob = {
      id: 'job-error',
      data: { timestamp: new Date() },
    } as Job;

    // Act & Assert
    await expect(managePaymentCycles(mockJob)).rejects.toThrow('Database error');
  });

  it('should process multiple cycles with mixed results', async () => {
    // Arrange
    const mockCycles = [
      { _id: 'cycle1', userId: 'user1', status: 'active', endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      { _id: 'cycle2', userId: 'user2', status: 'active', endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      { _id: 'cycle3', userId: 'user3', status: 'active', endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    ];

    vi.mocked(PaymentCycle.find).mockResolvedValue(mockCycles as any);
    vi.mocked(paymentCycleService.closePaymentCycle)
      .mockResolvedValueOnce({
        closedCycle: { _id: 'cycle1', userId: 'user1', status: 'completed' },
        newCycle: { _id: 'cycle4', userId: 'user1', status: 'active' },
      } as any)
      .mockRejectedValueOnce(new Error('Error for cycle2'))
      .mockResolvedValueOnce({
        closedCycle: { _id: 'cycle3', userId: 'user3', status: 'completed' },
        newCycle: { _id: 'cycle5', userId: 'user3', status: 'active' },
      } as any);

    const mockJob = {
      id: 'job-mixed',
      data: { timestamp: new Date() },
    } as Job;

    // Act
    const result = await managePaymentCycles(mockJob);

    // Assert
    expect(result.totalProcessed).toBe(3);
    expect(result.successCount).toBe(2);
    expect(result.errorCount).toBe(1);
  });
});
