'use client';

import { useEffect } from 'react';
import { useUserStore } from '@/stores/user-store';
import { Navigation } from './navigation';

interface ClientLayoutProps {
  children: React.ReactNode;
  showNavigation?: boolean;
}

export function ClientLayout({ children, showNavigation = true }: ClientLayoutProps) {
  const { loadUser } = useUserStore();

  useEffect(() => {
    // Load user data when the component mounts
    loadUser();
  }, [loadUser]);

  return (
    <>
      {showNavigation && <Navigation />}
      {children}
    </>
  );
}
