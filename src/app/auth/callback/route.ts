import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/lib/services/user-service';
import { NextResponse } from 'next/server';
import type { UserRole } from '@/types';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      try {
        // Get the authenticated user
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (authUser) {
          // Check if user exists in database
          const existingUser = await UserService.getUserById(authUser.id);

          if (!existingUser) {
            // Create user in database with data from Supabase metadata
            const userData = {
              id: authUser.id,
              email: authUser.email!,
              name: authUser.user_metadata?.name || authUser.email!.split('@')[0],
              role: (authUser.user_metadata?.role?.toUpperCase() || 'LEARNER') as UserRole,
              avatar: authUser.user_metadata?.avatar_url,
            };

            await UserService.createUser(userData);
            console.log('Created database user record for:', authUser.email);
          }
        }
      } catch (dbError) {
        console.error('Error creating user in database:', dbError);
        // Continue with redirect even if database creation fails
        // User can be created later when they access the app
      }

      const forwardedHost = request.headers.get('x-forwarded-host'); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
