import { relations } from "drizzle-orm/relations";
import { user, userImage, password, session, connection, permission, permissionToRole, role, roleToUser, trace, traceMetaDataOnTrace, traceMetaData, organization, organizationMember, organizationInvite } from "./schema";

export const userImageRelations = relations(userImage, ({one}) => ({
	user: one(user, {
		fields: [userImage.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	userImages: many(userImage),
	passwords: many(password),
	sessions: many(session),
	connections: many(connection),
	roleToUsers: many(roleToUser),
	traces: many(trace),
	organizationMembers: many(organizationMember),
	organizationInvites_invitedById: many(organizationInvite, {
		relationName: "organizationInvite_invitedById_user_id"
	}),
	organizationInvites_invitedUserId: many(organizationInvite, {
		relationName: "organizationInvite_invitedUserId_user_id"
	}),
}));

export const passwordRelations = relations(password, ({one}) => ({
	user: one(user, {
		fields: [password.userId],
		references: [user.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const connectionRelations = relations(connection, ({one}) => ({
	user: one(user, {
		fields: [connection.userId],
		references: [user.id]
	}),
}));

export const permissionToRoleRelations = relations(permissionToRole, ({one}) => ({
	permission: one(permission, {
		fields: [permissionToRole.a],
		references: [permission.id]
	}),
	role: one(role, {
		fields: [permissionToRole.b],
		references: [role.id]
	}),
}));

export const permissionRelations = relations(permission, ({many}) => ({
	permissionToRoles: many(permissionToRole),
}));

export const roleRelations = relations(role, ({many}) => ({
	permissionToRoles: many(permissionToRole),
	roleToUsers: many(roleToUser),
	traces: many(trace),
	organizationMembers: many(organizationMember),
}));

export const roleToUserRelations = relations(roleToUser, ({one}) => ({
	role: one(role, {
		fields: [roleToUser.a],
		references: [role.id]
	}),
	user: one(user, {
		fields: [roleToUser.b],
		references: [user.id]
	}),
}));

export const traceMetaDataOnTraceRelations = relations(traceMetaDataOnTrace, ({one}) => ({
	trace: one(trace, {
		fields: [traceMetaDataOnTrace.traceId],
		references: [trace.id]
	}),
	traceMetaDatum: one(traceMetaData, {
		fields: [traceMetaDataOnTrace.traceMetaId],
		references: [traceMetaData.id]
	}),
}));

export const traceRelations = relations(trace, ({one, many}) => ({
	traceMetaDataOnTraces: many(traceMetaDataOnTrace),
	role: one(role, {
		fields: [trace.roleId],
		references: [role.id]
	}),
	user: one(user, {
		fields: [trace.userId],
		references: [user.id]
	}),
}));

export const traceMetaDataRelations = relations(traceMetaData, ({many}) => ({
	traceMetaDataOnTraces: many(traceMetaDataOnTrace),
}));

export const organizationMemberRelations = relations(organizationMember, ({one}) => ({
	organization: one(organization, {
		fields: [organizationMember.organizationId],
		references: [organization.id]
	}),
	role: one(role, {
		fields: [organizationMember.roleId],
		references: [role.id]
	}),
	user: one(user, {
		fields: [organizationMember.userId],
		references: [user.id]
	}),
}));

export const organizationRelations = relations(organization, ({many}) => ({
	organizationMembers: many(organizationMember),
	organizationInvites: many(organizationInvite),
}));

export const organizationInviteRelations = relations(organizationInvite, ({one}) => ({
	user_invitedById: one(user, {
		fields: [organizationInvite.invitedById],
		references: [user.id],
		relationName: "organizationInvite_invitedById_user_id"
	}),
	user_invitedUserId: one(user, {
		fields: [organizationInvite.invitedUserId],
		references: [user.id],
		relationName: "organizationInvite_invitedUserId_user_id"
	}),
	organization: one(organization, {
		fields: [organizationInvite.organizationId],
		references: [organization.id]
	}),
}));