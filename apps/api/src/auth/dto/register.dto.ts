import { RegisterSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class RegisterDto extends createZodDto(RegisterSchema) {}
