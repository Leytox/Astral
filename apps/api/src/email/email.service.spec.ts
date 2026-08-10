import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Lookup } from 'geoip-lite';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;
  const mockConfigService = { get: jest.fn() };
  const mockEmailQueue = { add: jest.fn() };

  const geo: Lookup = {
    country: 'Ukraine',
    city: 'Kyiv',
    ll: [50.45, 30.52],
  } as Lookup;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'APP_BASE_URL' ? 'https://astral.example.com' : undefined,
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getQueueToken('email'), useValue: mockEmailQueue },
      ],
    }).compile();

    service = moduleRef.get(EmailService);
  });

  describe('welcomeEmail', () => {
    it('queues a welcome job with the verification url built from APP_BASE_URL', async () => {
      await service.welcomeEmail(
        'John',
        'Doe',
        'john@example.com',
        'token-123',
      );

      expect(mockConfigService.get).toHaveBeenCalledWith('APP_BASE_URL');
      expect(mockEmailQueue.add).toHaveBeenCalledWith('welcome', {
        from: 'Astral <noreply@astral.com>',
        to: 'john@example.com',
        subject: 'Welcome to Astral!',
        template: './welcome',
        context: {
          firstName: 'John',
          lastName: 'Doe',
          url: 'https://astral.example.com/auth/verify/token-123',
        },
      });
    });
  });

  describe('verificationCode', () => {
    it('queues a verification job with the code', async () => {
      await service.verificationCode('123456', 'john@example.com');

      expect(mockEmailQueue.add).toHaveBeenCalledWith('verification', {
        from: 'Astral <noreply@astral.com>',
        to: 'john@example.com',
        subject: 'Your Verification Code',
        template: './verification',
        context: {
          code: '123456',
        },
      });
    });
  });

  describe('resetPassword', () => {
    it('queues a reset password job with the token and username', async () => {
      await service.resetPassword('reset-token', 'john@example.com', 'johndoe');

      expect(mockEmailQueue.add).toHaveBeenCalledWith('resetPassword', {
        from: 'Astral <noreply@astral.com>',
        to: 'john@example.com',
        subject: 'Password Reset',
        template: './password-reset',
        context: {
          token: 'reset-token',
          username: 'johndoe',
        },
      });
    });
  });

  describe('passwordChanged', () => {
    it('queues a password changed job with the username', async () => {
      await service.passwordChanged('john@example.com', 'johndoe');

      expect(mockEmailQueue.add).toHaveBeenCalledWith('passwordChanged', {
        from: 'Astral <noreply@astral.com>',
        to: 'john@example.com',
        subject: 'Password Changed',
        template: './password-changed',
        context: {
          username: 'johndoe',
        },
      });
    });
  });

  describe('login', () => {
    it('formats the geolocation and ISO login time when geo is present', async () => {
      const loginTime = new Date('2026-08-10T12:00:00.000Z');
      await service.login('john@example.com', '1.2.3.4', geo, loginTime);

      expect(mockEmailQueue.add).toHaveBeenCalledWith('login', {
        from: 'Astral <noreply@astral.com>',
        to: 'john@example.com',
        subject: 'Login',
        template: './login',
        context: {
          ip: '1.2.3.4',
          location: 'Ukraine, Kyiv',
          latitude: 50.45,
          longitude: 30.52,
          loginTime: '2026-08-10T12:00:00.000Z',
        },
      });
    });

    it('falls back to placeholders when geo is null', async () => {
      const loginTime = new Date('2026-08-10T12:00:00.000Z');
      await service.login('john@example.com', null, null, loginTime);

      expect(mockEmailQueue.add).toHaveBeenCalledWith('login', {
        from: 'Astral <noreply@astral.com>',
        to: 'john@example.com',
        subject: 'Login',
        template: './login',
        context: {
          ip: null,
          location: 'Location was not approximated',
          latitude: 'Latitude is not defined',
          longitude: 'Longitude is not defined',
          loginTime: loginTime.toISOString(),
        },
      });
    });

    it('emits the login time as an ISO string', async () => {
      const loginTime = new Date('2026-08-10T12:00:00.000Z');
      await service.login('john@example.com', '1.2.3.4', geo, loginTime);

      const context = mockEmailQueue.add.mock.calls[0][1].context;
      expect(context.loginTime).toBe(loginTime.toISOString());
      expect(context.loginTime).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('accountVerified', () => {
    it('queues an account verified job', async () => {
      await service.accountVerified('john@example.com');

      expect(mockEmailQueue.add).toHaveBeenCalledWith('accountVerified', {
        from: 'Astral <noreply@astral.com>',
        to: 'john@example.com',
        subject: 'Your account has been verified!',
        template: './account-verified',
        context: {},
      });
    });
  });

  describe('accountDeleted', () => {
    it('queues an account deleted job', async () => {
      await service.accountDeleted('john@example.com');

      expect(mockEmailQueue.add).toHaveBeenCalledWith('accountDeleted', {
        from: 'Astral <noreply@astral.com>',
        to: 'john@example.com',
        subject: 'Your account was deleted',
        template: './account-deleted',
        context: {},
      });
    });
  });
});
