import React from 'react';
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import DashboardClientShell from './DashboardClientShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { userId } = await auth();
    if (!userId) {
        redirect('/auth/sign-in');
    }

    const user = await currentUser();
    const initialUser = user ? {
        id: user.id,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Researcher',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        username: user.username || '',
        imageUrl: user.imageUrl || '',
        email: user.emailAddresses?.[0]?.emailAddress || '',
    } : null;

    return (
        <DashboardClientShell initialUser={initialUser}>
            {children}
        </DashboardClientShell>
    );
}
