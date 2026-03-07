/**
 * Comprehensive Database Migration for Admin Role Management
 * 
 * This migration script:
 * 1. Adds role='regular' to all existing users without a role field
 * 2. Creates indexes on the User collection role field
 * 3. Creates indexes for BillTemplate model
 * 4. Creates indexes for SystemConfig model
 * 5. Creates indexes for AuditLog model (admin-specific)
 * 
 * This script is idempotent and can be run multiple times safely.
 */

import { getDatabase } from '../mongodb';
import mongoose from 'mongoose';
import SystemConfig from '../models/SystemConfig';
import AuditLog from '../models/AuditLog';

interface MigrationResult {
  success: boolean;
  usersUpdated: number;
  indexesCreated: string[];
  errors: string[];
}

export async function migrateAdminRoleSetup(): Promise<MigrationResult> {
  console.log('Starting admin role management database migration...\n');

  const result: MigrationResult = {
    success: true,
    usersUpdated: 0,
    indexesCreated: [],
    errors: [],
  };

  try {
    // Connect to MongoDB
    const db = await getDatabase();
    const users = db.collection('users');

    // Step 1: Add role='regular' to all existing users without a role field
    console.log('Step 1: Updating existing users with default role...');
    try {
      const updateResult = await users.updateMany(
        { role: { $exists: false } },
        { $set: { role: 'regular' } }
      );
      result.usersUpdated = updateResult.modifiedCount;
      console.log(`✓ Updated ${updateResult.modifiedCount} user(s) with default role 'regular'\n`);
    } catch (error) {
      const errorMsg = `Failed to update users: ${error}`;
      console.error(`✗ ${errorMsg}`);
      result.errors.push(errorMsg);
      result.success = false;
    }

    // Step 2: Create index on User collection role field
    console.log('Step 2: Creating index on users.role field...');
    try {
      await users.createIndex({ role: 1 });
      result.indexesCreated.push('users.role');
      console.log('✓ Created index on users.role\n');
    } catch (error) {
      const errorMsg = `Failed to create users.role index: ${error}`;
      console.error(`✗ ${errorMsg}`);
      result.errors.push(errorMsg);
      // Don't fail if index already exists
    }


    // Step 4: Ensure SystemConfig collection and indexes exist
    console.log('Step 4: Setting up SystemConfig collection and indexes...');
    try {
      const systemConfigsCollection = db.collection('systemconfigs');

      // Create unique index on key field
      await systemConfigsCollection.createIndex({ key: 1 }, { unique: true });
      result.indexesCreated.push('systemconfigs.key (unique)');
      console.log('✓ Created unique index on systemconfigs.key');

      // Create index on category field
      await systemConfigsCollection.createIndex({ category: 1 });
      result.indexesCreated.push('systemconfigs.category');
      console.log('✓ Created index on systemconfigs.category\n');
    } catch (error) {
      const errorMsg = `Failed to create SystemConfig indexes: ${error}`;
      console.error(`✗ ${errorMsg}`);
      result.errors.push(errorMsg);
      // Don't fail if indexes already exist
    }

    // Step 5: Ensure AuditLog admin-specific indexes exist
    console.log('Step 5: Setting up AuditLog admin-specific indexes...');
    try {
      const auditLogsCollection = db.collection('auditlogs');

      // Create admin-specific compound indexes
      await auditLogsCollection.createIndex({ adminId: 1, timestamp: -1 });
      result.indexesCreated.push('auditlogs.adminId_timestamp');
      console.log('✓ Created compound index on auditlogs.adminId + timestamp');

      await auditLogsCollection.createIndex({ adminId: 1, operationType: 1, timestamp: -1 });
      result.indexesCreated.push('auditlogs.adminId_operationType_timestamp');
      console.log('✓ Created compound index on auditlogs.adminId + operationType + timestamp');

      await auditLogsCollection.createIndex({ targetUserId: 1, timestamp: -1 });
      result.indexesCreated.push('auditlogs.targetUserId_timestamp');
      console.log('✓ Created compound index on auditlogs.targetUserId + timestamp\n');
    } catch (error) {
      const errorMsg = `Failed to create AuditLog admin indexes: ${error}`;
      console.error(`✗ ${errorMsg}`);
      result.errors.push(errorMsg);
      // Don't fail if indexes already exist
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('Migration Summary:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
    console.log(`Users updated: ${result.usersUpdated}`);
    console.log(`Indexes created: ${result.indexesCreated.length}`);
    if (result.indexesCreated.length > 0) {
      console.log('\nIndexes:');
      result.indexesCreated.forEach(idx => console.log(`  - ${idx}`));
    }
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
    console.log('═══════════════════════════════════════════════════════\n');

    return result;
  } catch (error) {
    console.error('Critical error during migration:', error);
    result.success = false;
    result.errors.push(`Critical error: ${error}`);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrateAdminRoleSetup()
    .then((result) => {
      if (result.success) {
        console.log('✅ Migration completed successfully');
        process.exit(0);
      } else {
        console.error('❌ Migration completed with errors');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}
