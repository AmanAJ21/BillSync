import { getDatabase } from '../mongodb';
import { auditLogService } from './AuditLogService';
import { ObjectId } from 'mongodb';

/**
 * AdminBillService
 * Handles admin operations for bill management
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6, 11.1, 11.2, 11.3, 11.4
 */

export interface Bill {
  _id?: string;
  billId: string;
  billNumber: string;
  customerName: string;
  provider: string;
  billType: 'dth' | 'electricity' | 'prepaid_mobile';
  amount: number;
  dueDay: number;
  billingFrequency: 'monthly' | 'quarterly' | 'yearly' | 'one-time';
  createdAt?: Date;
  updatedAt?: Date;
  // Keep userId optional for backward compatibility
  userId?: string;
}

export interface CreateBillDto {
  billNumber: string;
  customerName: string;
  provider: string;
  billType: 'dth' | 'electricity' | 'prepaid_mobile';
  amount: number;
  dueDay: number;
  billingFrequency: 'monthly' | 'quarterly' | 'yearly' | 'one-time';
}

export interface BillFilters {
  userId?: string;
  endDate?: Date;
}

export interface Pagination {
  page: number;
  limit: number;
}

export interface PaginatedBills {
  bills: Bill[];
  total: number;
  page: number;
  totalPages: number;
}

export interface BulkResult {
  success: boolean;
  results: {
    billId: string;
    success: boolean;
    error?: string;
  }[];
}

export class AdminBillService {
  /**
   * Create a new bill
   * 
   * @param billData - Bill creation data
   * @param adminId - Admin user ID performing the action
   * @returns Created bill
   */
  async createBill(billData: CreateBillDto, adminId: string): Promise<Bill> {
    const db = await getDatabase();
    const bills = db.collection('bills');

    // Generate unique internal billId
    const billId = `BILL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Check bill number uniqueness
    const existingBill = await bills.findOne({ billNumber: billData.billNumber });
    if (existingBill) {
      throw new Error('A bill with this bill number already exists');
    }

    // Create bill
    const newBill = {
      ...billData,
      billId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await bills.insertOne(newBill);
    const createdBill = { ...newBill, _id: result.insertedId.toString() };

    // Log the action
    await auditLogService.log({
      userId: adminId,
      adminId,
      operation: 'Create bill',
      operationType: 'bill_create',
      entityType: 'bill',
      entityId: result.insertedId.toString(),
      details: {
        billId,
        billNumber: billData.billNumber,
        customerName: billData.customerName,
        provider: billData.provider,
        amount: billData.amount,
        dueDay: billData.dueDay,
        billingFrequency: billData.billingFrequency
      },
      status: 'success'
    });

    return createdBill;
  }

  /**
   * Update an existing bill
   * Validates: Requirement 4.2
   * 
   * @param billId - Bill ID to update
   * @param updates - Partial bill updates
   * @param adminId - Admin user ID performing the action
   * @returns Updated bill
   */
  async updateBill(billId: string, updates: Partial<Bill>, adminId: string): Promise<Bill | null> {
    const db = await getDatabase();
    const bills = db.collection('bills');

    // Get current bill state
    const currentBill = await bills.findOne({ billId });
    if (!currentBill) {
      return null;
    }

    const beforeState = {
      provider: currentBill.provider,
      dueDate: currentBill.dueDate,
      accountNumber: currentBill.accountNumber,
      description: currentBill.description
    };

    // Remove fields that shouldn't be updated
    const { _id, billId: _, userId, createdAt, ...allowedUpdates } = updates;

    // Update bill
    const updateData = {
      ...allowedUpdates,
      updatedAt: new Date()
    };

    await bills.updateOne(
      { billId },
      { $set: updateData }
    );

    // Get updated bill
    const updatedBill = await bills.findOne({ billId });
    if (!updatedBill) {
      return null;
    }

    const afterState = {
      provider: updatedBill.provider,
      dueDate: updatedBill.dueDate,
      accountNumber: updatedBill.accountNumber,
      description: updatedBill.description
    };

    // Log the action with before/after state
    await auditLogService.log({
      userId: adminId,
      adminId,
      operation: 'Update bill',
      operationType: 'bill_update',
      entityType: 'bill',
      entityId: updatedBill._id.toString(),
      targetUserId: updatedBill.userId,
      details: {
        billId: updatedBill.billId,
        provider: updatedBill.provider
      },
      beforeState,
      afterState,
      status: 'success'
    });

    return { ...(updatedBill as any), _id: updatedBill._id.toString() };
  }

  /**
   * Delete a bill
   * Validates: Requirement 4.3
   * 
   * @param billId - Bill ID to delete
   * @param adminId - Admin user ID performing the action
   */
  async deleteBill(billId: string, adminId: string): Promise<void> {
    const db = await getDatabase();
    const bills = db.collection('bills');

    // Get bill for logging
    const bill = await bills.findOne({ billId });
    if (!bill) {
      throw new Error('Bill not found');
    }

    // Delete bill
    await bills.deleteOne({ billId });

    // Log the action
    await auditLogService.log({
      userId: adminId,
      adminId,
      operation: 'Delete bill',
      operationType: 'bill_delete',
      entityType: 'bill',
      entityId: bill._id.toString(),
      targetUserId: bill.userId,
      details: {
        billId: bill.billId,
        provider: bill.provider,
        userId: bill.userId
      },
      status: 'success'
    });
  }

  /**
   * Get all bills across all users with filtering and pagination
   * Validates: Requirement 4.6
   * 
   * @param filters - Bill filters
   * @param pagination - Page and limit
   * @returns Paginated list of bills
   */
  async getAllBills(filters: BillFilters, pagination: Pagination): Promise<PaginatedBills> {
    const db = await getDatabase();
    const bills = db.collection('bills');

    // Build query
    const query: any = {};

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.endDate) {
      query.dueDate = { $lte: filters.endDate };
    }

    // Get total count
    const total = await bills.countDocuments(query);

    // Get paginated results
    const skip = (pagination.page - 1) * pagination.limit;
    const billList = await bills
      .find(query)
      .sort({ dueDate: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .toArray();

    return {
      bills: billList.map(b => ({ ...(b as any), _id: b._id?.toString() })),
      total,
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit)
    };
  }

  /**
   * Bulk update bills
   * Validates: Requirements 11.1, 11.2, 11.4
   * 
   * @param billIds - Array of bill IDs to update
   * @param updates - Partial bill updates to apply
   * @param adminId - Admin user ID performing the action
   * @returns Bulk operation results
   */
  async bulkUpdateBills(billIds: string[], updates: Partial<Bill>, adminId: string): Promise<BulkResult> {
    const results: BulkResult['results'] = [];

    for (const billId of billIds) {
      try {
        const updatedBill = await this.updateBill(billId, updates, adminId);
        if (updatedBill) {
          results.push({ billId, success: true });
        } else {
          results.push({ billId, success: false, error: 'Bill not found' });
        }
      } catch (error) {
        results.push({
          billId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log bulk operation
    await auditLogService.log({
      userId: adminId,
      adminId,
      operation: 'Bulk update bills',
      operationType: 'bill_bulk_update',
      entityType: 'bill',
      details: {
        billIds,
        updates,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length
      },
      status: 'success'
    });

    return {
      success: results.every(r => r.success),
      results
    };
  }

  /**
   * Bulk delete bills
   * Validates: Requirements 11.3, 11.4
   * 
   * @param billIds - Array of bill IDs to delete
   * @param adminId - Admin user ID performing the action
   * @returns Bulk operation results
   */
  async bulkDeleteBills(billIds: string[], adminId: string): Promise<BulkResult> {
    const results: BulkResult['results'] = [];

    for (const billId of billIds) {
      try {
        await this.deleteBill(billId, adminId);
        results.push({ billId, success: true });
      } catch (error) {
        results.push({
          billId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log bulk operation
    await auditLogService.log({
      userId: adminId,
      adminId,
      operation: 'Bulk delete bills',
      operationType: 'bill_bulk_delete',
      entityType: 'bill',
      details: {
        billIds,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length
      },
      status: 'success'
    });

    return {
      success: results.every(r => r.success),
      results
    };
  }
}

// Export singleton instance
export const adminBillService = new AdminBillService();
