'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';
import useUserStore from '@/store/useUserStore';
import useResearchStore from '@/store/useResearchStore';
import useLibraryStore from '@/store/useLibraryStore';
import useUIStore from '@/store/useUIStore';

const DashboardContext = createContext<any>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser } = useUser();
  const { userProfile, getMergedUser, getTrialState } = useUserStore();
  const research = useResearchStore();
  const library = useLibraryStore();
  const ui = useUIStore();

  const mergedUser = getMergedUser();
  const trialState = getTrialState();

  return (
    <DashboardContext.Provider
      value={{
        user: mergedUser,
        clerkUser,
        userProfile,
        ...trialState,
        ...research,
        ...library,
        ...ui,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): any {
  const ctx = useContext(DashboardContext);
  return ctx || {};
}
