import { describe, expect, it } from 'vitest';
import {
  isValidRole,
  MANAGE_ROLES,
  OWNER_ROLES,
  READ_ROLES,
  READ_ROLES_WITH_TENANT,
  Role,
  roleSatisfies,
} from './roles';

describe('RBAC role matrix', () => {
  it('owner can do everything an operator/reader can', () => {
    expect(roleSatisfies([Role.OWNER], OWNER_ROLES)).toBe(true);
    expect(roleSatisfies([Role.OWNER], MANAGE_ROLES)).toBe(true);
    expect(roleSatisfies([Role.OWNER], READ_ROLES)).toBe(true);
  });

  it('manager can operate and read but not perform ownership actions', () => {
    expect(roleSatisfies([Role.MANAGER], MANAGE_ROLES)).toBe(true);
    expect(roleSatisfies([Role.MANAGER], READ_ROLES)).toBe(true);
    expect(roleSatisfies([Role.MANAGER], OWNER_ROLES)).toBe(false);
  });

  it('accountant is read-only', () => {
    expect(roleSatisfies([Role.ACCOUNTANT], READ_ROLES)).toBe(true);
    expect(roleSatisfies([Role.ACCOUNTANT], MANAGE_ROLES)).toBe(false);
  });

  it('tenant has no workspace roles but counts for tenant-inclusive reads', () => {
    expect(roleSatisfies([Role.TENANT], READ_ROLES)).toBe(false);
    expect(roleSatisfies([Role.TENANT], READ_ROLES_WITH_TENANT)).toBe(true);
  });

  it('validates role strings', () => {
    expect(isValidRole('OWNER')).toBe(true);
    expect(isValidRole('SUPERUSER')).toBe(false);
  });
});
