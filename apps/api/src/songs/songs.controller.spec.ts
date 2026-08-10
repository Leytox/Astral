import { Test } from '@nestjs/testing';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';

// SongsService imports the ESM file-type package.
jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
}));

describe('SongsController', () => {
  let controller: SongsController;

  const mockSongsService = {
    play: jest.fn(),
    upload: jest.fn(),
    edit: jest.fn(),
    like: jest.fn(),
    unlike: jest.fn(),
    getLiked: jest.fn(),
    delete: jest.fn(),
  };

  const user = { sub: 'user-1', username: 'johndoe', role: 'USER' };
  const res = { status: jest.fn(), set: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [SongsController],
      providers: [{ provide: SongsService, useValue: mockSongsService }],
    }).compile();

    controller = moduleRef.get(SongsController);
  });

  it('delegates play', async () => {
    const stream = { pipe: jest.fn() };
    mockSongsService.play.mockResolvedValue(stream);

    await controller.play('song-1', 'bytes=0-1023', res as any, 'low');

    expect(mockSongsService.play).toHaveBeenCalledWith(
      'song-1',
      'bytes=0-1023',
      res,
      'low',
    );
  });

  it('delegates upload', async () => {
    const file = { path: '/tmp/song.flac' };
    const body = { title: 'Track', albumId: 'album-1', genreId: 'genre-1' };
    mockSongsService.upload.mockResolvedValue({
      id: 'song-1',
      message: 'Song uploaded successfully',
    });

    await controller.upload(file as any, user as any, body as any);

    expect(mockSongsService.upload).toHaveBeenCalledWith(file, user, body);
  });

  it('delegates edit', async () => {
    const body = { title: 'New Track', genreId: 'genre-2' };
    mockSongsService.edit.mockResolvedValue({
      message: 'Song updated successfully',
    });

    await controller.edit('song-1', body as any, user as any);

    expect(mockSongsService.edit).toHaveBeenCalledWith('song-1', body, user);
  });

  it('delegates like', async () => {
    mockSongsService.like.mockResolvedValue({
      message: 'Song was successfully added to liked',
    });

    await controller.like('song-1', user as any);

    expect(mockSongsService.like).toHaveBeenCalledWith('song-1', user.sub);
  });

  it('delegates unlike', async () => {
    mockSongsService.unlike.mockResolvedValue({
      message: 'Song was removed from liked',
    });

    await controller.unlike('song-1', user as any);

    expect(mockSongsService.unlike).toHaveBeenCalledWith('song-1', user.sub);
  });

  it('delegates getLiked', async () => {
    const query = { limit: '10', offset: '0' };
    mockSongsService.getLiked.mockResolvedValue({ songs: [], count: 0 });

    await controller.getLiked(user as any, query as any);

    expect(mockSongsService.getLiked).toHaveBeenCalledWith(user.sub, query);
  });

  it('delegates delete', async () => {
    mockSongsService.delete.mockResolvedValue({
      message: 'Song deleted successfully',
    });

    await controller.delete('song-1', user as any);

    expect(mockSongsService.delete).toHaveBeenCalledWith('song-1', user.sub);
  });
});
