import { verifyWebhook } from '@clerk/nextjs/webhooks';
import type { UserJSON } from '@clerk/nextjs/server';
import { type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { UserRole } from '@/types';

/**
 * Clerk webhook — the authoritative sync of Clerk users into codely.users.
 *
 * Configure it at Clerk Dashboard -> Webhooks with endpoint
 * https://<app-host>/api/webhooks/clerk, subscribed to user.created,
 * user.updated, user.deleted, and set CLERK_WEBHOOK_SIGNING_SECRET.
 *
 * `verifyWebhook` validates the signature using CLERK_WEBHOOK_SIGNING_SECRET.
 * It runs with the service role (bypasses RLS) because a webhook has no user
 * session. Creation is also handled lazily by ensureUser() on first request, so
 * the app still works if the webhook isn't configured — but only the webhook
 * gives you profile-update propagation and deletion cleanup.
 */
function extractProfile(data: UserJSON) {
  const email =
    data.email_addresses?.find((e) => e.id === data.primary_email_address_id)
      ?.email_address ??
    data.email_addresses?.[0]?.email_address ??
    '';
  const name =
    [data.first_name, data.last_name].filter(Boolean).join(' ') ||
    data.username ||
    (email ? email.split('@')[0] : 'User');
  // Only treat role as set when Clerk explicitly provides it, so a profile edit
  // never silently downgrades an instructor whose role lives only in the DB.
  const roleClaim = (
    data.public_metadata?.role as string | undefined
  )?.toUpperCase();
  const role: UserRole | undefined =
    roleClaim === 'INSTRUCTOR'
      ? 'INSTRUCTOR'
      : roleClaim === 'LEARNER'
        ? 'LEARNER'
        : undefined;
  return { email, name, avatar: data.image_url ?? undefined, role };
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    console.error('Clerk webhook: CLERK_WEBHOOK_SIGNING_SECRET is not set');
    return new Response('Webhook not configured', { status: 500 });
  }

  let event;
  try {
    event = await verifyWebhook(request);
  } catch (err) {
    console.error('Clerk webhook: verification failed', err);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    if (event.type === 'user.created') {
      const { email, name, avatar, role } = extractProfile(event.data);
      await supabase
        .from('users')
        .upsert(
          { id: event.data.id, email, name, avatar, role: role ?? 'LEARNER' },
          { onConflict: 'id' }
        );
    } else if (event.type === 'user.updated') {
      const { email, name, avatar, role } = extractProfile(event.data);
      await supabase
        .from('users')
        .update({ email, name, avatar, ...(role ? { role } : {}) })
        .eq('id', event.data.id);
    } else if (event.type === 'user.deleted' && event.data.id) {
      // Cascades to sessions/participants/snapshots/etc. via their FKs.
      await supabase.from('users').delete().eq('id', event.data.id);
    }
  } catch (err) {
    console.error(`Clerk webhook: failed to process ${event.type}`, err);
    return new Response('Processing error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
}
