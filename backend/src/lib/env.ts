import { z } from 'zod'
import 'dotenv/config'

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  RESEND_API_KEY: z.string().min(1),
  // Sender for all outbound mail. Must be an address on a Resend-verified
  // domain. Defaults to Resend's shared testing sender, which needs no
  // domain setup but can only deliver to your own Resend account email.
  EMAIL_FROM: z.string().default('MovingDesk <onboarding@resend.dev>'),
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
