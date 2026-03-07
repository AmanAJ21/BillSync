import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Job } from 'bull';
import { generateConsolidatedBills } from '../consolidatedBillGenerator';
import { aggregationEngine } from '../../services/AggregationEngine';
import PaymentCycle from '../../models/PaymentCycle';

// Mock the AggregationEngine
vi.mock('../../services/AggregationEngine', () => ({
  aggregationEngine: {
    generateConsolidatedBill: vi.fn(),
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

describe('Consolidated Bill Generator Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate consolidated bills for active cycles', async () => {
    // Arrange
    const mockCycles = [
      { _id: 'cycle1', userId: 'user1', status: 'active', endDate: new Date() },
      { _id: 'cycle2', userId: 'user2', status: 'active', endDate: new Date() },
    ];

    const mockBill1 = { _id: 'bill1', userId: 'user1', totalAmount: 100 };
    const mockBill2 = { _id: 'bill2', userId: 'user2', totalAmount: 200 };

    vi.mocked(PaymentCycle.find).mockResolvedValue(mockCycles as any);
    vi.mocked(aggregationEngine.generateConsolidatedBill)
      .mockResolvedValueOnce(mockBill1 as any)
      .mockResolvedValueOnce(mockBill2 as any);

    const mockJob = {
      id: 'job-123',
      data: { timestamp: new Date() },
    } as Job;

    // Act
    const result = await generateConsolidatedBills(mockJob);

    // Assert
    expect(PaymentCycle.find).toHaveBeenCalledOnce();
    expect(aggregationEngine.generateConsolidatedBill).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBe(2);
    expect(result.successCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(result.errorCount).toBe(0);
  });

  it('should skip cycles with no auto-payment records', async () => {
    // Arrange
    const mockCycles = [
      { _id: 'cycle1', userId: 'user1', status: 'active', endDate: new Date() },
      { _id: 'cycle2', userId: 'user2', status: 'active', endDate: new Date() },
    ];

    vi.mocked(PaymentCycle.find).mockResolvedValue(mockCycles as any);
    vi.mocked(aggregationEngine.generateConsolidatedBill)
      .mockResolvedValueOnce(null) // No records for cycle1
      .mockResolvedValueOnce({ _id: 'bill2', userId: 'user2', totalAmount: 200 } as any);

    const mockJob = {
      id: 'job-456',
      data: { timestamp: new Date() },
    } as Job;

    // Act
    const result = await generateConsolidatedBills(mockJob);

    // Assert
    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.errorCount).toBe(0);
  });

  it('should handle errors during bill generation', async () => {
    // Arrange
    const mockCycles = [
      { _id: 'cycle1', userId: 'user1', status: 'active', endDate: new Date() },
      { _id: 'cycle2', userId: 'user2', status: 'active', endDate: new Date() },
    ];

    vi.mocked(PaymentCycle.find).mockResolvedValue(mockCycles as any);
    vi.mocked(aggregationEngine.generateConsolidatedBill)
      .mockRejectedValueOnce(new Error('Generation failed'))
      .mockResolvedValueOnce({ _id: 'bill2', userId: 'user2', totalAmount: 200 } as any);

    const mockJob = {
      id: 'job-789',
      data: { timestamp: new Date() },
    } as Job;

    // Act
    const result = await generateConsolidatedBills(mockJob);

    // Assert
    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.errorCount).toBe(1);
  });

  it('should handle no active cycles', async () => {
    // Arrange
    vi.mocked(PaymentCycle.find).mockResolvedValue([]);

    const mockJob = {
      id: 'job-empty',
      data: { timestamp: new Date() },
    } as Job;

    // Act
    const result = await generateConsolidatedBills(mockJob);

    // Assert
    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBe(0);
    expect(result.successCount).toBe(0);
    expect(result.skippedCount).toBe(0);
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
    await expect(generateConsolidatedBills(mockJob)).rejects.toThrow('Database error');
  });
});
