import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { unlink } from 'fs/promises';

import { AUDIO_QUALITIES } from '../common/consts';
import { AudioService } from './audio.service';

jest.mock('child_process', () => ({ spawn: jest.fn() }));

jest.mock('fs/promises', () => ({
  ...jest.requireActual('fs/promises'),
  unlink: jest.fn(),
}));

const mockSpawn = spawn as unknown as jest.Mock;
const mockUnlink = unlink as unknown as jest.Mock;

describe('AudioService', () => {
  let service: AudioService;

  const mockUploadQueue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AudioService,
        { provide: getQueueToken('upload'), useValue: mockUploadQueue },
      ],
    }).compile();

    service = moduleRef.get(AudioService);
  });

  it('spawns ffmpeg for every quality, resolves on close code 0 and queues an upload job per output', async () => {
    mockSpawn.mockImplementation(() => {
      const emitter = new EventEmitter();
      setImmediate(() => emitter.emit('close', 0));
      return emitter;
    });
    mockUploadQueue.add.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);

    await service.processAudio('/tmp/source.flac', 'song-1');

    expect(mockSpawn).toHaveBeenCalledTimes(AUDIO_QUALITIES.length);
    AUDIO_QUALITIES.forEach((quality, index) => {
      const [command, args] = mockSpawn.mock.calls[index];
      expect(command).toBe('ffmpeg');
      expect(args).toContain('-i');
      expect(args).toContain('/tmp/source.flac');
      expect(args).toContain(quality.bitrate);
      expect(args[args.length - 1]).toMatch(
        new RegExp(`${quality.name}\\.m4a$`),
      );
    });

    expect(mockUploadQueue.add).toHaveBeenCalledTimes(AUDIO_QUALITIES.length);
    AUDIO_QUALITIES.forEach((quality) => {
      expect(mockUploadQueue.add).toHaveBeenCalledWith('upload', {
        Bucket: 'songs',
        Key: `song-1-${quality.name}.m4a`,
        ContentType: 'audio/mp4',
        tempPath: expect.stringMatching(new RegExp(`${quality.name}\\.m4a$`)),
      });
    });

    // outputs are kept once their upload jobs are queued; only the source is removed
    expect(mockUnlink).toHaveBeenCalledTimes(1);
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/source.flac');
  });

  it('rejects when ffmpeg exits non-zero, cleans up the output file and unlinks the source', async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const emitter = new EventEmitter();
    mockSpawn.mockReturnValue(emitter);
    mockUnlink.mockResolvedValue(undefined);

    const promise = service.processAudio('/tmp/source.flac', 'song-1');
    emitter.emit('close', 1);

    await expect(promise).rejects.toThrow('ffmpeg exited with code 1');

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockUploadQueue.add).not.toHaveBeenCalled();
    const outputPath =
      mockSpawn.mock.calls[0][1][mockSpawn.mock.calls[0][1].length - 1];
    expect(mockUnlink).toHaveBeenCalledWith(outputPath);
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/source.flac');
    loggerSpy.mockRestore();
  });

  it('rejects when ffmpeg emits an error event, cleans up the output file and unlinks the source', async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const emitter = new EventEmitter();
    mockSpawn.mockReturnValue(emitter);
    mockUnlink.mockResolvedValue(undefined);

    const promise = service.processAudio('/tmp/source.flac', 'song-1');
    emitter.emit('error', new Error('ENOENT'));

    await expect(promise).rejects.toThrow('ENOENT');

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockUploadQueue.add).not.toHaveBeenCalled();
    const outputPath =
      mockSpawn.mock.calls[0][1][mockSpawn.mock.calls[0][1].length - 1];
    expect(mockUnlink).toHaveBeenCalledWith(outputPath);
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/source.flac');
    loggerSpy.mockRestore();
  });
});
