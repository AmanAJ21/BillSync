import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Job } from 'bull';
import { processAutoPayments } from '../autoPaymentProcessor';
import { autoPaymentService } from '../../services/AutoPaymentService';

// Mock the AutoPaymentService
vi.mock('../../services/AutoPaymentService', () => ({
  autoPaymentService: {
    processScheduledPaymentsWithExecution: vi.fn(),
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

describe('Auto Payment Processor Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should process automatic payments successfully', async () => {
    // Arrange
    const mockResults = [
      { billId: 'bill1', userId: 'user1', status: 'success' as const, transactionId: 'txn1' },
      { billId: 'bill2', userId: 'user2', status: 'skipped' as const, reason: 'Not due' },
      { billId: 'bill3', userId: 'user3', status: 'failed' as const, reason: 'Payment failed' },
    ];

    vi.mocked(autoPaymentService.processScheduledPaymentsWithExecution).mockResolvedValue(mockResults);

    const mockJob = {
      id: 'job-123',
      data: { timestamp: new Date() },
    } as Job;

    // Act
    const result = await processAutoPayments(mockJob);

    // Assert
    expect(autoPaymentService.processScheduledPaymentsWithExecution).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBe(3);
    expect(result.successCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.errorCount).toBe(0);
    expect(result.results).toEqual(mockResults);
  });

  it('should handle errors during payment processing', async () => {
    // Arrange
    const mockError = new Error('Payment processing failed');
    vi.mocked(autoPaymentService.processScheduledPaymentsWithExecution).mockRejectedValue(mockError);

    const mockJob = {
      id: 'job-456',
      data: { timestamp: new Date() },
    } as Job;

    // Act & Assert
    await expect(processAutoPayments(mockJob)).rejects.toThrow('Payment processing failed');
    expect(autoPaymentService.processScheduledPaymentsWithExecution).toHaveBeenCalledOnce();
  });

  it('should count different status types correctly', async () => {
    // Arrange
    const mockResults = [
      { billId: 'bill1', userId: 'user1', status: 'success' as const, transactionId: 'txn1' },
      { billId: 'bill2', userId: 'user1', status: 'success' as const, transactionId: 'txn2' },
      { billId: 'bill3', userId: 'user2', status: 'skipped' as const, reason: 'Not due' },
      { billId: 'bill4', userId: 'user3', status: 'failed' as const, reason: 'Payment failed' },
      { billId: 'bill5', userId: 'user4', status: 'error' as const, reason: 'System error' },
    ];

    vi.mocked(autoPaymentService.processScheduledPaymentsWithExecution).mockResolvedValue(mockResults);

    const mockJob = {
      id: 'job-789',
      data: { timestamp: new Date() },
    } as Job;

    // Act
    const result = await processAutoPayments(mockJob);

    // Assert
    expect(result.totalProcessed).toBe(5);
    expect(result.successCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.errorCount).toBe(1);
  });

  it('should handle empty results', async () => {
    // Arrange
    vi.mocked(autoPaymentService.processScheduledPaymentsWithExecution).mockResolvedValue([]);

    const mockJob = {
      id: 'job-empty',
      data: { timestamp: new Date() },
    } as Job;

    // Act
    const result = await processAutoPayments(mockJob);

    // Assert
    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBe(0);
    expect(result.successCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.errorCount).toBe(0);
  });
});
