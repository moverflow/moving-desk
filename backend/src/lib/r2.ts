import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { env } from './env.js'
import { logger } from './logger.js'

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const FILE_EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

const R2_ENV_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
] as const

export function missingR2Vars(): string[] {
  return R2_ENV_VARS.filter((name) => !env[name])
}

export function isR2Configured(): boolean {
  return missingR2Vars().length === 0
}

// Without R2 we fall back to the container filesystem, which Railway wipes on
// every deploy — silently destroying signed contracts and signature images.
// That fallback is fine for local dev, never in production.
export function assertStorageConfigured(): void {
  if (env.NODE_ENV !== 'production') return

  const missing = missingR2Vars()
  if (missing.length === 0) return

  throw new Error(
    `R2 storage is not configured. Missing env vars: ${missing.join(', ')}. ` +
      'Refusing to start in production: uploads (signed contracts, signature images, ' +
      'order files, logos) would be written to the container filesystem and lost on ' +
      'the next deploy.',
  )
}

const s3 = isR2Configured()
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    })
  : null

async function uploadLogoToR2(file: File, tenantId: string): Promise<string> {
  const ext = EXT_MAP[file.type] ?? 'jpg'
  const key = `logos/${tenantId}/${Date.now()}.${ext}`
  const body = Buffer.from(await file.arrayBuffer())

  await s3!.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: file.type,
    }),
  )

  return `${env.R2_PUBLIC_URL}/${key}`
}

async function uploadLogoLocally(file: File, tenantId: string): Promise<string> {
  const ext = EXT_MAP[file.type] ?? 'jpg'
  const filename = `${Date.now()}.${ext}`
  const dir = path.join(process.cwd(), 'uploads', 'logos', tenantId)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()))
  return `${env.BACKEND_URL}/uploads/logos/${tenantId}/${filename}`
}

export async function uploadLogo(file: File, tenantId: string): Promise<string> {
  if (isR2Configured()) return uploadLogoToR2(file, tenantId)
  return uploadLogoLocally(file, tenantId)
}

async function uploadOrderFileToR2(file: File, key: string): Promise<string> {
  const body = Buffer.from(await file.arrayBuffer())
  await s3!.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: file.type,
    }),
  )
  return `${env.R2_PUBLIC_URL}/${key}`
}

async function uploadOrderFileLocally(file: File, key: string): Promise<string> {
  const dir = path.join(process.cwd(), 'uploads', 'order-files', path.dirname(key))
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, path.basename(key)), Buffer.from(await file.arrayBuffer()))
  return `${env.BACKEND_URL}/uploads/order-files/${key}`
}

export async function uploadOrderFile(
  file: File,
  tenantId: string,
  orderId: string,
): Promise<{ url: string; key: string }> {
  const ext = FILE_EXT_MAP[file.type] ?? 'bin'
  const key = `${tenantId}/${orderId}/${crypto.randomUUID()}.${ext}`
  const url = isR2Configured()
    ? await uploadOrderFileToR2(file, key)
    : await uploadOrderFileLocally(file, key)
  return { url, key }
}

// Uploads raw bytes under an arbitrary key — used for server-generated
// artifacts (signature PNGs, signed-contract PDFs) that don't arrive as
// a multipart File. Mirrors the order-file storage layout so the same
// resolveOrderFileUrl() logic keeps the public URL correct over time.
export async function uploadBinary(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<{ url: string; key: string }> {
  if (isR2Configured()) {
    await s3!.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    )
    return { url: `${env.R2_PUBLIC_URL}/${key}`, key }
  }
  const dir = path.join(process.cwd(), 'uploads', 'order-files', path.dirname(key))
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, path.basename(key)), body)
  return { url: `${env.BACKEND_URL}/uploads/order-files/${key}`, key }
}

// Derives the current public URL for an order file from its storage key,
// rather than trusting the URL persisted at upload time — keeps API
// responses correct even if BACKEND_URL/R2 config changes after upload.
export function resolveOrderFileUrl(key: string): string {
  return isR2Configured()
    ? `${env.R2_PUBLIC_URL}/${key}`
    : `${env.BACKEND_URL}/uploads/order-files/${key}`
}

export async function deleteOrderFile(key: string): Promise<void> {
  if (!isR2Configured()) return
  try {
    await s3!.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }))
  } catch (err) {
    logger.error({ err, key }, 'Failed to delete order file from R2')
  }
}

export const UPLOADS_ROOT = path.join(process.cwd(), 'uploads')
