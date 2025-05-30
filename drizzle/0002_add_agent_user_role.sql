-- Migration: Add agent-user role
-- This migration adds the 'agent-user' role and links it to the 'read:agent:own' permission

-- Insert the agent-user role
INSERT INTO "Role" ("id", "name", "description", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'agent-user',
  'Standard user role with permission to read their own agents',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Link the agent-user role to the read:agent:own permission
INSERT INTO "_PermissionToRole" ("A", "B")
SELECT 
  p."id" as "A",
  r."id" as "B"
FROM "Permission" p, "Role" r
WHERE p."action" = 'read' 
  AND p."entity" = 'agent' 
  AND p."access" = 'own'
  AND r."name" = 'agent-user'; 
