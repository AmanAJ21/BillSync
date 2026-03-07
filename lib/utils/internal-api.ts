import { NextRequest, NextResponse } from 'next/server';

// List of allowed origins (same as middleware)
const ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:19006',
];

function isAllowedOrigin(origin: string | null, host: string | null): boolean {
  if (!origin) return true; // No origin = same-origin or server-side call
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Same host (normal browser same-origin)
  try {
    if (host && new URL(origin).host === host) return true;
  } catch { /* ignore */ }
  // Allow any local-network IP
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (/^192\.168\./.test(hostname)) return true;
    if (/^10\./.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  } catch { /* ignore */ }
  return false;
}

/**
 * Validates that the request comes from a trusted origin.
 * Returns a 403 response if blocked, null if allowed.
 */
export function validateInternalRequest(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  if (!isAllowedOrigin(origin, host)) {
    return NextResponse.json(
      { error: 'Forbidden: External access not allowed' },
      { status: 403 }
    );
  }

  return null; // Valid request
}

/**
 * Add CORS headers to a response so the Expo app (and browser) can read it.
 */
export function addInternalHeaders(response: NextResponse, request?: NextRequest): NextResponse {
  const origin = request?.headers.get('origin') ?? null;
  const host = request?.headers.get('host') ?? null;

  const allowedOrigin = origin && isAllowedOrigin(origin, host) ? origin : 'same-origin';

  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  return response;
}
