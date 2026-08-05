import { GetProfileSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';
export class GetProfileDto extends createZodDto(GetProfileSchema) {}
