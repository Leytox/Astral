import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { EmailModule } from '../email/email.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CookieService } from './cookie.service';
import { AccessTokenStrategy } from './strategies/jwt-access.strategy';
import { OptionalTokenStrategy } from './strategies/jwt-optional.strategy';
import { RefreshTokenStrategy } from './strategies/jwt-refresh.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.register({}), EmailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    CookieService,
    LocalStrategy,
    AccessTokenStrategy,
    RefreshTokenStrategy,
    OptionalTokenStrategy,
  ],
  exports: [AccessTokenStrategy, RefreshTokenStrategy, OptionalTokenStrategy],
})
export class AuthModule {}
