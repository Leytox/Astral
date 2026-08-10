import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PlaylistsService } from './playlists.service';
import { PrismaService } from '../database/prisma.service';

describe('PlaylistsService', () => {
  let service: PlaylistsService;

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };
  const mockDb = {
    playlist: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    song: {
      findUnique: jest.fn(),
    },
    playlistSong: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  const playlist = {
    id: 'playlist-1',
    name: 'My Playlist',
    isPublic: true,
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlaylistsService,
        { provide: PrismaService, useValue: mockDb },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = moduleRef.get(PlaylistsService);
  });

  describe('getAllPlaylists', () => {
    it('uses default pagination of limit 20 and offset 0', async () => {
      mockDb.playlist.findMany.mockResolvedValue([]);
      mockDb.playlist.count.mockResolvedValue(0);

      await service.getAllPlaylists('user-1', {});

      expect(mockDb.playlist.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockDb.playlist.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('passes the requested skip/take and orders by createdAt desc', async () => {
      mockDb.playlist.findMany.mockResolvedValue([]);
      mockDb.playlist.count.mockResolvedValue(0);

      await service.getAllPlaylists('user-1', {
        limit: '5',
        offset: '10',
      } as any);

      expect(mockDb.playlist.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        skip: 10,
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns the playlists and the total count', async () => {
      mockDb.playlist.findMany.mockResolvedValue([playlist]);
      mockDb.playlist.count.mockResolvedValue(1);

      const result = await service.getAllPlaylists('user-1', {});

      expect(result).toEqual({ playlists: [playlist], count: 1 });
    });
  });

  describe('getPlaylistById', () => {
    it('returns the cached playlist without querying the database', async () => {
      mockCache.get.mockResolvedValue(playlist);

      const result = await service.getPlaylistById('user-1', 'playlist-1');

      expect(result).toBe(playlist);
      expect(mockDb.playlist.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the playlist does not exist', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.playlist.findUnique.mockResolvedValue(null);

      await expect(
        service.getPlaylistById('user-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
      expect(mockDb.playlist.findUnique).toHaveBeenCalledWith({
        where: { id: 'missing' },
        include: { songs: true },
      });
    });

    it('throws BadRequestException for a private playlist owned by another user', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.playlist.findUnique.mockResolvedValue({
        ...playlist,
        isPublic: false,
        userId: 'user-2',
      });

      await expect(
        service.getPlaylistById('user-1', 'playlist-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('allows the owner to view their private playlist and caches it for 180s', async () => {
      const privatePlaylist = { ...playlist, isPublic: false };
      mockCache.get.mockResolvedValue(undefined);
      mockDb.playlist.findUnique.mockResolvedValue(privatePlaylist);

      const result = await service.getPlaylistById('user-1', 'playlist-1');

      expect(result).toBe(privatePlaylist);
      expect(mockCache.set).toHaveBeenCalledWith(
        'playlists:detail:playlist-1',
        privatePlaylist,
        180_000,
      );
    });

    it('caches a public playlist for 180s even without a user id', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.playlist.findUnique.mockResolvedValue(playlist);

      const result = await service.getPlaylistById(undefined, 'playlist-1');

      expect(result).toBe(playlist);
      expect(mockCache.set).toHaveBeenCalledWith(
        'playlists:detail:playlist-1',
        playlist,
        180_000,
      );
    });
  });

  describe('createPlaylist', () => {
    const dto = { name: 'My Playlist', isPublic: true };

    it('throws BadRequestException when a playlist with the same name already exists', async () => {
      mockDb.playlist.findFirst.mockResolvedValue({ id: 'playlist-2' });

      await expect(
        service.createPlaylist(dto as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockDb.playlist.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', name: 'My Playlist' },
      });
      expect(mockDb.playlist.create).not.toHaveBeenCalled();
    });

    it('creates the playlist and returns a success message', async () => {
      mockDb.playlist.findFirst.mockResolvedValue(null);

      const result = await service.createPlaylist(dto, 'user-1');

      expect(mockDb.playlist.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', name: 'My Playlist', isPublic: true },
      });
      expect(result).toEqual({ message: 'Playlist created successfully' });
    });
  });

  describe('addTrackToPlaylist', () => {
    it('throws NotFoundException when the song does not exist', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.playlist.findUnique.mockResolvedValue(playlist);
      mockDb.song.findUnique.mockResolvedValue(null);

      await expect(
        service.addTrackToPlaylist('song-1', 'playlist-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockDb.song.findUnique).toHaveBeenCalledWith({
        where: { id: 'song-1' },
      });
      expect(mockDb.playlist.update).not.toHaveBeenCalled();
    });

    it('adds the track to the playlist and clears the detail cache', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.playlist.findUnique.mockResolvedValue(playlist);
      mockDb.song.findUnique.mockResolvedValue({ id: 'song-1' });

      const result = await service.addTrackToPlaylist(
        'song-1',
        'playlist-1',
        'user-1',
      );

      expect(mockDb.playlist.update).toHaveBeenCalledWith({
        where: { id: 'playlist-1' },
        data: { songs: { create: { songId: 'song-1' } } },
      });
      expect(mockCache.del).toHaveBeenCalledWith('playlists:detail:playlist-1');
      expect(result).toEqual({
        message: 'Track added to playlist successfully',
      });
    });
  });

  describe('removeTrackFromPlaylist', () => {
    it('throws NotFoundException when the track is not in the playlist', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.playlist.findUnique.mockResolvedValue(playlist);
      mockDb.playlistSong.findUnique.mockResolvedValue(null);

      await expect(
        service.removeTrackFromPlaylist('song-1', 'playlist-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockDb.playlistSong.findUnique).toHaveBeenCalledWith({
        where: {
          playlistId_songId: { playlistId: 'playlist-1', songId: 'song-1' },
        },
      });
    });

    it('deletes the track link and clears the detail cache', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.playlist.findUnique.mockResolvedValue(playlist);
      mockDb.playlistSong.findUnique.mockResolvedValue({ id: 'link-1' });

      const result = await service.removeTrackFromPlaylist(
        'song-1',
        'playlist-1',
        'user-1',
      );

      expect(mockDb.playlistSong.delete).toHaveBeenCalledWith({
        where: { id: 'link-1' },
      });
      expect(mockCache.del).toHaveBeenCalledWith('playlists:detail:playlist-1');
      expect(result).toEqual({
        message: 'Track removed from playlist successfully',
      });
    });
  });

  describe('updatePlaylist', () => {
    const dto = { name: 'Renamed', isPublic: false };

    it('throws BadRequestException when another playlist has the same name', async () => {
      mockDb.playlist.findFirst.mockResolvedValue({ id: 'playlist-2' });

      await expect(
        service.updatePlaylist('playlist-1', 'user-1', dto as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockDb.playlist.findFirst).toHaveBeenCalledWith({
        where: { name: 'Renamed', userId: 'user-1' },
      });
      expect(mockDb.playlist.update).not.toHaveBeenCalled();
    });

    it('updates the playlist and clears the detail cache', async () => {
      mockDb.playlist.findFirst.mockResolvedValue(null);

      const result = await service.updatePlaylist('playlist-1', 'user-1', dto);

      expect(mockDb.playlist.update).toHaveBeenCalledWith({
        where: { id: 'playlist-1' },
        data: { name: 'Renamed', isPublic: false },
      });
      expect(mockCache.del).toHaveBeenCalledWith('playlists:detail:playlist-1');
      expect(result).toEqual({ message: 'Playlist updated successfully' });
    });
  });

  describe('deletePlaylist', () => {
    it('deletes the playlist and clears the detail cache', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockDb.playlist.findUnique.mockResolvedValue(playlist);

      const result = await service.deletePlaylist('playlist-1', 'user-1');

      expect(mockDb.playlist.delete).toHaveBeenCalledWith({
        where: { id: 'playlist-1' },
      });
      expect(mockCache.del).toHaveBeenCalledWith('playlists:detail:playlist-1');
      expect(result).toEqual({ message: 'Playlist deleted successfully' });
    });
  });
});
