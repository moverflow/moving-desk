import { z } from 'zod'
import 'dotenv/config'

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  RESEND_API_KEY: z.string().min(1),
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url().default('http://localhost:3000'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_BASIC_PRICE_ID: z.string().default(''),
  STRIPE_PRO_PRICE_ID: z.string().default(''),
  R2_ACCOUNT_ID: z.string().default(''),
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_BUCKET_NAME: z.string().default(''),
  R2_PUBLIC_URL: z.string().default(''),
  ANTHROPIC_API_KEY: z.string().default(''),
})

export const env = schema.parse(process.env)
