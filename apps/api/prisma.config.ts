import path from 'node:path';

import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

dotenv.config({
  path: path.resolve(__dirname, '.env'),
});

export default defineConfig({
  schema: 'src/database/schema.prisma',
  migrations: {
    path: 'src/database/migrations',
    seed: 'tsx src/database/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL || env('DATABASE_URL'),
  },
});
