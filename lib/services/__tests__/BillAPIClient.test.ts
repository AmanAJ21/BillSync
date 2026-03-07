import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BillAPIClient, BillAPIError } from '../BillAPIClient';

// Mock fetch globally
global.fetch = vi.fn();

vi.mock('../../logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('BillAPIClient - Error Scenarios', () => {
  let client: BillAPIClient;

  beforeEach(() => {
    client = new BillAPIClient({
      baseUrl: 'https://api.example.com',
      apiKey: 'test-api-key',
      maxRetries: 3,
      initialRetryDelayMs: 100, // Short delay for tests
      maxRetryDelayMs: 1000,
    });
    vi.clearAllMocks();
  });

  describe('BillAPI unavailability handling', () => {
    it('should retry on 503 Service Unavailable error', async () => {
      const mockFetch = global.fetch as any;
      
      // First 2 attempts fail with 503, third succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({ message: 'Service Unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({ message: 'Service Unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            bill: {
              id: 'bill123',
              amount: 100,
              dueDate: '2024-12-31',
              provider: 'Electric Co',
              type: 'electricity',
            },
          }),
        });

      const result = await client.queryBill('bill123');

      expect(result).toEqual({
        id: 'bill123',
        amount: 100,
        dueDate: expect.any(Date),
        provider: 'Electric Co',
        type: 'electricity',
      });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should retry on 500 Internal Server Error', async () => {
      const mockFetch = global.fetch as any;
      
      // First attempt fails with 500, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ message: 'Internal Server Error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            bill: {
              id: 'bill123',
              amount: 100,
              dueDate: '2024-12-31',
              provider: 'Electric Co',
              type: 'electricity',
            },
          }),
        });

      const result = await client.queryBill('bill123');

      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 502 Bad Gateway error', async () => {
      const mockFetch = global.fetch as any;
      
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: async () => ({ message: 'Bad Gateway' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            bill: {
              id: 'bill123',
              amount: 100,
              dueDate: '2024-12-31',
              provider: 'Electric Co',
              type: 'electricity',
            },
          }),
        });

      const result = await client.queryBill('bill123');

      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries exceeded', async () => {
      const mockFetch = global.fetch as any;
      
      // All attempts fail with 503
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Service Unavailable' }),
      });

      await expect(client.queryBill('bill123')).rejects.toThrow(BillAPIError);
      
      // Should try initial + 3 retries = 4 total attempts
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should not retry on 404 Not Found error', async () => {
      const mockFetch = global.fetch as any;
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Bill not found' }),
      });

      await expect(client.queryBill('bill123')).rejects.toThrow(BillAPIError);
      
      // Should only try once (no retries for 404)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 400 Bad Request error', async () => {
      const mockFetch = global.fetch as any;
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid request' }),
      });

      await expect(client.queryBill('bill123')).rejects.toThrow(BillAPIError);
      
      // Should only try once (no retries for 400)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff for retries', async () => {
      const mockFetch = global.fetch as any;
      const startTime = Date.now();
      
      // First 2 attempts fail, third succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({ message: 'Service Unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({ message: 'Service Unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            bill: {
              id: 'bill123',
              amount: 100,
              dueDate: '2024-12-31',
              provider: 'Electric Co',
              type: 'electricity',
            },
          }),
        });

      await client.queryBill('bill123');
      
      const elapsedTime = Date.now() - startTime;
      
      // Should have some delay between retries (at least 100ms for first retry)
      expect(elapsedTime).toBeGreaterThan(100);
    });
  });

  describe('payBill with retry logic', () => {
    it('should retry payment on 503 error', async () => {
      const mockFetch = global.fetch as any;
      
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({ message: 'Service Unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            transactionId: 'txn123',
            status: 'success',
          }),
        });

      const result = await client.payBill('bill123', 100);

      expect(result).toEqual({
        transactionId: 'txn123',
        status: 'success',
        message: undefined,
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries for payment', async () => {
      const mockFetch = global.fetch as any;
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Service Unavailable' }),
      });

      await expect(client.payBill('bill123', 100)).rejects.toThrow(BillAPIError);
      
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('checkHealth', () => {
    it('should return true when BillAPI is available', async () => {
      const mockFetch = global.fetch as any;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await client.checkHealth();

      expect(result).toBe(true);
    });

    it('should return false when BillAPI is unavailable', async () => {
      const mockFetch = global.fetch as any;
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const result = await client.checkHealth();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      const mockFetch = global.fetch as any;
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.checkHealth();

      expect(result).toBe(false);
    });
  });
});
