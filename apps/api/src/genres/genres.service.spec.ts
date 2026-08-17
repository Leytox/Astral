import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service';
import { GenresService } from './genres.service';

describe('GenresService', () => {
  let service: GenresService;

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };
  const mockDb = {
    genre: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const genre = {
    id: 'genre-1',
    name: 'Rock',
    description: 'Loud guitars',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        GenresService,
        { provide: PrismaService, useValue: mockDb },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = moduleRef.get(GenresService);
  });

  describe('getGenre', () => {
    it('returns the cached genre without querying the database', async () => {
      mockCache.get.mockResolvedValue(genre);

      const result = await service.getGenre('genre-1');

      expect(result).toBe(genre);
      expect(mockDb.genre.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the genre does not exist', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.genre.findUnique.mockResolvedValue(null);

      await expect(service.getGenre('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('fetches the genre from the database and caches it for 60s', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.genre.findUnique.mockResolvedValue(genre);

      const result = await service.getGenre('genre-1');

      expect(result).toBe(genre);
      expect(mockDb.genre.findUnique).toHaveBeenCalledWith({
        where: { id: 'genre-1' },
      });
      expect(mockCache.set).toHaveBeenCalledWith(
        'genres:detail:genre-1',
        genre,
        60_000,
      );
    });
  });

  describe('getGenres', () => {
    it('uses default pagination of limit 10 and offset 0 and returns genres with a count', async () => {
      mockDb.genre.findMany.mockResolvedValue([genre]);
      mockDb.genre.count.mockResolvedValue(1);

      const result = await service.getGenres({});

      expect(mockDb.genre.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockDb.genre.count).toHaveBeenCalled();
      expect(result).toEqual({ genres: [genre], count: 1 });
    });
  });

  describe('createGenre', () => {
    const dto = { name: 'Rock', description: 'Loud guitars' };

    it('throws ConflictException when the name is already taken', async () => {
      mockDb.genre.findUnique.mockResolvedValue(genre);

      await expect(service.createGenre(dto as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockDb.genre.findUnique).toHaveBeenCalledWith({
        where: { name: 'Rock' },
      });
      expect(mockDb.genre.create).not.toHaveBeenCalled();
    });

    it('creates the genre and returns a success message', async () => {
      mockDb.genre.findUnique.mockResolvedValue(null);

      const result = await service.createGenre(dto);

      expect(mockDb.genre.create).toHaveBeenCalledWith({
        data: { name: 'Rock', description: 'Loud guitars' },
      });
      expect(result).toEqual({ message: 'Genre was successfully created' });
    });
  });

  describe('editGenre', () => {
    const dto = { name: 'Hard Rock', description: 'Heavier' };

    it('throws NotFoundException when the genre does not exist', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.genre.findUnique.mockResolvedValue(null);

      await expect(service.editGenre(dto as any, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when the new name belongs to another genre', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.genre.findUnique
        .mockResolvedValueOnce(genre) // getGenre id lookup
        .mockResolvedValueOnce({ ...genre, id: 'other-genre' }); // name collision lookup

      await expect(service.editGenre(dto as any, 'genre-1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockDb.genre.update).not.toHaveBeenCalled();
    });

    it('allows keeping the same name (no self-collision)', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.genre.findUnique
        .mockResolvedValueOnce(genre) // getGenre id lookup
        .mockResolvedValueOnce(genre); // name lookup finds the genre itself

      const result = await service.editGenre(dto, 'genre-1');

      expect(mockDb.genre.update).toHaveBeenCalledWith({
        where: { id: 'genre-1' },
        data: { name: 'Hard Rock', description: 'Heavier' },
      });
      expect(result).toEqual({ message: 'Genre was edited successfully' });
    });

    it('updates the genre and clears the detail cache', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.genre.findUnique
        .mockResolvedValueOnce(genre) // getGenre id lookup
        .mockResolvedValueOnce(null); // no name collision

      const result = await service.editGenre(dto, 'genre-1');

      expect(mockDb.genre.update).toHaveBeenCalledWith({
        where: { id: 'genre-1' },
        data: { name: 'Hard Rock', description: 'Heavier' },
      });
      expect(mockCache.del).toHaveBeenCalledWith('genres:detail:genre-1');
      expect(result).toEqual({ message: 'Genre was edited successfully' });
    });
  });
});
