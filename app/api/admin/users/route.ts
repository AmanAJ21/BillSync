import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/middleware/role';
import { adminUserService } from '../../../../lib/services/AdminUserService';
import { verifyAuth } from '../../../../lib/middleware/auth';
import { handleError, errors } from '../../../../lib/middleware/errorHandler';
import { validateRequestBody } from '../../../../lib/middleware/validation';
import { sendUserCreationEmails } from '../../../../lib/email/admin-notifications';
import { z } from 'zod';

// Zod schema for user creation validation
const createUserSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name must not exceed 100 characters'),
  role: z.enum(['regular', 'admin'], {
    message: 'Role must be either "regular" or "admin"',
  }),
});

/**
 * GET /api/admin/users
 * Get all users with pagination and filtering
 * Requires admin role
 * Validates: Requirements 6.1, 6.2, 6.3
 */
export async function GET(request: NextRequest) {
  // Check admin authorization
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck; // Return error response
  }

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || undefined;
    const role = searchParams.get('role') as 'regular' | 'admin' | undefined;

    // Validate pagination parameters
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
      return errors.badRequest('Invalid pagination parameters. Page must be >= 1, limit must be 1-100');
    }

    // Validate role parameter if provided
    if (role && !['regular', 'admin'].includes(role)) {
      return errors.badRequest('Invalid role filter. Must be "regular" or "admin"');
    }

    // Get users with filters and pagination
    const result = await adminUserService.getAllUsers(
      { search, role },
      { page, limit }
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/admin/users
 * Create a new user account with email notification
 * Requires admin role
 * Validates: Requirements 12.1, 12.2, 12.3
 */
export async function POST(request: NextRequest) {
  // Check admin authorization
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck; // Return error response
  }

  try {
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

    // Validate request body with Zod schema
    const validation = await validateRequestBody(body, createUserSchema);
    if (!validation.success) {
      return errors.badRequest(validation.error);
    }

    const { email, password, name, role } = validation.data;

    // Create user - any error here is a real creation failure
    let newUser;
    try {
      newUser = await adminUserService.createUser(
        { email, password, name, role },
        authResult.user.id
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        return errors.conflict('User with this email already exists');
      }
      return handleError(error);
    }

    // Send email notification (non-blocking, errors should not affect response)
    let emailResult = { userNotified: false, adminsNotified: 0 };
    try {
      emailResult = await sendUserCreationEmails(
        { name, email, role },
        authResult.user.name || authResult.user.email || 'System Admin',
        authResult.user.id
      );
    } catch (emailError) {
      console.error('Failed to send user creation emails:', emailError);
    }

    // Return user without password
    const { password: _, ...userResponse } = newUser;
    return NextResponse.json(
      {
        success: true,
        user: userResponse,
        notifications: {
          userNotified: emailResult.userNotified,
          adminsNotified: emailResult.adminsNotified,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}