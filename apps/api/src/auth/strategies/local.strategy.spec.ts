import { UnauthorizedException } from '@nestjs/common';

import { LocalStrategy } from './local.strategy';

// AuthService module is loaded transitively; keep its external deps mocked.
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('geoip-lite', () => ({
  lookup: jest.fn(),
}));

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  const mockAuthService = { validateUser: jest.fn() };

  const user = {
    id: 'user-1',
    username: 'johndoe',
    role: 'USER',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new LocalStrategy(mockAuthService as any);
  });

  it('returns the user when credentials are valid', async () => {
    mockAuthService.validateUser.mockResolvedValue(user);

    await expect(strategy.validate('johndoe', 'Password123!')).resolves.toEqual(
      user,
    );
    expect(mockAuthService.validateUser).toHaveBeenCalledWith(
      'johndoe',
      'Password123!',
    );
  });

  it('throws UnauthorizedException when credentials are invalid', async () => {
    mockAuthService.validateUser.mockResolvedValue(null);

    await expect(
      strategy.validate('johndoe', 'wrong-password'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
