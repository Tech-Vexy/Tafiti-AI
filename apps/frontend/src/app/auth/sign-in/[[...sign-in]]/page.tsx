'use client';

import { SignIn } from '@clerk/nextjs';
import { dark } from '@clerk/themes';

export default function SignInPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
            <SignIn
                appearance={{ baseTheme: dark }}
                routing="path"
                path="/auth/sign-in"
                signUpUrl="/auth/sign-up"
                redirectUrl="/"
            />
        </div>
    );
}
