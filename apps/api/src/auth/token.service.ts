import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { User } from '../generated/prisma/client';

@Injectable()
export class TokenService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Generate an access token for the user
   * @param user The user object
   * @returns {Promise<string>}
   */
  async generateAccessToken(user: User): Promise<string> {
    return await this.jwtService.signAsync(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
      },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: Number(
          this.configService.get('JWT_ACCESS_EXPIRES_IN') / 1000,
        ),
      },
    );
  }

  /**
   * Generate a refresh token for the user
   * @param user The user object
   * @param sessionId The session ID
   * @returns {Promise<string>}
   */
  async generateRefreshToken(user: User, sessionId: string): Promise<string> {
    return await this.jwtService.signAsync(
      {
        sub: user.id,
        username: user.username,
        jti: sessionId,
      },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: Number(
          this.configService.get('JWT_REFRESH_EXPIRES_IN') / 1000,
        ),
      },
    );
  }
}
