import { EditGenreSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class EditGenreDto extends createZodDto(EditGenreSchema) {}
