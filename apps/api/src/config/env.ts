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
  TEMP_UPLOAD_DIR: z.string().default('./tmp/uploads'),
  SIGN_REQUESTS_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  SIGN_MASTER_KEY: z.string().optional(),
  SEAL_CERT_PATH: z.string().optional(),
  SEAL_CERT_PASS: z.string().optional(),
  APP_PUBLIC_URL: z.string().default('http://localhost:4200')
});

export const env = envSchema.parse(process.env);

/** Runtime check respecting dynamic env overrides in tests. */
export function isSignRequestsEnabled(): boolean {
  if (typeof process.env.SIGN_REQUESTS_ENABLED === 'string') {
    return process.env.SIGN_REQUESTS_ENABLED === 'true';
  }
  return env.SIGN_REQUESTS_ENABLED;
}
