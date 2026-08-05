import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

@Injectable()
export class CookieService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Extract the refresh token cookie from the request
   * @param request The request object
   * @returns {string}
   */
  extractRefreshTokenCookie(request: Request): string {
    return request.cookies['refresh_token'] as string;
  }

  /**
   * Append the refresh token cookie to the response
   * @param response The response object
   * @param refreshToken The refresh token
   */
  appendRefreshTokenCookie(response: Response, refreshToken: string): void {
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: Number(this.configService.get('JWT_REFRESH_EXPIRES_IN')),
    });
  }

  /**
   * Delete the refresh token cookie from the response
   * @param response The response object
   */
  deleteRefreshTokenCookie(response: Response): void {
    response.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }
}
