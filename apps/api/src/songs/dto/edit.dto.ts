import { createZodDto } from 'nestjs-zod';
import { EditSongSchema } from '@repo/types';

export class EditSongDto extends createZodDto(EditSongSchema) {}
