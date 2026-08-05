import { PaginationSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class PaginationDto extends createZodDto(PaginationSchema) {}
