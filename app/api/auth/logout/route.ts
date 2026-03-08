import { NextRequest, NextResponse } from 'next/server';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Validate internal request
  const validationError = validateInternalRequest(request);
  if (validationError) return validationError;
  const response = NextResponse.json({
    message: 'Logged out successfully',
  });

  // Clear the auth cookie
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
  });

  return addInternalHeaders(response, request);
}