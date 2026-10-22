import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = path.resolve(__dirname, `../../.env.${nodeEnv}`);

// Load environment-specific file first, then fallback to .env
dotenv.config({ path: envFile });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  API_VERSION: z.string().default('1.0.0'),
  TEMP_UPLOAD_DIR: z.string().default('./tmp/uploads')
});

export const env = envSchema.parse(process.env);
