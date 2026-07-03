'use client';

import { useEffect, useState, useRef } from 'react';
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
  const user = useUserStore((s) => s.user);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        await useUserStore.getState().loadUser();
      }
      if (!cancelled) {
        setHasCheckedAuth(true);
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  // Token refresh is handled transparently by Clerk (getToken always returns a
  // fresh JWT), so there's no Supabase auth-state subscription to maintain here.

  if (!showNavigation) {
    return <>{children}</>;
  }

  // Always render with sidebar layout for authenticated views.
  // AppSidebar handles its own loading state (shell vs full).
  // This prevents layout shifts and sidebar disappearing.
  if (user || !hasCheckedAuth) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    );
  }

  // Auth check completed and user is not authenticated
  return <>{children}</>;
}
