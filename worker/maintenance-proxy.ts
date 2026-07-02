/**
 * Codely edge maintenance proxy (Cloudflare Worker).
 *
 * Fronts the public app hostname (codely.simplemart.dev). It proxies every
 * request to the Docker origin — exposed by the Cloudflare Tunnel under a
 * dedicated hostname (ORIGIN_HOST) — and, whenever that origin is unreachable
 * or returns a gateway error, serves a self-contained maintenance page from
 * Cloudflare's edge.
 *
 * This covers the case the in-container nginx page cannot: a TOTAL Docker /
 * tunnel outage (host reboot, daemon crash, stack stopped) where cloudflared is
 * also gone. The Worker runs on Cloudflare's network, so it stays up regardless.
 *
 * Deploy: `wrangler deploy` (config in wrangler.jsonc). No toggle — the page is
 * shown automatically whenever the app is down.
 */

// Single source of truth for the maintenance page: the same file nginx serves
// inside Docker. Bundled into the Worker at build time via the wrangler `Text`
// module rule (see wrangler.jsonc).
import MAINTENANCE_HTML from '../maintenance/maintenance.html';

interface Env {
  /** Tunnel hostname for the real app, e.g. "origin.simplemart.dev". */
  ORIGIN_HOST: string;
}

// Origin states that mean "the app is down / unreachable" → serve maintenance.
// Real app responses (2xx/3xx/4xx and app-thrown 500s) pass through untouched.
//   502/503/504 – gateway/unavailable (also nginx's own maintenance response)
//   521–526     – Cloudflare origin-connectivity errors
//   530         – Argo Tunnel error (1033): tunnel up but no connector
const DOWN_STATUS = new Set([502, 503, 504, 521, 522, 523, 524, 525, 526, 530]);

function maintenancePage(): Response {
  return new Response(MAINTENANCE_HTML, {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'retry-after': '120',
      'cache-control': 'no-store',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incomingHost = new URL(request.url).host;

    // Rewrite the request onto the origin hostname, preserving path, query,
    // method, headers, and body.
    const originUrl = new URL(request.url);
    originUrl.protocol = 'https:';
    originUrl.hostname = env.ORIGIN_HOST;
    originUrl.port = '';

    const originRequest = new Request(originUrl.toString(), request);
    // Tell the app its real public host so redirects/absolute URLs stay correct
    // (and the server-action Origin/Host check passes). nginx forwards this
    // through (it prefers an incoming X-Forwarded-Host over its own $host).
    originRequest.headers.set('X-Forwarded-Host', incomingHost);
    originRequest.headers.set('X-Forwarded-Proto', 'https');

    try {
      // redirect: 'manual' so the app's own 3xx (e.g. auth) reach the browser.
      const response = await fetch(originRequest, { redirect: 'manual' });
      if (DOWN_STATUS.has(response.status)) {
        return maintenancePage();
      }
      return response;
    } catch {
      // DNS failure, connection refused, tunnel with no connector, etc.
      return maintenancePage();
    }
  },
} satisfies ExportedHandler<Env>;
