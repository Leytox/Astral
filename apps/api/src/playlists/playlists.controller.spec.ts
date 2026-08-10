import { Test } from '@nestjs/testing';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';

describe('PlaylistsController', () => {
  let controller: PlaylistsController;
  const mockPlaylistsService = {
    getAllPlaylists: jest.fn(),
    getPlaylistById: jest.fn(),
    createPlaylist: jest.fn(),
    addTrackToPlaylist: jest.fn(),
    removeTrackFromPlaylist: jest.fn(),
    updatePlaylist: jest.fn(),
    deletePlaylist: jest.fn(),
  };

  const user = { sub: 'user-1' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [PlaylistsController],
      providers: [
        { provide: PlaylistsService, useValue: mockPlaylistsService },
      ],
    }).compile();

    controller = moduleRef.get(PlaylistsController);
  });

  it('delegates getAllPlaylists', async () => {
    const query = { limit: '10', offset: '0' };
    mockPlaylistsService.getAllPlaylists.mockResolvedValue({
      playlists: [],
      count: 0,
    });

    const result = await controller.getAllPlaylists(user as any, query as any);

    expect(mockPlaylistsService.getAllPlaylists).toHaveBeenCalledWith(
      'user-1',
      query,
    );
    expect(result).toEqual({ playlists: [], count: 0 });
  });

  it('delegates getPlaylistById', async () => {
    mockPlaylistsService.getPlaylistById.mockResolvedValue({
      id: 'playlist-1',
    });

    const result = await controller.getPlaylistById(user as any, 'playlist-1');

    expect(mockPlaylistsService.getPlaylistById).toHaveBeenCalledWith(
      'user-1',
      'playlist-1',
    );
    expect(result).toEqual({ id: 'playlist-1' });
  });

  it('delegates getPlaylistById with an undefined user', async () => {
    mockPlaylistsService.getPlaylistById.mockResolvedValue({
      id: 'playlist-1',
    });

    await controller.getPlaylistById(undefined, 'playlist-1');

    expect(mockPlaylistsService.getPlaylistById).toHaveBeenCalledWith(
      undefined,
      'playlist-1',
    );
  });

  it('delegates createPlaylist', async () => {
    const dto = { name: 'My Playlist', isPublic: true };
    mockPlaylistsService.createPlaylist.mockResolvedValue({
      message: 'Playlist created successfully',
    });

    const result = await controller.createPlaylist(dto, user as any);

    expect(mockPlaylistsService.createPlaylist).toHaveBeenCalledWith(
      dto,
      'user-1',
    );
    expect(result).toEqual({ message: 'Playlist created successfully' });
  });

  it('delegates addTrackToPlaylist', async () => {
    mockPlaylistsService.addTrackToPlaylist.mockResolvedValue({
      message: 'Track added to playlist successfully',
    });

    const result = await controller.addTrackToPlaylist(
      'playlist-1',
      'song-1',
      user as any,
    );

    expect(mockPlaylistsService.addTrackToPlaylist).toHaveBeenCalledWith(
      'song-1',
      'playlist-1',
      'user-1',
    );
    expect(result).toEqual({ message: 'Track added to playlist successfully' });
  });

  it('delegates removeTrackFromPlaylist', async () => {
    mockPlaylistsService.removeTrackFromPlaylist.mockResolvedValue({
      message: 'Track removed from playlist successfully',
    });

    const result = await controller.removeTrackFromPlaylist(
      'playlist-1',
      'song-1',
      user as any,
    );

    expect(mockPlaylistsService.removeTrackFromPlaylist).toHaveBeenCalledWith(
      'song-1',
      'playlist-1',
      'user-1',
    );
    expect(result).toEqual({
      message: 'Track removed from playlist successfully',
    });
  });

  it('delegates updatePlaylist', async () => {
    const dto = { name: 'Renamed', isPublic: false };
    mockPlaylistsService.updatePlaylist.mockResolvedValue({
      message: 'Playlist updated successfully',
    });

    const result = await controller.updatePlaylist(
      'playlist-1',
      dto,
      user as any,
    );

    expect(mockPlaylistsService.updatePlaylist).toHaveBeenCalledWith(
      'playlist-1',
      'user-1',
      dto,
    );
    expect(result).toEqual({ message: 'Playlist updated successfully' });
  });

  it('delegates deletePlaylist', async () => {
    mockPlaylistsService.deletePlaylist.mockResolvedValue({
      message: 'Playlist deleted successfully',
    });

    const result = await controller.deletePlaylist('playlist-1', user as any);

    expect(mockPlaylistsService.deletePlaylist).toHaveBeenCalledWith(
      'playlist-1',
      'user-1',
    );
    expect(result).toEqual({ message: 'Playlist deleted successfully' });
  });
});
