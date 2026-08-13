import { UploadSongResponseSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class UploadSongResponseDto extends createZodDto(
  UploadSongResponseSchema,
) {}
