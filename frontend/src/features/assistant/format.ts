import { formatDate } from '@/lib/utils'

// The assistant's contract carries move dates as bare "YYYY-MM-DD" strings. They
// are parsed as UTC midnight and formatted in UTC, which is what stops a job on
// the 1st from reading as the 31st west of Greenwich.
export function formatMoveDate(isoDate: string): string {
  return formatDate(new Date(`${isoDate}T00:00:00Z`))
}

const HOME_SIZE_LABELS: Record<string, string> = {
  studio: 'Studio',
  '1br': '1 bedroom',
  '2br': '2 bedrooms',
  '3br': '3 bedrooms',
  house: 'House',
}

export function formatHomeSize(homeSize: string): string {
  return HOME_SIZE_LABELS[homeSize] ?? homeSize
}

export function formatStatus(status: string): string {
  return status.replace(/_/g, ' ')
}

// Colour per job status, matching the Kanban board's language: green for done,
// amber in flight, red cancelled.
export function statusTone(status: string): string {
  switch (status) {
    case 'completed':
    case 'closed':
    case 'paid':
      return 'bg-green-100 text-green-800'
    case 'in_progress':
    case 'sent':
      return 'bg-amber-100 text-amber-800'
    case 'cancelled':
    case 'disputed':
      return 'bg-red-100 text-red-800'
    case 'confirmed':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}
