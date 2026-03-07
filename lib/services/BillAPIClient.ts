import logger from '../logger';

/**
 * BillAPIClient
 * Handles communication with BillAPI with exponential backoff retry logic
 * Validates: Requirement 9.3
 */

export interface BillAPIConfig {
  baseUrl: string;
  apiKey: string;
  maxRetries?: number;
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
}

export interface BillDetails {
  id: string;
  amount: number;
  dueDate: Date;
  provider: string;
  type: string;
}

export interface PaymentResponse {
  transactionId: string;
  status: 'success' | 'failed';
  message?: string;
}

export class BillAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isRetryable: boolean = true
  ) {
    super(message);
    this.name = 'BillAPIError';
  }
}

export class BillAPIClient {
  private config: Required<BillAPIConfig>;

  constructor(config: BillAPIConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      maxRetries: config.maxRetries ?? 3,
      initialRetryDelayMs: config.initialRetryDelayMs ?? 1000,
      maxRetryDelayMs: config.maxRetryDelayMs ?? 30000,
    };
  }

  /**
   * Execute a request with exponential backoff retry
   * Validates: Requirement 9.3
   * 
   * @param requestFn - Function that makes the HTTP request
   * @param operation - Description of the operation for logging
   * @returns Response from the request
   */
  private async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    operation: string
  ): Promise<T> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= this.config.maxRetries) {
      try {
        logger.debug({ operation, attempt }, 'Executing BillAPI request');
        return await requestFn();
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || attempt > this.config.maxRetries) {
          logger.error(
            { error, operation, attempt, isRetryable },
            'BillAPI request failed (not retrying)'
          );
          throw error;
        }

        // Calculate exponential backoff delay
        const delay = this.calculateBackoffDelay(attempt);

        logger.warn(
          { error, operation, attempt, delay, maxRetries: this.config.maxRetries },
          'BillAPI request failed, retrying with exponential backoff'
        );

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Unknown error in executeWithRetry');
  }

  /**
   * Check if an error is retryable
   * 
   * @param error - The error to check
   * @returns True if the error is retryable
   */
  private isRetryableError(error: any): boolean {
    // BillAPIError with isRetryable flag
    if (error instanceof BillAPIError) {
      return error.isRetryable;
    }

    // Network errors are retryable
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }

    // HTTP status codes that are retryable
    if (error.statusCode) {
      const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
      return retryableStatusCodes.includes(error.statusCode);
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Calculate exponential backoff delay
   * 
   * @param attempt - Current attempt number (1-indexed)
   * @returns Delay in milliseconds
   */
  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff: initialDelay * 2^(attempt-1)
    const delay = this.config.initialRetryDelayMs * Math.pow(2, attempt - 1);
    
    // Add jitter (random factor between 0.5 and 1.5)
    const jitter = 0.5 + Math.random();
    const delayWithJitter = delay * jitter;

    // Cap at max delay
    return Math.min(delayWithJitter, this.config.maxRetryDelayMs);
  }

  /**
   * Sleep for a specified duration
   * 
   * @param ms - Duration in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Query bill details from BillAPI
   * Validates: Requirement 9.3
   * 
   * @param billId - The bill ID
   * @returns Bill details
   * @throws BillAPIError if request fails
   */
  async queryBill(billId: string): Promise<BillDetails> {
    return this.executeWithRetry(async () => {
      const queryParams = new URLSearchParams({ billId });
      const url = `${this.config.baseUrl}/api/external/bills/query?${queryParams}`;

      logger.debug({ billId, url }, 'Querying bill from BillAPI');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new BillAPIError(
          `BillAPI query failed: ${response.status} - ${errorData.message || 'Unknown error'}`,
          response.status,
          response.status >= 500 || response.status === 429 || response.status === 408
        );
      }

      const data = await response.json();

      if (!data || !data.bill) {
        throw new BillAPIError(
          `Bill ${billId} not found in BillAPI`,
          404,
          false // Not found is not retryable
        );
      }

      const bill = data.bill;

      // Validate required fields
      if (!bill.amount || !bill.dueDate) {
        throw new BillAPIError(
          `Bill ${billId} is missing required fields`,
          400,
          false // Invalid data is not retryable
        );
      }

      logger.debug({ billId, amount: bill.amount, dueDate: bill.dueDate }, 'Successfully queried bill from BillAPI');

      return {
        id: bill.id,
        amount: bill.amount,
        dueDate: new Date(bill.dueDate),
        provider: bill.provider || 'Unknown',
        type: bill.type || 'Unknown',
      };
    }, `queryBill(${billId})`);
  }

  /**
   * Pay a bill through BillAPI
   * Validates: Requirement 9.3
   * 
   * @param billId - The bill ID
   * @param amount - The payment amount
   * @returns Payment response
   * @throws BillAPIError if payment fails
   */
  async payBill(billId: string, amount: number): Promise<PaymentResponse> {
    return this.executeWithRetry(async () => {
      const url = `${this.config.baseUrl}/api/external/bills/pay`;

      logger.debug({ billId, amount, url }, 'Paying bill through BillAPI');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
        body: JSON.stringify({ billId, amount }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new BillAPIError(
          `BillAPI payment failed: ${response.status} - ${errorData.message || 'Unknown error'}`,
          response.status,
          response.status >= 500 || response.status === 429 || response.status === 408
        );
      }

      const data = await response.json();

      logger.info({ billId, amount, transactionId: data.transactionId }, 'Successfully paid bill through BillAPI');

      return {
        transactionId: data.transactionId || `txn-${Date.now()}-${billId}`,
        status: 'success',
        message: data.message,
      };
    }, `payBill(${billId}, ${amount})`);
  }

  /**
   * Check BillAPI health/availability
   * 
   * @returns True if BillAPI is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl}/health`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': this.config.apiKey,
        },
      });

      return response.ok;
    } catch (error) {
      logger.error({ error }, 'BillAPI health check failed');
      return false;
    }
  }
}

/**
 * Create a BillAPIClient instance from environment variables
 * 
 * @returns BillAPIClient instance
 * @throws Error if configuration is missing
 */
export function createBillAPIClient(): BillAPIClient {
  const baseUrl = process.env.BILL_API;
  const apiKey = process.env.API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error('BillAPI configuration missing (BILL_API and API_KEY required)');
  }

  return new BillAPIClient({
    baseUrl,
    apiKey,
    maxRetries: parseInt(process.env.BILL_API_MAX_RETRIES || '3', 10),
    initialRetryDelayMs: parseInt(process.env.BILL_API_INITIAL_RETRY_DELAY_MS || '1000', 10),
    maxRetryDelayMs: parseInt(process.env.BILL_API_MAX_RETRY_DELAY_MS || '30000', 10),
  });
}

// Export singleton instance
let billAPIClientInstance: BillAPIClient | null = null;

export function getBillAPIClient(): BillAPIClient {
  if (!billAPIClientInstance) {
    billAPIClientInstance = createBillAPIClient();
  }
  return billAPIClientInstance;
}
