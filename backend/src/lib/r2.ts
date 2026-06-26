import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { env } from './env.js'

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET_NAME &&
      env.R2_PUBLIC_URL,
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
  return `http://localhost:${env.PORT}/uploads/logos/${tenantId}/${filename}`
}

export async function uploadLogo(file: File, tenantId: string): Promise<string> {
  if (isR2Configured()) return uploadLogoToR2(file, tenantId)
  return uploadLogoLocally(file, tenantId)
}

export const UPLOADS_ROOT = path.join(process.cwd(), 'uploads')
