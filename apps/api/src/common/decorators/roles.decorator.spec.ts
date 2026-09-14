import type { Role } from '../../generated/prisma/client';
import { ROLES_KEY, Roles } from './roles.decorator';

describe('Roles decorator', () => {
  it('exposes ROLES_KEY as "roles"', () => {
    expect(ROLES_KEY).toBe('roles');
  });

  it('sets the "roles" metadata with the given roles', () => {
    class Target {}
    const roles = ['ADMIN', 'USER'] as unknown as Role[];

    Roles(...roles)(Target);

    expect(Reflect.getMetadata('roles', Target)).toEqual(['ADMIN', 'USER']);
  });
});
