import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Trusted origins for CORS — covers Next.js dev, Expo web, and local network IPs
const ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:19006',
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // Same-origin / server-side requests (no Origin header)
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow any local network IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (/^192\.168\./.test(hostname)) return true;
    if (/^10\./.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  } catch {
    // ignore malformed origin
  }
  return false;
}

function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : 'null';
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');

  // Handle CORS preflight (OPTIONS) for all API routes immediately
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    const preflight = new NextResponse(null, { status: 204 });
    return addCorsHeaders(preflight, origin);
  }

  // API routes — allow same-origin and trusted cross-origins (Expo), block everything else
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/webhooks/')) {
    if (origin && !isAllowedOrigin(origin)) {
      return NextResponse.json(
        { error: 'Forbidden: External access not allowed' },
        { status: 403 }
      );
    }
    // Attach CORS headers to all API responses
    const response = NextResponse.next();
    return addCorsHeaders(response, origin);
  }

  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard'];

  // Auth routes that should redirect if already logged in
  const authRoutes = ['/login', '/signup'];

  const token = request.cookies.get('auth-token')?.value;

  // Redirect authenticated users away from auth pages
  if (authRoutes.includes(pathname) && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users to login
  if (protectedRoutes.some(route => pathname.startsWith(route)) && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*', '/login', '/signup']
};
