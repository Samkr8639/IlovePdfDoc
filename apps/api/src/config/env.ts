import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  API_VERSION: z.string().default('1.0.0'),
  TEMP_UPLOAD_DIR: z.string().default('./tmp/uploads')
});

export const env = envSchema.parse(process.env);
