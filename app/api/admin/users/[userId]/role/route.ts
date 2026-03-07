import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/middleware/role';
import { adminUserService } from '../../../../../../lib/services/AdminUserService';
import { verifyAuth } from '../../../../../../lib/middleware/auth';
import { handleError, errors } from '../../../../../../lib/middleware/errorHandler';
import { notifyRolePromotion } from '../../../../../../lib/email/admin-notifications';
import { z } from 'zod';

// Zod schema for role update validation
const updateRoleSchema = z.object({
  role: z.enum(['regular', 'admin'], {
    message: 'Role must be either "regular" or "admin"',
  }),
});

/**
 * PATCH /api/admin/users/[userId]/role
 * Update user role with email notification on promotion
 * Requires admin role
 * Validates: Requirements 12.3, 12.5
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // Check admin authorization
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck; // Return error response
  }

  try {
    const { userId } = await params;

    // Validate userId format (MongoDB ObjectId)
    if (!userId || userId.length !== 24) {
      return errors.badRequest('Invalid user ID format');
    }

    // Get authenticated admin user
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return errors.unauthorized('Authentication required');
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid JSON in request body');
    }

    // Validate with Zod
    const parseResult = updateRoleSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.issues
        .map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      return errors.badRequest(errorMessages);
    }

    const { role } = parseResult.data;

    // Prevent admin from changing their own role to regular
    if (userId === authResult.user.id && role === 'regular') {
      return errors.forbidden('Cannot change your own role to regular');
    }

    // Update user role
    const updatedUser = await adminUserService.updateUserRole(
      userId,
      role,
      authResult.user.id
    );

    if (!updatedUser) {
      return errors.notFound('User');
    }

    // Send email notification if user was promoted to admin
    let emailSent = false;
    if (role === 'admin' && updatedUser.email) {
      emailSent = await notifyRolePromotion(
        updatedUser.name || 'User',
        updatedUser.email,
        authResult.user.name || authResult.user.email || 'System Admin'
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      notifications: { emailSent },
    });
  } catch (error) {
    return handleError(error);
  }
}