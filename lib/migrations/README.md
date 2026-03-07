# Database Migrations

This directory contains database migration scripts for BillSync.

## Available Migrations

### Admin Role Setup Migration (Comprehensive)

**File:** `admin-role-setup.ts`

**Purpose:** Complete database setup for the admin role management feature.

**Changes:**
- Adds `role` field with value `'regular'` to all existing users
- Creates index on `users.role` field for efficient queries
- Creates indexes for BillTemplate collection (`createdBy`, `name`)
- Creates indexes for SystemConfig collection (`key` unique, `category`)
- Creates admin-specific compound indexes for AuditLog collection

**How to Run:**

```bash
npm run migrate:admin-setup
```

Or directly with tsx:

```bash
npx tsx scripts/migrate-admin-role-setup.ts
```

**When to Run:**
- Before deploying the admin role management feature
- After updating models to include admin-specific fields
- Only needs to be run once

**Idempotency:**
The migration is fully idempotent - it safely handles existing data and indexes, so it's safe to run multiple times.

---

### User Role Migration (Legacy)

**File:** `add-user-role.ts`

**Purpose:** Adds the `role` field to the User model to support admin role management.

**Changes:**
- Adds `role` field with value `'regular'` to all existing users
- Creates an index on the `role` field for efficient queries

**How to Run:**

```bash
npm run migrate:user-role
```

Or directly with Node:

```bash
node scripts/migrate-user-role.js
```

**When to Run:**
- This is now superseded by the comprehensive `admin-role-setup` migration
- Use `admin-role-setup` instead for complete setup

**Idempotency:**
The migration is idempotent - it only updates users that don't already have a role field, so it's safe to run multiple times.

## Migration Best Practices

1. **Backup First:** Always backup your database before running migrations
2. **Test in Development:** Run migrations in a development environment first
3. **Check Results:** Verify the migration completed successfully by checking the database
4. **Monitor Performance:** For large databases, migrations may take time
5. **Review Output:** The migration provides detailed output about what was changed

## Verification

After running the admin-role-setup migration, verify the changes:

```javascript
// Connect to MongoDB and verify:

// 1. Check users have role field
db.users.findOne({})
// Should show: { ..., role: 'regular', ... }

// 2. Check indexes exist
db.users.getIndexes()
// Should include: { role: 1 }

// 3. Check BillTemplate collection exists
db.billtemplates.getIndexes()
// Should include: { createdBy: 1 }, { name: 1 }

// 4. Check SystemConfig collection exists
db.systemconfigs.getIndexes()
// Should include: { key: 1 } (unique), { category: 1 }

// 5. Check AuditLog admin indexes
db.auditlogs.getIndexes()
// Should include admin-specific compound indexes
```

## Rollback

If you need to rollback the admin role setup migration:

```javascript
// Connect to MongoDB and run:

// Remove role field from users
db.users.updateMany({}, { $unset: { role: "" } });

// Drop user role index
db.users.dropIndex({ role: 1 });

// Drop BillTemplate indexes (optional - only if you want to remove the collection)
db.billtemplates.dropIndex({ createdBy: 1 });
db.billtemplates.dropIndex({ name: 1 });

// Drop SystemConfig indexes (optional - only if you want to remove the collection)
db.systemconfigs.dropIndex({ key: 1 });
db.systemconfigs.dropIndex({ category: 1 });

// Drop AuditLog admin indexes (optional - keeps existing audit log functionality)
db.auditlogs.dropIndex({ adminId: 1, timestamp: -1 });
db.auditlogs.dropIndex({ adminId: 1, operationType: 1, timestamp: -1 });
db.auditlogs.dropIndex({ targetUserId: 1, timestamp: -1 });
```

## Troubleshooting

### Index Already Exists Error

If you see "Index already exists" errors, this is normal and expected. The migration handles this gracefully and continues.

### Connection Errors

Ensure your `.env.local` file has the correct `MONGODB_URI` configured:

```
MONGODB_URI=mongodb://localhost:27017/billsync
```

### Permission Errors

Ensure your MongoDB user has permissions to:
- Create indexes
- Update documents
- Create collections
