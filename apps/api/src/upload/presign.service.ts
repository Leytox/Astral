import { Injectable } from '@nestjs/common';
import { AudioQuality } from '@repo/types';
import { InjectS3, type S3 } from 'nestjs-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
@Injectable()
export class PresignService {
  constructor(@InjectS3() private readonly s3: S3) {}

  /**
   * Generates a signed URL for a song
   * @param songId Id of the song
   * @param quality Quality of the song
   * @param expiresIn Expiration time in seconds
   * @returns Signed URL for the song
   */
  async getSongPlayUrl(
    songId: string,
    quality: AudioQuality = 'medium',
    expiresIn = 300,
  ): Promise<string> {
    const key = quality !== 'lossless' ? `${songId}-${quality}.m4a` : songId;
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: 'songs',
        Key: key,
      }),
      { expiresIn },
    );
  }

  /**
   * Generates a signed URL for an image from album covers or user avatars
   * @param bucket Bucket name
   * @param key Key of the image
   * @param expiresIn Expiration time in seconds
   * @returns Signed URL for the image
   */
  async getImageUrl(
    bucket: 'covers' | 'avatars',
    key: string,
    expiresIn = 86_400,
  ): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn },
    );
  }
}
