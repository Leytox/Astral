import { AlbumSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class AlbumDto extends createZodDto(AlbumSchema) {}
