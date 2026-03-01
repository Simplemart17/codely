# Codely Deployment Guide

## Architecture Overview

Codely has been migrated from a Prisma + Socket.io architecture to a **Supabase-first architecture** optimized for Vercel serverless deployment.

### Key Changes Made

1. **Database**: Migrated from Prisma ORM to Supabase PostgreSQL
2. **Real-time**: Replaced Socket.io with Supabase Realtime
3. **Server**: Removed custom Node.js server for Vercel serverless compatibility
4. **API Routes**: Converted to Vercel Edge Functions

## Prerequisites

- [Vercel Account](https://vercel.com)
- [Supabase Account](https://supabase.com)
- Node.js 18+ and npm

## Supabase Setup

### 1. Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose your organization and set project details
4. Wait for the project to be created

### 2. Run Database Migrations

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Run the migrations:
   ```bash
   supabase db push
   ```

   Or manually run the SQL files in your Supabase SQL editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`

### 3. Configure Authentication

1. In Supabase Dashboard, go to Authentication > Settings
2. Configure your site URL (e.g., `https://your-app.vercel.app`)
3. Add redirect URLs:
   - `https://your-app.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (for development)

### 4. Enable Realtime

1. Go to Database > Replication
2. Enable realtime for these tables:
   - `sessions`
   - `session_participants`
   - `operations`

## Vercel Deployment

### 1. Environment Variables

Set these environment variables in your Vercel project:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project settings under API.

### 2. Deploy to Vercel

#### Option A: Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

#### Option B: GitHub Integration

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Vercel will automatically deploy on every push

### 3. Configure Custom Domain (Optional)

1. In Vercel Dashboard, go to your project settings
2. Add your custom domain
3. Update Supabase auth settings with your new domain

## Local Development

### 1. Environment Setup

Create a `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Architecture Benefits

### Serverless Compatibility
- No custom server required
- Automatic scaling with Vercel
- Edge function support for global performance

### Real-time Features
- Supabase Realtime for collaborative editing
- WebSocket connections managed by Supabase
- Automatic reconnection and presence tracking

### Database Performance
- Direct PostgreSQL access through Supabase
- Row Level Security (RLS) for data protection
- Real-time subscriptions for live updates

### Cost Optimization
- Pay-per-use serverless model
- No server maintenance costs
- Automatic scaling based on demand

## Monitoring and Debugging

### Vercel Analytics
- Enable Vercel Analytics in your project dashboard
- Monitor performance and usage metrics

### Supabase Monitoring
- Use Supabase Dashboard for database monitoring
- Check real-time connections and performance

### Error Tracking
- Errors are automatically captured in Vercel logs
- Use Vercel's built-in error tracking

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**
   - Ensure variables are set in Vercel dashboard
   - Redeploy after adding new variables

2. **Database Connection Issues**
   - Verify Supabase URL and keys
   - Check RLS policies are correctly configured

3. **Real-time Not Working**
   - Ensure realtime is enabled for required tables
   - Check browser console for WebSocket errors

4. **Authentication Issues**
   - Verify redirect URLs in Supabase auth settings
   - Check that site URL matches your deployment URL

### Support

For additional support:
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)

## Migration Checklist

- [ ] Supabase project created
- [ ] Database migrations applied
- [ ] Authentication configured
- [ ] Realtime enabled
- [ ] Environment variables set in Vercel
- [ ] Application deployed to Vercel
- [ ] Custom domain configured (if applicable)
- [ ] Testing completed on production environment
