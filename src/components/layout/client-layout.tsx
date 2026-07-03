'use client';

import { useEffect, useState, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
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
  const { user: clerkUser } = useUser();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const hasLoadedRef = useRef(false);
  const lastClerkUpdateRef = useRef<number | null>(null);

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

  // Token refresh is handled transparently by Clerk. But the Zustand store must
  // still re-sync the app user when the Clerk profile changes (name/email/
  // avatar), otherwise it shows stale data until a full page reload.
  useEffect(() => {
    if (!clerkUser) return;
    const updatedAt = clerkUser.updatedAt?.getTime() ?? null;
    if (
      lastClerkUpdateRef.current !== null &&
      updatedAt !== lastClerkUpdateRef.current
    ) {
      useUserStore.getState().loadUser();
    }
    lastClerkUpdateRef.current = updatedAt;
  }, [clerkUser]);

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
