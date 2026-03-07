/**
 * Tests for admin role setup migration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';

// Mock the mongodb module before importing the migration
vi.mock('../../mongodb', () => {
  let mockDb: Db;
  return {
    getDatabase: vi.fn(async () => mockDb),
    setMockDb: (db: Db) => { mockDb = db; },
  };
});

import { migrateAdminRoleSetup } from '../admin-role-setup';
import * as mongodb from '../../mongodb';

describe('Admin Role Setup Migration', () => {
  let mongoServer: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    // Connect to the in-memory database
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('test');

    // Set the mock database
    (mongodb as any).setMockDb(db);
  });

  afterAll(async () => {
    await client.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = await db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
      await collection.dropIndexes();
    }
  });

  it('should add role field to existing users without role', async () => {
    // Insert test users without role field
    const users = db.collection('users');
    await users.insertMany([
      { email: 'user1@test.com', name: 'User 1', password: 'hash1' },
      { email: 'user2@test.com', name: 'User 2', password: 'hash2' },
      { email: 'user3@test.com', name: 'User 3', password: 'hash3' },
    ]);

    // Run migration
    const result = await migrateAdminRoleSetup();

    // Verify users were updated
    expect(result.usersUpdated).toBe(3);

    // Verify all users now have role='regular'
    const updatedUsers = await users.find({}).toArray();
    expect(updatedUsers).toHaveLength(3);
    updatedUsers.forEach(user => {
      expect(user.role).toBe('regular');
    });
  });

  it('should not update users that already have a role', async () => {
    // Insert test users with role field
    const users = db.collection('users');
    await users.insertMany([
      { email: 'admin@test.com', name: 'Admin', password: 'hash1', role: 'admin' },
      { email: 'user@test.com', name: 'User', password: 'hash2', role: 'regular' },
    ]);

    // Run migration
    const result = await migrateAdminRoleSetup();

    // Verify no users were updated
    expect(result.usersUpdated).toBe(0);

    // Verify roles remain unchanged
    const admin = await users.findOne({ email: 'admin@test.com' });
    expect(admin?.role).toBe('admin');

    const user = await users.findOne({ email: 'user@test.com' });
    expect(user?.role).toBe('regular');
  });

  it('should create index on users.role field', async () => {
    const users = db.collection('users');

    // Run migration
    const result = await migrateAdminRoleSetup();

    // Verify index was created
    expect(result.indexesCreated).toContain('users.role');

    // Check indexes exist
    const indexes = await users.indexes();
    const roleIndex = indexes.find(idx => idx.key.role === 1);
    expect(roleIndex).toBeDefined();
  });

  it('should create SystemConfig collection indexes', async () => {
    // Run migration
    const result = await migrateAdminRoleSetup();

    // Verify indexes were created
    expect(result.indexesCreated).toContain('systemconfigs.key (unique)');
    expect(result.indexesCreated).toContain('systemconfigs.category');

    // Check indexes exist
    const systemConfigs = db.collection('systemconfigs');
    const indexes = await systemConfigs.indexes();

    const keyIndex = indexes.find(idx => idx.key.key === 1);
    expect(keyIndex).toBeDefined();
    expect(keyIndex?.unique).toBe(true);

    const categoryIndex = indexes.find(idx => idx.key.category === 1);
    expect(categoryIndex).toBeDefined();
  });

  it('should create AuditLog admin-specific indexes', async () => {
    // Run migration
    const result = await migrateAdminRoleSetup();

    // Verify indexes were created
    expect(result.indexesCreated).toContain('auditlogs.adminId_timestamp');
    expect(result.indexesCreated).toContain('auditlogs.adminId_operationType_timestamp');
    expect(result.indexesCreated).toContain('auditlogs.targetUserId_timestamp');

    // Check indexes exist
    const auditLogs = db.collection('auditlogs');
    const indexes = await auditLogs.indexes();

    const adminIdTimestampIndex = indexes.find(
      idx => idx.key.adminId === 1 && idx.key.timestamp === -1 && !idx.key.operationType
    );
    expect(adminIdTimestampIndex).toBeDefined();

    const adminIdOperationTypeTimestampIndex = indexes.find(
      idx => idx.key.adminId === 1 && idx.key.operationType === 1 && idx.key.timestamp === -1
    );
    expect(adminIdOperationTypeTimestampIndex).toBeDefined();

    const targetUserIdTimestampIndex = indexes.find(
      idx => idx.key.targetUserId === 1 && idx.key.timestamp === -1
    );
    expect(targetUserIdTimestampIndex).toBeDefined();
  });

  it('should be idempotent - safe to run multiple times', async () => {
    // Insert test users
    const users = db.collection('users');
    await users.insertMany([
      { email: 'user1@test.com', name: 'User 1', password: 'hash1' },
      { email: 'user2@test.com', name: 'User 2', password: 'hash2' },
    ]);

    // Run migration first time
    const result1 = await migrateAdminRoleSetup();
    expect(result1.usersUpdated).toBe(2);
    expect(result1.success).toBe(true);

    // Run migration second time
    const result2 = await migrateAdminRoleSetup();
    expect(result2.usersUpdated).toBe(0); // No users to update
    expect(result2.success).toBe(true);

    // Verify users still have correct role
    const allUsers = await users.find({}).toArray();
    expect(allUsers).toHaveLength(2);
    allUsers.forEach(user => {
      expect(user.role).toBe('regular');
    });
  });

  it('should return success status and summary', async () => {
    // Run migration
    const result = await migrateAdminRoleSetup();

    // Verify result structure
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('usersUpdated');
    expect(result).toHaveProperty('indexesCreated');
    expect(result).toHaveProperty('errors');

    expect(result.success).toBe(true);
    expect(Array.isArray(result.indexesCreated)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
