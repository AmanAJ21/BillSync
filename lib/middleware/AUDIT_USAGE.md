# Audit Logging Middleware Usage Guide

The audit logging middleware automatically tracks all admin operations with detailed information about what was changed, who made the change, and when it occurred.

## Basic Usage

### Wrapping Route Handlers

Use the `auditLog` function to wrap your route handlers:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auditLog } from '@/lib/middleware';

// Example: Bill creation endpoint
export const POST = auditLog(
  { operationType: 'bill_create', entityType: 'bill' },
  async (request: NextRequest) => {
    // Your handler logic here
    const body = await request.json();
    
    // Create bill...
    const bill = await createBill(body);
    
    return NextResponse.json({ success: true, bill }, { status: 201 });
  }
);
```

### Available Operation Types

The middleware supports the following operation types:

- `bill_create` - Creating a new bill
- `bill_update` - Updating an existing bill
- `bill_delete` - Deleting a bill
- `bill_bulk_update` - Bulk updating multiple bills
- `bill_bulk_delete` - Bulk deleting multiple bills
- `template_create` - Creating a bill template
- `template_update` - Updating a bill template
- `template_delete` - Deleting a bill template
- `user_role_change` - Changing a user's role
- `user_create` - Creating a new user
- `config_update` - Updating system configuration
- `data_export` - Exporting data

### Available Entity Types

- `bill` - Bill entities
- `bill_template` - Bill template entities
- `user` - User entities
- `system_config` - System configuration entities

## What Gets Logged

The middleware automatically captures:

1. **Admin Information**: ID of the admin performing the action
2. **Operation Details**: HTTP method, URL path, operation type
3. **Entity Information**: Type and ID of the entity being modified
4. **Target User**: User affected by the operation (extracted from body or URL)
5. **Request Details**: Sanitized request body, IP address, user agent
6. **Timing**: Duration of the operation in milliseconds
7. **Status**: Success/failure status

## Automatic Features

### Entity ID Extraction

The middleware automatically extracts entity IDs from URL patterns:

- `/api/admin/bills/[billId]` → extracts `billId`
- `/api/admin/templates/[templateId]` → extracts `templateId`
- `/api/admin/users/[userId]` → extracts `userId`
- `/api/admin/config/[key]` → extracts `key`

### Target User ID Extraction

The middleware automatically extracts target user IDs from:

- Request body `userId` field
- URL path for user-specific operations

### Sensitive Data Sanitization

The following fields are automatically redacted from logs:

- `password`
- `token`
- `secret`
- `apiKey`
- `creditCard`
- `cvv`

## Advanced Usage: State Tracking

For update operations where you need to track before/after state:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAuditLogWithState } from '@/lib/middleware';

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const billId = extractBillId(request);
  
  // Get current state
  const currentBill = await getBill(billId);
  const beforeState = {
    amount: currentBill.amount,
    status: currentBill.status,
  };
  
  // Update bill
  const updatedBill = await updateBill(billId, body);
  const afterState = {
    amount: updatedBill.amount,
    status: updatedBill.status,
  };
  
  // Create audit log with state tracking
  await createAuditLogWithState(
    'admin123', // Admin ID
    'bill_update',
    'bill',
    billId,
    beforeState,
    afterState,
    request
  );
  
  return NextResponse.json({ success: true, bill: updatedBill });
}
```

## Examples

### Example 1: Bill Creation

```typescript
export const POST = auditLog(
  { operationType: 'bill_create', entityType: 'bill' },
  async (request: NextRequest) => {
    const { userId, provider, amount, dueDate } = await request.json();
    
    const bill = await Bill.create({
      userId,
      provider,
      amount,
      dueDate,
    });
    
    return NextResponse.json({ success: true, bill }, { status: 201 });
  }
);
```

### Example 2: Bill Update

```typescript
export const PUT = auditLog(
  { operationType: 'bill_update', entityType: 'bill' },
  async (request: NextRequest, { params }: { params: { billId: string } }) => {
    const updates = await request.json();
    
    const bill = await Bill.findByIdAndUpdate(
      params.billId,
      updates,
      { new: true }
    );
    
    return NextResponse.json({ success: true, bill });
  }
);
```

### Example 3: User Role Change

```typescript
export const PATCH = auditLog(
  { operationType: 'user_role_change', entityType: 'user' },
  async (request: NextRequest, { params }: { params: { userId: string } }) => {
    const { role } = await request.json();
    
    const user = await User.findByIdAndUpdate(
      params.userId,
      { role },
      { new: true }
    );
    
    return NextResponse.json({ success: true, user });
  }
);
```

### Example 4: Bulk Operations

```typescript
export const POST = auditLog(
  { operationType: 'bill_bulk_delete', entityType: 'bill' },
  async (request: NextRequest) => {
    const { billIds } = await request.json();
    
    const results = await Promise.all(
      billIds.map(async (id) => {
        try {
          await Bill.findByIdAndDelete(id);
          return { billId: id, success: true };
        } catch (error) {
          return { billId: id, success: false, error: error.message };
        }
      })
    );
    
    return NextResponse.json({ success: true, results });
  }
);
```

## Important Notes

1. **Only Successful Operations**: Audit logs are only created for successful operations (2xx status codes)
2. **Error Handling**: If audit log creation fails, the error is logged but doesn't affect the response
3. **Authentication Required**: The middleware extracts admin ID from authenticated user
4. **Automatic Timestamps**: Timestamps are automatically added to all audit logs
5. **Immutable Logs**: Audit logs cannot be modified or deleted once created

## Querying Audit Logs

Audit logs can be queried through the admin API:

```typescript
// Get all audit logs for an admin
GET /api/admin/audit-logs?adminId=admin123

// Get audit logs by operation type
GET /api/admin/audit-logs?operationType=bill_update

// Get audit logs by date range
GET /api/admin/audit-logs?startDate=2024-01-01&endDate=2024-01-31

// Get audit logs for a specific user
GET /api/admin/audit-logs?targetUserId=user123
```

## Compliance

The audit logging middleware helps meet compliance requirements:

- **Requirement 7.1**: Logs all admin operations with timestamp, admin ID, and affected entity
- **Requirement 7.2**: Tracks before/after state for configuration changes
- **Requirement 7.3**: Stores logs for at least 90 days (retention policy configured separately)
- **Requirement 7.5**: Prevents modification or deletion of audit logs
