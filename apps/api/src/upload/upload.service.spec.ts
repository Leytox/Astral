import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { copyFile, writeFile } from 'fs/promises';

import { UploadService } from './upload.service';

jest.mock('fs/promises', () => ({
  ...jest.requireActual('fs/promises'),
  writeFile: jest.fn(),
  copyFile: jest.fn(),
}));

const mockWriteFile = writeFile as unknown as jest.Mock;
const mockCopyFile = copyFile as unknown as jest.Mock;

describe('UploadService', () => {
  let service: UploadService;

  const mockUploadQueue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: getQueueToken('upload'), useValue: mockUploadQueue },
      ],
    }).compile();

    service = moduleRef.get(UploadService);
  });

  it('writes a Buffer source to a temp file and queues the upload', async () => {
    mockWriteFile.mockResolvedValue(undefined);
    const buffer = Buffer.from('audio-bytes');

    await service.uploadFile(
      buffer,
      'song-1.flac',
      'audio/flac',
      'songs',
      'user-1',
    );

    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('song-1.flac'),
      buffer,
    );
    expect(mockUploadQueue.add).toHaveBeenCalledWith('upload', {
      Bucket: 'songs',
      Key: 'song-1.flac',
      ContentType: 'audio/flac',
      tempPath: expect.stringContaining('song-1.flac'),
      userId: 'user-1',
    });
    expect(mockCopyFile).not.toHaveBeenCalled();
  });

  it('copies a string source to a temp file and queues the upload', async () => {
    mockCopyFile.mockResolvedValue(undefined);

    await service.uploadFile(
      '/tmp/source.flac',
      'song-1.flac',
      'audio/flac',
      'songs',
    );

    expect(mockCopyFile).toHaveBeenCalledWith(
      '/tmp/source.flac',
      expect.stringContaining('upload-song-1.flac'),
    );
    expect(mockUploadQueue.add).toHaveBeenCalledWith('upload', {
      Bucket: 'songs',
      Key: 'song-1.flac',
      ContentType: 'audio/flac',
      tempPath: expect.stringContaining('upload-song-1.flac'),
      userId: undefined,
    });
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
