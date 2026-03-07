'use client';

import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Wraps any page that requires authentication.
 * - While session is being verified → renders nothing (no skeleton flash).
 * - If unauthenticated after verification → redirects to /login.
 * - If authenticated → renders children normally.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Only redirect once the auth check is complete and user is still null
        if (!isLoading && !user) {
            router.replace('/login');
        }
    }, [isLoading, user, router]);

    // Show nothing while checking — avoids the skeleton hanging forever
    if (isLoading || !user) return null;

    return <>{children}</>;
}
