# Edge maintenance page (Cloudflare Worker)

A tiny Cloudflare Worker sits in front of the public app hostname and serves a
maintenance page **whenever the app can't be reached** — including a _total_
Docker/tunnel outage (host reboot, daemon crash, `docker compose down`), which
the in-container nginx page cannot cover because nginx and cloudflared are down
too. The Worker runs on Cloudflare's edge, so it stays up regardless of your box.

No toggle: the page appears automatically when the origin is down and disappears
when it's back.

```
                              ┌─ origin healthy ─▶ return app response
browser ─▶ codely.simplemart.dev ─▶ [Worker] ─┤
             (Workers custom domain)           └─ down / 5xx / 1033 ─▶ maintenance page (503)
                                                       │
                              fetch ▶ origin.simplemart.dev ─▶ tunnel ─▶ web (nginx) ─▶ app:3005
```

Files: [worker/maintenance-proxy.ts](worker/maintenance-proxy.ts) (proxy +
fallback) and [wrangler.jsonc](wrangler.jsonc) (config). The Worker bundles
[maintenance/maintenance.html](maintenance/maintenance.html) at build time (via a
wrangler `Text` rule) — the **same** file nginx serves inside Docker, so there's
a single source of truth for the page.

## Coverage (with the Docker nginx layer)

| Failure | Page served by |
| --- | --- |
| App container crash, Docker up | nginx (local) — Worker proxies it through |
| **Docker daemon / host down** | **Worker (edge)** |
| Tunnel / cloudflared down (error 1033) | **Worker (edge)** |
| App returns 502/503/504 | Worker (edge) |

## One-time setup

### 1. Repoint DNS: give the tunnel a new origin hostname

The Worker takes over `codely.simplemart.dev`; the tunnel moves to
`origin.simplemart.dev`. **Order matters** — free the name before wrangler claims it.

In **Zero Trust → Networks → Tunnels → your tunnel → Public Hostnames**:

1. **Delete** the `codely.simplemart.dev` public hostname (this removes its DNS
   record so wrangler can create the custom domain).
2. **Add** `origin.simplemart.dev` → `http://web:80`.
3. Leave `codely-ws.simplemart.dev` → `http://yjs:3006` **unchanged** (Yjs stays
   direct; the Worker only fronts the app hostname).

Nothing about the app changes: users still visit `codely.simplemart.dev`, so
`SERVER_ACTIONS_ALLOWED_ORIGINS`, the Supabase Site URL, and
`NEXT_PUBLIC_*` all stay as-is — **no app rebuild needed**. (The Worker sends
`X-Forwarded-Host: codely.simplemart.dev` so redirects and the server-action
Origin/Host check keep working even though the origin's own host is
`origin.simplemart.dev`.)

### 2. Authenticate wrangler (once)

```bash
wrangler login          # or set CLOUDFLARE_API_TOKEN
```

### 3. Deploy

```bash
npm run worker:deploy    # = wrangler deploy
```

Wrangler builds the Worker, provisions `codely.simplemart.dev` as a Workers
Custom Domain (DNS + cert), and binds `ORIGIN_HOST=origin.simplemart.dev`. Only
that one var is uploaded — no secrets.

## Everyday use

- **Nothing to do.** Deploy the Docker stack as usual; the Worker automatically
  shows/hides the page based on origin reachability.
- **Change the page:** edit [maintenance/maintenance.html](maintenance/maintenance.html)
  (single source), then redeploy both layers — `npm run worker:deploy` (edge) and
  rebuild the `web` image (`docker compose ... up -d --build web`, local nginx).
- **Change which origin it proxies:** edit `vars.ORIGIN_HOST` in
  [wrangler.jsonc](wrangler.jsonc) and redeploy.
- **Type-check the Worker:** `npm run worker:check` (`tsc -p worker`).

## Local testing

```bash
# Fallback path (origin unreachable) → 503 maintenance page
npm run worker:dev -- --var ORIGIN_HOST:nonexistent.invalid
curl -i http://127.0.0.1:8787/

# Passthrough path (origin reachable) → proxied 200
npm run worker:dev -- --var ORIGIN_HOST:example.com
curl -i http://127.0.0.1:8787/
```

## Notes

- **Cost:** Workers free tier = 100k requests/day. All app traffic flows through
  the Worker; both it and the tunnel run on Cloudflare's edge, so added latency
  is negligible.
- **`origin.simplemart.dev` is public** (the app's own Supabase auth still gates
  it, same as before). To hide the raw origin, put Cloudflare Access on it with a
  service token and forward that token from the Worker — optional, not required.
- The Worker only proxies HTTP for the app hostname. WebSockets (Yjs) use the
  separate `codely-ws` hostname and never touch the Worker.
