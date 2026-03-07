import { getDatabase } from '../mongodb';
import Bill from '../models/Bill';
import AutoPaymentRecord from '../models/AutoPaymentRecord';
import connectDB from '../mongoose';
import { auditLogService } from './AuditLogService';
import logger from '../logger';
import { User } from '../auth';

/**
 * ExportService
 * Handles data export operations for admins
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5
 * 
 * Performance optimizations:
 * - Uses cursor-based iteration for large datasets to avoid loading all records into memory
 * - Batch size limits to prevent excessive memory usage
 * - Lean queries to skip Mongoose hydration overhead
 * - Projection to only fetch needed fields
 */

// Maximum records to export in a single request (performance guard)
const MAX_EXPORT_RECORDS = 50_000;

// Batch size for cursor-based processing
const CURSOR_BATCH_SIZE = 1000;

export interface UserFilters {
  role?: 'regular' | 'admin';
  startDate?: Date;
  endDate?: Date;
}

export interface BillFilters {
  userId?: string;
  status?: 'pending' | 'paid' | 'overdue';
  startDate?: Date;
  endDate?: Date;
}

export interface TransactionFilters {
  userId?: string;
  status?: 'success' | 'failed' | 'settled';
  startDate?: Date;
  endDate?: Date;
}

export class ExportService {
  /**
   * Escape a CSV field value properly
   * Handles commas, quotes, newlines, and special characters
   */
  private escapeCSVField(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  /**
   * Convert array of objects to CSV format
   * Optimized for large datasets with pre-allocated string building
   * 
   * @param data - Array of objects to convert
   * @param headers - Column headers
   * @returns CSV string
   */
  private arrayToCSV(data: any[], headers: string[]): string {
    if (data.length === 0) {
      return headers.join(',') + '\n';
    }

    // Pre-estimate string capacity to reduce reallocations
    const estimatedLength = headers.length * 20 * (data.length + 1);
    const csvParts: string[] = [];
    csvParts.length = data.length + 1;

    // Header row
    csvParts[0] = headers.join(',');

    // Data rows
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const values = headers.map(header => this.escapeCSVField(row[header]));
      csvParts[i + 1] = values.join(',');
    }

    return csvParts.join('\n');
  }

  /**
   * Build CSV from a cursor/stream in batches to handle large datasets
   * This avoids loading all records into memory at once.
   * 
   * @param cursor - MongoDB cursor
   * @param headers - CSV column headers
   * @param transformFn - Function to transform each document for CSV
   * @returns CSV string
   */
  private async buildCSVFromBatches(
    cursor: any,
    headers: string[],
    transformFn: (doc: any) => Record<string, any>
  ): Promise<{ csv: string; recordCount: number }> {
    const csvParts: string[] = [headers.join(',')];
    let recordCount = 0;

    const batch: any[] = [];
    for await (const doc of cursor) {
      batch.push(doc);
      recordCount++;

      if (recordCount >= MAX_EXPORT_RECORDS) {
        logger.warn(`Export limit reached: ${MAX_EXPORT_RECORDS} records`);
        break;
      }

      if (batch.length >= CURSOR_BATCH_SIZE) {
        // Process batch
        for (const item of batch) {
          const row = transformFn(item);
          csvParts.push(headers.map(h => this.escapeCSVField(row[h])).join(','));
        }
        batch.length = 0; // Clear batch
      }
    }

    // Process remaining items in the last batch
    for (const item of batch) {
      const row = transformFn(item);
      csvParts.push(headers.map(h => this.escapeCSVField(row[h])).join(','));
    }

    return { csv: csvParts.join('\n'), recordCount };
  }

  /**
   * Export users to CSV format
   * Validates: Requirements 13.1, 13.3, 13.4, 13.5
   * 
   * @param filters - Optional filters for user data
   * @param adminId - Admin user ID performing the export
   * @returns CSV string
   */
  async exportUsers(filters: UserFilters = {}, adminId: string): Promise<string> {
    try {
      const db = await getDatabase();
      const usersCollection = db.collection<User>('users');

      // Build query based on filters
      const query: any = {};

      if (filters.role) {
        query.role = filters.role;
      }

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.createdAt.$lte = filters.endDate;
        }
      }

      // Define CSV headers
      const headers = ['id', 'email', 'name', 'role', 'createdAt'];

      // Use cursor-based iteration for performance with large datasets
      const cursor = usersCollection
        .find(query, {
          projection: {
            password: 0,     // Exclude password
            resetToken: 0,   // Exclude reset token
            resetTokenExpiry: 0,
          },
        })
        .sort({ createdAt: -1 })
        .batchSize(CURSOR_BATCH_SIZE);

      const { csv, recordCount } = await this.buildCSVFromBatches(
        cursor,
        headers,
        (user) => ({
          id: user._id?.toString() || '',
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
        })
      );

      // Log the export action
      await auditLogService.log({
        userId: adminId,
        adminId,
        operation: 'Export users',
        operationType: 'data_export',
        entityType: 'user',
        details: {
          filters,
          recordCount,
        },
        status: 'success',
      });

      logger.info(
        { adminId, filters, recordCount },
        'Users exported to CSV'
      );

      return csv;
    } catch (error) {
      logger.error({ error, adminId, filters }, 'Error exporting users');
      throw error;
    }
  }

  /**
   * Export bills to CSV format
   * Validates: Requirements 13.2, 13.3, 13.4, 13.5
   * 
   * @param filters - Optional filters for bill data
   * @param adminId - Admin user ID performing the export
   * @returns CSV string
   */
  async exportBills(filters: BillFilters = {}, adminId: string): Promise<string> {
    try {
      await connectDB();

      // Build query based on filters
      const query: any = {};

      if (filters.userId) {
        query.userId = filters.userId;
      }

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.startDate || filters.endDate) {
        query.dueDate = {};
        if (filters.startDate) {
          query.dueDate.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.dueDate.$lte = filters.endDate;
        }
      }

      // Define CSV headers
      const headers = [
        'id',
        'userId',
        'billId',
        'provider',
        'billType',
        'dueDate',
        'status',
        'description',
        'createdAt',
        'updatedAt',
      ];

      // Use cursor with lean for batch processing
      const cursor = Bill.find(query)
        .lean()
        .sort({ createdAt: -1 })
        .batchSize(CURSOR_BATCH_SIZE)
        .cursor();

      const { csv, recordCount } = await this.buildCSVFromBatches(
        cursor,
        headers,
        (bill) => ({
          id: bill._id.toString(),
          userId: bill.userId,
          billId: bill.billId,
          provider: bill.provider,
          billType: bill.billType,
          dueDate: bill.dueDate,
          status: bill.status,
          description: bill.description || '',
          createdAt: bill.createdAt,
          updatedAt: bill.updatedAt,
        })
      );

      // Log the export action
      await auditLogService.log({
        userId: adminId,
        adminId,
        operation: 'Export bills',
        operationType: 'data_export',
        entityType: 'bill',
        details: {
          filters,
          recordCount,
        },
        status: 'success',
      });

      logger.info(
        { adminId, filters, recordCount },
        'Bills exported to CSV'
      );

      return csv;
    } catch (error) {
      logger.error({ error, adminId, filters }, 'Error exporting bills');
      throw error;
    }
  }

  /**
   * Export payment transactions to CSV format
   * Validates: Requirements 13.2, 13.3, 13.4, 13.5
   * 
   * @param filters - Optional filters for transaction data
   * @param adminId - Admin user ID performing the export
   * @returns CSV string
   */
  async exportTransactions(filters: TransactionFilters = {}, adminId: string): Promise<string> {
    try {
      await connectDB();

      // Build query based on filters
      const query: any = {};

      if (filters.userId) {
        query.userId = filters.userId;
      }

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.startDate || filters.endDate) {
        query.paymentDate = {};
        if (filters.startDate) {
          query.paymentDate.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.paymentDate.$lte = filters.endDate;
        }
      }

      // Define CSV headers
      const headers = [
        'id',
        'userId',
        'billId',
        'amount',
        'paymentDate',
        'transactionId',
        'billProvider',
        'billType',
        'status',
        'paymentCycleId',
        'createdAt',
        'updatedAt',
      ];

      // Use cursor with lean for batch processing
      const cursor = AutoPaymentRecord.find(query)
        .lean()
        .sort({ paymentDate: -1 })
        .batchSize(CURSOR_BATCH_SIZE)
        .cursor();

      const { csv, recordCount } = await this.buildCSVFromBatches(
        cursor,
        headers,
        (transaction) => ({
          id: transaction._id.toString(),
          userId: transaction.userId,
          billId: transaction.billId,
          amount: transaction.amount,
          paymentDate: transaction.paymentDate,
          transactionId: transaction.transactionId,
          billProvider: transaction.billProvider,
          billType: transaction.billType,
          status: transaction.status,
          paymentCycleId: transaction.paymentCycleId,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
        })
      );

      // Log the export action
      await auditLogService.log({
        userId: adminId,
        adminId,
        operation: 'Export transactions',
        operationType: 'data_export',
        entityType: 'transaction',
        details: {
          filters,
          recordCount,
        },
        status: 'success',
      });

      logger.info(
        { adminId, filters, recordCount },
        'Transactions exported to CSV'
      );

      return csv;
    } catch (error) {
      logger.error({ error, adminId, filters }, 'Error exporting transactions');
      throw error;
    }
  }
}

// Export singleton instance
export const exportService = new ExportService();
