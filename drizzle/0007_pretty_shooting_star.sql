CREATE TABLE "pending_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"workflow_id" text,
	"tool_calls" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expires_at" timestamp(3),
	"resolved_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "workflow_states" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_type" text NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"current_step" text,
	"state_data" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_approvals" ADD CONSTRAINT "pending_approvals_userId_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_userId_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "pending_approvals_session_id_idx" ON "pending_approvals" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "pending_approvals_user_id_idx" ON "pending_approvals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pending_approvals_status_idx" ON "pending_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_states_session_id_idx" ON "workflow_states" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "workflow_states_user_id_idx" ON "workflow_states" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workflow_states_type_idx" ON "workflow_states" USING btree ("workflow_type");