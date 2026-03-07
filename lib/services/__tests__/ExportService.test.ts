import { describe, it, expect, beforeEach, vi, afterEach, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import mongoose from 'mongoose';
import { ExportService } from '../ExportService';
import Bill from '../../models/Bill';
import AutoPaymentRecord from '../../models/AutoPaymentRecord';

/**
 * Unit Tests for ExportService
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.5**
 * 
 * Tests cover:
 * - Export users with CSV generation
 * - Export bills with CSV generation
 * - Export transactions with CSV generation
 * - Filtering support for all export methods
 * - Exclusion of sensitive data from exports
 */

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let service: ExportService;

// Mock the mongodb module
vi.mock('../../mongodb', () => ({
  getDatabase: vi.fn(),
}));

// Mock the mongoose module for Bill and AutoPaymentRecord
vi.mock('../../mongoose', () => ({
  default: vi.fn().mockResolvedValue(mongoose),
}));

// Mock the audit log service
vi.mock('../AuditLogService', () => ({
  auditLogService: {
    log: vi.fn().mockResolvedValue({}),
  },
}));

// Mock logger
vi.mock('../../logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
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

  // Connect mongoose to the test database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }

  service = new ExportService();
}, 30000);

afterEach(async () => {
  // Clear all collections
  const collections = await db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
  
  vi.clearAllMocks();
}, 30000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (client) {
    await client.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}, 30000);

describe('ExportService', () => {
  describe('exportUsers', () => {
    /**
     * Test: Export users to CSV format
     * Validates: Requirements 13.1, 13.5
     */
    it('should export users to CSV format', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertMany([
        {
          email: 'user1@example.com',
          name: 'John Doe',
          role: 'regular',
          password: 'hashed_password_1',
          createdAt: new Date('2024-01-15'),
        },
        {
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin',
          password: 'hashed_password_2',
          createdAt: new Date('2024-01-20'),
        },
      ]);

      const adminId = 'admin-123';

      // Act
      const result = await service.exportUsers({}, adminId);

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      // Check CSV structure
      const lines = result.split('\n');
      expect(lines[0]).toBe('id,email,name,role,createdAt'); // Header
      expect(lines).toHaveLength(3); // Header + 2 users
      
      // Check that sensitive data is excluded
      expect(result).not.toContain('password');
      expect(result).not.toContain('hashed_password');
      
      // Check user data is present
      expect(result).toContain('user1@example.com');
      expect(result).toContain('John Doe');
      expect(result).toContain('regular');
      expect(result).toContain('admin@example.com');
      expect(result).toContain('Admin User');
      expect(result).toContain('admin');
    });

    /**
     * Test: Export users with role filter
     * Validates: Requirements 13.1, 13.3
     */
    it('should filter users by role', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertMany([
        {
          email: 'user1@example.com',
          name: 'Regular User 1',
          role: 'regular',
          password: 'hashed_password_1',
          createdAt: new Date('2024-01-15'),
        },
        {
          email: 'user2@example.com',
          name: 'Regular User 2',
          role: 'regular',
          password: 'hashed_password_2',
          createdAt: new Date('2024-01-16'),
        },
        {
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin',
          password: 'hashed_password_3',
          createdAt: new Date('2024-01-20'),
        },
      ]);

      const adminId = 'admin-123';
      const filters = { role: 'regular' as const };

      // Act
      const result = await service.exportUsers(filters, adminId);

      // Assert
      const lines = result.split('\n');
      expect(lines).toHaveLength(3); // Header + 2 regular users
      expect(result).toContain('Regular User 1');
      expect(result).toContain('Regular User 2');
      expect(result).not.toContain('Admin User');
    });

    /**
     * Test: Export users with date range filter
     * Validates: Requirements 13.1, 13.3
     */
    it('should filter users by date range', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertMany([
        {
          email: 'old@example.com',
          name: 'Old User',
          role: 'regular',
          password: 'hashed_password_1',
          createdAt: new Date('2023-12-01'),
        },
        {
          email: 'new@example.com',
          name: 'New User',
          role: 'regular',
          password: 'hashed_password_2',
          createdAt: new Date('2024-02-01'),
        },
      ]);

      const adminId = 'admin-123';
      const filters = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-02-28'),
      };

      // Act
      const result = await service.exportUsers(filters, adminId);

      // Assert
      const lines = result.split('\n');
      expect(lines).toHaveLength(2); // Header + 1 user
      expect(result).toContain('New User');
      expect(result).not.toContain('Old User');
    });

    /**
     * Test: Export users excludes sensitive fields
     * Validates: Requirement 13.5
     */
    it('should exclude sensitive data from user export', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertOne({
        email: 'user@example.com',
        name: 'Test User',
        role: 'regular',
        password: 'super_secret_password',
        resetToken: 'secret_reset_token',
        resetTokenExpiry: new Date(),
        createdAt: new Date('2024-01-15'),
      });

      const adminId = 'admin-123';

      // Act
      const result = await service.exportUsers({}, adminId);

      // Assert
      expect(result).not.toContain('super_secret_password');
      expect(result).not.toContain('secret_reset_token');
      expect(result).not.toContain('resetToken');
      expect(result).not.toContain('resetTokenExpiry');
      expect(result).toContain('user@example.com');
      expect(result).toContain('Test User');
    });

    /**
     * Test: Export users creates audit log
     * Validates: Requirement 13.1
     */
    it('should create audit log for user export', async () => {
      // Arrange
      const { auditLogService } = await import('../AuditLogService');
      const users = db.collection('users');
      await users.insertOne({
        email: 'user@example.com',
        name: 'Test User',
        role: 'regular',
        password: 'password',
        createdAt: new Date(),
      });

      const adminId = 'admin-123';

      // Act
      await service.exportUsers({}, adminId);

      // Assert
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminId,
          adminId,
          operation: 'Export users',
          operationType: 'data_export',
          entityType: 'user',
          status: 'success',
        })
      );
    });

    /**
     * Test: Export users handles empty result
     * Validates: Requirement 13.1
     */
    it('should handle empty user list', async () => {
      // Arrange
      const adminId = 'admin-123';

      // Act
      const result = await service.exportUsers({}, adminId);

      // Assert
      expect(result).toBe('id,email,name,role,createdAt\n');
    });

    /**
     * Test: Export users handles CSV escaping
     * Validates: Requirement 13.1
     */
    it('should properly escape CSV values with commas and quotes', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertOne({
        email: 'user@example.com',
        name: 'User, with "quotes" and commas',
        role: 'regular',
        password: 'password',
        createdAt: new Date('2024-01-15'),
      });

      const adminId = 'admin-123';

      // Act
      const result = await service.exportUsers({}, adminId);

      // Assert
      expect(result).toContain('"User, with ""quotes"" and commas"');
    });
  });

  describe('exportBills', () => {
    /**
     * Test: Export bills to CSV format
     * Validates: Requirements 13.2, 13.5
     */
    it('should export bills to CSV format', async () => {
      // Arrange
      await Bill.create([
        {
          billId: 'BILL-001',
          userId: 'user-123',
          provider: 'Electric Company',
          billType: 'electricity',
          amount: 150.50,
          dueDate: new Date('2024-02-15'),
          status: 'pending',
          description: 'Monthly electric bill',
        },
        {
          billId: 'BILL-002',
          userId: 'user-456',
          provider: 'Water Company',
          billType: 'water',
          amount: 75.25,
          dueDate: new Date('2024-02-20'),
          status: 'paid',
          description: 'Monthly water bill',
        },
      ]);

      const adminId = 'admin-123';

      // Act
      const result = await service.exportBills({}, adminId);

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      // Check CSV structure
      const lines = result.split('\n');
      expect(lines[0]).toBe('id,userId,billId,provider,billType,amount,dueDate,status,description,createdAt,updatedAt');
      expect(lines).toHaveLength(3); // Header + 2 bills
      
      // Check bill data is present
      expect(result).toContain('BILL-001');
      expect(result).toContain('Electric Company');
      expect(result).toContain('150.5');
      expect(result).toContain('BILL-002');
      expect(result).toContain('Water Company');
      expect(result).toContain('75.25');
    });

    /**
     * Test: Export bills with userId filter
     * Validates: Requirements 13.2, 13.3
     */
    it('should filter bills by userId', async () => {
      // Arrange
      await Bill.create([
        {
          billId: 'BILL-001',
          userId: 'user-123',
          provider: 'Electric Company',
          billType: 'electricity',
          amount: 150.50,
          dueDate: new Date('2024-02-15'),
          status: 'pending',
        },
        {
          billId: 'BILL-002',
          userId: 'user-456',
          provider: 'Water Company',
          billType: 'water',
          amount: 75.25,
          dueDate: new Date('2024-02-20'),
          status: 'paid',
        },
      ]);

      const adminId = 'admin-123';
      const filters = { userId: 'user-123' };

      // Act
      const result = await service.exportBills(filters, adminId);

      // Assert
      const lines = result.split('\n');
      expect(lines).toHaveLength(2); // Header + 1 bill
      expect(result).toContain('BILL-001');
      expect(result).toContain('user-123');
      expect(result).not.toContain('BILL-002');
      expect(result).not.toContain('user-456');
    });

    /**
     * Test: Export bills with status filter
     * Validates: Requirements 13.2, 13.3
     */
    it('should filter bills by status', async () => {
      // Arrange
      await Bill.create([
        {
          billId: 'BILL-PENDING',
          userId: 'user-123',
          provider: 'Electric Company',
          billType: 'electricity',
          amount: 150.50,
          dueDate: new Date('2024-02-15'),
          status: 'pending',
        },
        {
          billId: 'BILL-PAID',
          userId: 'user-123',
          provider: 'Water Company',
          billType: 'water',
          amount: 75.25,
          dueDate: new Date('2024-02-20'),
          status: 'paid',
        },
      ]);

      const adminId = 'admin-123';
      const filters = { status: 'paid' as const };

      // Act
      const result = await service.exportBills(filters, adminId);

      // Assert
      const lines = result.split('\n');
      expect(lines).toHaveLength(2); // Header + 1 bill
      expect(result).toContain('BILL-PAID');
      expect(result).toContain('paid');
      expect(result).not.toContain('BILL-PENDING');
    });

    /**
     * Test: Export bills with date range filter
     * Validates: Requirements 13.2, 13.3
     */
    it('should filter bills by date range', async () => {
      // Arrange
      await Bill.create([
        {
          billId: 'BILL-JAN',
          userId: 'user-123',
          provider: 'Electric Company',
          billType: 'electricity',
          amount: 150.50,
          dueDate: new Date('2024-01-15'),
          status: 'pending',
        },
        {
          billId: 'BILL-FEB',
          userId: 'user-123',
          provider: 'Water Company',
          billType: 'water',
          amount: 75.25,
          dueDate: new Date('2024-02-15'),
          status: 'paid',
        },
        {
          billId: 'BILL-MAR',
          userId: 'user-123',
          provider: 'Gas Company',
          billType: 'gas',
          amount: 100.00,
          dueDate: new Date('2024-03-15'),
          status: 'pending',
        },
      ]);

      const adminId = 'admin-123';
      const filters = {
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-28'),
      };

      // Act
      const result = await service.exportBills(filters, adminId);

      // Assert
      const lines = result.split('\n');
      expect(lines).toHaveLength(2); // Header + 1 bill
      expect(result).toContain('BILL-FEB');
      expect(result).not.toContain('BILL-JAN');
      expect(result).not.toContain('BILL-MAR');
    });

    /**
     * Test: Export bills creates audit log
     * Validates: Requirement 13.2
     */
    it('should create audit log for bill export', async () => {
      // Arrange
      const { auditLogService } = await import('../AuditLogService');
      await Bill.create({
        billId: 'BILL-001',
        userId: 'user-123',
        provider: 'Electric Company',
        billType: 'electricity',
        amount: 150.50,
        dueDate: new Date('2024-02-15'),
        status: 'pending',
      });

      const adminId = 'admin-123';

      // Act
      await service.exportBills({}, adminId);

      // Assert
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminId,
          adminId,
          operation: 'Export bills',
          operationType: 'data_export',
          entityType: 'bill',
          status: 'success',
        })
      );
    });

    /**
     * Test: Export bills handles empty result
     * Validates: Requirement 13.2
     */
    it('should handle empty bill list', async () => {
      // Arrange
      const adminId = 'admin-123';

      // Act
      const result = await service.exportBills({}, adminId);

      // Assert
      expect(result).toBe('id,userId,billId,provider,billType,amount,dueDate,status,description,createdAt,updatedAt\n');
    });
  });

  describe('exportTransactions', () => {
    /**
     * Test: Export transactions to CSV format
     * Validates: Requirements 13.2, 13.5
     */
    it('should export transactions to CSV format', async () => {
      // Arrange
      await AutoPaymentRecord.create([
        {
          userId: 'user-123',
          billId: 'BILL-001',
          amount: 150.50,
          paymentDate: new Date('2024-02-15'),
          transactionId: 'TXN-001',
          billProvider: 'Electric Company',
          billType: 'electricity',
          status: 'success',
          paymentCycleId: 'CYCLE-001',
        },
        {
          userId: 'user-456',
          billId: 'BILL-002',
          amount: 75.25,
          paymentDate: new Date('2024-02-20'),
          transactionId: 'TXN-002',
          billProvider: 'Water Company',
          billType: 'water',
          status: 'failed',
          paymentCycleId: 'CYCLE-002',
        },
      ]);

      const adminId = 'admin-123';

      // Act
      const result = await service.exportTransactions({}, adminId);

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      // Check CSV structure
      const lines = result.split('\n');
      expect(lines[0]).toBe('id,userId,billId,amount,paymentDate,transactionId,billProvider,billType,status,paymentCycleId,createdAt,updatedAt');
      expect(lines).toHaveLength(3); // Header + 2 transactions
      
      // Check transaction data is present
      expect(result).toContain('TXN-001');
      expect(result).toContain('Electric Company');
      expect(result).toContain('150.5');
      expect(result).toContain('TXN-002');
      expect(result).toContain('Water Company');
      expect(result).toContain('75.25');
    });

    /**
     * Test: Export transactions excludes sensitive payment information
     * Validates: Requirement 13.5
     */
    it('should exclude sensitive payment information from transaction export', async () => {
      // Arrange
      await AutoPaymentRecord.create({
        userId: 'user-123',
        billId: 'BILL-001',
        amount: 150.50,
        paymentDate: new Date('2024-02-15'),
        transactionId: 'TXN-001',
        billProvider: 'Electric Company',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: 'CYCLE-001',
      });

      const adminId = 'admin-123';

      // Act
      const result = await service.exportTransactions({}, adminId);

      // Assert
      // The export should not contain sensitive payment method details
      // (Note: The current AutoPaymentRecord model doesn't store sensitive payment info,
      // but this test ensures the pattern is followed)
      expect(result).toContain('TXN-001');
      expect(result).toContain('user-123');
      expect(result).toContain('150.5');
      
      // Verify the CSV headers don't include sensitive fields
      const lines = result.split('\n');
      const headers = lines[0];
      expect(headers).not.toContain('creditCard');
      expect(headers).not.toContain('bankAccount');
      expect(headers).not.toContain('paymentMethod');
    });

    /**
     * Test: Export transactions with userId filter
     * Validates: Requirements 13.2, 13.3
     */
    it('should filter transactions by userId', async () => {
      // Arrange
      await AutoPaymentRecord.create([
        {
          userId: 'user-123',
          billId: 'BILL-001',
          amount: 150.50,
          paymentDate: new Date('2024-02-15'),
          transactionId: 'TXN-001',
          billProvider: 'Electric Company',
          billType: 'electricity',
          status: 'success',
          paymentCycleId: 'CYCLE-001',
        },
        {
          userId: 'user-456',
          billId: 'BILL-002',
          amount: 75.25,
          paymentDate: new Date('2024-02-20'),
          transactionId: 'TXN-002',
          billProvider: 'Water Company',
          billType: 'water',
          status: 'success',
          paymentCycleId: 'CYCLE-002',
        },
      ]);

      const adminId = 'admin-123';
      const filters = { userId: 'user-123' };

      // Act
      const result = await service.exportTransactions(filters, adminId);

      // Assert
      const lines = result.split('\n');
      expect(lines).toHaveLength(2); // Header + 1 transaction
      expect(result).toContain('TXN-001');
      expect(result).toContain('user-123');
      expect(result).not.toContain('TXN-002');
      expect(result).not.toContain('user-456');
    });

    /**
     * Test: Export transactions with status filter
     * Validates: Requirements 13.2, 13.3
     */
    it('should filter transactions by status', async () => {
      // Arrange
      await AutoPaymentRecord.create([
        {
          userId: 'user-123',
          billId: 'BILL-001',
          amount: 150.50,
          paymentDate: new Date('2024-02-15'),
          transactionId: 'TXN-SUCCESS',
          billProvider: 'Electric Company',
          billType: 'electricity',
          status: 'success',
          paymentCycleId: 'CYCLE-001',
        },
        {
          userId: 'user-123',
          billId: 'BILL-002',
          amount: 75.25,
          paymentDate: new Date('2024-02-20'),
          transactionId: 'TXN-FAILED',
          billProvider: 'Water Company',
          billType: 'water',
          status: 'failed',
          paymentCycleId: 'CYCLE-002',
        },
      ]);

      const adminId = 'admin-123';
      const filters = { status: 'success' as const };

      // Act
      const result = await service.exportTransactions(filters, adminId);

      // Assert
      const lines = result.split('\n');
      expect(lines).toHaveLength(2); // Header + 1 transaction
      expect(result).toContain('TXN-SUCCESS');
      expect(result).toContain('success');
      expect(result).not.toContain('TXN-FAILED');
    });

    /**
     * Test: Export transactions with date range filter
     * Validates: Requirements 13.2, 13.3
     */
    it('should filter transactions by date range', async () => {
      // Arrange
      await AutoPaymentRecord.create([
        {
          userId: 'user-123',
          billId: 'BILL-001',
          amount: 150.50,
          paymentDate: new Date('2024-01-15'),
          transactionId: 'TXN-JAN',
          billProvider: 'Electric Company',
          billType: 'electricity',
          status: 'success',
          paymentCycleId: 'CYCLE-001',
        },
        {
          userId: 'user-123',
          billId: 'BILL-002',
          amount: 75.25,
          paymentDate: new Date('2024-02-15'),
          transactionId: 'TXN-FEB',
          billProvider: 'Water Company',
          billType: 'water',
          status: 'success',
          paymentCycleId: 'CYCLE-002',
        },
        {
          userId: 'user-123',
          billId: 'BILL-003',
          amount: 100.00,
          paymentDate: new Date('2024-03-15'),
          transactionId: 'TXN-MAR',
          billProvider: 'Gas Company',
          billType: 'gas',
          status: 'success',
          paymentCycleId: 'CYCLE-003',
        },
      ]);

      const adminId = 'admin-123';
      const filters = {
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-28'),
      };

      // Act
      const result = await service.exportTransactions(filters, adminId);

      // Assert
      const lines = result.split('\n');
      expect(lines).toHaveLength(2); // Header + 1 transaction
      expect(result).toContain('TXN-FEB');
      expect(result).not.toContain('TXN-JAN');
      expect(result).not.toContain('TXN-MAR');
    });

    /**
     * Test: Export transactions creates audit log
     * Validates: Requirement 13.2
     */
    it('should create audit log for transaction export', async () => {
      // Arrange
      const { auditLogService } = await import('../AuditLogService');
      await AutoPaymentRecord.create({
        userId: 'user-123',
        billId: 'BILL-001',
        amount: 150.50,
        paymentDate: new Date('2024-02-15'),
        transactionId: 'TXN-001',
        billProvider: 'Electric Company',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: 'CYCLE-001',
      });

      const adminId = 'admin-123';

      // Act
      await service.exportTransactions({}, adminId);

      // Assert
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminId,
          adminId,
          operation: 'Export transactions',
          operationType: 'data_export',
          entityType: 'transaction',
          status: 'success',
        })
      );
    });

    /**
     * Test: Export transactions handles empty result
     * Validates: Requirement 13.2
     */
    it('should handle empty transaction list', async () => {
      // Arrange
      const adminId = 'admin-123';

      // Act
      const result = await service.exportTransactions({}, adminId);

      // Assert
      expect(result).toBe('id,userId,billId,amount,paymentDate,transactionId,billProvider,billType,status,paymentCycleId,createdAt,updatedAt\n');
    });
  });

  describe('CSV Generation', () => {
    /**
     * Test: CSV escaping for special characters
     * Validates: Requirements 13.1, 13.2
     */
    it('should properly escape CSV values with special characters', async () => {
      // Arrange
      await Bill.create({
        billId: 'BILL-001',
        userId: 'user-123',
        provider: 'Company, Inc. "The Best"',
        billType: 'electricity',
        amount: 150.50,
        dueDate: new Date('2024-02-15'),
        status: 'pending',
        description: 'Bill with\nnewline and "quotes"',
      });

      const adminId = 'admin-123';

      // Act
      const result = await service.exportBills({}, adminId);

      // Assert
      expect(result).toContain('"Company, Inc. ""The Best"""');
      expect(result).toContain('"Bill with\nnewline and ""quotes"""');
    });

    /**
     * Test: CSV handles null and undefined values
     * Validates: Requirements 13.1, 13.2
     */
    it('should handle null and undefined values in CSV', async () => {
      // Arrange
      await Bill.create({
        billId: 'BILL-001',
        userId: 'user-123',
        provider: 'Electric Company',
        billType: 'electricity',
        amount: 150.50,
        dueDate: new Date('2024-02-15'),
        status: 'pending',
        // description is optional and will be undefined
      });

      const adminId = 'admin-123';

      // Act
      const result = await service.exportBills({}, adminId);

      // Assert
      const lines = result.split('\n');
      const dataLine = lines[1];
      const fields = dataLine.split(',');
      
      // The description field (index 8) should be empty for undefined values
      expect(fields[8]).toBe('');
    });

    /**
     * Test: CSV handles date formatting
     * Validates: Requirements 13.1, 13.2
     */
    it('should format dates as ISO strings in CSV', async () => {
      // Arrange
      const testDate = new Date('2024-02-15T10:30:00.000Z');
      await Bill.create({
        billId: 'BILL-001',
        userId: 'user-123',
        provider: 'Electric Company',
        billType: 'electricity',
        amount: 150.50,
        dueDate: testDate,
        status: 'pending',
      });

      const adminId = 'admin-123';

      // Act
      const result = await service.exportBills({}, adminId);

      // Assert
      expect(result).toContain('2024-02-15T10:30:00.000Z');
    });
  });

  describe('Error Handling', () => {
    /**
     * Test: Handle database errors gracefully
     * Validates: Requirements 13.1, 13.2
     */
    it('should handle database errors gracefully', async () => {
      // Arrange
      const { getDatabase } = await import('../../mongodb');
      vi.mocked(getDatabase).mockRejectedValueOnce(new Error('Database connection failed'));

      const adminId = 'admin-123';

      // Act & Assert
      await expect(service.exportUsers({}, adminId)).rejects.toThrow('Database connection failed');
    });
  });
});