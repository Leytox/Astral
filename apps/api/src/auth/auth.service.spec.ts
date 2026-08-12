import { Test } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import geoip from 'geoip-lite';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { TokenService } from './token.service';
import { CookieService } from './cookie.service';
import { EmailService } from '../email/email.service';
import type { Request, Response } from 'express';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('geoip-lite', () => ({
  lookup: jest.fn(),
}));

const mockBcrypt = bcrypt as unknown as {
  hash: jest.Mock;
  compare: jest.Mock;
};
const mockGeoip = geoip as unknown as { lookup: jest.Mock };

describe('AuthService', () => {
  let service: AuthService;

  const mockDb = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    passwordReset: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const mockConfigService = { get: jest.fn() };
  const mockTokenService = {
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
  };
  const mockCookieService = {
    extractRefreshTokenCookie: jest.fn(),
    appendRefreshTokenCookie: jest.fn(),
    deleteRefreshTokenCookie: jest.fn(),
  };
  const mockEmailService = {
    login: jest.fn(),
    welcomeEmail: jest.fn(),
    verificationCode: jest.fn(),
    accountVerified: jest.fn(),
    resetPassword: jest.fn(),
    passwordChanged: jest.fn(),
  };

  const user = {
    id: 'user-1',
    username: 'johndoe',
    email: 'john@example.com',
    password: 'hashed-password',
    firstName: 'John',
    lastName: 'Doe',
    role: 'USER' as const,
    verified: true,
    avatar: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      const values: Record<string, number | string> = {
        SALT_ROUNDS: '10',
        JWT_REFRESH_EXPIRES_IN: 604_800_000,
        JWT_ACCESS_EXPIRES_IN: 900_000,
      };
      return values[key];
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: CookieService, useValue: mockCookieService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  const makeResponse = () =>
    ({ cookie: jest.fn(), clearCookie: jest.fn() }) as unknown as Response;

  const makeRequest = (userPayload: Record<string, unknown> = {}) =>
    ({ user: userPayload, cookies: {} }) as unknown as Request & {
      user: any;
    };

  describe('login', () => {
    const requestInfo = {
      ip: '127.0.0.1',
      userAgent: '  Mozilla/5.0  ',
      device: 'MacBook',
    };

    it('creates a session, sets the refresh cookie, notifies by email and returns the access token', async () => {
      mockGeoip.lookup.mockReturnValue({
        city: 'Berlin',
        region: 'BE',
        country: 'DE',
      });
      mockBcrypt.hash.mockResolvedValue('hashed-refresh-token');
      mockTokenService.generateAccessToken.mockResolvedValue('access-token');
      mockTokenService.generateRefreshToken.mockResolvedValue('refresh-token');
      mockDb.userSession.create.mockResolvedValue({});
      const res = makeResponse();

      const result = await service.login(user, requestInfo, res);

      expect(result).toEqual({ access_token: 'access-token' });
      expect(mockBcrypt.hash).toHaveBeenCalledWith('refresh-token', 10);
      expect(mockDb.userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          tokenHash: 'hashed-refresh-token',
          ipAddress: '127.0.0.1',
          location: 'Berlin, BE, DE',
          userAgent: 'Mozilla/5.0',
          deviceName: 'MacBook',
        }),
      });
      expect(mockCookieService.appendRefreshTokenCookie).toHaveBeenCalledWith(
        res,
        'refresh-token',
      );
      expect(mockEmailService.login).toHaveBeenCalledWith(
        'john@example.com',
        '127.0.0.1',
        expect.objectContaining({ city: 'Berlin' }),
        expect.any(Date),
      );
    });

    it('records an Unknown location when geo lookup fails', async () => {
      mockGeoip.lookup.mockReturnValue(null);
      mockBcrypt.hash.mockResolvedValue('hashed-refresh-token');
      mockTokenService.generateAccessToken.mockResolvedValue('access-token');
      mockTokenService.generateRefreshToken.mockResolvedValue('refresh-token');
      mockDb.userSession.create.mockResolvedValue({});

      await service.login(user, requestInfo, makeResponse());

      expect(mockDb.userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ location: 'Unknown' }),
      });
    });
  });

  describe('register', () => {
    const registerDto = {
      username: 'johndoe',
      email: 'john@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('creates the user with a hashed password and verification token, then sends a welcome email', async () => {
      mockDb.user.findFirst.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue('hashed-password');
      mockDb.user.create.mockResolvedValue({});
      mockEmailService.welcomeEmail.mockResolvedValue(undefined);

      const result = await service.register(registerDto);

      expect(result).toEqual({ message: 'Account created successfully' });
      expect(mockDb.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          password: 'hashed-password',
          verificationTokens: {
            create: expect.objectContaining({
              token: expect.any(String),
              expiresAt: expect.any(Date),
            }),
          },
        }),
      });
      // The token emailed to the user must be the plaintext counterpart of the stored hash
      const created = mockDb.user.create.mock.calls[0][0].data;
      const emailedToken = mockEmailService.welcomeEmail.mock.calls[0][3];
      const { createHash } = jest.requireActual('node:crypto');
      expect(created.verificationTokens.create.token).toBe(
        createHash('sha256').update(emailedToken).digest('hex'),
      );
    });

    it('rejects when a user with the same username or email already exists', async () => {
      mockDb.user.findFirst.mockResolvedValue(user);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockDb.user.create).not.toHaveBeenCalled();
    });
  });

  describe('sendVerificationCode', () => {
    it('creates a verification token and emails it for an unverified user', async () => {
      mockDb.user.findUnique.mockResolvedValue({
        ...user,
        verified: false,
      });
      mockDb.user.update.mockResolvedValue({});

      const result = await service.sendVerificationCode('john@example.com');

      expect(result).toEqual({ message: 'Verification link was sent!' });
      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
        data: {
          verificationTokens: {
            create: expect.objectContaining({ token: expect.any(String) }),
          },
        },
      });
      expect(mockEmailService.verificationCode).toHaveBeenCalledWith(
        expect.any(String),
        'john@example.com',
      );
    });

    it('does nothing when no matching user exists', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      await service.sendVerificationCode('nobody@example.com');

      expect(mockDb.user.update).not.toHaveBeenCalled();
      expect(mockEmailService.verificationCode).not.toHaveBeenCalled();
    });

    it('does nothing for already verified users', async () => {
      mockDb.user.findUnique.mockResolvedValue(user);

      await service.sendVerificationCode('john@example.com');

      expect(mockDb.user.update).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('returns null when the user does not exist', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(service.validateUser('johndoe', 'pw')).resolves.toBeNull();
    });

    it('throws when the user is deactivated', async () => {
      mockDb.user.findUnique.mockResolvedValue({
        ...user,
        deletedAt: new Date(),
      });

      await expect(service.validateUser('johndoe', 'pw')).rejects.toThrow(
        'User is deactivated',
      );
    });

    it('throws when the user is not verified', async () => {
      mockDb.user.findUnique.mockResolvedValue({ ...user, verified: false });

      await expect(service.validateUser('johndoe', 'pw')).rejects.toThrow(
        'Please verify your account',
      );
    });

    it('returns null on a password mismatch', async () => {
      mockDb.user.findUnique.mockResolvedValue(user);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.validateUser('johndoe', 'wrong-password'),
      ).resolves.toBeNull();
    });

    it('returns the user when credentials match', async () => {
      mockDb.user.findUnique.mockResolvedValue(user);
      mockBcrypt.compare.mockResolvedValue(true);

      await expect(
        service.validateUser('johndoe', 'Password123!'),
      ).resolves.toEqual(user);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        'Password123!',
        'hashed-password',
      );
    });
  });

  describe('verifyAccount', () => {
    it('throws when no user holds a valid token', async () => {
      mockDb.user.findFirst.mockResolvedValue(null);

      await expect(service.verifyAccount('token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when the user is deactivated', async () => {
      mockDb.user.findFirst.mockResolvedValue({
        ...user,
        deletedAt: new Date(),
      });

      await expect(service.verifyAccount('token')).rejects.toThrow(
        'User is deactivated',
      );
    });

    it('throws when the account is already verified', async () => {
      mockDb.user.findFirst.mockResolvedValue(user);

      await expect(service.verifyAccount('token')).rejects.toThrow(
        'Account already verified',
      );
    });

    it('marks the user verified and notifies them', async () => {
      mockDb.user.findFirst.mockResolvedValue({ ...user, verified: false });
      mockDb.user.update.mockResolvedValue({});
      mockEmailService.accountVerified.mockResolvedValue(undefined);

      const result = await service.verifyAccount('plain-token');

      expect(result).toEqual({ message: 'Verification successful' });
      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { verified: true },
      });
      expect(mockEmailService.accountVerified).toHaveBeenCalledWith(
        'john@example.com',
      );
    });
  });

  describe('refresh', () => {
    const req = makeRequest({ jti: 'jti-1', sub: 'user-1' });
    const session = {
      jti: 'jti-1',
      userId: 'user-1',
      tokenHash: 'hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };

    it('throws when the refresh cookie is missing', async () => {
      mockCookieService.extractRefreshTokenCookie.mockReturnValue(undefined);

      await expect(service.refresh(req, makeResponse())).rejects.toThrow(
        'Refresh token not provided',
      );
    });

    it('throws when the user does not exist', async () => {
      mockCookieService.extractRefreshTokenCookie.mockReturnValue('token');
      mockDb.userSession.findUnique.mockResolvedValue(session);
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh(req, makeResponse())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when the user is deactivated', async () => {
      mockCookieService.extractRefreshTokenCookie.mockReturnValue('token');
      mockDb.userSession.findUnique.mockResolvedValue(session);
      mockDb.user.findUnique.mockResolvedValue({
        ...user,
        deletedAt: new Date(),
      });

      await expect(service.refresh(req, makeResponse())).rejects.toThrow(
        'User is deactivated',
      );
    });

    it('throws when the session is missing', async () => {
      mockCookieService.extractRefreshTokenCookie.mockReturnValue('token');
      mockDb.userSession.findUnique.mockResolvedValue(null);
      mockDb.user.findUnique.mockResolvedValue(user);

      await expect(service.refresh(req, makeResponse())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when the session is revoked', async () => {
      mockCookieService.extractRefreshTokenCookie.mockReturnValue('token');
      mockDb.userSession.findUnique.mockResolvedValue({
        ...session,
        revokedAt: new Date(),
      });
      mockDb.user.findUnique.mockResolvedValue(user);

      await expect(service.refresh(req, makeResponse())).rejects.toThrow(
        'Session revoked',
      );
    });

    it('throws when the session is expired', async () => {
      mockCookieService.extractRefreshTokenCookie.mockReturnValue('token');
      mockDb.userSession.findUnique.mockResolvedValue({
        ...session,
        expiresAt: new Date(Date.now() - 60_000),
      });
      mockDb.user.findUnique.mockResolvedValue(user);

      await expect(service.refresh(req, makeResponse())).rejects.toThrow(
        'Session expired',
      );
    });

    it('throws when the session does not belong to the user', async () => {
      mockCookieService.extractRefreshTokenCookie.mockReturnValue('token');
      mockDb.userSession.findUnique.mockResolvedValue({
        ...session,
        userId: 'someone-else',
      });
      mockDb.user.findUnique.mockResolvedValue(user);

      await expect(service.refresh(req, makeResponse())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('revokes the session and throws on a token hash mismatch', async () => {
      mockCookieService.extractRefreshTokenCookie.mockReturnValue('bad-token');
      mockDb.userSession.findUnique.mockResolvedValue(session);
      mockDb.user.findUnique.mockResolvedValue(user);
      mockBcrypt.compare.mockResolvedValue(false);
      mockDb.userSession.update.mockResolvedValue({});

      await expect(service.refresh(req, makeResponse())).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockDb.userSession.update).toHaveBeenCalledWith({
        where: { jti: 'jti-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rotates the refresh token and returns a fresh access token', async () => {
      mockCookieService.extractRefreshTokenCookie.mockReturnValue(
        'valid-token',
      );
      mockDb.userSession.findUnique.mockResolvedValue(session);
      mockDb.user.findUnique.mockResolvedValue(user);
      mockBcrypt.compare.mockResolvedValue(true);
      mockTokenService.generateRefreshToken.mockResolvedValue(
        'new-refresh-token',
      );
      mockBcrypt.hash.mockResolvedValue('new-hash');
      mockDb.userSession.update.mockResolvedValue({});
      mockTokenService.generateAccessToken.mockResolvedValue('new-access');
      const res = makeResponse();

      const result = await service.refresh(req, res);

      expect(result).toEqual({ access_token: 'new-access' });
      expect(mockDb.userSession.update).toHaveBeenCalledWith({
        where: { jti: 'jti-1' },
        data: expect.objectContaining({
          jti: expect.any(String),
          tokenHash: 'new-hash',
          lastUsedAt: expect.any(Date),
          expiresAt: expect.any(Date),
        }),
      });
      expect(mockCookieService.appendRefreshTokenCookie).toHaveBeenCalledWith(
        res,
        'new-refresh-token',
      );
    });
  });

  describe('logout', () => {
    it('revokes the current session and clears the cookie', async () => {
      mockDb.userSession.update.mockResolvedValue({});
      const res = makeResponse();
      const req = makeRequest({ jti: 'jti-1' });

      const result = await service.logout(req, res);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(mockDb.userSession.update).toHaveBeenCalledWith({
        where: { jti: 'jti-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockCookieService.deleteRefreshTokenCookie).toHaveBeenCalledWith(
        res,
      );
    });
  });

  describe('forgotPassword', () => {
    it('creates a reset token and emails it when the user exists', async () => {
      mockDb.user.findUnique.mockResolvedValue(user);
      mockDb.passwordReset.create.mockResolvedValue({});
      mockEmailService.resetPassword.mockResolvedValue(undefined);

      const result = await service.forgotPassword({
        email: 'john@example.com',
      });

      expect(result).toEqual({
        message:
          'If an account exists for this email, a password reset link has been sent',
      });
      expect(mockDb.passwordReset.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
      expect(mockEmailService.resetPassword).toHaveBeenCalledWith(
        expect.any(String),
        'john@example.com',
        'johndoe',
      );
    });

    it('does not create a reset when the user is unknown or deactivated', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      await service.forgotPassword({ email: 'nobody@example.com' });

      expect(mockDb.passwordReset.create).not.toHaveBeenCalled();
      expect(mockEmailService.resetPassword).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('throws when the reset token is unknown', async () => {
      mockDb.passwordReset.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'token', newPassword: 'NewPassword1!' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when the token is expired', async () => {
      mockDb.passwordReset.findFirst.mockResolvedValue({
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 60_000),
        usedAt: null,
      });

      await expect(
        service.resetPassword({ token: 'token', newPassword: 'NewPassword1!' }),
      ).rejects.toThrow('Token expired');
    });

    it('throws when the linked user is gone', async () => {
      mockDb.passwordReset.findFirst.mockResolvedValue({
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'token', newPassword: 'NewPassword1!' }),
      ).rejects.toThrow('User not found');
    });

    it('throws when the linked user is deactivated', async () => {
      mockDb.passwordReset.findFirst.mockResolvedValue({
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });
      mockDb.user.findUnique.mockResolvedValue({
        ...user,
        deletedAt: new Date(),
      });

      await expect(
        service.resetPassword({ token: 'token', newPassword: 'NewPassword1!' }),
      ).rejects.toThrow('User linked to this email is deactivated');
    });

    it('updates the password, revokes sessions and marks resets used in a transaction', async () => {
      mockDb.passwordReset.findFirst.mockResolvedValue({
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });
      mockDb.user.findUnique.mockResolvedValue(user);
      mockBcrypt.hash.mockResolvedValue('new-hashed-password');
      mockDb.$transaction.mockResolvedValue([]);
      mockEmailService.passwordChanged.mockResolvedValue(undefined);

      const result = await service.resetPassword({
        token: 'token',
        newPassword: 'NewPassword1!',
      });

      expect(result).toEqual({ message: 'Password reset successfully' });
      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.$transaction.mock.calls[0][0]).toHaveLength(3);
      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { password: 'new-hashed-password' },
      });
      expect(mockDb.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockDb.passwordReset.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      expect(mockEmailService.passwordChanged).toHaveBeenCalledWith(
        'john@example.com',
        'johndoe',
      );
    });
  });

  describe('listActiveSessions', () => {
    it('throws when there are no active sessions', async () => {
      mockDb.userSession.findMany.mockResolvedValue([]);

      await expect(
        service.listActiveSessions(makeRequest({ sub: 'user-1' })),
      ).rejects.toThrow('No active sessions found');
    });

    it('returns the active sessions without sensitive fields', async () => {
      const sessions = [{ jti: 'jti-1', lastUsedAt: new Date() }];
      mockDb.userSession.findMany.mockResolvedValue(sessions);

      const result = await service.listActiveSessions(
        makeRequest({ sub: 'user-1' }),
      );

      expect(result).toEqual(sessions);
      expect(mockDb.userSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        omit: {
          userId: true,
          tokenHash: true,
          revokedAt: true,
          expiresAt: true,
        },
      });
    });
  });

  describe('logoutAllSessions', () => {
    it('revokes every session of the user and clears the cookie', async () => {
      mockDb.userSession.updateMany.mockResolvedValue({ count: 3 });
      const res = makeResponse();

      const result = await service.logoutAllSessions(
        makeRequest({ sub: 'user-1' }),
        res,
      );

      expect(result).toEqual({
        message: 'Logged out from all sessions successfully',
      });
      expect(mockDb.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockCookieService.deleteRefreshTokenCookie).toHaveBeenCalledWith(
        res,
      );
    });
  });

  describe('logoutSession', () => {
    it('revokes the specific session and clears the cookie', async () => {
      mockDb.userSession.updateMany.mockResolvedValue({ count: 1 });
      const res = makeResponse();

      const result = await service.logoutSession(
        'jti-1',
        makeRequest({ sub: 'user-1' }),
        res,
      );

      expect(result).toEqual({ message: 'Removed session successfully' });
      expect(mockDb.userSession.updateMany).toHaveBeenCalledWith({
        where: { jti: 'jti-1', userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockCookieService.deleteRefreshTokenCookie).toHaveBeenCalledWith(
        res,
      );
    });
  });
});
