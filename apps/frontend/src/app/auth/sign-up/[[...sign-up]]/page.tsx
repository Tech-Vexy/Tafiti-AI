'use client';

import { SignUp } from '@clerk/nextjs';
import { dark } from '@clerk/themes';

export default function SignUpPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
            <SignUp
                appearance={{ baseTheme: dark }}
                routing="path"
                path="/auth/sign-up"
                signInUrl="/auth/sign-in"
                redirectUrl="/"
            />
        </div>
    );
}
