import { EditSongSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class EditSongDto extends createZodDto(EditSongSchema) {}
