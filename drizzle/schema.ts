import {
	pgTable,
	varchar,
	timestamp,
	text,
	integer,
	uniqueIndex,
	foreignKey,
	index,
	bigserial,
	boolean,
} from 'drizzle-orm/pg-core';
import { sql, eq, isNotNull } from 'drizzle-orm';
import { relations } from 'drizzle-orm';

export const prismaMigrations = pgTable('_prisma_migrations', {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	checksum: varchar({ length: 64 }).notNull(),
	finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
	migrationName: varchar('migration_name', { length: 255 }).notNull(),
	logs: text(),
	rolledBackAt: timestamp('rolled_back_at', {
		withTimezone: true,
		mode: 'string',
	}),
	startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	appliedStepsCount: integer('applied_steps_count').default(0).notNull(),
});

export const verification = pgTable(
	'Verification',
	{
		id: text().primaryKey().notNull(),
		createdAt: timestamp({ precision: 3, mode: 'string' })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		type: text().notNull(),
		target: text().notNull(),
		secret: text().notNull(),
		algorithm: text().notNull(),
		digits: integer().notNull(),
		period: integer().notNull(),
		charSet: text().notNull(),
		expiresAt: timestamp({ precision: 3, mode: 'string' }),
	},
	(table) => [
		uniqueIndex('Verification_target_type_key').using(
			'btree',
			table.target.asc().nullsLast().op('text_ops'),
			table.type.asc().nullsLast().op('text_ops'),
		),
	],
);

export const user = pgTable(
	'User',
	{
		id: text().primaryKey().notNull(),
		email: text().notNull(),
		username: text().notNull(),
		name: text(),
		createdAt: timestamp({ precision: 3, mode: 'string' })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	},
	(table) => [
		uniqueIndex('User_email_key').using(
			'btree',
			table.email.asc().nullsLast().op('text_ops'),
		),
		uniqueIndex('User_username_key').using(
			'btree',
			table.username.asc().nullsLast().op('text_ops'),
		),
	],
);

export const userImage = pgTable(
	'UserImage',
	{
		id: text().primaryKey().notNull(),
		altText: text(),
		contentType: text().notNull(),
		blob: text().notNull(), // Represents bytea/binary data
		createdAt: timestamp({ precision: 3, mode: 'string' })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
		userId: text().notNull(),
	},
	(table) => [
		uniqueIndex('UserImage_userId_key').using(
			'btree',
			table.userId.asc().nullsLast().op('text_ops'),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: 'UserImage_userId_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
	],
);

export const password = pgTable(
	'Password',
	{
		hash: text().notNull(),
		userId: text().notNull(),
	},
	(table) => [
		uniqueIndex('Password_userId_key').using(
			'btree',
			table.userId.asc().nullsLast().op('text_ops'),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: 'Password_userId_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
	],
);

export const session = pgTable(
	'Session',
	{
		id: text().primaryKey().notNull(),
		expirationDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
		createdAt: timestamp({ precision: 3, mode: 'string' })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
		userId: text().notNull(),
	},
	(table) => [
		index('Session_userId_idx').using(
			'btree',
			table.userId.asc().nullsLast().op('text_ops'),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: 'Session_userId_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
	],
);

export const connection = pgTable(
	'Connection',
	{
		id: text().primaryKey().notNull(),
		providerName: text().notNull(),
		providerId: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: 'string' })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
		userId: text().notNull(),
	},
	(table) => [
		uniqueIndex('Connection_providerName_providerId_key').using(
			'btree',
			table.providerName.asc().nullsLast().op('text_ops'),
			table.providerId.asc().nullsLast().op('text_ops'),
		),
		index('Connection_userId_idx').using(
			'btree',
			table.userId.asc().nullsLast().op('text_ops'),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: 'Connection_userId_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
	],
);

export const permission = pgTable(
	'Permission',
	{
		id: text().primaryKey().notNull(),
		action: text().notNull(),
		entity: text().notNull(),
		access: text().notNull(),
		description: text().default('').notNull(),
		createdAt: timestamp({ precision: 3, mode: 'string' })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	},
	(table) => [
		uniqueIndex('Permission_action_entity_access_key').using(
			'btree',
			table.action.asc().nullsLast().op('text_ops'),
			table.entity.asc().nullsLast().op('text_ops'),
			table.access.asc().nullsLast().op('text_ops'),
		),
	],
);

export const permissionToRole = pgTable(
	'_PermissionToRole',
	{
		a: text('A').notNull(),
		b: text('B').notNull(),
	},
	(table) => [
		uniqueIndex('_PermissionToRole_AB_unique').using(
			'btree',
			table.a.asc().nullsLast().op('text_ops'),
			table.b.asc().nullsLast().op('text_ops'),
		),
		index().using('btree', table.b.asc().nullsLast().op('text_ops')),
		foreignKey({
			columns: [table.a],
			foreignColumns: [permission.id],
			name: '_PermissionToRole_A_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
		foreignKey({
			columns: [table.b],
			foreignColumns: [role.id],
			name: '_PermissionToRole_B_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
	],
);

export const role = pgTable(
	'Role',
	{
		id: text().primaryKey().notNull(),
		name: text().notNull(),
		description: text().default('').notNull(),
		createdAt: timestamp({ precision: 3, mode: 'string' })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	},
	(table) => [
		index('Role_name_idx').using(
			'btree',
			table.name.asc().nullsLast().op('text_ops'),
		),
		uniqueIndex('Role_name_key').using(
			'btree',
			table.name.asc().nullsLast().op('text_ops'),
		),
	],
);

export const roleToUser = pgTable(
	'_RoleToUser',
	{
		a: text('A').notNull(),
		b: text('B').notNull(),
	},
	(table) => [
		uniqueIndex('_RoleToUser_AB_unique').using(
			'btree',
			table.a.asc().nullsLast().op('text_ops'),
			table.b.asc().nullsLast().op('text_ops'),
		),
		index().using('btree', table.b.asc().nullsLast().op('text_ops')),
		foreignKey({
			columns: [table.a],
			foreignColumns: [role.id],
			name: '_RoleToUser_A_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
		foreignKey({
			columns: [table.b],
			foreignColumns: [user.id],
			name: '_RoleToUser_B_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
	],
);

export const traceMetaDataOnTrace = pgTable(
	'TraceMetaDataOnTrace',
	{
		id: text().primaryKey().notNull(),
		traceId: text().notNull(),
		traceMetaId: text().notNull(),
	},
	(table) => [
		uniqueIndex('TraceMetaDataOnTrace_traceId_traceMetaId_key').using(
			'btree',
			table.traceId.asc().nullsLast().op('text_ops'),
			table.traceMetaId.asc().nullsLast().op('text_ops'),
		),
		index('TraceMetaDataOnTrace_traceMetaId_idx').using(
			'btree',
			table.traceMetaId.asc().nullsLast().op('text_ops'),
		),
		foreignKey({
			columns: [table.traceId],
			foreignColumns: [trace.id],
			name: 'TraceMetaDataOnTrace_traceId_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
		foreignKey({
			columns: [table.traceMetaId],
			foreignColumns: [traceMetaData.id],
			name: 'TraceMetaDataOnTrace_traceMetaId_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
	],
);

export const traceMetaData = pgTable(
	'TraceMetaData',
	{
		id: text().primaryKey().notNull(),
		key: text().notNull(),
		value: text().notNull(),
	},
	(table) => [
		uniqueIndex('TraceMetaData_key_value_key').using(
			'btree',
			table.key.asc().nullsLast().op('text_ops'),
			table.value.asc().nullsLast().op('text_ops'),
		),
	],
);

export const trace = pgTable(
	'Trace',
	{
		id: text().primaryKey().notNull(),
		name: text(),
		url: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: 'string' })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
		userId: text().notNull(),
		roleId: text(),
		blob: text().notNull(), // Represents bytea/binary data
		traceNumber: bigserial({ mode: 'bigint' }).notNull(),
	},
	(table) => [
		index('Trace_name_idx').using(
			'btree',
			table.name.asc().nullsLast().op('text_ops'),
		),
		index('Trace_roleId_idx').using(
			'btree',
			table.roleId.asc().nullsLast().op('text_ops'),
		),
		index('Trace_url_idx').using(
			'btree',
			table.url.asc().nullsLast().op('text_ops'),
		),
		index('Trace_userId_idx').using(
			'btree',
			table.userId.asc().nullsLast().op('text_ops'),
		),
		index('Trace_userId_updatedAt_idx').using(
			'btree',
			table.userId.asc().nullsLast().op('timestamp_ops'),
			table.updatedAt.asc().nullsLast().op('text_ops'),
		),
		foreignKey({
			columns: [table.roleId],
			foreignColumns: [role.id],
			name: 'Trace_roleId_fkey',
		})
			.onUpdate('cascade')
			.onDelete('set null'),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: 'Trace_userId_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
	],
);

export const organizationMember = pgTable(
	'OrganizationMember',
	{
		id: text().primaryKey().notNull(),
		userId: text().notNull(),
		organizationId: text().notNull(),
		roleId: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: 'string' })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	},
	(table) => [
		index('OrganizationMember_organizationId_idx').using(
			'btree',
			table.organizationId.asc().nullsLast().op('text_ops'),
		),
		index('OrganizationMember_roleId_idx').using(
			'btree',
			table.roleId.asc().nullsLast().op('text_ops'),
		),
		uniqueIndex('OrganizationMember_userId_organizationId_key').using(
			'btree',
			table.userId.asc().nullsLast().op('text_ops'),
			table.organizationId.asc().nullsLast().op('text_ops'),
		),
		index('OrganizationMember_userId_organizationId_roleId_idx').using(
			'btree',
			table.userId.asc().nullsLast().op('text_ops'),
			table.organizationId.asc().nullsLast().op('text_ops'),
			table.roleId.asc().nullsLast().op('text_ops'),
		),
		foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: 'OrganizationMember_organizationId_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
		foreignKey({
			columns: [table.roleId],
			foreignColumns: [role.id],
			name: 'OrganizationMember_roleId_fkey',
		})
			.onUpdate('cascade')
			.onDelete('restrict'),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: 'OrganizationMember_userId_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
	],
);

export const organization = pgTable('Organization', {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
});

export const organizationInvite = pgTable(
	'OrganizationInvite',
	{
		id: text().primaryKey().notNull(),
		email: text(),
		organizationId: text().notNull(),
		invitedById: text().notNull(),
		invitedUserId: text(),
		accepted: boolean().default(false).notNull(),
		expiresAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
		createdAt: timestamp({ precision: 3, mode: 'string' })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	},
	(table) => [
		index('OrganizationInvite_invitedById_idx').using(
			'btree',
			table.invitedById.asc().nullsLast().op('text_ops'),
		),
		index('OrganizationInvite_invitedUserId_idx').using(
			'btree',
			table.invitedUserId.asc().nullsLast().op('text_ops'),
		),
		uniqueIndex('OrganizationInvite_organizationId_email_key').using(
			'btree',
			table.organizationId.asc().nullsLast().op('text_ops'),
			table.email.asc().nullsLast().op('text_ops'),
		),
		index('OrganizationInvite_organizationId_idx').using(
			'btree',
			table.organizationId.asc().nullsLast().op('text_ops'),
		),
		uniqueIndex('OrganizationInvite_organizationId_invitedUserId_key').using(
			'btree',
			table.organizationId.asc().nullsLast().op('text_ops'),
			table.invitedUserId.asc().nullsLast().op('text_ops'),
		),
		foreignKey({
			columns: [table.invitedById],
			foreignColumns: [user.id],
			name: 'OrganizationInvite_invitedById_fkey',
		})
			.onUpdate('cascade')
			.onDelete('restrict'),
		foreignKey({
			columns: [table.invitedUserId],
			foreignColumns: [user.id],
			name: 'OrganizationInvite_invitedUserId_fkey',
		})
			.onUpdate('cascade')
			.onDelete('set null'),
		foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: 'OrganizationInvite_organizationId_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
	],
);

// Relations
export const userRelations = relations(user, ({ one, many }) => ({
	image: one(userImage),
	password: one(password),
	sessions: many(session),
	connections: many(connection),
	traces: many(trace),
	roles: many(roleToUser),
	organizations: many(organizationMember),
	sentInvites: many(organizationInvite, { relationName: 'invitedBy' }),
	receivedInvites: many(organizationInvite, { relationName: 'invitedUser' }),
	mcpServers: many(mcpServers),
}));

export const userImageRelations = relations(userImage, ({ one }) => ({
	user: one(user, {
		fields: [userImage.userId],
		references: [user.id],
	}),
}));

export const passwordRelations = relations(password, ({ one }) => ({
	user: one(user, {
		fields: [password.userId],
		references: [user.id],
	}),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const connectionRelations = relations(connection, ({ one }) => ({
	user: one(user, {
		fields: [connection.userId],
		references: [user.id],
	}),
}));

export const permissionRelations = relations(permission, ({ many }) => ({
	roles: many(permissionToRole),
}));

export const roleRelations = relations(role, ({ many }) => ({
	users: many(roleToUser),
	permissions: many(permissionToRole),
	traces: many(trace),
	members: many(organizationMember),
}));

export const permissionToRoleRelations = relations(
	permissionToRole,
	({ one }) => ({
		permission: one(permission, {
			fields: [permissionToRole.a],
			references: [permission.id],
		}),
		role: one(role, {
			fields: [permissionToRole.b],
			references: [role.id],
		}),
	}),
);

export const roleToUserRelations = relations(roleToUser, ({ one }) => ({
	role: one(role, {
		fields: [roleToUser.a],
		references: [role.id],
	}),
	user: one(user, {
		fields: [roleToUser.b],
		references: [user.id],
	}),
}));

export const traceRelations = relations(trace, ({ one, many }) => ({
	user: one(user, {
		fields: [trace.userId],
		references: [user.id],
	}),
	role: one(role, {
		fields: [trace.roleId],
		references: [role.id],
	}),
	metadata: many(traceMetaDataOnTrace),
}));

export const traceMetaDataRelations = relations(traceMetaData, ({ many }) => ({
	traces: many(traceMetaDataOnTrace),
}));

export const traceMetaDataOnTraceRelations = relations(
	traceMetaDataOnTrace,
	({ one }) => ({
		trace: one(trace, {
			fields: [traceMetaDataOnTrace.traceId],
			references: [trace.id],
		}),
		traceMeta: one(traceMetaData, {
			fields: [traceMetaDataOnTrace.traceMetaId],
			references: [traceMetaData.id],
		}),
	}),
);

export const organizationRelations = relations(organization, ({ many }) => ({
	members: many(organizationMember),
	invites: many(organizationInvite),
}));

export const organizationMemberRelations = relations(
	organizationMember,
	({ one }) => ({
		user: one(user, {
			fields: [organizationMember.userId],
			references: [user.id],
		}),
		organization: one(organization, {
			fields: [organizationMember.organizationId],
			references: [organization.id],
		}),
		role: one(role, {
			fields: [organizationMember.roleId],
			references: [role.id],
		}),
	}),
);

export const organizationInviteRelations = relations(
	organizationInvite,
	({ one }) => ({
		organization: one(organization, {
			fields: [organizationInvite.organizationId],
			references: [organization.id],
		}),
		invitedBy: one(user, {
			fields: [organizationInvite.invitedById],
			references: [user.id],
			relationName: 'invitedBy',
		}),
		invitedUser: one(user, {
			fields: [organizationInvite.invitedUserId],
			references: [user.id],
			relationName: 'invitedUser',
		}),
	}),
);

export const mcpServers = pgTable(
	'mcp_servers',
	{
		id: text().primaryKey().notNull(),
		userId: text('user_id').notNull(),
		name: text().notNull(),
		url: text().notNull(),
		enabled: boolean().default(true).notNull(),
		// OAuth authentication status
		authStatus: text('auth_status').default('unknown').notNull(), // 'unknown', 'required', 'authorized', 'failed'
		// OAuth token storage (encrypted)
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		tokenExpiresAt: timestamp('token_expires_at', {
			precision: 3,
			mode: 'string',
		}),
		// OAuth client_id used for this server (for dynamic client registration)
		clientId: text('client_id'),
		createdAt: timestamp('created_at', { precision: 3, mode: 'string' })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp('updated_at', {
			precision: 3,
			mode: 'string',
		}).notNull(),
	},
	(table) => [
		// Original userId index
		index('mcp_servers_userId_idx').using(
			'btree',
			table.userId.asc().nullsLast().op('text_ops'),
		),
		// Composite index for user + enabled servers (most frequent query)
		index('mcp_servers_user_enabled_idx').using(
			'btree',
			table.userId.asc().nullsLast().op('text_ops'),
			table.enabled.asc().nullsLast(),
		),
		// Index for auth status filtering
		index('mcp_servers_auth_status_idx').using(
			'btree',
			table.authStatus.asc().nullsLast().op('text_ops'),
		),
		// Index for token expiration checks
		index('mcp_servers_token_expiry_idx').using(
			'btree',
			table.tokenExpiresAt.asc().nullsLast(),
		),
		// Composite index for auth operations (user + server + auth status)
		index('mcp_servers_user_auth_idx').using(
			'btree',
			table.userId.asc().nullsLast().op('text_ops'),
			table.id.asc().nullsLast().op('text_ops'),
			table.authStatus.asc().nullsLast().op('text_ops'),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: 'mcp_servers_userId_fkey',
		})
			.onUpdate('cascade')
			.onDelete('cascade'),
	],
);

export const mcpServersRelations = relations(mcpServers, ({ one }) => ({
	user: one(user, {
		fields: [mcpServers.userId],
		references: [user.id],
	}),
}));

