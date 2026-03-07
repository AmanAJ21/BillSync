import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/middleware/role';
import connectDB from '../../../../../lib/mongoose';
import { getDatabase } from '../../../../../lib/mongodb';
import AuditLog from '../../../../../lib/models/AuditLog';

/**
 * GET /api/admin/dashboard/stats
 * Get summary statistics and recent activity for admin dashboard
 * Requires admin role
 * Validates: Requirements 9.2
 */
export async function GET(request: NextRequest) {
  // Check admin authorization
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck; // Return error response
  }

  try {
    await connectDB();
    const db = await getDatabase();

    // Get collections
    const users = db.collection('users');
    const bills = db.collection('bills');
    const autoPaymentRecords = db.collection('autopaymentrecords');

    // Calculate statistics in parallel
    const [
      totalUsers,
      totalBills,
      pendingBills,
      totalRevenue,
      recentActivity
    ] = await Promise.all([
      // Total users count
      users.countDocuments(),

      // Total bills count
      bills.countDocuments(),

      // Pending bills count
      bills.countDocuments({ status: 'pending' }),

      // Total revenue from successful payments
      autoPaymentRecords.aggregate([
        { $match: { status: { $in: ['success', 'settled'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).toArray().then(result => result[0]?.total || 0),

      // Recent admin activity (last 10 activities)
      AuditLog.find({
        adminId: { $exists: true, $ne: null }
      })
        .sort({ timestamp: -1 })
        .limit(10)
        .select('adminId operationType entityType timestamp details')
        .lean()
    ]);

    // Format recent activity for response
    const formattedActivity = recentActivity.map(activity => ({
      id: activity._id,
      adminId: activity.adminId,
      action: activity.operationType,
      entityType: activity.entityType,
      timestamp: activity.timestamp,
      description: generateActivityDescription(activity)
    }));

    return NextResponse.json({
      totalUsers,
      totalBills,
      pendingBills,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      recentActivity: formattedActivity
    });
  } catch (error) {
    console.error('Error fetching dashboard statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}

/**
 * Generate human-readable description for admin activity
 */
function generateActivityDescription(activity: any): string {
  const { operationType, entityType, details } = activity;

  switch (operationType) {
    case 'bill_create':
      return `Created bill for ${details?.provider || 'unknown provider'}`;
    case 'bill_update':
      return `Updated bill ${details?.billId || 'unknown bill'}`;
    case 'bill_delete':
      return `Deleted bill ${details?.billId || 'unknown bill'}`;
    case 'bill_bulk_update':
      return `Bulk updated ${details?.count || 'multiple'} bills`;
    case 'bill_bulk_delete':
      return `Bulk deleted ${details?.count || 'multiple'} bills`;

    case 'user_role_change':
      return `Changed user role to ${details?.newRole || 'unknown role'}`;
    case 'user_create':
      return `Created new ${details?.role || 'user'} account`;
    case 'config_update':
      return `Updated system configuration "${details?.key || 'unknown config'}"`;
    case 'data_export':
      return `Exported ${entityType} data`;
    default:
      return `Performed ${operationType} on ${entityType}`;
  }
}

/**
 * POST, PUT, DELETE methods are not allowed for dashboard stats
 * This is a read-only endpoint
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Dashboard statistics are read-only.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Dashboard statistics are read-only.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Dashboard statistics are read-only.' },
    { status: 405 }
  );
}