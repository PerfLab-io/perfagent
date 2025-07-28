ALTER TABLE "mcp_servers" ADD COLUMN "use_oauth" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "redirect_uris" text;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "scopes" text;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "client_name" text;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "access_token" text;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "refresh_token" text;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "token_expires_at" timestamp(3);