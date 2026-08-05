import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AccessJwtPayload } from '@repo/types';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class OptionalTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-optional',
) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') as string,
    });
  }

  validate(payload: AccessJwtPayload): AccessJwtPayload {
    return payload;
  }
}
