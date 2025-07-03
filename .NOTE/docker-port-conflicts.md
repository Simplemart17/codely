# Docker Port Conflicts Resolution

## Issue
When running `docker-compose up`, encountered port conflicts:
- Port 5432 (PostgreSQL) already in use by local PostgreSQL instance
- Port 6379 (Redis) already in use by local Redis instance

## Root Cause
Local PostgreSQL and Redis services are running on the system:
- PostgreSQL: PID 568, running on port 5432
- Redis: PID 722, running on port 6379

## Solution Applied
Modified `docker-compose.yml` to use different external ports while keeping internal container ports the same:

### Changes Made:

#### PostgreSQL Port Mapping:
**Before:** `"5432:5432"`
**After:** `"5433:5432"`

#### Redis Port Mapping:
**Before:** `"6379:6379"`
**After:** `"6380:6379"`

### Updated Service Access:
- **PostgreSQL Database:** localhost:5433 (external) → postgres:5432 (internal)
- **Redis Cache:** localhost:6380 (external) → redis:6379 (internal)
- **pgAdmin:** localhost:5050 (unchanged)
- **Application:** localhost:3000 (unchanged)

## Internal Container Communication
The internal Docker network URLs remain unchanged:
- `DATABASE_URL=postgresql://codely:password@postgres:5432/codely`
- `REDIS_URL=redis://redis:6379`

This ensures the application containers can still communicate with each other using the standard ports within the Docker network.

## Alternative Solutions (Not Used)
1. **Stop Local Services:** Could stop local PostgreSQL/Redis, but might affect other projects
2. **Use Local Services:** Could configure app to use local services instead of Docker
3. **Different Docker Network:** Could use custom network with different IP ranges

## Testing Results
✅ **Port Conflicts Resolved!**
- PostgreSQL: Successfully running on port 5433 (external)
- Redis: Successfully running on port 6380 (external)
- pgAdmin: Successfully running on port 5050
- Docker build: Completed successfully

❌ **Remaining Issue: Webpack Module Error**
The application container is still failing with:
```
Error: Cannot find module 'next/dist/compiled/webpack/webpack'
```

This appears to be a Next.js configuration issue with the custom server setup, not related to the port conflicts.

## Connection Details for External Access
- **Database:** `postgresql://codely:password@localhost:5433/codely`
- **Redis:** `redis://localhost:6380`
- **pgAdmin:** http://localhost:5050 (admin@codely.dev / admin)
- **Application:** http://localhost:3000
