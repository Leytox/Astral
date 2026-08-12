import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Readable } from 'stream';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import { UploadProcessor } from './upload.processor';
import { EventsGateway } from '../events/events.gateway';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createReadStream: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  ...jest.requireActual('fs/promises'),
  unlink: jest.fn(),
}));

const mockCreateReadStream = createReadStream as unknown as jest.Mock;
const mockUnlink = unlink as unknown as jest.Mock;

describe('UploadProcessor', () => {
  let processor: UploadProcessor;

  const mockS3 = { putObject: jest.fn() };
  const mockEventsGateway = { emitToUser: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UploadProcessor,
        { provide: 'default_S3ModuleConnectionToken', useValue: mockS3 },
        { provide: EventsGateway, useValue: mockEventsGateway },
      ],
    }).compile();

    processor = moduleRef.get(UploadProcessor);
  });

  const makeJob = (userId: string | null) => ({
    data: {
      Bucket: 'songs',
      Key: 'song-1.m4a',
      ContentType: 'audio/mp4',
      tempPath: '/tmp/song-1.m4a',
      userId,
    },
  });

  it('uploads the file to S3, notifies the user and unlinks the temp file', async () => {
    const stream = Readable.from(['data']);
    mockCreateReadStream.mockReturnValue(stream);
    mockS3.putObject.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);

    await processor.process(makeJob('user-1') as any);

    expect(mockCreateReadStream).toHaveBeenCalledWith('/tmp/song-1.m4a');
    expect(mockS3.putObject).toHaveBeenCalledWith({
      Bucket: 'songs',
      Key: 'song-1.m4a',
      Body: stream,
      ContentType: 'audio/mp4',
    });
    expect(mockEventsGateway.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'upload:success',
      { Key: 'song-1.m4a', message: 'Song uploaded successfully' },
    );
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/song-1.m4a');
  });

  it('does not emit events when the job has no userId', async () => {
    mockCreateReadStream.mockReturnValue(Readable.from(['data']));
    mockS3.putObject.mockResolvedValue(undefined);

    await processor.process(makeJob(null) as any);

    expect(mockS3.putObject).toHaveBeenCalledTimes(1);
    expect(mockEventsGateway.emitToUser).not.toHaveBeenCalled();
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/song-1.m4a');
  });

  it('logs, emits upload:error and rethrows when the S3 upload fails', async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    mockCreateReadStream.mockReturnValue(Readable.from(['data']));
    mockS3.putObject.mockRejectedValue(new Error('s3 down'));
    mockUnlink.mockResolvedValue(undefined);

    await expect(processor.process(makeJob('user-1') as any)).rejects.toThrow(
      's3 down',
    );

    expect(loggerSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(mockEventsGateway.emitToUser).toHaveBeenCalledTimes(1);
    expect(mockEventsGateway.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'upload:error',
      { Key: 'song-1.m4a', message: 'Upload has failed' },
    );
    // The temp file must survive a failed attempt so BullMQ retries can
    // still stream it.
    expect(mockUnlink).not.toHaveBeenCalled();
    loggerSpy.mockRestore();
  });

  it('rethrows without emitting an event when an anonymous upload fails', async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    mockCreateReadStream.mockReturnValue(Readable.from(['data']));
    mockS3.putObject.mockRejectedValue(new Error('s3 down'));
    mockUnlink.mockResolvedValue(undefined);

    await expect(processor.process(makeJob(null) as any)).rejects.toThrow(
      's3 down',
    );

    expect(mockEventsGateway.emitToUser).not.toHaveBeenCalled();
    // The temp file must survive a failed attempt so BullMQ retries can
    // still stream it.
    expect(mockUnlink).not.toHaveBeenCalled();
    loggerSpy.mockRestore();
  });
});
