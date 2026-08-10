import { Test } from '@nestjs/testing';
import { AlbumsController } from './albums.controller';
import { AlbumsService } from './albums.service';

// AlbumsService loads SongsService transitively, which imports the ESM file-type.
jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
}));

describe('AlbumsController', () => {
  let controller: AlbumsController;

  const mockAlbumsService = {
    getAlbum: jest.fn(),
    updateAlbumCover: jest.fn(),
    createAlbum: jest.fn(),
    getAlbums: jest.fn(),
    editAlbum: jest.fn(),
    likeAlbum: jest.fn(),
    deleteAlbum: jest.fn(),
  };

  const user = { sub: 'user-1', username: 'johndoe', role: 'USER' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AlbumsController],
      providers: [{ provide: AlbumsService, useValue: mockAlbumsService }],
    }).compile();

    controller = moduleRef.get(AlbumsController);
  });

  it('delegates getAlbum', async () => {
    mockAlbumsService.getAlbum.mockResolvedValue({ id: 'album-1' });

    await controller.getAlbum('album-1');

    expect(mockAlbumsService.getAlbum).toHaveBeenCalledWith('album-1');
  });

  it('delegates updateAlbumCover', async () => {
    const file = { buffer: Buffer.from('image-bytes') };
    mockAlbumsService.updateAlbumCover.mockResolvedValue({
      message: 'Album cover updated successfully',
    });

    await controller.updateAlbumCover('album-1', file as any, user as any);

    expect(mockAlbumsService.updateAlbumCover).toHaveBeenCalledWith(
      file,
      'album-1',
      user.sub,
    );
  });

  it('delegates createAlbum', async () => {
    const file = { buffer: Buffer.from('image-bytes') };
    const body = { title: 'Alpha', releaseDate: '2011-03-04' };
    mockAlbumsService.createAlbum.mockResolvedValue({
      message: 'Album created successfully',
    });

    await controller.createAlbum(file as any, user as any, body);

    expect(mockAlbumsService.createAlbum).toHaveBeenCalledWith(
      body,
      file,
      user.sub,
    );
  });

  it('delegates getAlbums', async () => {
    const query = { limit: '10', offset: '0' };
    mockAlbumsService.getAlbums.mockResolvedValue({ albums: [], count: 0 });

    await controller.getAlbums('best-2026', query as any);

    expect(mockAlbumsService.getAlbums).toHaveBeenCalledWith(
      'best-2026',
      query,
    );
  });

  it('delegates editAlbum', async () => {
    const body = { title: 'New Title' };
    mockAlbumsService.editAlbum.mockResolvedValue({
      message: 'Album updated successfully',
    });

    await controller.editAlbum('album-1', body, user as any);

    expect(mockAlbumsService.editAlbum).toHaveBeenCalledWith(
      'album-1',
      body,
      user.sub,
    );
  });

  it('delegates likeAlbum', async () => {
    mockAlbumsService.likeAlbum.mockResolvedValue({
      message: 'Album liked successfully',
    });

    await controller.likeAlbum('album-1', user as any);

    expect(mockAlbumsService.likeAlbum).toHaveBeenCalledWith(
      'album-1',
      user.sub,
    );
  });

  it('delegates deleteAlbum', async () => {
    mockAlbumsService.deleteAlbum.mockResolvedValue({
      message: 'Album deleted successfully',
    });

    await controller.deleteAlbum('album-1', user as any);

    expect(mockAlbumsService.deleteAlbum).toHaveBeenCalledWith(
      'album-1',
      user.sub,
    );
  });
});
