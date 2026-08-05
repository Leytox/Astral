import { MessageResponseSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class MessageResponseDto extends createZodDto(MessageResponseSchema) {}
