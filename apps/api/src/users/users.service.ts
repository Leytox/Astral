import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EditUserDto } from './dto/edit-user.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { User } from '../generated/prisma/client';
import { EmailService } from '../email/email.service';
import { fileTypeFromBuffer } from 'file-type';
import { UploadService } from '../upload/upload.service';
import { InjectS3, type S3 } from 'nestjs-s3';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PresignService } from '../upload/presign.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly db: PrismaService,
    private readonly emailService: EmailService,
    private readonly uploadService: UploadService,
    private readonly presignService: PresignService,
    @InjectS3() private readonly s3: S3,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get a user's profile by id
   * @param id The user id
   * @returns {Promise<Omit<User, 'password' | 'deletedAt'> | null>} returns the user's profile
   */
  async getProfile(
    id: string,
  ): Promise<Omit<User, 'password' | 'deletedAt'> | null> {
    const cacheKey = `profile:detail:${id}`;
    const cachedProfile = await this.cacheManager.get<Omit<
      User,
      'password' | 'deletedAt'
    > | null>(cacheKey);
    if (cachedProfile) return cachedProfile;

    const profile = await this.db.user.findUnique({
      where: {
        id,
      },
      omit: {
        password: true,
        deletedAt: true,
      },
    });

    if (profile?.avatar)
      profile.avatar = await this.presignService.getImageUrl(
        'avatars',
        profile.avatar,
      );

    await this.cacheManager.set(cacheKey, profile, 45_000);
    return profile;
  }

  /**
   * Get a user by id
   * @param id The user id
   * @returns {Promise<Omit<User, 'email' | 'password' | 'verified' | 'deletedAt'> | null>} returns the user
   */
  async getUserById(
    id: string,
  ): Promise<Omit<
    User,
    'email' | 'password' | 'verified' | 'deletedAt'
  > | null> {
    const cacheKey = `user:detail:${id}`;
    const cachedProfile = await this.cacheManager.get<Omit<
      User,
      'email' | 'password' | 'verified' | 'deletedAt'
    > | null>(cacheKey);
    if (cachedProfile) return cachedProfile;

    const user = await this.db.user.findUnique({
      where: {
        id,
      },
      omit: {
        email: true,
        password: true,
        verified: true,
        deletedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user?.avatar)
      user.avatar = await this.presignService.getImageUrl(
        'avatars',
        user.avatar,
      );

    await this.cacheManager.set(cacheKey, user, 45_000);
    return user;
  }

  /**
   * Upload a user's profile picture
   * @param id The user id
   * @param file The profile picture file
   * @returns {Promise<MessageResponseDto>} returns a message response dto
   */
  async uploadProfilePicture(
    id: string,
    file: Express.Multer.File,
  ): Promise<MessageResponseDto> {
    const type = await fileTypeFromBuffer(file.buffer);
    if (
      !type ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime)
    ) {
      throw new UnprocessableEntityException(
        'Invalid file type. Only image/jpeg, image/png, and image/webp are allowed.',
      );
    }
    const user = await this.db.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.avatar)
      await this.s3.deleteObject({ Bucket: 'avatars', Key: user.avatar }); // remove previous image
    const fileKey = `${id}.${type.ext}`;
    await this.uploadService.uploadFile(
      file.buffer,
      fileKey,
      type.mime,
      'avatars',
    );
    await this.db.user.update({
      where: { id },
      data: { avatar: fileKey },
    });

    await this.cacheManager.del(`user:detail:${id}`);
    await this.cacheManager.del(`profile:detail:${id}`);

    return { message: 'Profile picture uploaded successfully' };
  }

  /**
   * Edit a user's profile
   * @param id The user id
   * @param data The updated profile data
   * @returns {Promise<MessageResponseDto>} returns a message response dto
   */
  async editProfile(
    id: string,
    data: EditUserDto,
  ): Promise<MessageResponseDto> {
    await this.db.user.update({
      where: {
        id,
      },
      data,
      omit: {
        email: true,
        password: true,
        verified: true,
      },
    });

    await this.cacheManager.del(`user:detail:${id}`);
    await this.cacheManager.del(`profile:detail:${id}`);

    return { message: 'Profile updated successfully' };
  }

  /**
   * Delete a user's profile
   * @param id The user id
   * @returns {Promise<MessageResponseDto>} returns a message response dto
   */
  async deleteProfile(id: string): Promise<MessageResponseDto> {
    const timestamp = Date.now();
    const [user, sessions] = await Promise.all([
      this.db.user.findUnique({ where: { id } }),
      this.db.userSession.findMany({ where: { userId: id } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (sessions.length > 0)
      await this.db.userSession.updateMany({
        where: { userId: id },
        data: {
          revokedAt: new Date(),
        },
      });
    await this.db.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        username: `deleted_${user.username}_${timestamp}`,
        email: `deleted_${user.email}_${timestamp}`,
      },
    });
    await this.emailService.accountDeleted(user.email);

    await this.cacheManager.del(`user:detail:${id}`);
    await this.cacheManager.del(`profile:detail:${id}`);

    return { message: 'Profile deleted successfully' };
  }
}
