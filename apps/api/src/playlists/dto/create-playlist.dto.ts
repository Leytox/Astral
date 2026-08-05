import { CreatePlaylistSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class CreatePlaylistDto extends createZodDto(CreatePlaylistSchema) {}
