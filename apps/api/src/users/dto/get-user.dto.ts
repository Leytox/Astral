import { GetUserSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';
export class GetUserDto extends createZodDto(GetUserSchema) {}
