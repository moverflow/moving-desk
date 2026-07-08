import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { OrderFile } from '@/types'
import { apiFetch, apiUpload } from '@/lib/api'

interface RawOrderFile {
  id: string
  tenant_id: string
  order_id: string
  name: string
  url: string
  key: string
  size: number
  mime_type: string
  uploaded_by: string
  created_at: string | null
}

function mapOrderFile(raw: RawOrderFile): OrderFile {
  return {
    id: raw.id,
    name: raw.name,
    url: raw.url,
    size: raw.size,
    mimeType: raw.mime_type,
    uploadedBy: raw.uploaded_by,
    createdAt: raw.created_at ?? '',
  }
}

function filesQueryKey(orderId: string): readonly ['orders', string, 'files'] {
  return ['orders', orderId, 'files']
}

export function useOrderFiles(orderId: string) {
  return useQuery<OrderFile[]>({
    queryKey: filesQueryKey(orderId),
    queryFn: async () => {
      const data = await apiFetch<{ files: RawOrderFile[] }>(`/orders/${orderId}/files`)
      return data.files.map(mapOrderFile)
    },
  })
}

export function useUploadOrderFile(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiUpload<{ file: RawOrderFile }>(`/orders/${orderId}/files`, formData).then((res) =>
        mapOrderFile(res.file),
      )
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: filesQueryKey(orderId) }),
  })
}

export function useDeleteOrderFile(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fileId: string) =>
      apiFetch<{ success: boolean }>(`/orders/${orderId}/files/${fileId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: filesQueryKey(orderId) }),
  })
}
