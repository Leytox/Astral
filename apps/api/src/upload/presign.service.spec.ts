import { Test } from '@nestjs/testing';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PresignService } from './presign.service';
import type { AudioQuality } from '@repo/types';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const mockGetSignedUrl = getSignedUrl as unknown as jest.Mock;

describe('PresignService', () => {
  let service: PresignService;

  const mockS3 = { send: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PresignService,
        { provide: 'default_S3ModuleConnectionToken', useValue: mockS3 },
      ],
    }).compile();

    service = moduleRef.get(PresignService);
  });

  /** Extracts the GetObjectCommand passed to getSignedUrl and returns its input. */
  const commandInputOf = (callIndex = 0): unknown => {
    const [, command] = mockGetSignedUrl.mock.calls[callIndex] as [
      unknown,
      GetObjectCommand,
    ];
    return command.input;
  };

  describe('getSongPlayUrl', () => {
    it('builds a medium-quality key by default and signs it with a 300s expiry', async () => {
      mockGetSignedUrl.mockResolvedValue('https://minio/signed-url');

      const url = await service.getSongPlayUrl('song-1');

      expect(url).toBe('https://minio/signed-url');
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        mockS3,
        expect.any(GetObjectCommand),
        { expiresIn: 300 },
      );
      expect(commandInputOf()).toEqual({
        Bucket: 'songs',
        Key: 'song-1-medium.m4a',
      });
    });

    it.each<[AudioQuality, string]>([
      ['low', 'song-1-low.m4a'],
      ['medium', 'song-1-medium.m4a'],
      ['high', 'song-1-high.m4a'],
    ])('signs the %s rendition key as %s', async (quality, expectedKey) => {
      mockGetSignedUrl.mockResolvedValue('https://minio/signed-url');

      await service.getSongPlayUrl('song-1', quality);

      expect(commandInputOf()).toEqual({
        Bucket: 'songs',
        Key: expectedKey,
      });
    });

    it('signs the original file key (no suffix) for lossless quality', async () => {
      mockGetSignedUrl.mockResolvedValue('https://minio/signed-url');

      await service.getSongPlayUrl('song-1', 'lossless');

      expect(commandInputOf()).toEqual({
        Bucket: 'songs',
        Key: 'song-1',
      });
    });

    it('passes a custom expiry through to the signer', async () => {
      mockGetSignedUrl.mockResolvedValue('https://minio/signed-url');

      await service.getSongPlayUrl('song-1', 'high', 60);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        mockS3,
        expect.any(GetObjectCommand),
        { expiresIn: 60 },
      );
    });

    it('propagates signer errors to the caller', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('signing failed'));

      await expect(service.getSongPlayUrl('song-1')).rejects.toThrow(
        'signing failed',
      );
    });
  });

  describe('getImageUrl', () => {
    it('signs a cover image with a 24h default expiry', async () => {
      mockGetSignedUrl.mockResolvedValue('https://minio/signed-cover');

      const url = await service.getImageUrl('covers', 'album-1.jpg');

      expect(url).toBe('https://minio/signed-cover');
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        mockS3,
        expect.any(GetObjectCommand),
        { expiresIn: 86_400 },
      );
      expect(commandInputOf()).toEqual({
        Bucket: 'covers',
        Key: 'album-1.jpg',
      });
    });

    it('signs an avatar image in the avatars bucket', async () => {
      mockGetSignedUrl.mockResolvedValue('https://minio/signed-avatar');

      await service.getImageUrl('avatars', 'user-1.png');

      expect(commandInputOf()).toEqual({
        Bucket: 'avatars',
        Key: 'user-1.png',
      });
    });

    it('passes a custom expiry through to the signer', async () => {
      mockGetSignedUrl.mockResolvedValue('https://minio/signed-avatar');

      await service.getImageUrl('avatars', 'user-1.png', 3600);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        mockS3,
        expect.any(GetObjectCommand),
        { expiresIn: 3600 },
      );
    });
  });
});
