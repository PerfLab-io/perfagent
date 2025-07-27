-- PERFORMANCE OPTIMIZATION: Add missing indexes for session lookups
-- These indexes will dramatically improve authentication query performance

-- Add index on session.id for primary key lookups (if not already exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "session_id_idx" ON "Session" ("id");

-- Add composite index for session + expiration lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "session_id_expiration_idx" ON "Session" ("id", "expirationDate");

-- Add index for role name lookups (already exists but ensure it's there)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "role_name_lookup_idx" ON "Role" ("name") WHERE "name" IS NOT NULL;

-- Add composite index for roleToUser lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "role_to_user_composite_idx" ON "_RoleToUser" ("B", "A");

-- Clean up expired sessions for better performance
DELETE FROM "Session" WHERE "expirationDate" < NOW();

-- Update table statistics for better query planning
ANALYZE "Session";
ANALYZE "Role";
ANALYZE "_RoleToUser";

-- Performance recommendation comments
-- Consider running: VACUUM ANALYZE "Session"; periodically
-- Consider setting up a cron job to clean expired sessions: DELETE FROM "Session" WHERE "expirationDate" < NOW(); 
