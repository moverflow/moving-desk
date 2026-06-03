import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { env } from './env'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
})

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function uploadLogo(file: File, tenantId: string): Promise<string> {
  const ext = EXT_MAP[file.type] ?? 'jpg'
  const key = `logos/${tenantId}/${Date.now()}.${ext}`
  const body = Buffer.from(await file.arrayBuffer())

  await s3.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: file.type,
    })
  )

  return `${env.R2_PUBLIC_URL}/${key}`
}
