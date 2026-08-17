import { Test } from '@nestjs/testing';

import { AudioProcessor } from './audio.processor';
import { AudioService } from './audio.service';

describe('AudioProcessor', () => {
  let processor: AudioProcessor;

  const mockAudioService = { processAudio: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AudioProcessor,
        { provide: AudioService, useValue: mockAudioService },
      ],
    }).compile();

    processor = moduleRef.get(AudioProcessor);
  });

  it('delegates to audioService.processAudio with the job data', async () => {
    mockAudioService.processAudio.mockResolvedValue(undefined);
    const job = { data: { path: '/tmp/source.flac', name: 'song-1' } };

    await processor.process(job as any);

    expect(mockAudioService.processAudio).toHaveBeenCalledWith(
      '/tmp/source.flac',
      'song-1',
    );
  });

  it('rethrows when processAudio fails', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockAudioService.processAudio.mockRejectedValue(new Error('boom'));
    const job = { data: { path: '/tmp/source.flac', name: 'song-1' } };

    await expect(processor.process(job as any)).rejects.toThrow('boom');

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error processing audio:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});
