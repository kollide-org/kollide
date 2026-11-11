/** Who the current user is, from least to most access. */
export type Role = 'visitor' | 'member' | 'host' | 'admin'

export const ROLES: readonly Role[] = ['visitor', 'member', 'host', 'admin']

export const ROLE_LABELS: Record<Role, string> = {
  visitor: 'Visitor',
  member: 'Member',
  host: 'Host',
  admin: 'Admin',
}

const RANK: Record<Role, number> = { visitor: 0, member: 1, host: 2, admin: 3 }

/** True when `role` has at least the access of `minimum`. */
export function hasRole(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum]
}

/** Where each role lands by default. */
export const ROLE_HOME: Record<Role, string> = {
  visitor: '/',
  member: '/app',
  host: '/app',
  admin: '/admin',
}

/** The role shown in the interface: the highest of the roles the person holds. Signed-in people are at least members. */
export function roleFromRoles(roles: readonly string[]): Role {
  if (roles.includes('admin')) return 'admin'
  if (roles.includes('host')) return 'host'
  return 'member'
}
