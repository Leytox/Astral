import { ForgotPasswordSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}
