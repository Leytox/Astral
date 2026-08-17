import { getQueueToken } from '@nestjs/bullmq';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
  StreamableFile,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { fileTypeFromFile } from 'file-type';
import { copyFile, unlink } from 'fs/promises';
import { Readable } from 'stream';

import { AUDIO_QUALITIES } from '../common/consts';
import { PrismaService } from '../database/prisma.service';
import { PresignService } from '../upload/presign.service';
import { UploadService } from '../upload/upload.service';
import { SongsService } from './songs.service';

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  ...jest.requireActual('fs/promises'),
  copyFile: jest.fn(),
  unlink: jest.fn(),
}));

const mockFileTypeFromFile = fileTypeFromFile as unknown as jest.Mock;
const mockCopyFile = copyFile as unknown as jest.Mock;
const mockUnlink = unlink as unknown as jest.Mock;

describe('SongsService', () => {
  let service: SongsService;

  const mockDb = {
    album: { findUnique: jest.fn() },
    song: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    likedSong: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const mockUploadService = { uploadFile: jest.fn() };
  const mockPresignService = {
    getSongPlayUrl: jest.fn(),
    getImageUrl: jest.fn(),
  };
  const mockAudioQueue = { add: jest.fn() };
  const mockS3 = {
    getObject: jest.fn(),
    headObject: jest.fn(),
    deleteObject: jest.fn(),
  };
  const mockCacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

  const song = {
    id: 'song-1',
    title: 'Track',
    albumId: 'album-1',
    genreId: 'genre-1',
    duration: 120,
  };

  const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    set: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SongsService,
        { provide: PrismaService, useValue: mockDb },
        { provide: UploadService, useValue: mockUploadService },
        { provide: PresignService, useValue: mockPresignService },
        { provide: getQueueToken('audio'), useValue: mockAudioQueue },
        { provide: 'default_S3ModuleConnectionToken', useValue: mockS3 },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = moduleRef.get(SongsService);
  });

  describe('play', () => {
    it('returns the whole file stream with an OK status when no range is given', async () => {
      mockDb.song.findUnique.mockResolvedValue(song);
      mockS3.getObject.mockResolvedValue({
        Body: Readable.from(['audio']),
        ContentType: 'audio/mp4',
        ContentLength: 1000,
      });
      const res = makeRes();

      const result = await service.play(
        'song-1',
        undefined as any,
        res as any,
        undefined as any,
      );

      expect(result).toBeInstanceOf(StreamableFile);
      expect(mockDb.song.findUnique).toHaveBeenCalledWith({
        where: { id: 'song-1', album: { user: { deletedAt: null } } },
      });
      expect(mockS3.getObject).toHaveBeenCalledWith({
        Bucket: 'songs',
        Key: 'song-1',
      });
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.set).toHaveBeenCalledWith({
        'Content-Length': 1000,
        'Content-Type': 'audio/mp4',
      });
    });

    it('uses the quality suffixed key when a quality is requested', async () => {
      mockDb.song.findUnique.mockResolvedValue(song);
      mockS3.getObject.mockResolvedValue({
        Body: Readable.from(['audio']),
        ContentType: 'audio/mp4',
        ContentLength: 1000,
      });

      await service.play('song-1', undefined as any, makeRes() as any, 'low');

      expect(mockS3.getObject).toHaveBeenCalledWith({
        Bucket: 'songs',
        Key: 'song-1-low.m4a',
      });
    });

    it('uses the base key for lossless quality', async () => {
      mockDb.song.findUnique.mockResolvedValue(song);
      mockS3.getObject.mockResolvedValue({
        Body: Readable.from(['audio']),
        ContentType: 'audio/mp4',
        ContentLength: 1000,
      });

      await service.play(
        'song-1',
        undefined as any,
        makeRes() as any,
        'lossless',
      );

      expect(mockS3.getObject).toHaveBeenCalledWith({
        Bucket: 'songs',
        Key: 'song-1',
      });
    });

    it('streams the requested byte range with partial content headers', async () => {
      mockDb.song.findUnique.mockResolvedValue(song);
      mockS3.headObject.mockResolvedValue({ ContentLength: 2048 });
      mockS3.getObject.mockResolvedValue({
        Body: Readable.from(['chunk']),
        ContentType: 'audio/mp4',
      });
      const res = makeRes();

      const result = await service.play(
        'song-1',
        'bytes=0-1023',
        res as any,
        'medium',
      );

      expect(result).toBeInstanceOf(StreamableFile);
      expect(mockS3.headObject).toHaveBeenCalledWith({
        Bucket: 'songs',
        Key: 'song-1-medium.m4a',
      });
      expect(mockS3.getObject).toHaveBeenCalledWith({
        Bucket: 'songs',
        Key: 'song-1-medium.m4a',
        Range: 'bytes=0-1023',
      });
      expect(res.status).toHaveBeenCalledWith(HttpStatus.PARTIAL_CONTENT);
      expect(res.set).toHaveBeenCalledWith({
        'Content-Range': 'bytes 0-1023/2048',
        'Accept-Ranges': 'bytes',
        'Content-Length': 1024,
        'Content-Type': 'audio/mp4',
      });
    });

    it('streams an open-ended range to the end of the file', async () => {
      mockDb.song.findUnique.mockResolvedValue(song);
      mockS3.headObject.mockResolvedValue({ ContentLength: 2048 });
      mockS3.getObject.mockResolvedValue({
        Body: Readable.from(['chunk']),
        ContentType: 'audio/mp4',
      });
      const res = makeRes();

      await service.play('song-1', 'bytes=500-', res as any, undefined as any);

      expect(mockS3.getObject).toHaveBeenCalledWith({
        Bucket: 'songs',
        Key: 'song-1',
        Range: 'bytes=500-2047',
      });
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Range': 'bytes 500-2047/2048',
          'Content-Length': 1548,
        }),
      );
    });

    it.each([
      ['a non-numeric start', 'bytes=abc-100'],
      ['a negative start', 'bytes=-5-100'],
      ['a start beyond the file size', 'bytes=5000-'],
      ['an end before the start', 'bytes=500-100'],
    ])('throws a 416 for %s', async (_label, range) => {
      mockDb.song.findUnique.mockResolvedValue(song);
      mockS3.headObject.mockResolvedValue({ ContentLength: 1024 });
      const res = makeRes();

      let caught: any;
      try {
        await service.play('song-1', range, res as any, undefined as any);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(HttpException);
      expect(caught.getStatus()).toBe(
        HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
      );
      expect(res.set).toHaveBeenCalledWith('Content-Range', 'bytes */1024');
      expect(mockS3.getObject).not.toHaveBeenCalled();
    });

    it('throws a NotFoundException when the song does not exist', async () => {
      mockDb.song.findUnique.mockResolvedValue(null);

      await expect(
        service.play(
          'song-1',
          undefined as any,
          makeRes() as any,
          undefined as any,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockS3.getObject).not.toHaveBeenCalled();
    });
  });

  describe('upload', () => {
    const file = { path: '/tmp/song.flac' } as Express.Multer.File;
    const user = { sub: 'user-1', username: 'johndoe', role: 'USER' };
    const body = {
      title: 'Track',
      albumId: 'album-1',
      genreId: 'genre-1',
      duration: 120,
    };

    beforeEach(() => {
      mockFileTypeFromFile.mockResolvedValue({
        ext: 'flac',
        mime: 'audio/flac',
      });
      mockDb.album.findUnique.mockResolvedValue({ id: 'album-1' });
      mockDb.song.findFirst.mockResolvedValue(null);
      mockDb.song.create.mockResolvedValue({ id: 'song-1' });
      mockCopyFile.mockResolvedValue(undefined);
      mockAudioQueue.add.mockResolvedValue(undefined);
      mockUploadService.uploadFile.mockResolvedValue(undefined);
      mockUnlink.mockResolvedValue(undefined);
    });

    it('throws an UnprocessableEntityException for an invalid audio type', async () => {
      mockFileTypeFromFile.mockResolvedValue(null);

      await expect(
        service.upload(file, user as any, body as any),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockDb.album.findUnique).not.toHaveBeenCalled();
      expect(mockUnlink).toHaveBeenCalledWith(file.path);
    });

    it('throws a NotFoundException with ALBUM_404 when the album does not exist', async () => {
      mockDb.album.findUnique.mockResolvedValue(null);

      let caught: any;
      try {
        await service.upload(file, user as any, body);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(NotFoundException);
      expect(caught.getResponse()).toEqual({
        message: 'No Album exists with this ID',
        errorCode: 'ALBUM_404',
      });
    });

    it('throws a ConflictException when the song already exists in the album', async () => {
      mockDb.song.findFirst.mockResolvedValue({ id: 'existing-song' });

      await expect(
        service.upload(file, user as any, body as any),
      ).rejects.toThrow(ConflictException);
      expect(mockDb.song.create).not.toHaveBeenCalled();
    });

    it('creates the song, copies the file, queues a convert job, uploads to S3 and invalidates the album cache', async () => {
      const result = await service.upload(file, user as any, body);

      expect(mockDb.album.findUnique).toHaveBeenCalledWith({
        where: { id: 'album-1', userId: 'user-1' },
      });
      expect(mockDb.song.findFirst).toHaveBeenCalledWith({
        where: { title: 'Track', albumId: 'album-1' },
      });
      expect(mockDb.song.create).toHaveBeenCalledWith({
        data: {
          title: 'Track',
          album: { connect: { id: 'album-1' } },
          genre: { connect: { id: 'genre-1' } },
          duration: 120,
        },
      });
      expect(mockCopyFile).toHaveBeenCalledWith(
        file.path,
        expect.stringContaining('song-1'),
      );
      expect(mockAudioQueue.add).toHaveBeenCalledWith('convert', {
        path: expect.stringContaining('song-1'),
        name: 'song-1',
      });
      expect(mockUploadService.uploadFile).toHaveBeenCalledWith(
        file.path,
        'song-1',
        'audio/flac',
        'songs',
        'user-1',
      );
      expect(mockCacheManager.del).toHaveBeenCalledWith(
        'albums:detail:album-1',
      );
      expect(result).toEqual({
        id: 'song-1',
        message: 'Song uploaded successfully',
      });
      // the original upload is always cleaned up; the conversion source is kept
      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledWith(file.path);
    });

    it('cleans up both files when queueing the convert job fails', async () => {
      mockAudioQueue.add.mockRejectedValue(new Error('queue down'));

      await expect(
        service.upload(file, user as any, body as any),
      ).rejects.toThrow('queue down');
      expect(mockUnlink).toHaveBeenCalledWith(file.path);
      expect(mockUnlink).toHaveBeenCalledWith(
        expect.stringContaining('song-1'),
      );
      expect(mockCacheManager.del).not.toHaveBeenCalled();
    });
  });

  describe('getLiked', () => {
    it('returns the liked songs with pagination defaults and a count', async () => {
      mockDb.song.findMany.mockResolvedValue([song]);
      mockDb.song.count.mockResolvedValue(1);

      const result = await service.getLiked('user-1', {});

      expect(mockDb.song.findMany).toHaveBeenCalledWith({
        where: { likedBy: { some: { userId: 'user-1' } } },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockDb.song.count).toHaveBeenCalledWith({
        where: { likedBy: { some: { userId: 'user-1' } } },
      });
      expect(result).toEqual({ songs: [song], count: 1 });
    });
  });

  describe('edit', () => {
    const user = { sub: 'user-1', username: 'johndoe', role: 'USER' };

    it('throws a NotFoundException when the song does not exist', async () => {
      mockDb.song.findUnique.mockResolvedValue(null);

      await expect(
        service.edit('song-1', {} as any, user as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockDb.song.update).not.toHaveBeenCalled();
    });

    it('updates the song and invalidates the album cache', async () => {
      mockDb.song.findUnique.mockResolvedValue(song);
      const body = { title: 'New Track', genreId: 'genre-2' };

      const result = await service.edit('song-1', body as any, user as any);

      expect(mockDb.song.findUnique).toHaveBeenCalledWith({
        where: { id: 'song-1', album: { userId: 'user-1' } },
      });
      expect(mockDb.song.update).toHaveBeenCalledWith({
        where: { id: 'song-1' },
        data: {
          title: 'New Track',
          genre: { connect: { id: 'genre-2' } },
        },
      });
      expect(mockCacheManager.del).toHaveBeenCalledWith(
        'albums:detail:album-1',
      );
      expect(result).toEqual({ message: 'Song updated successfully' });
    });
  });

  describe('like', () => {
    it('throws a NotFoundException when the song does not exist', async () => {
      mockDb.song.findUnique.mockResolvedValue(null);

      await expect(service.like('song-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockDb.likedSong.upsert).not.toHaveBeenCalled();
    });

    it('upserts the like', async () => {
      mockDb.song.findUnique.mockResolvedValue(song);

      const result = await service.like('song-1', 'user-1');

      expect(mockDb.song.findUnique).toHaveBeenCalledWith({
        where: { id: 'song-1' },
      });
      expect(mockDb.likedSong.upsert).toHaveBeenCalledWith({
        where: {
          userId_songId: { songId: 'song-1', userId: 'user-1' },
        },
        update: {},
        create: { songId: 'song-1', userId: 'user-1' },
      });
      expect(result).toEqual({
        message: 'Song was successfully added to liked',
      });
    });
  });

  describe('unlike', () => {
    it('throws a NotFoundException when the song does not exist', async () => {
      mockDb.song.findUnique.mockResolvedValue(null);

      await expect(service.unlike('song-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockDb.likedSong.deleteMany).not.toHaveBeenCalled();
    });

    it('removes the like', async () => {
      mockDb.song.findUnique.mockResolvedValue(song);

      const result = await service.unlike('song-1', 'user-1');

      expect(mockDb.song.findUnique).toHaveBeenCalledWith({
        where: { id: 'song-1' },
      });
      expect(mockDb.likedSong.deleteMany).toHaveBeenCalledWith({
        where: { songId: 'song-1', userId: 'user-1' },
      });
      expect(result).toEqual({ message: 'Song was removed from liked' });
    });
  });

  describe('delete', () => {
    it('throws a NotFoundException when the song does not exist', async () => {
      mockDb.song.findUnique.mockResolvedValue(null);

      await expect(service.delete('song-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockDb.song.delete).not.toHaveBeenCalled();
    });

    it('deletes the song, every S3 quality variant plus the base key, and invalidates the album cache', async () => {
      mockDb.song.findUnique.mockResolvedValue(song);

      const result = await service.delete('song-1', 'user-1');

      expect(mockDb.song.findUnique).toHaveBeenCalledWith({
        where: { id: 'song-1', album: { userId: 'user-1' } },
      });
      expect(mockDb.song.delete).toHaveBeenCalledWith({
        where: { id: 'song-1' },
      });
      for (const quality of AUDIO_QUALITIES) {
        expect(mockS3.deleteObject).toHaveBeenCalledWith({
          Bucket: 'songs',
          Key: `song-1-${quality.name}.m4a`,
        });
      }
      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: 'songs',
        Key: 'song-1',
      });
      expect(mockS3.deleteObject).toHaveBeenCalledTimes(
        AUDIO_QUALITIES.length + 1,
      );
      expect(mockCacheManager.del).toHaveBeenCalledWith(
        'albums:detail:album-1',
      );
      expect(result).toEqual({ message: 'Song deleted successfully' });
    });
  });

  describe('getPlayUrl', () => {
    it('validates the song and returns the signed URL with a 300s expiry', async () => {
      mockDb.song.findUnique.mockResolvedValue(song);
      mockPresignService.getSongPlayUrl.mockResolvedValue(
        'https://minio/signed-url',
      );

      const result = await service.getPlayUrl('song-1', 'high');

      expect(mockDb.song.findUnique).toHaveBeenCalledWith({
        where: { id: 'song-1', album: { user: { deletedAt: null } } },
      });
      expect(mockPresignService.getSongPlayUrl).toHaveBeenCalledWith(
        'song-1',
        'high',
      );
      expect(result).toEqual({
        url: 'https://minio/signed-url',
        expiresIn: 300,
      });
    });

    it('passes the quality through to the presign service', async () => {
      mockDb.song.findUnique.mockResolvedValue(song);
      mockPresignService.getSongPlayUrl.mockResolvedValue(
        'https://minio/signed-lossless',
      );

      await service.getPlayUrl('song-1', 'lossless');

      expect(mockPresignService.getSongPlayUrl).toHaveBeenCalledWith(
        'song-1',
        'lossless',
      );
    });

    it('throws a NotFoundException when the song does not exist', async () => {
      mockDb.song.findUnique.mockResolvedValue(null);

      await expect(service.getPlayUrl('song-1', 'high')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPresignService.getSongPlayUrl).not.toHaveBeenCalled();
    });
  });
});
