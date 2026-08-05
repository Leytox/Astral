import { GenreSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class GenreDto extends createZodDto(GenreSchema) {}
