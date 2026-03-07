import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/middleware/role';
import { adminUserService } from '../../../../../lib/services/AdminUserService';
import { verifyAuth } from '../../../../../lib/middleware/auth';
import { handleError, errors } from '../../../../../lib/middleware/errorHandler';

/**
 * GET /api/admin/users/[userId]
 * Get detailed user information
 * Requires admin role
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck;
  }

  try {
    const { userId } = await params;

    if (!userId || userId.length !== 24) {
      return errors.badRequest('Invalid user ID format');
    }

    const userDetails = await adminUserService.getUserDetails(userId);

    if (!userDetails) {
      return errors.notFound('User');
    }

    return NextResponse.json({
      user: userDetails,
      billCount: userDetails.billCount,
      lastLogin: userDetails.lastLogin || null
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT /api/admin/users/[userId]
 * Update user details (name, email, role)
 * Requires admin role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck;
  }

  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return errors.unauthorized('Authentication required');
    }

    const { userId } = await params;

    if (!userId || userId.length !== 24) {
      return errors.badRequest('Invalid user ID format');
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid JSON in request body');
    }

    const { name, email, role } = body;

    // Validate at least one field is provided
    if (!name && !email && !role) {
      return errors.badRequest('At least one field (name, email, or role) must be provided');
    }

    // Validate fields if provided
    if (name !== undefined && (typeof name !== 'string' || name.length < 2 || name.length > 100)) {
      return errors.badRequest('Name must be between 2 and 100 characters');
    }

    if (email !== undefined && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return errors.badRequest('Invalid email format');
    }

    if (role !== undefined && !['regular', 'admin'].includes(role)) {
      return errors.badRequest('Role must be either "regular" or "admin"');
    }

    let updatedUser;
    try {
      updatedUser = await adminUserService.updateUser(
        userId,
        { name, email, role },
        authResult.user.id
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        return errors.conflict('User with this email already exists');
      }
      throw error;
    }

    if (!updatedUser) {
      return errors.notFound('User');
    }

    return NextResponse.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/admin/users/[userId]
 * Delete a user
 * Requires admin role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck;
  }

  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return errors.unauthorized('Authentication required');
    }

    const { userId } = await params;

    if (!userId || userId.length !== 24) {
      return errors.badRequest('Invalid user ID format');
    }

    let deleted;
    try {
      deleted = await adminUserService.deleteUser(userId, authResult.user.id);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot delete your own account')) {
        return errors.badRequest('Cannot delete your own account');
      }
      throw error;
    }

    if (!deleted) {
      return errors.notFound('User');
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    return handleError(error);
  }
}