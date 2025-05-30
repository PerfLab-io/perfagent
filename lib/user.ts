type Action = 'create' | 'read' | 'update' | 'delete';
type Entity = 'user' | 'trace' | 'agent';
type Access =
	| 'own'
	| 'any'
	| 'org'
	| 'own,any'
	| 'any,own'
	| 'own,org'
	| 'any,org'
	| 'own,any,org';
export type PermissionString =
	| `${Action}:${Entity}`
	| `${Action}:${Entity}:${Access}`;

export function parsePermissionString(permissionString: PermissionString) {
	const [action, entity, access] = permissionString.split(':') as [
		Action,
		Entity,
		Access | undefined,
	];
	return {
		action,
		entity,
		access: access ? (access.split(',') as Array<Access>) : undefined,
	};
}
