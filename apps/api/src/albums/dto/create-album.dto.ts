import { CreateAlbumSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class CreateAlbumDto extends createZodDto(CreateAlbumSchema) {}
