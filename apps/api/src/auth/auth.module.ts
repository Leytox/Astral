import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { LocalStrategy } from './strategies/local.strategy';
import { AccessTokenStrategy } from './strategies/jwt-access.strategy';
import { RefreshTokenStrategy } from './strategies/jwt-refresh.strategy';
import { CookieService } from './cookie.service';
import { EmailModule } from '../email/email.module';
import { OptionalTokenStrategy } from './strategies/jwt-optional.strategy';

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
