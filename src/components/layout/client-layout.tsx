'use client';

import { useEffect } from 'react';
import { useUserStore } from '@/stores/user-store';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';

interface ClientLayoutProps {
  children: React.ReactNode;
  showNavigation?: boolean;
}

export function ClientLayout({
  children,
  showNavigation = true,
}: ClientLayoutProps) {
  const { loadUser, isAuthenticated } = useUserStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  if (!showNavigation || !isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
