import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for the BillSync application
 * Handles:
 * 1. API Protection (Blocking external access to internal APIs)
 * 2. Auth Route Protection (Redirecting authenticated users away from login/signup)
 * 3. Dashboard Protection (Redirecting unauthenticated users to login)
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. API Protection: Block external access to internal APIs (except webhooks and cron)
    if (pathname.startsWith('/api/') &&
        !pathname.startsWith('/api/webhooks/') &&
        !pathname.startsWith('/api/cron/')) {

        const origin = request.headers.get('origin');
        const referer = request.headers.get('referer');
        const host = request.headers.get('host');

        // Check if request is from an external source
        if (origin || referer) {
            const requestOrigin = origin ? new URL(origin).host : referer ? new URL(referer).host : null;

            // If the origin is different from the host, it's likely an external call
            if (requestOrigin && requestOrigin !== host) {
                // Allow common development origins if needed, but for production, we block
                return NextResponse.json(
                    { error: 'Forbidden: External access not allowed' },
                    { status: 403 }
                );
            }
        }
    }

    // 2. Protected routes that require authentication
    const protectedPaths = ['/dashboard', '/admin', '/profile'];

    // 3. Auth routes that should redirect if already logged in
    const authPaths = ['/login', '/signup', '/forgot-password'];

    const token = request.cookies.get('auth-token')?.value;

    // Redirect authenticated users away from auth pages
    if (authPaths.some(path => pathname.startsWith(path)) && token) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Redirect unauthenticated users to login for protected routes
    if (protectedPaths.some(path => pathname.startsWith(path)) && !token) {
        // Store the intended destination to redirect back after login
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

/**
 * Config for the middleware
 * Specifies which routes this middleware should run on
 */
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
