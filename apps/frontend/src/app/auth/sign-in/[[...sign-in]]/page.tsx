'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SignIn, useAuth } from '@clerk/nextjs';
import { dark } from '@clerk/themes';

export default function SignInPage() {
    const { isSignedIn, isLoaded } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (isLoaded && isSignedIn) {
            router.replace('/research');
            return;
        }

        // Clean out force_redirect query params that cause Clerk to escalate to strict Turnstile CAPTCHA on localhost
        if (typeof window !== 'undefined' && window.location.search.includes('force_redirect_url')) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [isLoaded, isSignedIn, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
            <SignIn
                appearance={{ baseTheme: dark }}
                routing="path"
                path="/auth/sign-in"
                signUpUrl="/auth/sign-up"
                fallbackRedirectUrl="/research"
            />
        </div>
    );
}
