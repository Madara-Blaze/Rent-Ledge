/** Roles and resource scopes for RBAC. Pure, framework-free, easily testable. */

export const Role = {
  OWNER: 'OWNER',
  CO_OWNER: 'CO_OWNER',
  MANAGER: 'MANAGER',
  ACCOUNTANT: 'ACCOUNTANT',
  TENANT: 'TENANT',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const ALL_ROLES = Object.values(Role);

export const ScopeType = {
  PLATFORM: 'PLATFORM',
  LANDLORD: 'LANDLORD',
  PORTFOLIO: 'PORTFOLIO',
  PROPERTY: 'PROPERTY',
  TENANCY: 'TENANCY',
} as const;
export type ScopeType = (typeof ScopeType)[keyof typeof ScopeType];

/** Ownership-level actions: delegation, deletion, ending tenancies. */
export const OWNER_ROLES: Role[] = [Role.OWNER, Role.CO_OWNER, Role.ADMIN];
/** Operational writes: create properties/tenancies, invoice, collect payments. */
export const MANAGE_ROLES: Role[] = [Role.OWNER, Role.CO_OWNER, Role.MANAGER, Role.ADMIN];
/** Read/report access (includes the CA/accountant). */
export const READ_ROLES: Role[] = [Role.OWNER, Role.CO_OWNER, Role.MANAGER, Role.ACCOUNTANT, Role.ADMIN];
/** Reads a tenant may also perform on their own tenancy. */
export const READ_ROLES_WITH_TENANT: Role[] = [...READ_ROLES, Role.TENANT];

export function roleSatisfies(userRoles: Role[], allowed: Role[]): boolean {
  return userRoles.some((r) => allowed.includes(r));
}

export function isValidRole(value: string): value is Role {
  return (ALL_ROLES as string[]).includes(value);
}
