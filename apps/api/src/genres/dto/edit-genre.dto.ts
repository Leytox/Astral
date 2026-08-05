import { createZodDto } from 'nestjs-zod';
import { EditGenreSchema } from '@repo/types';

export class EditGenreDto extends createZodDto(EditGenreSchema) {}
