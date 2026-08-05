import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Req,
  Res,
  Param,
  Get,
  Delete,
  Patch,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { User } from '../generated/prisma/client';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import type { Request, Response } from 'express';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerificationCodeDto } from './dto/verification-code.dto';
import { GetRequestInfo } from '../common/decorators/request-info.decorator';
import type {
  AccessJwtPayload,
  RefreshJwtPayload,
  RequestInfo,
} from '@repo/types';
import { Throttle } from '@nestjs/throttler';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { SessionDto } from './dto/session.dto';
import { LocalAuthGuard } from './guards/local.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { JwtAccessGuard } from './guards/jwt-access.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Login to an existing account',
    description: 'Returns access and refresh JWT tokens upon successful login',
  })
  @ApiOkResponse({
    description: 'Login successful',
    example: {
      accessToken:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    },
  })
  @ApiBadRequestResponse({
    description: 'Unverified user',
  })
  @ApiBody({
    description: 'User login payload',
    type: LoginDto,
    examples: {
      valid: {
        value: {
          username: 'johndoe',
          password: '$Password123',
        },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @Throttle({
    default: {
      limit: 4,
      ttl: 60_000,
    },
  })
  async login(
    @Req() req: Request & { user: User },
    @GetRequestInfo() requestInfo: RequestInfo,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.authService.login(req.user, requestInfo, res);
  }

  @ApiOperation({
    summary: 'Create a new account',
    description: 'Creates a new user account',
  })
  @ApiCreatedResponse({
    description: 'Account created successfully',
    type: MessageResponseDto,
  })
  @ApiConflictResponse({
    description: 'User already exists',
  })
  @ApiBody({
    description: 'User creation payload',
    type: RegisterDto,
    examples: {
      valid: {
        value: {
          email: 'user@example.com',
          password: '$Password123',
          firstName: 'John',
          lastName: 'Doe',
          username: 'johndoe',
        },
      },
    },
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async register(@Body() registerDto: RegisterDto) {
    return await this.authService.register(registerDto);
  }

  @ApiOperation({
    summary: 'Send a verification code',
    description: 'Sends a verification code to the provided email address',
  })
  @ApiOkResponse({
    description:
      'If an account exists for this email, a password reset link has been sent',
    type: MessageResponseDto,
  })
  @ApiBody({
    description: 'User creation payload',
    type: VerificationCodeDto,
    examples: {
      valid: {
        value: {
          email: 'user@example.com',
        },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  @Post('verification-codes')
  @Throttle({ default: { limit: 3, ttl: 6 * 60_000 } })
  async sendVerificationCode(@Body() verificationCodeDto: VerificationCodeDto) {
    return await this.authService.sendVerificationCode(
      verificationCodeDto.email,
    );
  }

  @ApiCookieAuth('refresh_token')
  @ApiOperation({
    summary: 'Returns new tokens',
    description:
      'Returns new access and refresh token and invalidates the old refresh token',
  })
  @ApiUnauthorizedResponse({
    description: 'Token is not provided or invalid',
  })
  @ApiOkResponse({
    description: 'Tokens refreshed successfully',
    type: RefreshDto,
    headers: {
      'Set-Cookie': {
        description: 'Refresh token cookie',
        schema: {
          type: 'string',
          example:
            'refresh_token=some_pretty_long_token; HttpOnly; Secure; SameSite=Strict',
        },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refresh(
    @Req() req: Request & { user: RefreshJwtPayload },
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshDto | null> {
    return await this.authService.refresh(req, res);
  }

  @ApiCookieAuth('refresh_token')
  @ApiOperation({
    summary: 'Logs out the user',
    description: 'Invalidates the refresh token and logs out the user',
  })
  @ApiUnauthorizedResponse({
    description: 'Token is not provided or invalid',
  })
  @ApiOkResponse({
    description: 'User logged out successfully',
    type: MessageResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @Delete('session')
  async logout(
    @Req() req: Request & { user: RefreshJwtPayload },
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.authService.logout(req, res);
  }

  @ApiOperation({
    summary: 'Verify user',
    description: 'Verificates a user by a token',
  })
  @ApiParam({
    name: 'token',
    description: 'The unique verification token',
    required: true,
    example: '21bf6733253be1559fff32f813b95a56309714b2ba86f5e82ccd7b91c09f5e80',
  })
  @ApiNotFoundResponse({
    description: 'Invalid verification token',
  })
  @ApiBadRequestResponse({
    description: 'User is deactivated or verified',
  })
  @ApiOkResponse({
    description: 'Verification successful',
    type: MessageResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  @Patch('verifications/:token')
  async verifyAccount(@Param('token') token: string) {
    return await this.authService.verifyAccount(token);
  }

  @ApiOperation({
    summary: 'Sends a password reset email',
    description:
      'Sends a password reset email to the provided user email address',
  })
  @ApiOkResponse({
    description:
      'If an account exists for this email, a password reset link has been sent',
    type: MessageResponseDto,
  })
  @ApiBody({
    type: ForgotPasswordDto,
  })
  @HttpCode(HttpStatus.OK)
  @Post('password-resets')
  @Throttle({ default: { limit: 3, ttl: 6 * 60_000 } })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return await this.authService.forgotPassword(body);
  }

  @ApiOperation({
    summary: "Resets user's password",
    description: "Resets user's password by provided token and a new password",
  })
  @ApiNotFoundResponse({
    description: 'Password reset token not found',
  })
  @ApiBadRequestResponse({
    description: 'Token expired or user is deactivated',
  })
  @ApiOkResponse({
    description: 'Password reset successfully',
    type: MessageResponseDto,
  })
  @ApiBody({
    type: ResetPasswordDto,
  })
  @HttpCode(HttpStatus.OK)
  @Patch('password-resets')
  @Throttle({ default: { limit: 3, ttl: 6 * 60_000 } })
  async resetPassword(@Body() body: ResetPasswordDto) {
    return await this.authService.resetPassword(body);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List all active sessions',
    description: 'List all active sessions for the current user',
  })
  @ApiNotFoundResponse({
    description: 'No active sessions found',
  })
  @ApiOkResponse({
    description: 'List of active sessions',
    type: SessionDto,
    isArray: true,
  })
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  @Get('sessions')
  async listActiveSessions(@Req() req: Request & { user: AccessJwtPayload }) {
    return await this.authService.listActiveSessions(req);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout all active sessions',
    description: 'Logout all active sessions for the current user',
  })
  @ApiOkResponse({
    description: 'Logged out from all sessions successfully',
    type: MessageResponseDto,
  })
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  @Delete('sessions')
  async logoutAllSessions(
    @Req() req: Request & { user: AccessJwtPayload },
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.authService.logoutAllSessions(req, res);
  }

  @ApiCookieAuth('refresh_token')
  @ApiOperation({
    summary: 'Logout from a session',
    description:
      'Logout from the specified session using the refresh token and session id',
  })
  @ApiOkResponse({
    description: 'Removed session successfully',
    type: MessageResponseDto,
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Id of the session to logout from',
  })
  @Delete('/sessions/:sessionId')
  @UseGuards(JwtAccessGuard)
  async logoutSession(
    @Param('sessionId') sessionId: string,
    @Req() req: Request & { user: RefreshJwtPayload },
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.authService.logoutSession(sessionId, req, res);
  }
}
