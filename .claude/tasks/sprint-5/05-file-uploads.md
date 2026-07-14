# Task: File uploads — attach to orders
**Sprint:** 5
**Scope:** both
**ID:** sprint-5/05-file-uploads

## User story
As a dispatcher, I want to attach photos and documents to an order
(damage photos, inventory list, signed contract) so everything related
to a move is in one place.

## DB schema change

Add new table `order_files`:
```sql
order_files:
  id:           uuid primary key default gen_random_uuid()
  tenant_id:    uuid not null references tenants(id)
  order_id:     uuid not null references orders(id)
  name:         varchar(255) not null   -- original filename
  url:          text not null           -- Cloudflare R2 public URL
  size:         integer not null        -- bytes
  mime_type:    varchar(100) not null
  uploaded_by:  uuid not null references users(id)
  created_at:   timestamp default now()
```

Add to `schema.ts` and run migration.

## Backend

### POST /orders/:id/files — upload file
Auth: required. Verify order belongs to tenant.
Content-Type: multipart/form-data
Body: file field named "file"

Limits:
- Max file size: 10MB
- Allowed types: image/jpeg, image/png, image/webp, application/pdf
- Max files per order: 20

Logic:
1. Validate file size and type
2. Generate unique filename: `{tenantId}/{orderId}/{uuid}.{ext}`
3. Upload to Cloudflare R2
4. INSERT into order_files
5. Return created file record

### GET /orders/:id/files — list files for order
Auth: required. Verify order belongs to tenant.
Response: array of file records with URLs.

### DELETE /orders/:id/files/:fileId — delete file
Auth: required. Verify order belongs to tenant.
Logic: delete from R2 + delete from order_files.

### Cloudflare R2 setup
Use existing `src/lib/r2.ts`. If not fully implemented, complete it:
```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT,  // https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
})

export const R2_PUBLIC_URL = env.R2_PUBLIC_URL  // public bucket URL
```

Add to Railway env vars:
```
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

### Files to create/modify
```
backend/src/db/schema.ts              ← add order_files table
backend/src/routes/orders.ts          ← add file upload/list/delete routes
backend/src/services/files.service.ts ← new: uploadFile, listFiles, deleteFile
backend/src/lib/r2.ts                 ← complete R2 client implementation
```

## Frontend

### Files section in order detail
When dispatcher opens an order (slide-over or detail view), add a
"Files" section at the bottom:

```
Files  (3)                              [+ Upload]
──────────────────────────────────────────────────
📄 inventory-list.pdf          1.2 MB   [↓] [🗑]
🖼 damage-photo-1.jpg          340 KB   [↓] [🗑]
🖼 signed-contract.png         890 KB   [↓] [🗑]
```

Upload button: opens native file picker (accept: image/*, .pdf)
Shows upload progress indicator.
On success: file appears in list immediately.
On error (too large, wrong type): show inline error toast.

Image files: show thumbnail preview (40x40px).
PDF files: show document icon.

Download button: opens file in new tab.
Delete button: confirm dialog → DELETE /orders/:id/files/:fileId.

### Files to create/modify
```
frontend/src/components/shared/OrderFiles.tsx  ← new component
frontend/src/hooks/useOrderFiles.ts            ← new hooks
frontend/src/routes/OrdersPage.tsx             ← add OrderFiles to order detail view
```

## Acceptance criteria
- AC1: Upload button appears in order detail view
- AC2: File uploads to R2, appears in list
- AC3: Image files show thumbnail preview
- AC4: PDF files show document icon
- AC5: Download opens file in new tab
- AC6: Delete removes from R2 and DB
- AC7: 10MB limit enforced — oversized file shows error
- AC8: Wrong file type shows error
- AC9: Files isolated by tenant (cannot access other tenant files)
- AC10: `npm run typecheck` passes

## Note on R2 setup
Cloudflare R2 credentials need to be created in Cloudflare dashboard:
R2 → your bucket → Settings → API tokens → Create API token
Public access URL: R2 → your bucket → Settings → Public Access → Enable
