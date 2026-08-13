import { PlayUrlSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class PlayUrlDto extends createZodDto(PlayUrlSchema) {}
