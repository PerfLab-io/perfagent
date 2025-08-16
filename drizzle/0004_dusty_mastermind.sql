ALTER TABLE "mcp_servers" ADD COLUMN "auth_status" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_servers" DROP COLUMN "use_oauth";--> statement-breakpoint
ALTER TABLE "mcp_servers" DROP COLUMN "redirect_uris";--> statement-breakpoint
ALTER TABLE "mcp_servers" DROP COLUMN "scopes";--> statement-breakpoint
ALTER TABLE "mcp_servers" DROP COLUMN "client_name";