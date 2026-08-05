import { UploadSongSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class UploadSongDto extends createZodDto(UploadSongSchema) {}
