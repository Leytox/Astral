import { VerificationCodeSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class VerificationCodeDto extends createZodDto(VerificationCodeSchema) {}
