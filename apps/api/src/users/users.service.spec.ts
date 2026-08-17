import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { fileTypeFromBuffer } from 'file-type';

import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { PresignService } from '../upload/presign.service';
import { UploadService } from '../upload/upload.service';
import { UsersService } from './users.service';

// file-type is ESM-only; both users.service and this spec load it.
jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
}));

const mockFileType = fileTypeFromBuffer as jest.Mock;

describe('UsersService', () => {
  let service: UsersService;

  const mockDb = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userSession: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const mockEmailService = {
    accountDeleted: jest.fn(),
  };
  const mockUploadService = {
    uploadFile: jest.fn(),
  };
  const mockPresignService = {
    getSongPlayUrl: jest.fn(),
    getImageUrl: jest.fn(),
  };
  const mockS3 = {
    getObject: jest.fn(),
    headObject: jest.fn(),
    putObject: jest.fn(),
    deleteObject: jest.fn(),
    listBuckets: jest.fn(),
  };
  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const user = {
    id: 'user-1',
    username: 'johndoe',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    verified: true,
    avatar: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockDb },
        { provide: EmailService, useValue: mockEmailService },
        { provide: UploadService, useValue: mockUploadService },
        { provide: PresignService, useValue: mockPresignService },
        { provide: 'default_S3ModuleConnectionToken', useValue: mockS3 },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('getProfile', () => {
    it('returns the cached profile without querying the database', async () => {
      mockCache.get.mockResolvedValue(user);

      const result = await service.getProfile('user-1');

      expect(result).toBe(user);
      expect(mockDb.user.findUnique).not.toHaveBeenCalled();
    });

    it('fetches the profile from the database and caches it for 45s', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.user.findUnique.mockResolvedValue(user);

      const result = await service.getProfile('user-1');

      expect(result).toBe(user);
      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        omit: { password: true, deletedAt: true },
      });
      expect(mockCache.set).toHaveBeenCalledWith(
        'profile:detail:user-1',
        user,
        45_000,
      );
    });

    it('returns null instead of throwing when the user does not exist', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.user.findUnique.mockResolvedValue(null);

      const result = await service.getProfile('missing');

      expect(result).toBeNull();
      expect(mockCache.set).toHaveBeenCalledWith(
        'profile:detail:missing',
        null,
        45_000,
      );
    });
  });

  describe('getUserById', () => {
    it('returns the cached user without querying the database', async () => {
      mockCache.get.mockResolvedValue(user);

      const result = await service.getUserById('user-1');

      expect(result).toBe(user);
      expect(mockDb.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the user does not exist', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('fetches the user from the database and caches it for 45s', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.user.findUnique.mockResolvedValue(user);

      const result = await service.getUserById('user-1');

      expect(result).toBe(user);
      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        omit: {
          email: true,
          password: true,
          verified: true,
          deletedAt: true,
        },
      });
      expect(mockCache.set).toHaveBeenCalledWith(
        'user:detail:user-1',
        user,
        45_000,
      );
    });
  });

  describe('uploadProfilePicture', () => {
    const file = { buffer: Buffer.from('avatar-data') } as Express.Multer.File;

    it('throws UnprocessableEntityException when the file type is not an image', async () => {
      mockFileType.mockResolvedValue({ ext: 'txt', mime: 'text/plain' });

      await expect(
        service.uploadProfilePicture('user-1', file),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockDb.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws UnprocessableEntityException when the file type cannot be detected', async () => {
      mockFileType.mockResolvedValue(undefined);

      await expect(
        service.uploadProfilePicture('user-1', file),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      mockFileType.mockResolvedValue({ ext: 'png', mime: 'image/png' });
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadProfilePicture('missing', file),
      ).rejects.toThrow(NotFoundException);
      expect(mockUploadService.uploadFile).not.toHaveBeenCalled();
    });

    it('deletes the previous avatar from S3 when the user already has one', async () => {
      mockFileType.mockResolvedValue({ ext: 'png', mime: 'image/png' });
      mockDb.user.findUnique.mockResolvedValue({
        ...user,
        avatar: 'old-avatar.png',
      });

      await service.uploadProfilePicture('user-1', file);

      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: 'avatars',
        Key: 'old-avatar.png',
      });
    });

    it('uploads the new avatar, updates the user and clears both cache keys', async () => {
      mockFileType.mockResolvedValue({ ext: 'png', mime: 'image/png' });
      mockDb.user.findUnique.mockResolvedValue(user);
      mockDb.user.update.mockResolvedValue({});

      const result = await service.uploadProfilePicture('user-1', file);

      expect(mockUploadService.uploadFile).toHaveBeenCalledWith(
        file.buffer,
        'user-1.png',
        'image/png',
        'avatars',
      );
      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { avatar: 'user-1.png' },
      });
      expect(mockCache.del).toHaveBeenCalledWith('user:detail:user-1');
      expect(mockCache.del).toHaveBeenCalledWith('profile:detail:user-1');
      expect(result).toEqual({
        message: 'Profile picture uploaded successfully',
      });
    });
  });

  describe('editProfile', () => {
    it('updates the user and clears both cache keys', async () => {
      const dto = { firstName: 'Jane' };
      mockDb.user.update.mockResolvedValue({});

      const result = await service.editProfile('user-1', dto as any);

      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: dto,
        omit: { email: true, password: true, verified: true },
      });
      expect(mockCache.del).toHaveBeenCalledWith('user:detail:user-1');
      expect(mockCache.del).toHaveBeenCalledWith('profile:detail:user-1');
      expect(result).toEqual({ message: 'Profile updated successfully' });
    });
  });

  describe('deleteProfile', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);
      mockDb.userSession.findMany.mockResolvedValue([]);

      await expect(service.deleteProfile('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockDb.user.update).not.toHaveBeenCalled();
    });

    it('revokes all sessions when the user has sessions', async () => {
      mockDb.user.findUnique.mockResolvedValue(user);
      mockDb.userSession.findMany.mockResolvedValue([
        { id: 's1' },
        { id: 's2' },
      ]);
      mockDb.user.update.mockResolvedValue({});

      await service.deleteProfile('user-1');

      expect(mockDb.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('updates the user with deleted_ prefixed credentials, emails them and clears the cache', async () => {
      mockDb.user.findUnique.mockResolvedValue(user);
      mockDb.userSession.findMany.mockResolvedValue([]);
      mockDb.user.update.mockResolvedValue({});
      mockEmailService.accountDeleted.mockResolvedValue(undefined);

      const result = await service.deleteProfile('user-1');

      expect(mockDb.userSession.updateMany).not.toHaveBeenCalled();
      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          deletedAt: expect.any(Date),
          username: expect.stringContaining('deleted_johndoe_'),
          email: expect.stringContaining('deleted_john@example.com_'),
        },
      });
      expect(mockEmailService.accountDeleted).toHaveBeenCalledWith(
        'john@example.com',
      );
      expect(mockCache.del).toHaveBeenCalledWith('user:detail:user-1');
      expect(mockCache.del).toHaveBeenCalledWith('profile:detail:user-1');
      expect(result).toEqual({ message: 'Profile deleted successfully' });
    });
  });
});
