# Shared Context — Codely Platform

All agents must reference this file for common conventions and stack details.

## Project Summary

Codely is a real-time collaborative coding education platform. Instructors create coding sessions; learners and observers join. Code is edited collaboratively in a Monaco Editor with Yjs CRDT-based conflict resolution, backed by Supabase for auth, database, and real-time subscriptions.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.3.4 (App Router), React 19, TypeScript 5 (strict) |
| Styling | Tailwind CSS 4, Radix UI primitives, CVA (class-variance-authority) |
| State | Zustand 5 (`useUserStore`, `useSessionStore`) |
| Database | Supabase PostgreSQL with Row Level Security |
| Auth | Supabase Auth (email/password + OAuth) via `@supabase/ssr` |
| Real-time | Supabase Realtime (broadcast + presence) for app events |
| CRDT | Yjs 13.6 + y-monaco 0.1.6 + y-websocket 3.0 for collaborative text editing |
| Code Editor | Monaco Editor 0.52 via `@monaco-editor/react` 4.7 |
| Icons | Lucide React |
| Testing | Jest 30 (jsdom) + React Testing Library 16 + Playwright 1.53 |
| Deployment | Vercel serverless (standalone output) + Supabase managed |
| Dev Tools | ESLint 9, Prettier 3.6, Husky + lint-staged |

## Path Alias

`@/*` maps to `./src/*` — configured in `tsconfig.json` and `jest.config.mjs`.

## Type System Conventions

All core types are defined in `src/types/index.ts`.

**String union enums** (not TypeScript enums):
```
UserRole        = 'INSTRUCTOR' | 'LEARNER'
Language        = 'JAVASCRIPT' | 'PYTHON' | 'CSHARP'
SessionStatus   = 'ACTIVE' | 'PAUSED' | 'ENDED'
ParticipantRole = 'INSTRUCTOR' | 'LEARNER' | 'OBSERVER'
InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
OperationType   = 'INSERT' | 'DELETE' | 'RETAIN'
```

**Naming convention**: Database rows use `snake_case`; application types use `camelCase`. Transform functions in `src/lib/supabase/database.ts` (`SupabaseDatabase.transform*()`) handle conversion.

## Code Style

- **Prettier**: single quotes, semicolons, trailing commas (es5), 80 char width, `prettier-plugin-tailwindcss` for class sorting
- **ESLint**: extends `next/core-web-vitals` + `next/typescript`
- **Pre-commit**: Husky + lint-staged run automatically

## Service Layer Pattern

Services are static classes in `src/lib/services/`. Each method:
1. Gets a Supabase client via `SupabaseDatabase.getServerClient()` (server-side)
2. Executes the query using the Supabase builder API
3. Transforms the result via `SupabaseDatabase.transform*()` to return camelCase app types
4. Handles errors via `SupabaseDatabase.handleError()`

## API Route Pattern

Every API route in `src/app/api/` follows:
1. **Authenticate**: `const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();`
2. **Guard**: Return 401 if no user
3. **Validate**: Check request body/params
4. **Delegate**: Call the appropriate service method
5. **Respond**: Return `NextResponse.json({ data })` or `NextResponse.json({ error }, { status })`

## API Response Types

```typescript
interface ApiResponse<T> { data?: T; error?: string; message?: string; }
interface PaginatedResponse<T> { data: T[]; total: number; page: number; limit: number; hasMore: boolean; }
```

## Error Handling

- `SupabaseDatabase.handleError()` maps PostgreSQL error codes: `PGRST116` → not found, `23505` → duplicate, `23503` → FK violation
- API routes catch errors and return structured JSON with appropriate HTTP status codes
- Components use the `ErrorBoundary` component with levels: `'page' | 'component' | 'critical'`

## Environment Variables

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Supabase service role key |
| `DATABASE_URL` | Server-only | Direct PostgreSQL connection |
| `CODE_EXECUTION_TIMEOUT` | Server-only | Max execution time (30000ms) |
| `MAX_CODE_LENGTH` | Server-only | Max code length (10000 chars) |

## Key Directories

```
src/app/           → Next.js pages and API routes
src/components/    → React components (ui/, layout/, editor/, sessions/, dashboard/, error/)
src/lib/           → Utilities, services, CRDT, Supabase clients, permissions
src/stores/        → Zustand state stores
src/hooks/         → Custom React hooks
src/types/         → TypeScript type definitions
supabase/          → Database migrations
tests/e2e/         → Playwright E2E tests
```

## Cross-Agent Coordination Rules

1. **Shared files** require coordination before modification:
   - `src/types/index.ts` — owned by System Architect, consumed by all
   - `src/lib/supabase/database.ts` — owned by Database Agent, consumed by Backend/Frontend
   - `src/components/editor/coding-interface.tsx` — shared between Frontend and Realtime agents
   - `package.json` — owned by Infrastructure Agent

2. **Handoff**: When an agent produces an interface that another depends on, document the contract in the relevant type file before implementation begins.

3. **Conflicts**: System Architect decides technical disputes; Project Coordinator decides sequencing disputes.
