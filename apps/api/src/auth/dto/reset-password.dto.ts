import { ResetPasswordSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
