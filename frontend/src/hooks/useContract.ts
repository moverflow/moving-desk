import { useMutation, useQuery } from '@tanstack/react-query'
import type { PublicContract } from '@/types'
import { apiFetch, apiUpload } from '@/lib/api'

export function usePublicContract(token: string) {
  return useQuery<PublicContract>({
    queryKey: ['contract', token],
    queryFn: () => apiFetch<PublicContract>(`/contract/${token}`),
    retry: false,
    enabled: token.length > 0,
  })
}

export function useSignContract(token: string) {
  return useMutation<
    { success: boolean; message: string },
    Error,
    { signedName: string; signatureDataUrl: string }
  >({
    mutationFn: (data) =>
      apiFetch(`/contract/${token}/sign`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  })
}

// Uploads the client-rendered signed-contract PDF. Fire-and-forget: the
// contract is already legally signed once /sign succeeds, so a failed PDF
// upload must not block the success screen.
export async function uploadContractPdf(token: string, pdf: Blob): Promise<void> {
  const formData = new FormData()
  formData.append('file', pdf, 'contract-signed.pdf')
  await apiUpload<{ success: boolean }>(`/contract/${token}/pdf`, formData)
}
