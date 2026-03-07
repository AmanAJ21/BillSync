/**
 * Migration script to add role field to existing users
 * This script:
 * 1. Adds role='regular' to all existing users without a role field
 * 2. Creates an index on the role field for efficient queries
 */

import { getDatabase } from '../mongodb';

export async function migrateUserRole() {
  console.log('Starting user role migration...');
  
  try {
    const db = await getDatabase();
    const users = db.collection('users');

    // Update all existing users without a role field
    const result = await users.updateMany(
      { role: { $exists: false } },
      { $set: { role: 'regular' } }
    );

    console.log(`Updated ${result.modifiedCount} users with default role 'regular'`);

    // Create index on role field for efficient queries
    await users.createIndex({ role: 1 });
    console.log('Created index on role field');

    console.log('User role migration completed successfully');
    return {
      success: true,
      modifiedCount: result.modifiedCount,
    };
  } catch (error) {
    console.error('Error during user role migration:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrateUserRole()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
