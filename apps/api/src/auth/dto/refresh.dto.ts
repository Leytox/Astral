import { RefreshSchema } from '@repo/types';
import { createZodDto } from 'nestjs-zod';

export class RefreshDto extends createZodDto(RefreshSchema) {}
