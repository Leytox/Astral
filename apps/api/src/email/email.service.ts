import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Lookup } from 'geoip-lite';

@Injectable()
export class EmailService {
  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('email') private emailQueue: Queue,
  ) {}

  /**
   * Sends a welcome email to the user.
   * @param firstName First name of the user.
   * @param lastName Last name of the user.
   * @param email Email address of the user.
   * @param verificationToken Verification token for the user.
   * @returns {Promise<void>}
   */
  async welcomeEmail(
    firstName: string,
    lastName: string,
    email: string,
    verificationToken: string,
  ): Promise<void> {
    await this.emailQueue.add('welcome', {
      from: 'Astral <noreply@astral.com>',
      to: email,
      subject: 'Welcome to Astral!',
      template: './welcome',
      context: {
        firstName,
        lastName,
        url: `${this.configService.get('APP_BASE_URL')}/auth/verify/${verificationToken}`,
      },
    });
  }

  /**
   * Sends a verification code to the user.
   * @param code Verification code for the user.
   * @param email Email address of the user.
   * @returns {Promise<void>}
   */
  async verificationCode(code: string, email: string): Promise<void> {
    await this.emailQueue.add('verification', {
      from: 'Astral <noreply@astral.com>',
      to: email,
      subject: 'Your Verification Code',
      template: './verification',
      context: {
        code,
      },
    });
  }

  /**
   * Sends a reset password email to the user.
   * @param token Reset password token for the user.
   * @param email Email address of the user.
   * @param username Username of the user.
   * @returns {Promise<void>}
   */
  async resetPassword(
    token: string,
    email: string,
    username: string,
  ): Promise<void> {
    await this.emailQueue.add('resetPassword', {
      from: 'Astral <noreply@astral.com>',
      to: email,
      subject: 'Password Reset',
      template: './password-reset',
      context: {
        token,
        username,
      },
    });
  }

  /**
   * Sends a password changed email to the user.
   * @param email Email address of the user.
   * @param username Username of the user.
   * @returns {Promise<void>}
   */
  async passwordChanged(email: string, username: string): Promise<void> {
    await this.emailQueue.add('passwordChanged', {
      from: 'Astral <noreply@astral.com>',
      to: email,
      subject: 'Password Changed',
      template: './password-changed',
      context: {
        username,
      },
    });
  }

  /**
   * Sends a login email to the user.
   * @param email Email address of the user.
   * @param ip IP address of the user.
   * @param geo Geolocation of the user.
   * @param loginTime Time of the login.
   * @returns {Promise<void>}
   */
  async login(
    email: string,
    ip: string | null,
    geo: Lookup | null,
    loginTime: Date,
  ): Promise<void> {
    await this.emailQueue.add('login', {
      from: 'Astral <noreply@astral.com>',
      to: email,
      subject: 'Login',
      template: './login',
      context: {
        ip,
        location: geo
          ? `${geo.country}, ${geo.city}`
          : 'Location was not approximated',
        latitude: geo ? geo.ll[0] : 'Latitude is not defined',
        longitude: geo ? geo.ll[1] : 'Longitude is not defined',
        loginTime: loginTime.toISOString(),
      },
    });
  }

  /**
   * Sends an account verified email to the user.
   * @param email Email address of the user.
   * @returns {Promise<void>}
   */
  async accountVerified(email: string): Promise<void> {
    await this.emailQueue.add('accountVerified', {
      from: 'Astral <noreply@astral.com>',
      to: email,
      subject: 'Your account has been verified!',
      template: './account-verified',
      context: {},
    });
  }

  /**
   * Sends an account deleted email to the user.
   * @param email Email address of the user.
   * @returns {Promise<void>}
   */
  async accountDeleted(email: string): Promise<void> {
    await this.emailQueue.add('accountDeleted', {
      from: 'Astral <noreply@astral.com>',
      to: email,
      subject: 'Your account was deleted',
      template: './account-deleted',
      context: {},
    });
  }
}
