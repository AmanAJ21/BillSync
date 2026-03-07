import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

/**
 * Helper function to authenticate API requests.
 * Accepts BOTH:
 *   - Cookie-based auth (web browser same-origin sessions): auth-token cookie
 *   - Bearer token auth (mobile / Expo app):  Authorization: Bearer <token>
 */
export function authenticateRequest(request: NextRequest): { userId: string; error?: never } | { userId?: never; error: NextResponse } {

  // 1. Try cookie first (web sessions)
  let rawToken = request.cookies.get('auth-token')?.value ?? null;

  // 2. Fall back to Authorization: Bearer <token> header (mobile / Expo)
  if (!rawToken) {
    const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      rawToken = authHeader.slice(7).trim();
    }
  }

  if (!rawToken) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    };
  }

  const decoded = verifyToken(rawToken);
  if (!decoded) {
    return {
      error: NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    };
  }

  return { userId: decoded.userId };
}
