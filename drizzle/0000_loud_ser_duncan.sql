-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "_prisma_migrations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamp with time zone,
	"migration_name" varchar(255) NOT NULL,
	"logs" text,
	"rolled_back_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_steps_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Verification" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"type" text NOT NULL,
	"target" text NOT NULL,
	"secret" text NOT NULL,
	"algorithm" text NOT NULL,
	"digits" integer NOT NULL,
	"period" integer NOT NULL,
	"charSet" text NOT NULL,
	"expiresAt" timestamp(3)
);
--> statement-breakpoint
ALTER TABLE "Verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"name" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserImage" (
	"id" text PRIMARY KEY NOT NULL,
	"altText" text,
	"contentType" text NOT NULL,
	"blob" "bytea" NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Password" (
	"hash" text NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" text PRIMARY KEY NOT NULL,
	"expirationDate" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Connection" (
	"id" text PRIMARY KEY NOT NULL,
	"providerName" text NOT NULL,
	"providerId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Permission" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"access" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_PermissionToRole" (
	"A" text NOT NULL,
	"B" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Role" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_RoleToUser" (
	"A" text NOT NULL,
	"B" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TraceMetaDataOnTrace" (
	"id" text PRIMARY KEY NOT NULL,
	"traceId" text NOT NULL,
	"traceMetaId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TraceMetaData" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Trace" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"url" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL,
	"roleId" text,
	"blob" "bytea" NOT NULL,
	"traceNumber" bigserial NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OrganizationMember" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text NOT NULL,
	"roleId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OrganizationInvite" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"organizationId" text NOT NULL,
	"invitedById" text NOT NULL,
	"invitedUserId" text,
	"accepted" boolean DEFAULT false NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "UserImage" ADD CONSTRAINT "UserImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Password" ADD CONSTRAINT "Password_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Permission"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Role"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Role"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "TraceMetaDataOnTrace" ADD CONSTRAINT "TraceMetaDataOnTrace_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "public"."Trace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "TraceMetaDataOnTrace" ADD CONSTRAINT "TraceMetaDataOnTrace_traceMetaId_fkey" FOREIGN KEY ("traceMetaId") REFERENCES "public"."TraceMetaData"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Trace" ADD CONSTRAINT "Trace_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Trace" ADD CONSTRAINT "Trace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "Verification_target_type_key" ON "Verification" USING btree ("target" text_ops,"type" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "User_username_key" ON "User" USING btree ("username" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "UserImage_userId_key" ON "UserImage" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Password_userId_key" ON "Password" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "Session_userId_idx" ON "Session" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Connection_providerName_providerId_key" ON "Connection" USING btree ("providerName" text_ops,"providerId" text_ops);--> statement-breakpoint
CREATE INDEX "Connection_userId_idx" ON "Connection" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Permission_action_entity_access_key" ON "Permission" USING btree ("action" text_ops,"entity" text_ops,"access" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "_PermissionToRole_AB_unique" ON "_PermissionToRole" USING btree ("A" text_ops,"B" text_ops);--> statement-breakpoint
CREATE INDEX "_PermissionToRole_B_index" ON "_PermissionToRole" USING btree ("B" text_ops);--> statement-breakpoint
CREATE INDEX "Role_name_idx" ON "Role" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Role_name_key" ON "Role" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "_RoleToUser_AB_unique" ON "_RoleToUser" USING btree ("A" text_ops,"B" text_ops);--> statement-breakpoint
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser" USING btree ("B" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "TraceMetaDataOnTrace_traceId_traceMetaId_key" ON "TraceMetaDataOnTrace" USING btree ("traceId" text_ops,"traceMetaId" text_ops);--> statement-breakpoint
CREATE INDEX "TraceMetaDataOnTrace_traceMetaId_idx" ON "TraceMetaDataOnTrace" USING btree ("traceMetaId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "TraceMetaData_key_value_key" ON "TraceMetaData" USING btree ("key" text_ops,"value" text_ops);--> statement-breakpoint
CREATE INDEX "Trace_name_idx" ON "Trace" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "Trace_roleId_idx" ON "Trace" USING btree ("roleId" text_ops);--> statement-breakpoint
CREATE INDEX "Trace_url_idx" ON "Trace" USING btree ("url" text_ops);--> statement-breakpoint
CREATE INDEX "Trace_userId_idx" ON "Trace" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "Trace_userId_updatedAt_idx" ON "Trace" USING btree ("userId" timestamp_ops,"updatedAt" text_ops);--> statement-breakpoint
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "OrganizationMember_roleId_idx" ON "OrganizationMember" USING btree ("roleId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "OrganizationMember_userId_organizationId_key" ON "OrganizationMember" USING btree ("userId" text_ops,"organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "OrganizationMember_userId_organizationId_roleId_idx" ON "OrganizationMember" USING btree ("userId" text_ops,"organizationId" text_ops,"roleId" text_ops);--> statement-breakpoint
CREATE INDEX "OrganizationInvite_invitedById_idx" ON "OrganizationInvite" USING btree ("invitedById" text_ops);--> statement-breakpoint
CREATE INDEX "OrganizationInvite_invitedUserId_idx" ON "OrganizationInvite" USING btree ("invitedUserId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "OrganizationInvite_organizationId_email_key" ON "OrganizationInvite" USING btree ("organizationId" text_ops,"email" text_ops);--> statement-breakpoint
CREATE INDEX "OrganizationInvite_organizationId_idx" ON "OrganizationInvite" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "OrganizationInvite_organizationId_invitedUserId_key" ON "OrganizationInvite" USING btree ("organizationId" text_ops,"invitedUserId" text_ops);
*/
