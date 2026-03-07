import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { AdminUserService } from '../AdminUserService';
import { hashPassword } from '../../auth';

/**
 * Unit Tests for AdminUserService
 * **Validates: Requirements 6.1, 6.2, 6.3, 12.1, 12.5**
 * 
 * Tests cover:
 * - Get all users with pagination and filters
 * - Get user details with stats
 * - Create user with role assignment
 * - Update user role with audit logging
 * - Search users by email/name
 */

let mongoServer: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let service: AdminUserService;

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

  service = new AdminUserService();
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

describe('AdminUserService', () => {
  describe('getAllUsers', () => {
    /**
     * Test: Get all users with pagination
     * Validates: Requirement 6.1
     */
    it('should return paginated list of all users', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertMany([
        {
          email: 'user1@example.com',
          password: 'hashed1',
          name: 'User One',
          role: 'regular',
          createdAt: new Date('2024-01-01'),
        },
        {
          email: 'user2@example.com',
          password: 'hashed2',
          name: 'User Two',
          role: 'admin',
          createdAt: new Date('2024-01-02'),
        },
        {
          email: 'user3@example.com',
          password: 'hashed3',
          name: 'User Three',
          role: 'regular',
          createdAt: new Date('2024-01-03'),
        },
      ]);

      // Act
      const result = await service.getAllUsers({}, { page: 1, limit: 10 });

      // Assert
      expect(result.users).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      // Verify password is excluded
      expect(result.users[0]).not.toHaveProperty('password');
    });

    /**
     * Test: Filter users by role
     * Validates: Requirement 6.1
     */
    it('should filter users by role', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertMany([
        {
          email: 'regular@example.com',
          password: 'hashed',
          name: 'Regular User',
          role: 'regular',
          createdAt: new Date(),
        },
        {
          email: 'admin@example.com',
          password: 'hashed',
          name: 'Admin User',
          role: 'admin',
          createdAt: new Date(),
        },
      ]);

      // Act
      const result = await service.getAllUsers({ role: 'admin' }, { page: 1, limit: 10 });

      // Assert
      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe('admin@example.com');
      expect(result.users[0].role).toBe('admin');
    });

    /**
     * Test: Search users by email
     * Validates: Requirement 6.3
     */
    it('should search users by email', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertMany([
        {
          email: 'john@example.com',
          password: 'hashed',
          name: 'John Doe',
          role: 'regular',
          createdAt: new Date(),
        },
        {
          email: 'jane@example.com',
          password: 'hashed',
          name: 'Jane Smith',
          role: 'regular',
          createdAt: new Date(),
        },
      ]);

      // Act
      const result = await service.getAllUsers({ search: 'john' }, { page: 1, limit: 10 });

      // Assert
      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe('john@example.com');
    });

    /**
     * Test: Search users by name
     * Validates: Requirement 6.3
     */
    it('should search users by name', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertMany([
        {
          email: 'john@example.com',
          password: 'hashed',
          name: 'John Doe',
          role: 'regular',
          createdAt: new Date(),
        },
        {
          email: 'jane@example.com',
          password: 'hashed',
          name: 'Jane Smith',
          role: 'regular',
          createdAt: new Date(),
        },
      ]);

      // Act
      const result = await service.getAllUsers({ search: 'Smith' }, { page: 1, limit: 10 });

      // Assert
      expect(result.users).toHaveLength(1);
      expect(result.users[0].name).toBe('Jane Smith');
    });

    /**
     * Test: Pagination works correctly
     * Validates: Requirement 6.1
     */
    it('should paginate results correctly', async () => {
      // Arrange
      const users = db.collection('users');
      const userDocs = Array.from({ length: 25 }, (_, i) => ({
        email: `user${i}@example.com`,
        password: 'hashed',
        name: `User ${i}`,
        role: 'regular' as const,
        createdAt: new Date(),
      }));
      await users.insertMany(userDocs);

      // Act - Get page 2 with 10 items per page
      const result = await service.getAllUsers({}, { page: 2, limit: 10 });

      // Assert
      expect(result.users).toHaveLength(10);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('getUserDetails', () => {
    /**
     * Test: Get user details with bill count
     * Validates: Requirement 6.2
     */
    it('should return user details with bill count', async () => {
      // Arrange
      const users = db.collection('users');
      const bills = db.collection('bills');
      
      const userResult = await users.insertOne({
        email: 'user@example.com',
        password: 'hashed',
        name: 'Test User',
        role: 'regular',
        createdAt: new Date(),
      });
      const userId = userResult.insertedId.toString();

      await bills.insertMany([
        { userId, provider: 'Electric', amount: 100 },
        { userId, provider: 'Water', amount: 50 },
      ]);

      // Act
      const result = await service.getUserDetails(userId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.email).toBe('user@example.com');
      expect(result?.name).toBe('Test User');
      expect(result?.role).toBe('regular');
      expect(result?.billCount).toBe(2);
      // Verify password is excluded (Requirement 6.5)
      expect(result).not.toHaveProperty('password');
    });

    /**
     * Test: Return null for non-existent user
     * Validates: Requirement 6.2
     */
    it('should return null for non-existent user', async () => {
      // Act
      const result = await service.getUserDetails('507f1f77bcf86cd799439011');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    /**
     * Test: Create user with admin role
     * Validates: Requirement 12.1
     */
    it('should create user with admin role', async () => {
      // Arrange
      const userData = {
        email: 'newadmin@example.com',
        password: 'SecurePass123!',
        name: 'New Admin',
        role: 'admin' as const,
      };
      const adminId = 'admin-123';

      // Act
      const result = await service.createUser(userData, adminId);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe(userData.email);
      expect(result.name).toBe(userData.name);
      expect(result.role).toBe('admin');
      expect(result._id).toBeDefined();

      // Verify password is hashed
      const users = db.collection('users');
      const savedUser = await users.findOne({ email: userData.email });
      expect(savedUser?.password).not.toBe(userData.password);
      expect(savedUser?.password).toBeTruthy();
    });

    /**
     * Test: Create user with regular role
     * Validates: Requirement 12.1
     */
    it('should create user with regular role', async () => {
      // Arrange
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'New User',
        role: 'regular' as const,
      };
      const adminId = 'admin-123';

      // Act
      const result = await service.createUser(userData, adminId);

      // Assert
      expect(result.role).toBe('regular');
    });

    /**
     * Test: Throw error for duplicate email
     * Validates: Requirement 12.1
     */
    it('should throw error when email already exists', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertOne({
        email: 'existing@example.com',
        password: 'hashed',
        name: 'Existing User',
        role: 'regular',
        createdAt: new Date(),
      });

      const userData = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        name: 'New User',
        role: 'regular' as const,
      };
      const adminId = 'admin-123';

      // Act & Assert
      await expect(service.createUser(userData, adminId)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    /**
     * Test: Audit log is created for user creation
     * Validates: Requirement 12.1
     */
    it('should create audit log for user creation', async () => {
      // Arrange
      const { auditLogService } = await import('../AuditLogService');
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'New User',
        role: 'regular' as const,
      };
      const adminId = 'admin-123';

      // Act
      await service.createUser(userData, adminId);

      // Assert
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminId,
          adminId,
          operation: 'Create user',
          operationType: 'user_create',
          entityType: 'user',
          status: 'success',
        })
      );
    });
  });

  describe('updateUserRole', () => {
    /**
     * Test: Update user role from regular to admin
     * Validates: Requirement 12.5
     */
    it('should update user role from regular to admin', async () => {
      // Arrange
      const users = db.collection('users');
      const userResult = await users.insertOne({
        email: 'user@example.com',
        password: 'hashed',
        name: 'Test User',
        role: 'regular',
        createdAt: new Date(),
      });
      const userId = userResult.insertedId.toString();
      const adminId = 'admin-123';

      // Act
      const result = await service.updateUserRole(userId, 'admin', adminId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.role).toBe('admin');

      // Verify in database
      const updatedUser = await users.findOne({ _id: userResult.insertedId });
      expect(updatedUser?.role).toBe('admin');
    });

    /**
     * Test: Update user role from admin to regular
     * Validates: Requirement 12.5
     */
    it('should update user role from admin to regular', async () => {
      // Arrange
      const users = db.collection('users');
      const userResult = await users.insertOne({
        email: 'admin@example.com',
        password: 'hashed',
        name: 'Admin User',
        role: 'admin',
        createdAt: new Date(),
      });
      const userId = userResult.insertedId.toString();
      const adminId = 'admin-123';

      // Act
      const result = await service.updateUserRole(userId, 'regular', adminId);

      // Assert
      expect(result?.role).toBe('regular');
    });

    /**
     * Test: Return null for non-existent user
     * Validates: Requirement 12.5
     */
    it('should return null for non-existent user', async () => {
      // Act
      const result = await service.updateUserRole('507f1f77bcf86cd799439011', 'admin', 'admin-123');

      // Assert
      expect(result).toBeNull();
    });

    /**
     * Test: Audit log includes before and after state
     * Validates: Requirement 12.5
     */
    it('should create audit log with before and after state', async () => {
      // Arrange
      const { auditLogService } = await import('../AuditLogService');
      const users = db.collection('users');
      const userResult = await users.insertOne({
        email: 'user@example.com',
        password: 'hashed',
        name: 'Test User',
        role: 'regular',
        createdAt: new Date(),
      });
      const userId = userResult.insertedId.toString();
      const adminId = 'admin-123';

      // Act
      await service.updateUserRole(userId, 'admin', adminId);

      // Assert
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminId,
          adminId,
          operation: 'Update user role',
          operationType: 'user_role_change',
          entityType: 'user',
          beforeState: { role: 'regular' },
          afterState: { role: 'admin' },
          status: 'success',
        })
      );
    });
  });

  describe('searchUsers', () => {
    /**
     * Test: Search users by email
     * Validates: Requirement 6.3
     */
    it('should search users by email', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertMany([
        {
          email: 'john.doe@example.com',
          password: 'hashed',
          name: 'John Doe',
          role: 'regular',
          createdAt: new Date(),
        },
        {
          email: 'jane.smith@example.com',
          password: 'hashed',
          name: 'Jane Smith',
          role: 'regular',
          createdAt: new Date(),
        },
        {
          email: 'bob.jones@example.com',
          password: 'hashed',
          name: 'Bob Jones',
          role: 'regular',
          createdAt: new Date(),
        },
      ]);

      // Act
      const result = await service.searchUsers('john');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('john.doe@example.com');
    });

    /**
     * Test: Search users by name
     * Validates: Requirement 6.3
     */
    it('should search users by name', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertMany([
        {
          email: 'john@example.com',
          password: 'hashed',
          name: 'John Doe',
          role: 'regular',
          createdAt: new Date(),
        },
        {
          email: 'jane@example.com',
          password: 'hashed',
          name: 'Jane Smith',
          role: 'regular',
          createdAt: new Date(),
        },
      ]);

      // Act
      const result = await service.searchUsers('Smith');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Jane Smith');
    });

    /**
     * Test: Search is case-insensitive
     * Validates: Requirement 6.3
     */
    it('should perform case-insensitive search', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertOne({
        email: 'John.Doe@Example.COM',
        password: 'hashed',
        name: 'John Doe',
        role: 'regular',
        createdAt: new Date(),
      });

      // Act
      const result = await service.searchUsers('john.doe');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('John.Doe@Example.COM');
    });

    /**
     * Test: Search returns empty array when no matches
     * Validates: Requirement 6.3
     */
    it('should return empty array when no matches found', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertOne({
        email: 'john@example.com',
        password: 'hashed',
        name: 'John Doe',
        role: 'regular',
        createdAt: new Date(),
      });

      // Act
      const result = await service.searchUsers('nonexistent');

      // Assert
      expect(result).toHaveLength(0);
    });

    /**
     * Test: Search excludes password field
     * Validates: Requirement 6.5
     */
    it('should exclude password from search results', async () => {
      // Arrange
      const users = db.collection('users');
      await users.insertOne({
        email: 'john@example.com',
        password: 'hashed',
        name: 'John Doe',
        role: 'regular',
        createdAt: new Date(),
      });

      // Act
      const result = await service.searchUsers('john');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('password');
    });

    /**
     * Test: Search limits results to 50
     * Validates: Requirement 6.3
     */
    it('should limit search results to 50 users', async () => {
      // Arrange
      const users = db.collection('users');
      const userDocs = Array.from({ length: 100 }, (_, i) => ({
        email: `user${i}@example.com`,
        password: 'hashed',
        name: `User ${i}`,
        role: 'regular' as const,
        createdAt: new Date(),
      }));
      await users.insertMany(userDocs);

      // Act
      const result = await service.searchUsers('user');

      // Assert
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });
});
