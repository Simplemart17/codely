# Running Codely in Docker behind a Cloudflare Tunnel

This stack runs the production app plus the Yjs collaboration server in Docker,
and exposes them to the internet through a **dedicated Cloudflare Tunnel** — no
inbound ports are opened on your machine/router.

```
  browser ─HTTPS─▶ codely.simplemart.dev    ─┐                    ┌─▶ web:80 (nginx) ─▶ app:3005 (Next.js)
                                              ├─ CF edge ─▶ cloudflared ┤        └─(app down)─▶ maintenance.html (503)
  browser ─WSS──▶ codely-ws.simplemart.dev  ─┘                    └─▶ yjs:3006 (Yjs WS)

  app + browser ──▶ Supabase (hosted, external)
```

Why two hostnames? The Yjs server is a separate WebSocket process, and the
browser connects to it directly via `NEXT_PUBLIC_YJS_WEBSOCKET_URL`. That value
is **baked into the client bundle at build time**, so it must be a stable public
`wss://` URL — hence its own tunnel hostname.

## Prerequisites

- Docker + Docker Compose (you have both)
- A Cloudflare account with `simplemart.dev` on it, and Zero Trust enabled
- Supabase project (hosted) with the app's schema/migrations applied

(No local `cloudflared` install is needed — it runs as a container using a token.)

## One-time setup

### 1. Create the tunnel in the Zero Trust dashboard

In **Cloudflare Zero Trust → Networks → Tunnels**:

1. **Create a tunnel** → type **Cloudflared** → name it `codely`.
2. On the **Install connector** screen, copy the **token** (the long
   `eyJ...` string). You do **not** need to run the install command it shows —
   the compose `cloudflared` service uses the token directly.
3. Add two **Public Hostnames** to the tunnel:

   | Subdomain | Domain | Service |
   |---|---|---|
   | `codely` | `simplemart.dev` | `http://web:80` |
   | `codely-ws` | `simplemart.dev` | `http://yjs:3006` |

   The service hosts are the Docker Compose service names — `cloudflared` shares
   the compose network and resolves them. DNS records are created automatically.
   The app hostname points at `web` (the nginx proxy), **not** the app directly,
   so users get the maintenance page instead of a raw 502 whenever the app is
   down (see [Maintenance page](#maintenance-page)). WebSockets work over the
   `http://yjs:3006` origin with no extra settings.

### 2. Create `.env.docker`

```bash
cp .env.docker.example .env.docker
```

Fill it in:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — from your Supabase project (copy from your existing `.env`)
- `NEXT_PUBLIC_YJS_WEBSOCKET_URL=wss://codely-ws.simplemart.dev`
- `ANTHROPIC_API_KEY` — for AI lesson notes (copy from `.env`)
- `SERVER_ACTIONS_ALLOWED_ORIGINS=codely.simplemart.dev` — trusted origin(s) for server actions behind the tunnel
- `TUNNEL_TOKEN` — the token from step 1

If you use different subdomains, update the **Public Hostnames** in the dashboard
and `NEXT_PUBLIC_YJS_WEBSOCKET_URL` to match.

### 3. Point Supabase auth at the public URL

In the Supabase dashboard → Authentication → URL Configuration:

- **Site URL**: `https://codely.simplemart.dev`
- **Redirect URLs**: add `https://codely.simplemart.dev/auth/callback`

## Run it

```bash
docker compose --env-file .env.docker up -d --build
```

- App: https://codely.simplemart.dev
- Yjs health: reachable in-network; check container logs for `[yjs] ... listening`

Useful commands:

```bash
docker compose --env-file .env.docker logs -f            # tail all services
docker compose --env-file .env.docker logs -f cloudflared # tunnel status
docker compose --env-file .env.docker ps                  # service status
docker compose --env-file .env.docker down                # stop
```

## Important notes

- **Rebuild to change public config.** `NEXT_PUBLIC_*` is compiled into the
  client bundle, so editing Supabase or Yjs URLs means `up -d --build`, not a
  plain restart.
- **No Cloudflare Access.** By design, requests are gated by the app's own
  Supabase auth. Putting Access in front of the raw Yjs WebSocket handshake
  would break the browser `wss://` connection.
- **Ports are internal.** `app`, `yjs`, and `web` use `expose` (compose network
  only). To also reach the app on `localhost`, add `ports: ["8080:80"]` to the
  `web` service.

## Maintenance page

The `web` service (nginx) sits between the tunnel and the app and serves
[`maintenance/maintenance.html`](maintenance/maintenance.html) — a self-contained
503 page that auto-refreshes — in two situations:

1. **Automatic** — the app container is unreachable (during `up --build`,
   `restart`, a crash, or slow boot). nginx can't connect to `app:3005`, so it
   returns the maintenance page instead of a raw 502. It clears itself the moment
   the app is serving again.
2. **Planned** — you flip a flag file, no rebuild or restart needed:

   ```bash
   # Turn maintenance ON (takes effect immediately, per-request check)
   docker compose --env-file .env.docker exec web touch /etc/nginx/maintenance.enabled

   # Turn maintenance OFF
   docker compose --env-file .env.docker exec web rm /etc/nginx/maintenance.enabled
   ```

   The flag lives inside the container, so it also clears on the next
   `up`/recreate — deliberately fail-open so you can't get stuck in maintenance.

To edit the look or copy, change the files under `maintenance/` and rebuild the
`web` image (`up -d --build web`). The page is intentionally standalone (inline
CSS, no app assets) so it renders even when the app is fully down.

**Note:** this nginx page only covers the case where the app container is down
but Docker + cloudflared are still up. For a _total_ Docker/host outage (nothing
to serve the page locally), an edge Cloudflare Worker serves the same page from
Cloudflare's network — see [MAINTENANCE.md](MAINTENANCE.md).

## Troubleshooting

- **Server Action blocked / "Invalid Server Actions request"**: the Host header
  is being rewritten. In the tunnel's Public Hostname settings, leave **HTTP Host
  Header** blank (do not override it). Also ensure
  `SERVER_ACTIONS_ALLOWED_ORIGINS` in `.env.docker` lists the app's public host
  (this feeds `experimental.serverActions.allowedOrigins` in `next.config.js`),
  then rebuild — it's baked at build time.
- **Collaboration/cursors don't sync**: check `NEXT_PUBLIC_YJS_WEBSOCKET_URL` is
  `wss://` (not `ws://`) and matches the `codely-ws` Public Hostname; confirm the
  `yjs` container is healthy (`docker compose ... ps`).
- **Tunnel won't start / "unauthorized"**: verify `TUNNEL_TOKEN` in `.env.docker`
  is complete and unquoted; check `docker compose ... logs cloudflared`.
- **Build fails on Monaco/Pyodide assets**: these are generated during the build
  from `node_modules`; make sure the build ran the deps stage cleanly (no
  network restrictions blocking `npm ci`).
