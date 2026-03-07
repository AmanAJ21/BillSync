import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '../auth';
import { getDatabase } from '../mongodb';
import { ObjectId } from 'mongodb';

export interface AuthResult {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  error?: string;
}

/**
 * Verify authentication from request
 * Extracts JWT token from Authorization header or cookies
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    // Try to get token from Authorization header
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // Try to get token from cookies
      token = request.cookies.get('auth-token')?.value || null;
    }

    if (!token) {
      return {
        authenticated: false,
        error: 'No authentication token provided',
      };
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return {
        authenticated: false,
        error: 'Invalid or expired token',
      };
    }

    // Get user from database
    const db = await getDatabase();
    const users = db.collection('users');
    const user = await users.findOne({ _id: new ObjectId(decoded.userId) });

    if (!user) {
      return {
        authenticated: false,
        error: 'User not found',
      };
    }

    return {
      authenticated: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      },
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return {
      authenticated: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Verify user owns the resource
 * Checks if the authenticated user ID matches the resource owner ID
 */
export function verifyOwnership(authenticatedUserId: string, resourceUserId: string): boolean {
  return authenticatedUserId === resourceUserId;
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Create forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}
