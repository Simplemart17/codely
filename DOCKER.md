# Running Codely in Docker behind a Cloudflare Tunnel

This stack runs the production app plus the Yjs collaboration server in Docker,
and exposes them to the internet through a **dedicated Cloudflare Tunnel** — no
inbound ports are opened on your machine/router.

```
  browser ──HTTPS──▶ codely.simplemart.dev    ─┐
                                                ├─ Cloudflare edge ─▶ cloudflared ─▶ app:3005  (Next.js)
  browser ──WSS───▶ codely-ws.simplemart.dev  ─┘                    (container)   ─▶ yjs:3006  (Yjs WS)

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
   | `codely` | `simplemart.dev` | `http://app:3005` |
   | `codely-ws` | `simplemart.dev` | `http://yjs:3006` |

   The service hosts are the Docker Compose service names — `cloudflared` shares
   the compose network and resolves them. DNS records are created automatically.
   WebSockets work over the `http://yjs:3006` origin with no extra settings.

### 2. Create `.env.docker`

```bash
cp .env.docker.example .env.docker
```

Fill it in:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — from your Supabase project (copy from your existing `.env`)
- `NEXT_PUBLIC_YJS_WEBSOCKET_URL=wss://codely-ws.simplemart.dev`
- `ANTHROPIC_API_KEY` — for AI lesson notes (copy from `.env`)
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
- **Ports are internal.** `app` and `yjs` use `expose` (compose network only).
  To also reach the app on `localhost`, add `ports: ["3005:3005"]` to the `app`
  service.

## Troubleshooting

- **Server Action blocked / "Invalid Server Actions request"**: the Host header
  is being rewritten. In the tunnel's Public Hostname settings, leave **HTTP Host
  Header** blank (do not override it). As a fallback, set
  `experimental.serverActions.allowedOrigins: ['codely.simplemart.dev']` in
  `next.config.js`.
- **Collaboration/cursors don't sync**: check `NEXT_PUBLIC_YJS_WEBSOCKET_URL` is
  `wss://` (not `ws://`) and matches the `codely-ws` Public Hostname; confirm the
  `yjs` container is healthy (`docker compose ... ps`).
- **Tunnel won't start / "unauthorized"**: verify `TUNNEL_TOKEN` in `.env.docker`
  is complete and unquoted; check `docker compose ... logs cloudflared`.
- **Build fails on Monaco/Pyodide assets**: these are generated during the build
  from `node_modules`; make sure the build ran the deps stage cleanly (no
  network restrictions blocking `npm ci`).
