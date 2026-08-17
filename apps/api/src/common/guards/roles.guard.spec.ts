import { ExecutionContext } from '@nestjs/common';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  const mockReflector = { getAllAndOverride: jest.fn() };

  const handler = jest.fn();
  const klass = jest.fn();

  const makeContext = (user: any): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => klass,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(mockReflector as any);
  });

  it('allows access when no roles are required', () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(makeContext({ role: 'USER' }))).toBe(true);

    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      handler,
      klass,
    ]);
  });

  it('allows access when the user role matches a required role', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN'] as unknown);

    expect(guard.canActivate(makeContext({ role: 'ADMIN' }))).toBe(true);
  });

  it('denies access when the user role does not match', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN'] as unknown);

    expect(guard.canActivate(makeContext({ role: 'USER' }))).toBe(false);
  });
});
