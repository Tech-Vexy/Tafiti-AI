'use client';

import { createContext, useContext } from 'react';
import { useUser } from '@clerk/nextjs';
import useUserStore from '@/store/useUserStore';
import useResearchStore from '@/store/useResearchStore';
import useLibraryStore from '@/store/useLibraryStore';
import useUIStore from '@/store/useUIStore';

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
    const { user: clerkUser } = useUser();
    const { userProfile, getMergedUser, getTrialState } = useUserStore();
    const research = useResearchStore();
    const library = useLibraryStore();
    const ui = useUIStore();

    const mergedUser = getMergedUser();
    const trialState = getTrialState();

    return (
        <DashboardContext.Provider value={{
            user: mergedUser,
            clerkUser,
            userProfile,
            ...trialState,
            ...research,
            ...library,
            ...ui,
        }}>
            {children}
        </DashboardContext.Provider>
    );
}

export function useDashboard() {
    const ctx = useContext(DashboardContext);
    return ctx || {};
}
