import { SessionSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class SessionDto extends createZodDto(SessionSchema) {}
