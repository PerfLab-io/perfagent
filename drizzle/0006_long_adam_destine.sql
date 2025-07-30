CREATE INDEX IF NOT EXISTS "mcp_servers_user_enabled_idx" ON "mcp_servers" USING btree ("user_id" text_ops,"enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_servers_auth_status_idx" ON "mcp_servers" USING btree ("auth_status" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_servers_token_expiry_idx" ON "mcp_servers" USING btree ("token_expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_servers_user_auth_idx" ON "mcp_servers" USING btree ("user_id" text_ops,"id" text_ops,"auth_status" text_ops);