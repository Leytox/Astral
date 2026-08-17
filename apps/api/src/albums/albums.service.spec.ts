import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { fileTypeFromBuffer } from 'file-type';

import { PrismaService } from '../database/prisma.service';
import { SongsService } from '../songs/songs.service';
import { PresignService } from '../upload/presign.service';
import { UploadService } from '../upload/upload.service';
import { AlbumsService } from './albums.service';

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
}));

const mockFileTypeFromBuffer = fileTypeFromBuffer as unknown as jest.Mock;

describe('AlbumsService', () => {
  let service: AlbumsService;

  const mockDb = {
    album: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    song: {
      findMany: jest.fn(),
    },
    likedAlbum: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  const mockUploadService = { uploadFile: jest.fn() };
  const mockPresignService = {
    getSongPlayUrl: jest.fn(),
    getImageUrl: jest.fn(),
  };
  const mockSongsService = { delete: jest.fn() };
  const mockS3 = { deleteObject: jest.fn() };
  const mockCacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

  const album = {
    id: 'album-1',
    title: 'Alpha',
    cover: '',
    userId: 'user-1',
    releaseDate: new Date('2011-03-04'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AlbumsService,
        { provide: PrismaService, useValue: mockDb },
        { provide: UploadService, useValue: mockUploadService },
        { provide: PresignService, useValue: mockPresignService },
        { provide: SongsService, useValue: mockSongsService },
        { provide: 'default_S3ModuleConnectionToken', useValue: mockS3 },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = moduleRef.get(AlbumsService);
  });

  describe('getAlbums', () => {
    it('runs the raw similarity queries and returns albums with a count', async () => {
      const albums = [album];
      mockDb.$queryRaw
        .mockResolvedValueOnce(albums)
        .mockResolvedValueOnce([{ count: 5 }]);

      const result = await service.getAlbums('best', {
        limit: '20',
        offset: '5',
      } as any);

      expect(mockDb.$queryRaw).toHaveBeenCalledTimes(2);
      expect(mockDb.$queryRaw.mock.calls[0][1]).toBe('best');
      expect(mockDb.$queryRaw.mock.calls[0][3]).toBe(20);
      expect(mockDb.$queryRaw.mock.calls[0][4]).toBe(5);
      expect(mockDb.$queryRaw.mock.calls[1][1]).toBe('best');
      expect(result).toEqual({ albums, count: 5 });
    });

    it('defaults limit to 10 and offset to 0', async () => {
      mockDb.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 0 }]);

      await service.getAlbums('best', {});

      expect(mockDb.$queryRaw.mock.calls[0][3]).toBe(10);
      expect(mockDb.$queryRaw.mock.calls[0][4]).toBe(0);
    });

    it('reports a count of zero when the count query returns no rows', async () => {
      mockDb.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await service.getAlbums('best', {});

      expect(result).toEqual({ albums: [], count: 0 });
    });
  });

  describe('getAlbum', () => {
    it('returns the cached album without querying the database', async () => {
      mockCacheManager.get.mockResolvedValue(album);

      const result = await service.getAlbum('album-1');

      expect(result).toEqual(album);
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'albums:detail:album-1',
      );
      expect(mockDb.album.findUnique).not.toHaveBeenCalled();
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('queries the database and caches the album on a cache miss', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockDb.album.findUnique.mockResolvedValue(album);

      const result = await service.getAlbum('album-1');

      expect(mockDb.album.findUnique).toHaveBeenCalledWith({
        where: { id: 'album-1' },
        include: { songs: true },
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'albums:detail:album-1',
        album,
        60_000,
      );
      expect(result).toEqual(album);
    });

    it('throws a NotFoundException when the album does not exist', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockDb.album.findUnique.mockResolvedValue(null);

      await expect(service.getAlbum('album-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateAlbumCover', () => {
    const file = { buffer: Buffer.from('image-bytes') } as Express.Multer.File;

    it('throws an UnprocessableEntityException for an invalid file type', async () => {
      mockFileTypeFromBuffer.mockResolvedValue(null);

      await expect(
        service.updateAlbumCover(file, 'album-1', 'user-1'),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockDb.album.findUnique).not.toHaveBeenCalled();
      expect(mockS3.deleteObject).not.toHaveBeenCalled();
    });

    it('throws a NotFoundException when the album does not exist', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({
        ext: 'jpg',
        mime: 'image/jpeg',
      });
      mockDb.album.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAlbumCover(file, 'album-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockUploadService.uploadFile).not.toHaveBeenCalled();
    });

    it('deletes the previous cover, uploads the new one, updates the album and invalidates the cache', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({
        ext: 'jpg',
        mime: 'image/jpeg',
      });
      mockDb.album.findUnique.mockResolvedValue({
        ...album,
        cover: 'old-cover.jpg',
      });

      const result = await service.updateAlbumCover(file, 'album-1', 'user-1');

      expect(mockDb.album.findUnique).toHaveBeenCalledWith({
        where: { id: 'album-1', userId: 'user-1' },
      });
      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: 'covers',
        Key: 'old-cover.jpg',
      });
      expect(mockUploadService.uploadFile).toHaveBeenCalledWith(
        file.buffer,
        'album-1.jpg',
        'image/jpeg',
        'covers',
      );
      expect(mockDb.album.update).toHaveBeenCalledWith({
        where: { id: 'album-1' },
        data: { cover: 'album-1.jpg' },
      });
      expect(mockCacheManager.del).toHaveBeenCalledWith(
        'albums:detail:album-1',
      );
      expect(result).toEqual({ message: 'Album cover updated successfully' });
    });

    it('does not delete an old cover when the album has none', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({
        ext: 'png',
        mime: 'image/png',
      });
      mockDb.album.findUnique.mockResolvedValue(album);

      await service.updateAlbumCover(file, 'album-1', 'user-1');

      expect(mockS3.deleteObject).not.toHaveBeenCalled();
      expect(mockUploadService.uploadFile).toHaveBeenCalledWith(
        file.buffer,
        'album-1.png',
        'image/png',
        'covers',
      );
    });
  });

  describe('createAlbum', () => {
    const file = { buffer: Buffer.from('image-bytes') } as Express.Multer.File;
    const data = { title: 'Alpha', releaseDate: '2011-03-04' };

    it('throws an UnprocessableEntityException for an invalid file type', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({
        ext: 'txt',
        mime: 'text/plain',
      });

      await expect(
        service.createAlbum(data as any, file, 'user-1'),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockDb.album.create).not.toHaveBeenCalled();
    });

    it('creates the album, uploads the cover and returns a success message', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({
        ext: 'jpg',
        mime: 'image/jpeg',
      });
      mockDb.album.create.mockResolvedValue({ ...album, id: 'album-new' });
      mockUploadService.uploadFile.mockResolvedValue(undefined);

      const result = await service.createAlbum(data, file, 'user-1');

      expect(mockDb.album.create).toHaveBeenCalledWith({
        data: {
          title: 'Alpha',
          releaseDate: new Date('2011-03-04').toISOString(),
          cover: '',
          userId: 'user-1',
        },
      });
      expect(mockUploadService.uploadFile).toHaveBeenCalledWith(
        file.buffer,
        'album-new.jpg',
        'image/jpeg',
        'covers',
      );
      expect(mockDb.album.update).toHaveBeenCalledWith({
        where: { id: 'album-new' },
        data: { cover: 'album-new.jpg' },
      });
      expect(result).toEqual({ message: 'Album created successfully' });
    });
  });

  describe('editAlbum', () => {
    const body = { title: 'New Title', releaseDate: '2012-01-01' };

    it('throws a NotFoundException when the album does not exist', async () => {
      mockDb.album.findUnique.mockResolvedValue(null);

      await expect(
        service.editAlbum('album-1', body as any, 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockDb.album.update).not.toHaveBeenCalled();
    });

    it('updates the album and invalidates the cache', async () => {
      mockDb.album.findUnique.mockResolvedValue(album);

      const result = await service.editAlbum('album-1', body, 'user-1');

      expect(mockDb.album.findUnique).toHaveBeenCalledWith({
        where: { id: 'album-1', userId: 'user-1' },
      });
      expect(mockDb.album.update).toHaveBeenCalledWith({
        where: { id: 'album-1' },
        data: body,
      });
      expect(mockCacheManager.del).toHaveBeenCalledWith(
        'albums:detail:album-1',
      );
      expect(result).toEqual({ message: 'Album updated successfully' });
    });
  });

  describe('getLikedAlbums', () => {
    it('returns the liked albums with pagination defaults and a count', async () => {
      mockDb.album.findMany.mockResolvedValue([album]);
      mockDb.album.count.mockResolvedValue(1);

      const result = await service.getLikedAlbums('user-1', {});

      expect(mockDb.album.findMany).toHaveBeenCalledWith({
        where: { likedBy: { some: { userId: 'user-1' } } },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockDb.album.count).toHaveBeenCalledWith({
        where: { likedBy: { some: { userId: 'user-1' } } },
      });
      expect(result).toEqual({ albums: [album], count: 1 });
    });
  });

  describe('likeAlbum', () => {
    it('fetches the album and upserts the like', async () => {
      mockCacheManager.get.mockResolvedValue(album);

      const result = await service.likeAlbum('album-1', 'user-1');

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'albums:detail:album-1',
      );
      expect(mockDb.likedAlbum.upsert).toHaveBeenCalledWith({
        where: {
          userId_albumId: { albumId: 'album-1', userId: 'user-1' },
        },
        update: {},
        create: { albumId: 'album-1', userId: 'user-1' },
      });
      expect(result).toEqual({ message: 'Album liked successfully' });
    });
  });

  describe('unlikeAlbum', () => {
    it('fetches the album and removes the like', async () => {
      mockCacheManager.get.mockResolvedValue(album);

      const result = await service.unlikeAlbum('album-1', 'user-1');

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'albums:detail:album-1',
      );
      expect(mockDb.likedAlbum.deleteMany).toHaveBeenCalledWith({
        where: { albumId: 'album-1', userId: 'user-1' },
      });
      expect(result).toEqual({ message: 'Album unliked successfully' });
    });
  });

  describe('deleteAlbum', () => {
    it('throws a NotFoundException when the album does not exist', async () => {
      mockDb.album.findUnique.mockResolvedValue(null);

      await expect(service.deleteAlbum('album-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockSongsService.delete).not.toHaveBeenCalled();
    });

    it('deletes every song, the cover from S3 and the album, then invalidates the cache', async () => {
      mockDb.album.findUnique.mockResolvedValue({
        ...album,
        cover: 'cover.jpg',
      });
      mockDb.song.findMany.mockResolvedValue([
        { id: 'song-1' },
        { id: 'song-2' },
      ]);

      const result = await service.deleteAlbum('album-1', 'user-1');

      expect(mockDb.album.findUnique).toHaveBeenCalledWith({
        where: { id: 'album-1', userId: 'user-1' },
      });
      expect(mockDb.song.findMany).toHaveBeenCalledWith({
        where: { albumId: 'album-1' },
      });
      expect(mockSongsService.delete).toHaveBeenCalledWith('song-1', 'user-1');
      expect(mockSongsService.delete).toHaveBeenCalledWith('song-2', 'user-1');
      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: 'covers',
        Key: 'cover.jpg',
      });
      expect(mockDb.album.delete).toHaveBeenCalledWith({
        where: { id: 'album-1' },
      });
      expect(mockCacheManager.del).toHaveBeenCalledWith(
        'albums:detail:album-1',
      );
      expect(result).toEqual({ message: 'Album deleted successfully' });
    });
  });
});
