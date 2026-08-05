import { EditPlaylistSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class EditPlaylistDto extends createZodDto(EditPlaylistSchema) {}
