import { CreateGenreSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class CreateGenreDto extends createZodDto(CreateGenreSchema) {}
