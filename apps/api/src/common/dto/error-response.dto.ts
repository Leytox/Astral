import { ErrorResponseSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class ErrorResponseDto extends createZodDto(ErrorResponseSchema) {}
