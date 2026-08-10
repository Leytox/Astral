import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SearchService } from './search.service';
import { PrismaService } from '../database/prisma.service';

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

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: mockDb },
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
  });
});
