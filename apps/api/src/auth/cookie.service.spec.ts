import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CookieService } from './cookie.service';
import type { Request, Response } from 'express';

describe('CookieService', () => {
  let service: CookieService;
  const mockConfigService = { get: jest.fn() };
  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      const values: Record<string, number | string> = {
        JWT_REFRESH_EXPIRES_IN: 604_800_000,
      };
      return values[key];
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        CookieService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = moduleRef.get(CookieService);
  });

  describe('extractRefreshTokenCookie', () => {
    it('returns the refresh_token cookie value', () => {
      const request = {
        cookies: { refresh_token: 'cookie-value' },
      } as unknown as Request;

      expect(service.extractRefreshTokenCookie(request)).toBe('cookie-value');
    });

    it('returns undefined when the cookie is absent', () => {
      const request = { cookies: {} } as unknown as Request;

      expect(service.extractRefreshTokenCookie(request)).toBeUndefined();
    });
  });

  describe('appendRefreshTokenCookie', () => {
    it('sets an httpOnly, sameSite=strict cookie with the configured maxAge', () => {
      service.appendRefreshTokenCookie(mockResponse, 'refresh-token');

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          maxAge: 604_800_000,
          secure: false,
        }),
      );
    });

    it('marks the cookie secure in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        service.appendRefreshTokenCookie(mockResponse, 'refresh-token');

        expect(mockResponse.cookie).toHaveBeenCalledWith(
          'refresh_token',
          'refresh-token',
          expect.objectContaining({ secure: true }),
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('deleteRefreshTokenCookie', () => {
    it('clears the refresh_token cookie with the same attributes', () => {
      service.deleteRefreshTokenCookie(mockResponse);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          secure: false,
        }),
      );
    });
  });
});
