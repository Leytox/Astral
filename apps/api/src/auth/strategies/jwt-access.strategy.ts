import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { AccessJwtPayload } from '@repo/types';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor(
    config: ConfigService,
    private readonly db: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') as string,
    });
  }

  async validate(payload: AccessJwtPayload): Promise<AccessJwtPayload> {
    const user = await this.db.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt) throw new Error('User not found');
    return payload;
  }
}
