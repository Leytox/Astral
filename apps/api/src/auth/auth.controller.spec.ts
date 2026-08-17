import { Test } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// AuthService module is loaded transitively; keep its external deps mocked.
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('geoip-lite', () => ({
  lookup: jest.fn(),
}));

describe('AuthController', () => {
  let controller: AuthController;
  const mockAuthService = {
    login: jest.fn(),
    register: jest.fn(),
    sendVerificationCode: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    verifyAccount: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    listActiveSessions: jest.fn(),
    logoutAllSessions: jest.fn(),
    logoutSession: jest.fn(),
  };

  const req = { user: { sub: 'user-1', jti: 'jti-1' } };
  const res = { cookie: jest.fn(), clearCookie: jest.fn() };
  const requestInfo = { ip: '127.0.0.1', userAgent: 'UA', device: 'Mac' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  it('delegates login', async () => {
    mockAuthService.login.mockResolvedValue({ access_token: 'token' });

    await controller.login(req as any, requestInfo, res as any);

    expect(mockAuthService.login).toHaveBeenCalledWith(
      req.user,
      requestInfo,
      res,
    );
  });

  it('delegates register', async () => {
    const dto = { username: 'johndoe' };
    mockAuthService.register.mockResolvedValue({
      message: 'Account created successfully',
    });

    await controller.register(dto as any);

    expect(mockAuthService.register).toHaveBeenCalledWith(dto);
  });

  it('delegates sendVerificationCode', async () => {
    const dto = { email: 'john@example.com' };
    mockAuthService.sendVerificationCode.mockResolvedValue({
      message: 'Verification link was sent!',
    });

    await controller.sendVerificationCode(dto);

    expect(mockAuthService.sendVerificationCode).toHaveBeenCalledWith(
      'john@example.com',
    );
  });

  it('delegates refresh', async () => {
    mockAuthService.refresh.mockResolvedValue({ access_token: 'token' });

    await controller.refresh(req as any, res as any);

    expect(mockAuthService.refresh).toHaveBeenCalledWith(req, res);
  });

  it('delegates logout', async () => {
    mockAuthService.logout.mockResolvedValue({
      message: 'Logged out successfully',
    });

    await controller.logout(req as any, res as any);

    expect(mockAuthService.logout).toHaveBeenCalledWith(req, res);
  });

  it('delegates verifyAccount', async () => {
    mockAuthService.verifyAccount.mockResolvedValue({
      message: 'Verification successful',
    });

    await controller.verifyAccount('token-1');

    expect(mockAuthService.verifyAccount).toHaveBeenCalledWith('token-1');
  });

  it('delegates forgotPassword', async () => {
    const dto = { email: 'john@example.com' };
    mockAuthService.forgotPassword.mockResolvedValue({
      message:
        'If an account exists for this email, a password reset link has been sent',
    });

    await controller.forgotPassword(dto);

    expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto);
  });

  it('delegates resetPassword', async () => {
    const dto = { token: 't', newPassword: 'NewPassword1!' };
    mockAuthService.resetPassword.mockResolvedValue({
      message: 'Password reset successfully',
    });

    await controller.resetPassword(dto);

    expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
  });

  it('delegates listActiveSessions', async () => {
    mockAuthService.listActiveSessions.mockResolvedValue([]);

    await controller.listActiveSessions(req as any);

    expect(mockAuthService.listActiveSessions).toHaveBeenCalledWith(req);
  });

  it('delegates logoutAllSessions', async () => {
    mockAuthService.logoutAllSessions.mockResolvedValue({
      message: 'Logged out from all sessions successfully',
    });

    await controller.logoutAllSessions(req as any, res as any);

    expect(mockAuthService.logoutAllSessions).toHaveBeenCalledWith(req, res);
  });

  it('delegates logoutSession', async () => {
    mockAuthService.logoutSession.mockResolvedValue({
      message: 'Removed session successfully',
    });

    await controller.logoutSession('jti-1', req as any, res as any);

    expect(mockAuthService.logoutSession).toHaveBeenCalledWith(
      'jti-1',
      req,
      res,
    );
  });
});
