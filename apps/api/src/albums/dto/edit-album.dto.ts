import { EditAlbumSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class EditAlbumDto extends createZodDto(EditAlbumSchema) {}
