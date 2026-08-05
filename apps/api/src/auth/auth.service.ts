import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import type { Request, Response } from 'express';
import { User, UserSession } from '../generated/prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { CookieService } from './cookie.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../email/email.service';
import geoip from 'geoip-lite';
import crypto from 'node:crypto';
import type {
  AccessJwtPayload,
  RefreshJwtPayload,
  RequestInfo,
} from '@repo/types';
import { MessageResponseDto } from '../common/dto/message-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
    private readonly cookieService: CookieService,
    private readonly emailService: EmailService,
  ) {}

  /** Login a user and return access and refresh tokens
   * @param user - The user to login
   * @param requestInfo - The request information
   * @param res - The response object
   * @returns {Promise<{access_token: string}>}
   */
  async login(
    user: User,
    requestInfo: RequestInfo,
    res: Response,
  ): Promise<{ access_token: string }> {
    const loginAt = new Date();
    const geo = geoip.lookup(requestInfo.ip);
    const jti = randomUUID();
    const [access_token, refresh_token] = await Promise.all([
      this.tokenService.generateAccessToken(user),
      this.tokenService.generateRefreshToken(user, jti),
    ]);

    const hashedRefreshToken = await bcrypt.hash(
      refresh_token,
      Number(this.configService.get('SALT_ROUNDS')),
    );

    await this.db.userSession.create({
      data: {
        jti,
        userId: user.id,
        tokenHash: hashedRefreshToken,
        ipAddress: requestInfo?.ip,
        location: geo
          ? `${geo?.city}, ${geo?.region}, ${geo?.country}`.trim()
          : 'Unknown',
        userAgent: requestInfo.userAgent.trim(),
        deviceName: requestInfo.device.trim(),
        lastUsedAt: loginAt,
        expiresAt: new Date(
          Date.now() + Number(this.configService.get('JWT_REFRESH_EXPIRES_IN')),
        ),
      },
    });

    this.cookieService.appendRefreshTokenCookie(res, refresh_token);

    await this.emailService.login(user.email, requestInfo?.ip, geo, loginAt);

    return { access_token };
  }

  /**
   * Register a new user and return a message indicating success
   * @param registerDto The registration data
   * @returns {Promise<MessageResponseDto>}
   */
  async register(registerDto: RegisterDto): Promise<MessageResponseDto> {
    const user = await this.db.user.findFirst({
      where: {
        OR: [{ username: registerDto.username }, { email: registerDto.email }],
      },
    });
    if (user) throw new ConflictException('User already exists');
    const hashedPassword = await bcrypt.hash(
      registerDto.password,
      Number(this.configService.get('SALT_ROUNDS')),
    );
    const verificationToken = randomBytes(32).toString('hex');
    const hashedVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken, 'utf-8')
      .digest('hex');
    await this.db.user.create({
      data: {
        ...registerDto,
        password: hashedPassword,
        verificationTokens: {
          create: {
            token: hashedVerificationToken,
            expiresAt: new Date(Date.now() + 3600000), // 1 hour
          },
        },
      },
    });

    await this.emailService.welcomeEmail(
      registerDto.firstName,
      registerDto.lastName,
      registerDto.email,
      verificationToken,
    );

    return { message: 'Account created successfully' };
  }

  /**
   * Send a verification code to the user's email
   * @param email: string The email address to send the code to
   * @returns {Promise<MessageResponseDto>}
   */
  async sendVerificationCode(email: string): Promise<MessageResponseDto> {
    const user = await this.db.user.findUnique({
      where: { email },
    });
    if (user && !user.deletedAt && !user.verified) {
      const verificationToken = randomBytes(32).toString('hex');
      const hashedVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken, 'utf-8')
        .digest('hex');
      await this.db.user.update({
        where: { email },
        data: {
          verificationTokens: {
            create: {
              token: hashedVerificationToken,
              expiresAt: new Date(Date.now() + 3600000), // 1 hour
            },
          },
        },
      });
      await this.emailService.verificationCode(verificationToken, email);
    }
    return { message: 'Verification link was sent!' };
  }

  /**
   * Validate a user's credentials and return the user if valid
   * @param username The username to validate
   * @param password The password to validate
   * @returns {Promise<User | null>}
   */
  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.db.user.findUnique({
      where: { username },
    });
    if (!user) return null;
    if (user.deletedAt) throw new BadRequestException('User is deactivated');
    if (!user.verified)
      throw new BadRequestException('Please verify your account');
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return null;
    return user;
  }

  /**
   * Verify a user's account using a verification token
   * @param token The verification token to verify
   * @returns {Promise<MessageResponseDto>}
   */
  async verifyAccount(token: string): Promise<MessageResponseDto> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token, 'utf-8')
      .digest('hex');
    const user = await this.db.user.findFirst({
      where: {
        verificationTokens: {
          some: {
            token: hashedToken,
            expiresAt: { gt: new Date() },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Invalid verification token');
    if (user.deletedAt) throw new BadRequestException('User is deactivated');
    if (user.verified)
      throw new BadRequestException('Account already verified');
    await this.db.user.update({
      where: {
        id: user.id,
      },
      data: {
        verified: true,
      },
    });

    await this.emailService.accountVerified(user.email);

    return { message: 'Verification successful' };
  }

  /**
   * Refresh the user's access token using a valid refresh token
   * @param req The request object
   * @param res The response object
   * @returns {Promise<{access_token: string}>}
   */
  async refresh(
    req: Request & { user: RefreshJwtPayload },
    res: Response,
  ): Promise<{ access_token: string }> {
    const rawRefreshToken = this.cookieService.extractRefreshTokenCookie(req);
    if (!rawRefreshToken)
      throw new UnauthorizedException('Refresh token not provided');
    const [session, user] = await Promise.all([
      this.db.userSession.findUnique({
        where: {
          jti: req.user.jti,
        },
      }),
      this.db.user.findUnique({
        where: {
          id: req.user.sub,
        },
      }),
    ]);

    if (!user) throw new UnauthorizedException('Invalid refresh token');
    if (user.deletedAt) throw new BadRequestException('User is deactivated');

    if (!session) throw new UnauthorizedException('Invalid refresh token');
    if (session.revokedAt) throw new UnauthorizedException('Session revoked');
    if (session.expiresAt < new Date())
      throw new UnauthorizedException('Session expired');
    if (session.userId !== user.id)
      throw new UnauthorizedException('Invalid refresh token');

    const compareTokens = await bcrypt.compare(
      rawRefreshToken,
      session.tokenHash,
    );
    if (!compareTokens) {
      // Revoking the session if the token has a mismatch on this jti: (prevention of session fixation attacks)
      await this.db.userSession.update({
        where: { jti: session.jti },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotating refresh token
    const newJti = randomUUID();
    const newRefreshToken = await this.tokenService.generateRefreshToken(
      user,
      newJti,
    );
    const hashedNewRefreshToken = await bcrypt.hash(
      newRefreshToken,
      Number(this.configService.get('SALT_ROUNDS')),
    );
    await this.db.userSession.update({
      where: { jti: session.jti },
      data: {
        jti: newJti,
        tokenHash: hashedNewRefreshToken,
        lastUsedAt: new Date(),
        expiresAt: new Date(
          Date.now() + Number(this.configService.get('JWT_REFRESH_EXPIRES_IN')),
        ),
      },
    });
    const access_token = await this.tokenService.generateAccessToken(user);

    this.cookieService.appendRefreshTokenCookie(res, newRefreshToken);
    return { access_token };
  }

  /**
   * Logout the user and revoke their session
   * @param req The request object
   * @param res The response object
   * @returns {Promise<MessageResponseDto>}
   */
  async logout(
    req: Request & { user: RefreshJwtPayload },
    res: Response,
  ): Promise<MessageResponseDto> {
    await this.db.userSession.update({
      where: { jti: req.user.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.cookieService.deleteRefreshTokenCookie(res);
    return { message: 'Logged out successfully' };
  }

  /**
   * Forgot password flow: send a reset token to the user's email
   * @param body The forgot password data
   * @returns {Promise<MessageResponseDto>}
   */
  async forgotPassword(body: ForgotPasswordDto): Promise<MessageResponseDto> {
    const user = await this.db.user.findUnique({
      where: {
        email: body.email,
      },
    });
    if (user && !user.deletedAt) {
      const token = randomBytes(32).toString('hex');
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
      await this.db.passwordReset.create({
        data: {
          token: hashedToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      await this.emailService.resetPassword(token, user.email, user.username);
    }

    return {
      message:
        'If an account exists for this email, a password reset link has been sent',
    };
  }

  /**
   * Reset a user's password using a password reset token
   * @param body The reset password data
   * @returns {Promise<MessageResponseDto>}
   */
  async resetPassword(body: ResetPasswordDto): Promise<MessageResponseDto> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(body.token)
      .digest('hex');
    const pr = await this.db.passwordReset.findFirst({
      where: { token: hashedToken, usedAt: null },
    });
    if (!pr) throw new NotFoundException('Password reset token not found');

    const now = new Date();
    if (pr.expiresAt < now) throw new BadRequestException('Token expired');

    const user = await this.db.user.findUnique({
      where: {
        id: pr.userId,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletedAt)
      throw new BadRequestException('User linked to this email is deactivated');

    const newHashedPassword = await bcrypt.hash(
      body.newPassword,
      Number(this.configService.get('SALT_ROUNDS')),
    );

    await this.db.$transaction([
      this.db.user.update({
        where: {
          id: user.id,
        },
        data: {
          password: newHashedPassword,
        },
      }),
      this.db.userSession.updateMany({
        where: {
          userId: user.id,
        },
        data: { revokedAt: new Date() },
      }),
      this.db.passwordReset.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    await this.emailService.passwordChanged(user.email, user.username);

    return { message: 'Password reset successfully' };
  }

  /**
   * List all active sessions for the user
   * @param req The request object
   * @returns {Promise<Array<Omit<UserSession, 'userId' | 'tokenHash' | 'revokedAt' | 'expiresAt'>>}
   */
  async listActiveSessions(
    req: Request & { user: AccessJwtPayload },
  ): Promise<
    Array<Omit<UserSession, 'userId' | 'tokenHash' | 'revokedAt' | 'expiresAt'>>
  > {
    const sessions = await this.db.userSession.findMany({
      where: {
        userId: req.user.sub,
        revokedAt: null,
      },
      omit: {
        userId: true,
        tokenHash: true,
        revokedAt: true,
        expiresAt: true,
      },
    });
    if (!sessions.length)
      throw new NotFoundException('No active sessions found');
    return sessions;
  }

  /**
   * Logout all active sessions for the user
   * @param req The request object
   * @param res The response object
   * @returns {Promise<MessageResponseDto>}
   */
  async logoutAllSessions(
    req: Request & { user: AccessJwtPayload },
    res: Response,
  ): Promise<MessageResponseDto> {
    await this.db.userSession.updateMany({
      where: {
        userId: req.user.sub,
      },
      data: { revokedAt: new Date() },
    });
    this.cookieService.deleteRefreshTokenCookie(res);
    return { message: 'Logged out from all sessions successfully' };
  }

  /**
   * Logout a specific session for the user
   * @param sessionId The session ID to logout
   * @param req The request object
   * @param res The response object
   * @returns {Promise<MessageResponseDto>}
   */
  async logoutSession(
    sessionId: string,
    req: Request & { user: RefreshJwtPayload },
    res: Response,
  ): Promise<MessageResponseDto> {
    await this.db.userSession.updateMany({
      where: {
        jti: sessionId,
        userId: req.user.sub,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    this.cookieService.deleteRefreshTokenCookie(res);
    return { message: 'Removed session successfully' };
  }
}
