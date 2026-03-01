# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Codely is a collaborative coding education platform built with Next.js 16 (App Router) and React 19. It features real-time collaborative code editing using Monaco Editor with Yjs CRDTs, backed by Supabase for auth, database, and real-time subscriptions. The UI uses shadcn/ui components with a dark-first OKLCH color theme.

## Commands

```bash
npm run dev            # Start dev server (Turbopack)
npm run build          # Production build
npm run lint           # ESLint check (eslint ./src)
npm run lint:fix       # ESLint auto-fix
npm run type-check     # TypeScript check (tsc --noEmit)
npm test               # Run all Jest tests
npm test -- --testPathPattern="crdt" # Run tests matching pattern
npm test -- path/to/file.test.ts     # Run a single test file
npm run test:watch     # Jest in watch mode
npm run test:coverage  # Jest with coverage (70% threshold)
npm run test:e2e       # Playwright E2E tests
npm run format         # Prettier format all files
npm run format:check   # Prettier check formatting
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16 with App Router, React 19, TypeScript 5.9 (strict)
- **UI Components**: shadcn/ui (new-york style, zinc base) with Radix UI primitives
- **Styling**: Tailwind CSS 4 with OKLCH color system (`globals.css`), dark-first theme via `next-themes`
- **State**: Zustand stores (`src/stores/`) — `useUserStore`, `useSessionStore`
- **Mutations**: Server Actions (`src/lib/actions/`) with Zod validation
- **Database/Auth**: Supabase (PostgreSQL + Auth + Realtime)
- **Code Editor**: Monaco Editor with Yjs CRDT bindings (y-monaco)
- **Notifications**: Sonner toast library
- **Testing**: Jest (jsdom) + React Testing Library; Playwright for E2E

### Path Alias
`@/*` maps to `./src/*` (configured in tsconfig.json and jest.config.mjs).

### Key Layers

**Pages** (`src/app/`): Next.js App Router pages. Auth routes (`/login`, `/signup`, `/auth/callback`), dashboard, sessions list, session detail, and code editor (`/sessions/[id]/code`).

**Server Actions** (`src/lib/actions/`): Mutation handlers using `'use server'` directive with Zod validation. `user-actions.ts` (createUser, updateUser), `session-actions.ts` (createSession, updateSession, deleteSession, joinSession, leaveSession), `snapshot-actions.ts` (createSnapshot). All return `ActionResult<T> = { success: true; data: T } | { success: false; error: string }`.

**API Routes** (`src/app/api/`): Read-only endpoints — users (GET), sessions (GET), session snapshots (GET), dashboard stats (GET). Mutations moved to Server Actions.

**Services** (`src/lib/services/`): Business logic layer — `UserService`, `SessionService`, `RealtimeService`. Services wrap Supabase queries and handle data transformation.

**Database** (`src/lib/supabase/`): Supabase client/server factories and `SupabaseDatabase` helper with transform functions (snake_case DB rows → camelCase app types).

**Layout** (`src/components/layout/`): `ClientLayout` wraps authenticated pages with `SidebarProvider` + `AppSidebar`. `ThemeToggle` for dark/light switching. Navigation uses shadcn sidebar (collapsible, mobile-responsive).

**CRDT System** (`src/lib/crdt/`): Multi-document CRDT manager, cursor tracking, selection sync, conflict resolution, and network error handling for real-time collaborative editing.

**Permissions** (`src/lib/permissions.ts` + `src/hooks/use-permissions.tsx`): Role-based access control with `UserRole` (INSTRUCTOR, LEARNER) and `ParticipantRole` (INSTRUCTOR, LEARNER, OBSERVER).

**Middleware** (`middleware.ts`): Supabase SSR middleware for session refresh. Runs on all routes except static assets.

### Type System
All core types live in `src/types/index.ts`. Key enums are string unions: `UserRole`, `Language` (JAVASCRIPT, PYTHON, CSHARP), `SessionStatus` (ACTIVE, PAUSED, ENDED), `ParticipantRole`. DB rows use snake_case; app types use camelCase.

### Design System
- shadcn/ui components in `src/components/ui/` (button, card, badge, input, select, dialog, tabs, sidebar, etc.)
- Config: `components.json` (new-york style, zinc base, CSS variables)
- Theme: OKLCH colors in `globals.css` with `@custom-variant dark (&:is(.dark *))` for Tailwind v4
- Dark theme primary: `oklch(0.623 0.214 259.815)` (vibrant blue), background: zinc-950
- Light theme primary: `oklch(0.488 0.243 264.376)` (blue-600), background: white

### Database Tables
`users`, `sessions`, `session_participants`, `operations`, `session_invitations`, `session_recordings`, `session_snapshots`. Migrations are in `supabase/migrations/`.

## Code Style
- Prettier: single quotes, semicolons, trailing commas (es5), 80 char width, Tailwind class sorting plugin
- ESLint: next/core-web-vitals + next/typescript
- Husky + lint-staged run on pre-commit
