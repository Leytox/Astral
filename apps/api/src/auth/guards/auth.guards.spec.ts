import { JwtAccessGuard } from './jwt-access.guard';
import { JwtRefreshGuard } from './jwt-refresh.guard';
import { LocalAuthGuard } from './local.guard';
import { OptionalJwtAuthGuard } from './jwt-optional-access.guard';

describe('Passport guards', () => {
  it('JwtAccessGuard is a canActivate guard bound to the jwt-access strategy', () => {
    expect(typeof JwtAccessGuard.prototype.canActivate).toBe('function');
    expect(new JwtAccessGuard()).toBeInstanceOf(JwtAccessGuard);
  });

  it('JwtRefreshGuard is a canActivate guard bound to the jwt-refresh strategy', () => {
    expect(typeof JwtRefreshGuard.prototype.canActivate).toBe('function');
    expect(new JwtRefreshGuard()).toBeInstanceOf(JwtRefreshGuard);
  });

  it('LocalAuthGuard is a canActivate guard bound to the local strategy', () => {
    expect(typeof LocalAuthGuard.prototype.canActivate).toBe('function');
    expect(new LocalAuthGuard()).toBeInstanceOf(LocalAuthGuard);
  });
});

describe('OptionalJwtAuthGuard', () => {
  let guard: OptionalJwtAuthGuard;

  beforeEach(() => {
    guard = new OptionalJwtAuthGuard();
  });

  it('returns null when the strategy failed', () => {
    expect(guard.handleRequest(new Error('boom'), undefined)).toBeNull();
  });

  it('returns null when no user is attached', () => {
    expect(guard.handleRequest(null, undefined)).toBeNull();
  });

  it('returns the user when authentication succeeded', () => {
    const user = { sub: 'user-1' };
    expect(guard.handleRequest(null, user)).toEqual(user);
  });
});
