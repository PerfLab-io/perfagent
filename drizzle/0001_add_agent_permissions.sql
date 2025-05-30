-- Migration: Add agent entity permissions
-- This migration adds permissions for the 'agent' entity with various actions and access levels

-- Insert agent permissions
INSERT INTO "Permission" ("id", "action", "entity", "access", "description", "createdAt", "updatedAt")
VALUES
  -- Read permissions
  (gen_random_uuid(), 'read', 'agent', 'own', 'Read own agents', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'read', 'agent', 'any', 'Read any agents', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'read', 'agent', 'org', 'Read organization agents', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Create permissions
  (gen_random_uuid(), 'create', 'agent', 'own', 'Create own agents', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'create', 'agent', 'any', 'Create any agents', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'create', 'agent', 'org', 'Create organization agents', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Update permissions
  (gen_random_uuid(), 'update', 'agent', 'own', 'Update own agents', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'update', 'agent', 'any', 'Update any agents', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'update', 'agent', 'org', 'Update organization agents', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Delete permissions
  (gen_random_uuid(), 'delete', 'agent', 'own', 'Delete own agents', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'delete', 'agent', 'any', 'Delete any agents', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'delete', 'agent', 'org', 'Delete organization agents', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP); 
