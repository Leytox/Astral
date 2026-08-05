import { PlaylistSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class PlaylistDto extends createZodDto(PlaylistSchema) {}
