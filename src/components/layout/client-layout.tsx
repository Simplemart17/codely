'use client';

import { useEffect, useState, useRef } from 'react';
import { useUserStore } from '@/stores/user-store';
import { createClient } from '@/lib/supabase/client';
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

  // Listen for Supabase auth state changes.
  // IMPORTANT: Do NOT handle SIGNED_OUT here. The Supabase browser
  // client can fire SIGNED_OUT spuriously during initialization
  // (before it checks its own session storage), which causes the
  // user to be logged out immediately after loading. Explicit logout
  // is handled in AppSidebar via signOut() + logout().
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') {
        // Silently re-fetch user data to keep store in sync.
        useUserStore.getState().loadUser();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
