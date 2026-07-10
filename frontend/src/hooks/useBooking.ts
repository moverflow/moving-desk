import { useQuery, useMutation } from '@tanstack/react-query'
import type { PublicBookingTenant, BookingFormData, BookingResult } from '@/types'
import { apiFetch } from '@/lib/api'

export function useBookingTenant(slug: string) {
  return useQuery<PublicBookingTenant>({
    queryKey: ['booking-tenant', slug],
    queryFn: async () => {
      const data = await apiFetch<{ tenant: PublicBookingTenant }>(`/book/${slug}`)
      return data.tenant
    },
    retry: false,
    enabled: slug.length > 0,
  })
}

export function useBookingAvailability(slug: string, month: string) {
  return useQuery<string[]>({
    queryKey: ['booking-availability', slug, month],
    queryFn: async () => {
      const data = await apiFetch<{ availableDates: string[] }>(
        `/book/${slug}/availability?month=${month}`,
      )
      return data.availableDates
    },
    enabled: slug.length > 0 && month.length > 0,
  })
}

export function useCreateBooking(slug: string) {
  return useMutation<BookingResult, Error, BookingFormData>({
    mutationFn: (data: BookingFormData) =>
      apiFetch<BookingResult>(`/book/${slug}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  })
}
