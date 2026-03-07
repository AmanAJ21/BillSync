import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { auditLog, createAuditLogWithState } from '../audit';
import AuditLog from '../../models/AuditLog';
import * as authMiddleware from '../auth';

// Mock dependencies
vi.mock('../../models/AuditLog');
vi.mock('../auth');

describe('Audit Logging Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('auditLog middleware wrapper', () => {
    it('should create audit log for successful admin operation', async () => {
      // Mock authenticated admin user
      vi.mocked(authMiddleware.verifyAuth).mockResolvedValue({
        authenticated: true,
        user: {
          id: 'admin123',
          email: 'admin@test.com',
          name: 'Admin User',
        },
      });

      // Mock AuditLog.create
      const mockCreate = vi.fn().mockResolvedValue({});
      vi.mocked(AuditLog.create).mockImplementation(mockCreate);

      // Create a mock handler that returns success
      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true }, { status: 200 })
      );

      // Wrap handler with audit logging
      const wrappedHandler = auditLog(
        { operationType: 'bill_create', entityType: 'bill' },
        mockHandler
      );

      // Create mock request
      const request = new NextRequest('http://localhost:3000/api/admin/bills', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'test-agent',
          'x-forwarded-for': '127.0.0.1',
        },
        body: JSON.stringify({ userId: 'user123', amount: 100 }),
      });

      // Execute wrapped handler
      const response = await wrappedHandler(request);

      // Verify handler was called
      expect(mockHandler).toHaveBeenCalledWith(request, undefined);

      // Verify response is successful
      expect(response.status).toBe(200);

      // Verify audit log was created
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin123',
          adminId: 'admin123',
          operation: 'POST /api/admin/bills',
          operationType: 'bill_create',
          entityType: 'bill',
          status: 'success',
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        })
      );
    });

    it('should include request timing in audit log', async () => {
      vi.mocked(authMiddleware.verifyAuth).mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', name: 'Admin' },
      });

      const mockCreate = vi.fn().mockResolvedValue({});
      vi.mocked(AuditLog.create).mockImplementation(mockCreate);

      const mockHandler = vi.fn().mockImplementation(async () => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        return NextResponse.json({ success: true }, { status: 200 });
      });

      const wrappedHandler = auditLog(
        { operationType: 'bill_update', entityType: 'bill' },
        mockHandler
      );

      const request = new NextRequest('http://localhost:3000/api/admin/bills/bill123', {
        method: 'PUT',
      });

      await wrappedHandler(request);

      // Verify duration is included in details
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            duration: expect.any(Number),
          }),
        })
      );

      // Verify duration is reasonable (at least 10ms)
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.details.duration).toBeGreaterThanOrEqual(10);
    });

    it('should extract entity ID from URL path', async () => {
      vi.mocked(authMiddleware.verifyAuth).mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', name: 'Admin' },
      });

      const mockCreate = vi.fn().mockResolvedValue({});
      vi.mocked(AuditLog.create).mockImplementation(mockCreate);

      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true }, { status: 200 })
      );

      const wrappedHandler = auditLog(
        { operationType: 'bill_delete', entityType: 'bill' },
        mockHandler
      );

      const request = new NextRequest('http://localhost:3000/api/admin/bills/bill456', {
        method: 'DELETE',
      });

      await wrappedHandler(request);

      // Verify entity ID was extracted
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'bill456',
        })
      );
    });

    it('should extract target user ID from request body', async () => {
      vi.mocked(authMiddleware.verifyAuth).mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', name: 'Admin' },
      });

      const mockCreate = vi.fn().mockResolvedValue({});
      vi.mocked(AuditLog.create).mockImplementation(mockCreate);

      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true }, { status: 201 })
      );

      const wrappedHandler = auditLog(
        { operationType: 'bill_create', entityType: 'bill' },
        mockHandler
      );

      const request = new NextRequest('http://localhost:3000/api/admin/bills', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user789', amount: 200 }),
      });

      await wrappedHandler(request);

      // Verify target user ID was extracted
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUserId: 'user789',
        })
      );
    });

    it('should sanitize sensitive data from request body', async () => {
      vi.mocked(authMiddleware.verifyAuth).mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', name: 'Admin' },
      });

      const mockCreate = vi.fn().mockResolvedValue({});
      vi.mocked(AuditLog.create).mockImplementation(mockCreate);

      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true }, { status: 201 })
      );

      const wrappedHandler = auditLog(
        { operationType: 'user_create', entityType: 'user' },
        mockHandler
      );

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'newuser@test.com',
          password: 'secretPassword123',
          name: 'New User',
        }),
      });

      await wrappedHandler(request);

      // Verify password was redacted
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            body: expect.objectContaining({
              email: 'newuser@test.com',
              password: '[REDACTED]',
              name: 'New User',
            }),
          }),
        })
      );
    });

    it('should not create audit log for failed operations', async () => {
      vi.mocked(authMiddleware.verifyAuth).mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', name: 'Admin' },
      });

      const mockCreate = vi.fn().mockResolvedValue({});
      vi.mocked(AuditLog.create).mockImplementation(mockCreate);

      // Mock handler that returns error
      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ error: 'Not found' }, { status: 404 })
      );

      const wrappedHandler = auditLog(
        { operationType: 'bill_update', entityType: 'bill' },
        mockHandler
      );

      const request = new NextRequest('http://localhost:3000/api/admin/bills/bill999', {
        method: 'PUT',
      });

      const response = await wrappedHandler(request);

      // Verify handler was called
      expect(mockHandler).toHaveBeenCalled();

      // Verify response is error
      expect(response.status).toBe(404);

      // Verify audit log was NOT created
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should handle audit log creation failure gracefully', async () => {
      vi.mocked(authMiddleware.verifyAuth).mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', name: 'Admin' },
      });

      // Mock AuditLog.create to throw error
      vi.mocked(AuditLog.create).mockRejectedValue(new Error('Database error'));

      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true }, { status: 200 })
      );

      const wrappedHandler = auditLog(
        { operationType: 'bill_create', entityType: 'bill' },
        mockHandler
      );

      const request = new NextRequest('http://localhost:3000/api/admin/bills', {
        method: 'POST',
      });

      // Should not throw error even if audit log creation fails
      const response = await wrappedHandler(request);

      // Verify response is still successful
      expect(response.status).toBe(200);
    });

    it('should handle non-JSON request body gracefully', async () => {
      vi.mocked(authMiddleware.verifyAuth).mockResolvedValue({
        authenticated: true,
        user: { id: 'admin123', email: 'admin@test.com', name: 'Admin' },
      });

      const mockCreate = vi.fn().mockResolvedValue({});
      vi.mocked(AuditLog.create).mockImplementation(mockCreate);

      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true }, { status: 200 })
      );

      const wrappedHandler = auditLog(
        { operationType: 'data_export', entityType: 'bill' },
        mockHandler
      );

      // Request with non-JSON body
      const request = new NextRequest('http://localhost:3000/api/admin/export/bills', {
        method: 'POST',
        body: 'plain text body',
      });

      await wrappedHandler(request);

      // Should still create audit log with null body
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            body: {},
          }),
        })
      );
    });
  });

  describe('createAuditLogWithState', () => {
    it('should create audit log with before and after state', async () => {
      const mockCreate = vi.fn().mockResolvedValue({});
      vi.mocked(AuditLog.create).mockImplementation(mockCreate);

      const request = new NextRequest('http://localhost:3000/api/admin/bills/bill123', {
        method: 'PUT',
        headers: {
          'user-agent': 'test-agent',
          'x-forwarded-for': '192.168.1.1',
        },
      });

      const beforeState = { amount: 100, status: 'pending' };
      const afterState = { amount: 150, status: 'paid' };

      await createAuditLogWithState(
        'admin123',
        'bill_update',
        'bill',
        'bill123',
        beforeState,
        afterState,
        request
      );

      // Verify audit log was created with state tracking
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin123',
          adminId: 'admin123',
          operationType: 'bill_update',
          entityType: 'bill',
          entityId: 'bill123',
          beforeState: beforeState,
          afterState: afterState,
          status: 'success',
          ipAddress: '192.168.1.1',
          userAgent: 'test-agent',
        })
      );
    });

    it('should handle audit log creation failure gracefully', async () => {
      vi.mocked(AuditLog.create).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/admin/config/key1', {
        method: 'PUT',
      });

      // Should not throw error
      await expect(
        createAuditLogWithState(
          'admin123',
          'config_update',
          'system_config',
          'key1',
          { value: 'old' },
          { value: 'new' },
          request
        )
      ).resolves.not.toThrow();
    });
  });
});
