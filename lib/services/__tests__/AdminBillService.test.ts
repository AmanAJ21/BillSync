import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { AdminBillService } from '../AdminBillService';

/**
 * Unit Tests for AdminBillService
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6, 11.1, 11.2, 11.3, 11.4**
 * 
 * Tests cover:
 * - Create bill with user assignment
 * - Update bill with before/after state logging
 * - Delete bill with audit logging
 * - Get all bills with cross-user access
 * - Bulk update bills with individual result tracking
 * - Bulk delete bills with individual result tracking
 */

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let service: AdminBillService;

// Mock the mongodb module
vi.mock('../../mongodb', () => ({
  getDatabase: vi.fn(),
}));

// Mock the audit log service
vi.mock('../AuditLogService', () => ({
  auditLogService: {
    log: vi.fn().mockResolvedValue({}),
  },
}));

beforeEach(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  client = new MongoClient(uri);
  await client.connect();
  db = client.db('billsync-test');

  // Mock getDatabase to return our test database
  const { getDatabase } = await import('../../mongodb');
  vi.mocked(getDatabase).mockResolvedValue(db);

  service = new AdminBillService();
});

afterEach(async () => {
  if (client) {
    await client.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
  vi.clearAllMocks();
});

describe('AdminBillService', () => {
  describe('createBill', () => {
    /**
     * Test: Create bill with all required fields
     * Validates: Requirements 4.1, 4.4
     */
    it('should create bill with user assignment', async () => {
      // Arrange
      const billData = {
        billNumber: 'B-123',
        customerName: 'John Doe',
        dueDay: 15,
        billingFrequency: 'monthly' as const,
        userId: 'user-123',
        provider: 'Electric Company',
        billType: 'electricity' as const,
        amount: 150.50,
        dueDate: new Date('2024-02-15'),
        accountNumber: 'ACC-12345',
        description: 'Monthly electricity bill'
      };
      const adminId = 'admin-123';

      // Act
      const result = await service.createBill(billData, adminId);

      // Assert
      expect(result).toBeDefined();
      expect(result._id).toBeDefined();
      expect(result.billId).toBeDefined();
      expect(result.userId).toBe(billData.userId);
      expect(result.provider).toBe(billData.provider);
      expect(result.amount).toBe(billData.amount);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create bill correctly', async () => {
      // Arrange
      const billData = {
        billNumber: 'B-456',
        customerName: 'Jane Smith',
        dueDay: 20,
        billingFrequency: 'monthly' as const,
        userId: 'user-123',
        provider: 'Water Company',
        billType: 'water' as const,
        amount: 50.00,
        dueDate: new Date('2024-02-20')
      };
      const adminId = 'admin-123';

      // Act
      const result = await service.createBill(billData, adminId);

      // Assert
      expect(result.provider).toBe('Water Company');
    });

    // Custom status test removed because status is gone

    /**
     * Test: Audit log is created for bill creation
     * Validates: Requirement 4.1
     */
    it('should create audit log for bill creation', async () => {
      // Arrange
      const { auditLogService } = await import('../AuditLogService');
      const billData = {
        billNumber: 'B-789',
        customerName: 'Test User',
        dueDay: 1,
        billingFrequency: 'monthly' as const,
        userId: 'user-123',
        provider: 'Internet Provider',
        billType: 'internet' as const,
        amount: 60.00,
        dueDate: new Date('2024-03-01')
      };
      const adminId = 'admin-123';

      // Act
      await service.createBill(billData, adminId);

      // Assert
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminId,
          adminId,
          operation: 'Create bill',
          operationType: 'bill_create',
          entityType: 'bill',
          targetUserId: billData.userId,
          status: 'success',
        })
      );
    });
  });

  describe('updateBill', () => {
    /**
     * Test: Update bill with new values
     * Validates: Requirement 4.2
     */
    it('should update bill and set updatedAt timestamp', async () => {
      // Arrange
      const bills = db.collection('bills');
      const originalDate = new Date('2024-01-01');
      await bills.insertOne({
        billId: 'BILL-123',
        userId: 'user-123',
        provider: 'Electric Company',
        billType: 'electricity',
        amount: 100,
        dueDate: new Date('2024-02-15'),
        createdAt: originalDate,
        updatedAt: originalDate
      });

      const adminId = 'admin-123';
      const updates = {
        amount: 120,
      };

      // Act
      const result = await service.updateBill('BILL-123', updates, adminId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.amount).toBe(120);
      expect(result?.updatedAt).not.toEqual(originalDate);
    });

    /**
     * Test: Update bill logs before and after state
     * Validates: Requirement 4.2
     */
    it('should create audit log with before and after state', async () => {
      // Arrange
      const { auditLogService } = await import('../AuditLogService');
      const bills = db.collection('bills');
      await bills.insertOne({
        billId: 'BILL-456',
        userId: 'user-123',
        provider: 'Water Company',
        billType: 'water',
        amount: 50,
        dueDate: new Date('2024-02-20'),
        accountNumber: 'ACC-111',
        description: 'Original description',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const adminId = 'admin-123';
      const updates = {
        amount: 60,
        description: 'Updated description'
      };

      // Act
      await service.updateBill('BILL-456', updates, adminId);

      // Assert
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminId,
          adminId,
          operation: 'Update bill',
          operationType: 'bill_update',
          entityType: 'bill',
          beforeState: expect.objectContaining({
            amount: 50,
            description: 'Original description'
          }),
          afterState: expect.objectContaining({
            amount: 60,
            description: 'Updated description'
          }),
          status: 'success',
        })
      );
    });

    /**
     * Test: Return null for non-existent bill
     * Validates: Requirement 4.2
     */
    it('should return null for non-existent bill', async () => {
      // Act
      const result = await service.updateBill('BILL-NONEXISTENT', { amount: 100 }, 'admin-123');

      // Assert
      expect(result).toBeNull();
    });

    /**
     * Test: Cannot update protected fields
     * Validates: Requirement 4.2
     */
    it('should not update protected fields like userId and billId', async () => {
      // Arrange
      const bills = db.collection('bills');
      await bills.insertOne({
        billId: 'BILL-789',
        userId: 'user-123',
        provider: 'Gas Company',
        billType: 'gas',
        amount: 75,
        dueDate: new Date('2024-02-25'),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const adminId = 'admin-123';
      const updates = {
        userId: 'user-456', // Should not be updated
        billId: 'BILL-999', // Should not be updated
        amount: 80
      };

      // Act
      await service.updateBill('BILL-789', updates as any, adminId);

      // Assert
      const updatedBill = await bills.findOne({ billId: 'BILL-789' });
      expect(updatedBill?.userId).toBe('user-123'); // Original userId
      expect(updatedBill?.billId).toBe('BILL-789'); // Original billId
      expect(updatedBill?.amount).toBe(80); // Amount updated
    });
  });

  describe('deleteBill', () => {
    /**
     * Test: Delete bill successfully
     * Validates: Requirement 4.3
     */
    it('should delete bill from database', async () => {
      // Arrange
      const bills = db.collection('bills');
      await bills.insertOne({
        billId: 'BILL-DELETE-1',
        userId: 'user-123',
        provider: 'Mobile Provider',
        billType: 'mobile',
        amount: 40,
        dueDate: new Date('2024-03-01'),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const adminId = 'admin-123';

      // Act
      await service.deleteBill('BILL-DELETE-1', adminId);

      // Assert
      const deletedBill = await bills.findOne({ billId: 'BILL-DELETE-1' });
      expect(deletedBill).toBeNull();
    });

    /**
     * Test: Audit log is created for bill deletion
     * Validates: Requirement 4.3
     */
    it('should create audit log for bill deletion', async () => {
      // Arrange
      const { auditLogService } = await import('../AuditLogService');
      const bills = db.collection('bills');
      await bills.insertOne({
        billId: 'BILL-DELETE-2',
        userId: 'user-456',
        provider: 'Internet Provider',
        billType: 'internet',
        amount: 60,
        dueDate: new Date('2024-03-05'),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const adminId = 'admin-123';

      // Act
      await service.deleteBill('BILL-DELETE-2', adminId);

      // Assert
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminId,
          adminId,
          operation: 'Delete bill',
          operationType: 'bill_delete',
          entityType: 'bill',
          targetUserId: 'user-456',
          status: 'success',
        })
      );
    });

    /**
     * Test: Throw error for non-existent bill
     * Validates: Requirement 4.3
     */
    it('should throw error when bill not found', async () => {
      // Act & Assert
      await expect(service.deleteBill('BILL-NONEXISTENT', 'admin-123')).rejects.toThrow(
        'Bill not found'
      );
    });
  });

  describe('getAllBills', () => {
    /**
     * Test: Get all bills across multiple users
     * Validates: Requirement 4.6
     */
    it('should return bills from multiple users', async () => {
      // Arrange
      const bills = db.collection('bills');
      await bills.insertMany([
        {
          billId: 'BILL-USER1-1',
          userId: 'user-1',
          provider: 'Electric',
          billType: 'electricity',
          amount: 100,
          dueDate: new Date('2024-02-15'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          billId: 'BILL-USER2-1',
          userId: 'user-2',
          provider: 'Water',
          billType: 'water',
          amount: 50,
          dueDate: new Date('2024-02-20'),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          billId: 'BILL-USER3-1',
          userId: 'user-3',
          provider: 'Gas',
          billType: 'gas',
          amount: 75,
          dueDate: new Date('2024-02-25'),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      // Act
      const result = await service.getAllBills({}, { page: 1, limit: 10 });

      // Assert
      expect(result.bills).toHaveLength(3);
      expect(result.total).toBe(3);
      // Verify bills from different users
      const userIds = result.bills.map(b => b.userId);
      expect(new Set(userIds).size).toBe(3); // 3 unique users
    });

    /**
     * Test: Filter bills by userId
     * Validates: Requirement 4.6
     */
    it('should filter bills by userId', async () => {
      // Arrange
      const bills = db.collection('bills');
      await bills.insertMany([
        {
          billId: 'BILL-1',
          userId: 'user-123',
          provider: 'Electric',
          billType: 'electricity',
          amount: 100,
          dueDate: new Date('2024-02-15'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          billId: 'BILL-2',
          userId: 'user-456',
          provider: 'Water',
          billType: 'water',
          amount: 50,
          dueDate: new Date('2024-02-20'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      // Act
      const result = await service.getAllBills({ userId: 'user-123' }, { page: 1, limit: 10 });

      // Assert
      expect(result.bills).toHaveLength(1);
      expect(result.bills[0].userId).toBe('user-123');
    });

    // Status filtering test removed because status is gone

    // startDate filtering test removed because startDate is gone from top-level bill filtering
    it('should filter bills by endDate', async () => {
      // Arrange
      const bills = db.collection('bills');
      await bills.insertMany([
        {
          billId: 'BILL-JAN',
          userId: 'user-123',
          provider: 'Electric',
          billType: 'electricity',
          amount: 100,
          dueDate: new Date('2024-01-15'),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          billId: 'BILL-FEB',
          userId: 'user-123',
          provider: 'Water',
          billType: 'water',
          amount: 50,
          dueDate: new Date('2024-02-15'),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      // Act
      const result = await service.getAllBills(
        {
          endDate: new Date('2024-01-31')
        },
        { page: 1, limit: 10 }
      );

      // Assert
      expect(result.bills).toHaveLength(1);
      expect(result.bills[0].billId).toBe('BILL-JAN');
    });

    /**
     * Test: Pagination works correctly
     * Validates: Requirement 4.6
     */
    it('should paginate results correctly', async () => {
      // Arrange
      const bills = db.collection('bills');
      const billDocs = Array.from({ length: 25 }, (_, i) => ({
        billId: `BILL-${i}`,
        userId: 'user-123',
        provider: `Provider ${i}`,
        billType: 'electricity',
        amount: 100 + i,
        dueDate: new Date(`2024-02-${(i % 28) + 1}`),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      await bills.insertMany(billDocs);

      // Act - Get page 2 with 10 items per page
      const result = await service.getAllBills({}, { page: 2, limit: 10 });

      // Assert
      expect(result.bills).toHaveLength(10);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('bulkUpdateBills', () => {
    /**
     * Test: Bulk update multiple bills successfully
     * Validates: Requirements 11.1, 11.2, 11.4
     */
    it('should update multiple bills and return individual results', async () => {
      // Arrange
      const bills = db.collection('bills');
      await bills.insertMany([
        {
          billId: 'BILL-BULK-1',
          userId: 'user-123',
          provider: 'Electric',
          billType: 'electricity',
          amount: 100,
          dueDate: new Date('2024-02-15'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          billId: 'BILL-BULK-2',
          userId: 'user-123',
          provider: 'Water',
          billType: 'water',
          amount: 50,
          dueDate: new Date('2024-02-20'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      const adminId = 'admin-123';
      const billIds = ['BILL-BULK-1', 'BILL-BULK-2'];
      const updates = { status: 'paid' as const };

      // Act
      const result = await service.bulkUpdateBills(billIds, updates, adminId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);

      // Verify bills are updated
      const updatedBill1 = await bills.findOne({ billId: 'BILL-BULK-1' });
      const updatedBill2 = await bills.findOne({ billId: 'BILL-BULK-2' });
      expect(updatedBill1?.status).toBe('paid');
      expect(updatedBill2?.status).toBe('paid');
    });

    /**
     * Test: Bulk update handles partial failures
     * Validates: Requirement 11.4
     */
    it('should handle partial failures and report individual results', async () => {
      // Arrange
      const bills = db.collection('bills');
      await bills.insertOne({
        billId: 'BILL-EXISTS',
        userId: 'user-123',
        provider: 'Electric',
        billType: 'electricity',
        amount: 100,
        dueDate: new Date('2024-02-15'),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const adminId = 'admin-123';
      const billIds = ['BILL-EXISTS', 'BILL-NONEXISTENT'];
      const updates = { status: 'paid' as const };

      // Act
      const result = await service.bulkUpdateBills(billIds, updates, adminId);

      // Assert
      expect(result.success).toBe(false); // Not all succeeded
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].billId).toBe('BILL-EXISTS');
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].billId).toBe('BILL-NONEXISTENT');
      expect(result.results[1].error).toBe('Bill not found');
    });

    /**
     * Test: Audit log is created for bulk update
     * Validates: Requirement 11.4
     */
    it('should create audit log for bulk update operation', async () => {
      // Arrange
      const { auditLogService } = await import('../AuditLogService');
      const bills = db.collection('bills');
      await bills.insertMany([
        {
          billId: 'BILL-1',
          userId: 'user-123',
          provider: 'Electric',
          billType: 'electricity',
          amount: 100,
          dueDate: new Date('2024-02-15'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          billId: 'BILL-2',
          userId: 'user-123',
          provider: 'Water',
          billType: 'water',
          amount: 50,
          dueDate: new Date('2024-02-20'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      const adminId = 'admin-123';
      const billIds = ['BILL-1', 'BILL-2'];
      const updates = { status: 'paid' as const };

      // Act
      await service.bulkUpdateBills(billIds, updates, adminId);

      // Assert - Should have 3 audit logs: 2 individual updates + 1 bulk operation
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminId,
          adminId,
          operation: 'Bulk update bills',
          operationType: 'bill_bulk_update',
          entityType: 'bill',
          status: 'success',
        })
      );
    });
  });

  describe('bulkDeleteBills', () => {
    /**
     * Test: Bulk delete multiple bills successfully
     * Validates: Requirements 11.3, 11.4
     */
    it('should delete multiple bills and return individual results', async () => {
      // Arrange
      const bills = db.collection('bills');
      await bills.insertMany([
        {
          billId: 'BILL-DEL-1',
          userId: 'user-123',
          provider: 'Electric',
          billType: 'electricity',
          amount: 100,
          dueDate: new Date('2024-02-15'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          billId: 'BILL-DEL-2',
          userId: 'user-123',
          provider: 'Water',
          billType: 'water',
          amount: 50,
          dueDate: new Date('2024-02-20'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      const adminId = 'admin-123';
      const billIds = ['BILL-DEL-1', 'BILL-DEL-2'];

      // Act
      const result = await service.bulkDeleteBills(billIds, adminId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);

      // Verify bills are deleted
      const deletedBill1 = await bills.findOne({ billId: 'BILL-DEL-1' });
      const deletedBill2 = await bills.findOne({ billId: 'BILL-DEL-2' });
      expect(deletedBill1).toBeNull();
      expect(deletedBill2).toBeNull();
    });

    /**
     * Test: Bulk delete handles partial failures
     * Validates: Requirement 11.4
     */
    it('should handle partial failures and report individual results', async () => {
      // Arrange
      const bills = db.collection('bills');
      await bills.insertOne({
        billId: 'BILL-DEL-EXISTS',
        userId: 'user-123',
        provider: 'Electric',
        billType: 'electricity',
        amount: 100,
        dueDate: new Date('2024-02-15'),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const adminId = 'admin-123';
      const billIds = ['BILL-DEL-EXISTS', 'BILL-DEL-NONEXISTENT'];

      // Act
      const result = await service.bulkDeleteBills(billIds, adminId);

      // Assert
      expect(result.success).toBe(false); // Not all succeeded
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].billId).toBe('BILL-DEL-EXISTS');
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].billId).toBe('BILL-DEL-NONEXISTENT');
      expect(result.results[1].error).toBe('Bill not found');
    });

    /**
     * Test: Audit log is created for bulk delete
     * Validates: Requirement 11.4
     */
    it('should create audit log for bulk delete operation', async () => {
      // Arrange
      const { auditLogService } = await import('../AuditLogService');
      const bills = db.collection('bills');
      await bills.insertMany([
        {
          billId: 'BILL-A',
          userId: 'user-123',
          provider: 'Electric',
          billType: 'electricity',
          amount: 100,
          dueDate: new Date('2024-02-15'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          billId: 'BILL-B',
          userId: 'user-123',
          provider: 'Water',
          billType: 'water',
          amount: 50,
          dueDate: new Date('2024-02-20'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      const adminId = 'admin-123';
      const billIds = ['BILL-A', 'BILL-B'];

      // Act
      await service.bulkDeleteBills(billIds, adminId);

      // Assert - Should have 3 audit logs: 2 individual deletes + 1 bulk operation
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminId,
          adminId,
          operation: 'Bulk delete bills',
          operationType: 'bill_bulk_delete',
          entityType: 'bill',
          status: 'success',
        })
      );
    });
  });
});
