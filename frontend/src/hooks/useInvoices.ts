import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Invoice, InvoiceStatus, Company } from '@/types'
import { apiFetch } from '@/lib/api'

interface RawInvoice {
  id: string
  tenant_id: string
  order_id: string
  number: string
  status: string
  share_token: string | null
  sent_at: string | null
  paid_at: string | null
  expires_at: string | null
  created_at: string | null
  clientName: string | null
  clientPhone: string | null
  clientEmail: string | null
  fromAddress: string | null
  toAddress: string | null
  moveDate: string | null
  homeSize: string | null
  packing: boolean | null
  basePrice: number | null
  totalPrice: number | null
}

function mapInvoice(raw: RawInvoice): Invoice {
  return {
    id: raw.id,
    tenantId: raw.tenant_id,
    orderId: raw.order_id,
    number: raw.number,
    status: raw.status as InvoiceStatus,
    clientName: raw.clientName ?? '',
    clientPhone: raw.clientPhone ?? '',
    clientEmail: raw.clientEmail ?? '',
    fromAddress: raw.fromAddress ?? '',
    toAddress: raw.toAddress ?? '',
    moveDate: raw.moveDate ?? '',
    homeSize: raw.homeSize ?? '',
    packing: raw.packing ?? false,
    basePrice: raw.basePrice ?? 0,
    totalPrice: raw.totalPrice ?? 0,
    shareToken: raw.share_token ?? '',
    sentAt: raw.sent_at ?? undefined,
    paidAt: raw.paid_at ?? undefined,
    createdAt: raw.created_at ?? '',
  }
}

export function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const data = await apiFetch<{ invoices: RawInvoice[] }>('/invoices')
      return data.invoices.map(mapInvoice)
    },
  })
}

export function useGenerateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) =>
      apiFetch<{ invoice: RawInvoice }>('/invoices', {
        method: 'POST',
        body: JSON.stringify({ orderId }),
      }).then((res) => mapInvoice(res.invoice)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: InvoiceStatus }) =>
      apiFetch<{ invoice: RawInvoice }>(`/invoices/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }).then((res) => mapInvoice(res.invoice)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useSendInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, email }: { id: string; email?: string }) =>
      apiFetch<{ message: string }>(`/invoices/${id}/send`, {
        method: 'POST',
        ...(email ? { body: JSON.stringify({ email }) } : {}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

interface PublicInvoiceRow {
  invoiceId: string
  number: string
  status: string
  paidAt: string | null
  stripeSessionId: string | null
  createdAt: string | null
  fromAddress: string
  toAddress: string
  moveDate: string
  homeSize: string
  packing: boolean | null
  basePrice: number
  totalPrice: number
  clientName: string | null
  clientPhone: string | null
  companyName: string
  companyLogoUrl: string | null
  companySettings: unknown
}

export function usePublicInvoice(token: string) {
  return useQuery<{ invoice: Invoice; company: Company }>({
    queryKey: ['invoice-public', token],
    queryFn: async () => {
      const data = await apiFetch<{ invoice: PublicInvoiceRow }>(`/invoices/share/${token}`)
      const row = data.invoice
      const invoice: Invoice = {
        id: row.invoiceId,
        tenantId: '',
        orderId: '',
        number: row.number,
        status: row.status as InvoiceStatus,
        clientName: row.clientName ?? '',
        clientPhone: row.clientPhone ?? '',
        clientEmail: '',
        fromAddress: row.fromAddress,
        toAddress: row.toAddress,
        moveDate: row.moveDate,
        homeSize: row.homeSize,
        packing: row.packing ?? false,
        basePrice: row.basePrice,
        totalPrice: row.totalPrice,
        shareToken: token,
        paidAt: row.paidAt ?? undefined,
        createdAt: row.createdAt ?? '',
      }
      const company: Company = {
        name: row.companyName,
        phone: '',
        website: '',
        logoUrl: row.companyLogoUrl,
      }
      return { invoice, company }
    },
    enabled: token.length > 0,
  })
}

export function useCreatePaymentLink() {
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ checkoutUrl: string }>(`/invoices/share/${token}/payment-link`, {
        method: 'POST',
      }).then((res) => res.checkoutUrl),
  })
}
