import { SearchResponseSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class SearchResponseDto extends createZodDto(SearchResponseSchema) {}
