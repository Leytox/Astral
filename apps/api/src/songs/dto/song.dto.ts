import { SongSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class SongDto extends createZodDto(SongSchema) {}
