import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

export function formatCurrency(amount: number): string {
  if (Number.isInteger(amount)) {
    return `$${amount.toLocaleString('en-US')}`
  }
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function getPersonInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function getAllTimezones(): string[] {
  return Intl.supportedValuesOf('timeZone')
}

export function getGroupedTimezones(): Record<string, string[]> {
  const all = Intl.supportedValuesOf('timeZone')
  return all.reduce((acc, tz) => {
    const region = tz.split('/')[0]
    if (!acc[region]) acc[region] = []
    acc[region].push(tz)
    return acc
  }, {} as Record<string, string[]>)
}
