import { EditUserSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class EditUserDto extends createZodDto(EditUserSchema) {}
