import { describe, it, expect } from 'vitest';
import AuditLog from '../AuditLog';

describe('AuditLog Model', () => {

  it('should create an audit log with all required fields', async () => {
    const logData = {
      userId: 'user-123',
      operation: 'CREATE /api/bills',
      operationType: 'bill_create' as const,
      entityType: 'bill' as const,
      entityId: 'bill-456',
      details: { provider: 'Electric Company', amount: 150 },
      status: 'success' as const,
    };

    const log = await AuditLog.create(logData);

    expect(log).toBeDefined();
    expect(log.userId).toBe(logData.userId);
    expect(log.operation).toBe(logData.operation);
    expect(log.operationType).toBe(logData.operationType);
    expect(log.entityType).toBe(logData.entityType);
    expect(log.entityId).toBe(logData.entityId);
    expect(log.details).toEqual(logData.details);
    expect(log.status).toBe(logData.status);
    expect(log.timestamp).toBeDefined();
  });

  it('should create an audit log with admin-specific fields', async () => {
    const logData = {
      userId: 'user-123',
      adminId: 'admin-789',
      operation: 'UPDATE /api/admin/bills/bill-456',
      operationType: 'bill_update' as const,
      entityType: 'bill' as const,
      entityId: 'bill-456',
      targetUserId: 'user-123',
      details: { field: 'amount', action: 'update' },
      beforeState: { amount: 100, status: 'pending' },
      afterState: { amount: 150, status: 'pending' },
      status: 'success' as const,
    };

    const log = await AuditLog.create(logData);

    expect(log.adminId).toBe(logData.adminId);
    expect(log.targetUserId).toBe(logData.targetUserId);
    expect(log.beforeState).toEqual(logData.beforeState);
    expect(log.afterState).toEqual(logData.afterState);
  });

  it('should support all admin operation types', async () => {
    const adminOperationTypes = [
      'bill_create',
      'bill_update',
      'bill_delete',
      'bill_bulk_update',
      'bill_bulk_delete',
      'user_role_change',
      'user_create',
      'config_update',
      'data_export',
    ];

    for (const operationType of adminOperationTypes) {
      const log = await AuditLog.create({
        userId: 'admin-123',
        adminId: 'admin-123',
        operation: `TEST ${operationType}`,
        operationType: operationType as any,
        entityType: 'bill' as const,
        details: { test: true },
        status: 'success' as const,
      });

      expect(log.operationType).toBe(operationType);
    }
  });

  it('should support all existing payment operation types', async () => {
    const paymentOperationTypes = [
      'auto_payment_enable',
      'auto_payment_disable',
      'payment_attempt',
      'payment_success',
      'payment_failure',
      'payment_retry',
      'consolidated_bill_payment',
      'payment_method_update',
      'payment_method_expired',
    ];

    for (const operationType of paymentOperationTypes) {
      const log = await AuditLog.create({
        userId: 'user-123',
        operation: `TEST ${operationType}`,
        operationType: operationType as any,
        entityType: 'auto_payment_config' as const,
        details: { test: true },
        status: 'success' as const,
      });

      expect(log.operationType).toBe(operationType);
    }
  });

  it('should support all entity types including admin types', async () => {
    const entityTypes = [
      'auto_payment_config',
      'auto_payment_record',
      'consolidated_bill',
      'payment_method',
      'bill',
      'user',
      'system_config',
    ];

    for (const entityType of entityTypes) {
      const log = await AuditLog.create({
        userId: 'user-123',
        operation: `TEST ${entityType}`,
        operationType: 'bill_create' as const,
        entityType: entityType as any,
        details: { test: true },
        status: 'success' as const,
      });

      expect(log.entityType).toBe(entityType);
    }
  });

  it('should enforce required fields', async () => {
    const incompleteData = {
      userId: 'user-123',
      // Missing operation, operationType, entityType, details, status
    };

    await expect(AuditLog.create(incompleteData)).rejects.toThrow();
  });

  it('should reject invalid operation types', async () => {
    const invalidData = {
      userId: 'user-123',
      operation: 'TEST',
      operationType: 'invalid_operation_type',
      entityType: 'bill' as const,
      details: { test: true },
      status: 'success' as const,
    };

    await expect(AuditLog.create(invalidData)).rejects.toThrow();
  });

  it('should reject invalid entity types', async () => {
    const invalidData = {
      userId: 'user-123',
      operation: 'TEST',
      operationType: 'bill_create' as const,
      entityType: 'invalid_entity_type',
      details: { test: true },
      status: 'success' as const,
    };

    await expect(AuditLog.create(invalidData)).rejects.toThrow();
  });

  it('should reject invalid status values', async () => {
    const invalidData = {
      userId: 'user-123',
      operation: 'TEST',
      operationType: 'bill_create' as const,
      entityType: 'bill' as const,
      details: { test: true },
      status: 'invalid_status',
    };

    await expect(AuditLog.create(invalidData)).rejects.toThrow();
  });

  it('should store optional fields when provided', async () => {
    const logData = {
      userId: 'user-123',
      adminId: 'admin-789',
      operation: 'TEST',
      operationType: 'bill_create' as const,
      entityType: 'bill' as const,
      entityId: 'bill-456',
      targetUserId: 'user-999',
      details: { test: true },
      beforeState: { old: 'value' },
      afterState: { new: 'value' },
      status: 'success' as const,
      errorMessage: 'Test error',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    };

    const log = await AuditLog.create(logData);

    expect(log.adminId).toBe(logData.adminId);
    expect(log.entityId).toBe(logData.entityId);
    expect(log.targetUserId).toBe(logData.targetUserId);
    expect(log.beforeState).toEqual(logData.beforeState);
    expect(log.afterState).toEqual(logData.afterState);
    expect(log.errorMessage).toBe(logData.errorMessage);
    expect(log.ipAddress).toBe(logData.ipAddress);
    expect(log.userAgent).toBe(logData.userAgent);
  });

  it('should have index on userId field', async () => {
    const indexes = AuditLog.schema.indexes();
    const userIdIndex = indexes.find((index: any) =>
      index[0].userId === 1 && !index[0].timestamp
    );
    expect(userIdIndex).toBeDefined();
  });

  it('should have index on adminId field', async () => {
    const indexes = AuditLog.schema.indexes();
    const adminIdIndex = indexes.find((index: any) =>
      index[0].adminId === 1 && !index[0].timestamp
    );
    expect(adminIdIndex).toBeDefined();
  });

  it('should have index on targetUserId field', async () => {
    const indexes = AuditLog.schema.indexes();
    const targetUserIdIndex = indexes.find((index: any) =>
      index[0].targetUserId === 1 && !index[0].timestamp
    );
    expect(targetUserIdIndex).toBeDefined();
  });

  it('should have compound index on userId and timestamp', async () => {
    const indexes = AuditLog.schema.indexes();
    const compoundIndex = indexes.find((index: any) =>
      index[0].userId === 1 && index[0].timestamp === -1
    );
    expect(compoundIndex).toBeDefined();
  });

  it('should have compound index on adminId and timestamp', async () => {
    const indexes = AuditLog.schema.indexes();
    const compoundIndex = indexes.find((index: any) =>
      index[0].adminId === 1 && index[0].timestamp === -1
    );
    expect(compoundIndex).toBeDefined();
  });

  it('should have compound index on adminId, operationType, and timestamp', async () => {
    const indexes = AuditLog.schema.indexes();
    const compoundIndex = indexes.find((index: any) =>
      index[0].adminId === 1 &&
      index[0].operationType === 1 &&
      index[0].timestamp === -1
    );
    expect(compoundIndex).toBeDefined();
  });

  it('should have compound index on targetUserId and timestamp', async () => {
    const indexes = AuditLog.schema.indexes();
    const compoundIndex = indexes.find((index: any) =>
      index[0].targetUserId === 1 && index[0].timestamp === -1
    );
    expect(compoundIndex).toBeDefined();
  });

  it('should automatically set timestamp on creation', async () => {
    const beforeCreate = new Date();

    const log = await AuditLog.create({
      userId: 'user-123',
      operation: 'TEST',
      operationType: 'bill_create' as const,
      entityType: 'bill' as const,
      details: { test: true },
      status: 'success' as const,
    });

    const afterCreate = new Date();

    expect(log.timestamp).toBeDefined();
    expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(log.timestamp.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
  });

  it('should store complex details object', async () => {
    const complexDetails = {
      action: 'bulk_update',
      affectedBills: ['bill-1', 'bill-2', 'bill-3'],
      changes: {
        status: { from: 'pending', to: 'paid' },
        amount: { from: 100, to: 150 },
      },
      metadata: {
        requestId: 'req-123',
        duration: 250,
      },
    };

    const log = await AuditLog.create({
      userId: 'admin-123',
      adminId: 'admin-123',
      operation: 'BULK UPDATE',
      operationType: 'bill_bulk_update' as const,
      entityType: 'bill' as const,
      details: complexDetails,
      status: 'success' as const,
    });

    expect(log.details).toEqual(complexDetails);
  });

  it('should track config changes with before and after state', async () => {
    const log = await AuditLog.create({
      userId: 'admin-123',
      adminId: 'admin-123',
      operation: 'UPDATE /api/admin/config/payment.processor',
      operationType: 'config_update' as const,
      entityType: 'system_config' as const,
      entityId: 'payment.processor',
      details: { key: 'payment.processor', action: 'update' },
      beforeState: {
        value: 'stripe',
        lastModifiedBy: 'admin-100',
        lastModifiedAt: new Date('2024-01-01'),
      },
      afterState: {
        value: 'paypal',
        lastModifiedBy: 'admin-123',
        lastModifiedAt: new Date(),
      },
      status: 'success' as const,
    });

    expect(log.beforeState).toBeDefined();
    expect(log.afterState).toBeDefined();
    expect(log.beforeState?.value).toBe('stripe');
    expect(log.afterState?.value).toBe('paypal');
  });

  it('should track user role changes with target user', async () => {
    const log = await AuditLog.create({
      userId: 'admin-123',
      adminId: 'admin-123',
      operation: 'PATCH /api/admin/users/user-456/role',
      operationType: 'user_role_change' as const,
      entityType: 'user' as const,
      entityId: 'user-456',
      targetUserId: 'user-456',
      details: { action: 'role_change' },
      beforeState: { role: 'regular' },
      afterState: { role: 'admin' },
      status: 'success' as const,
    });

    expect(log.targetUserId).toBe('user-456');
    expect(log.beforeState?.role).toBe('regular');
    expect(log.afterState?.role).toBe('admin');
  });

  it('should log failed operations with error message', async () => {
    const log = await AuditLog.create({
      userId: 'admin-123',
      adminId: 'admin-123',
      operation: 'DELETE /api/admin/bills/bill-999',
      operationType: 'bill_delete' as const,
      entityType: 'bill' as const,
      entityId: 'bill-999',
      details: { error: 'Bill not found' },
      status: 'failure' as const,
      errorMessage: 'Bill with ID bill-999 does not exist',
    });

    expect(log.status).toBe('failure');
    expect(log.errorMessage).toBe('Bill with ID bill-999 does not exist');
  });
});
