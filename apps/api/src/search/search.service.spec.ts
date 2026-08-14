import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SearchService } from './search.service';
import { PrismaService } from '../database/prisma.service';
import { PresignService } from '../upload/presign.service';

describe('SearchService', () => {
  let service: SearchService;

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };
  const mockDb = {
    $queryRaw: jest.fn(),
  };
  const mockPresignService = {
    getImageUrl: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: mockDb },
        { provide: PresignService, useValue: mockPresignService },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = moduleRef.get(SearchService);
  });

  describe('search', () => {
    const results = [{ type: 'genre', id: 'genre-1', name: 'Rock' }];

    it('returns the cached results without running the query', async () => {
      mockCache.get.mockResolvedValue(results);

      const result = await service.search('Rock');

      expect(result).toBe(results);
      expect(mockDb.$queryRaw).not.toHaveBeenCalled();
    });

    it('runs the raw search query and caches the results for 30s on a miss', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.$queryRaw.mockResolvedValue(results);

      const result = await service.search('Rock');

      // $queryRaw receives the tagged template: a strings array followed by
      // the six interpolated title values.
      expect(mockDb.$queryRaw).toHaveBeenCalledWith(
        expect.any(Array),
        'Rock',
        'Rock',
        'Rock',
        'Rock',
        'Rock',
        'Rock',
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        'search:list:Rock',
        results,
        30_000,
      );
      expect(result).toBe(results);
    });

    it('presigns cover images for album and song results', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.$queryRaw.mockResolvedValue([
        { type: 'album', id: 'album-1', name: 'Alpha', imageUrl: 'cover.jpg' },
        {
          type: 'song',
          id: 'song-1',
          name: 'Alpha Song',
          imageUrl: 'cover.jpg',
        },
      ]);
      mockPresignService.getImageUrl.mockResolvedValue(
        'https://cdn.example/cover.jpg',
      );

      const result = await service.search('Alpha');

      expect(mockPresignService.getImageUrl).toHaveBeenCalledTimes(2);
      expect(mockPresignService.getImageUrl).toHaveBeenCalledWith(
        'covers',
        'cover.jpg',
      );
      expect(result[0].imageUrl).toBe('https://cdn.example/cover.jpg');
      expect(result[1].imageUrl).toBe('https://cdn.example/cover.jpg');
    });

    it('presigns avatar images for user results', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.$queryRaw.mockResolvedValue([
        { type: 'user', id: 'user-1', name: 'alice', imageUrl: 'avatar.png' },
      ]);
      mockPresignService.getImageUrl.mockResolvedValue(
        'https://cdn.example/avatar.png',
      );

      const result = await service.search('alice');

      expect(mockPresignService.getImageUrl).toHaveBeenCalledTimes(1);
      expect(mockPresignService.getImageUrl).toHaveBeenCalledWith(
        'avatars',
        'avatar.png',
      );
      expect(result[0].imageUrl).toBe('https://cdn.example/avatar.png');
    });

    it('does not presign results that have no image url', async () => {
      mockCache.get.mockResolvedValue(undefined);
      const genreResult = {
        type: 'genre',
        id: 'genre-1',
        name: 'Rock',
        imageUrl: null,
      };
      mockDb.$queryRaw.mockResolvedValue([genreResult]);

      const result = await service.search('Rock');

      expect(mockPresignService.getImageUrl).not.toHaveBeenCalled();
      expect(result).toEqual([genreResult]);
    });
  });
});
