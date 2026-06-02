import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Invoice, InvoiceStatus, Company } from '@/types'

const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-1', tenantId: 'mock-tenant-1', orderId: 'order-1',
    number: 'INV-1089', status: 'draft',
    clientName: 'Rick Adams', clientPhone: '(949) 632-9557',
    fromAddress: 'Lake Forest, CA', toAddress: 'Anaheim, CA',
    moveDate: '2026-06-15', homeSize: '2 BR', packing: false,
    basePrice: 480, totalPrice: 480, shareToken: 'mock-token-1',
    createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'inv-2', tenantId: 'mock-tenant-1', orderId: 'order-2',
    number: 'INV-1088', status: 'sent',
    clientName: 'Tom Wilson', clientPhone: '(310) 555-0177',
    fromAddress: 'Newport Beach, CA', toAddress: 'Los Angeles, CA',
    moveDate: '2026-06-20', homeSize: 'House', packing: true,
    basePrice: 850, totalPrice: 1100, shareToken: 'mock-token-2',
    sentAt: '2026-06-02T11:00:00Z', createdAt: '2026-06-02T10:00:00Z',
  },
  {
    id: 'inv-3', tenantId: 'mock-tenant-1', orderId: 'order-4',
    number: 'INV-1087', status: 'paid',
    clientName: 'James Lee', clientPhone: '(714) 555-0142',
    fromAddress: 'Tustin, CA', toAddress: 'Yorba Linda, CA',
    moveDate: '2026-06-10', homeSize: '2 BR', packing: false,
    basePrice: 480, totalPrice: 480, shareToken: 'mock-token-3',
    sentAt: '2026-06-10T15:00:00Z', paidAt: '2026-06-11T09:00:00Z',
    createdAt: '2026-06-10T14:00:00Z',
  },
]

export const MOCK_COMPANY: Company = {
  name: 'Best & Pro Moving Service',
  phone: '(714) 555-0199',
  website: 'bestpro-moving.com',
  logoUrl: null,
}

export function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: async () => {
      await new Promise<void>((r) => setTimeout(r, 300))
      return [...MOCK_INVOICES]
    },
  })
}

export function useGenerateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      await new Promise<void>((r) => setTimeout(r, 800))
      const newInvoice: Invoice = {
        id: `inv-${Date.now()}`, tenantId: 'mock-tenant-1', orderId,
        number: `INV-${1090 + MOCK_INVOICES.length}`, status: 'draft',
        clientName: 'New Client', clientPhone: '(555) 000-0001',
        fromAddress: 'Origin, CA', toAddress: 'Destination, CA',
        moveDate: new Date().toISOString().slice(0, 10),
        homeSize: '2 BR', packing: false, basePrice: 480, totalPrice: 480,
        shareToken: `token-${Date.now()}`, createdAt: new Date().toISOString(),
      }
      MOCK_INVOICES.push(newInvoice)
      return newInvoice
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
      await new Promise<void>((r) => setTimeout(r, 300))
      const inv = MOCK_INVOICES.find((i) => i.id === id)
      if (inv) inv.status = status
      return inv
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useSendInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await new Promise<void>((r) => setTimeout(r, 600))
      const inv = MOCK_INVOICES.find((i) => i.id === id)
      if (inv) { inv.status = 'sent'; inv.sentAt = new Date().toISOString() }
      return inv
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function usePublicInvoice(token: string) {
  return useQuery({
    queryKey: ['invoice-public', token],
    queryFn: async () => {
      await new Promise<void>((r) => setTimeout(r, 400))
      const invoice = MOCK_INVOICES.find((i) => i.shareToken === token) ?? MOCK_INVOICES[0]
      return { invoice, company: MOCK_COMPANY }
    },
  })
}
