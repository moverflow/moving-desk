import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { HomeSize, CreateOrderData } from '@/types'
import { useCreateOrder } from '@/hooks/useOrders'
import { useClientByPhone } from '@/hooks/useClients'

export interface NewOrderFormState {
  phone: string
  clientName: string
  clientEmail: string
  fromAddress: string
  toAddress: string
  moveDate: string
  homeSize: HomeSize
  fromFloor: number
  toFloor: number
  fromElevator: boolean
  toElevator: boolean
  packing: boolean
  crewId: string
  notes: string
}

const BLANK: NewOrderFormState = {
  phone: '', clientName: '', clientEmail: '', fromAddress: '', toAddress: '',
  moveDate: '', homeSize: '2br', fromFloor: 1, toFloor: 1,
  fromElevator: false, toElevator: false, packing: false,
  crewId: '', notes: '',
}

export function useNewOrderForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefill = (location.state as { clientPhone?: string; clientName?: string } | null) ?? {}
  const { mutate, isPending } = useCreateOrder()

  const [form, setForm] = useState<NewOrderFormState>(() => ({
    ...BLANK,
    phone: prefill.clientPhone ?? '',
    clientName: prefill.clientName ?? '',
  }))

  const { data: clientByPhone } = useClientByPhone(form.phone)

  function set<K extends keyof NewOrderFormState>(k: K, v: NewOrderFormState[K]): void {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function handlePhoneBlur(): void {
    if (clientByPhone) {
      setForm((p) => ({
        ...p,
        clientName: clientByPhone.name,
        clientEmail: clientByPhone.email || p.clientEmail,
      }))
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    const data: CreateOrderData = {
      clientName: form.clientName,
      phone: form.phone,
      ...(form.clientEmail.trim() ? { clientEmail: form.clientEmail.trim() } : {}),
      fromAddress: form.fromAddress, toAddress: form.toAddress,
      moveDate: form.moveDate, homeSize: form.homeSize,
      crewId: form.crewId || undefined,
      fromFloor: form.fromFloor, toFloor: form.toFloor,
      fromElevator: form.fromElevator, toElevator: form.toElevator,
      packing: form.packing, notes: form.notes || undefined,
    }
    mutate(data, { onSuccess: () => navigate('/orders') })
  }

  return { form, set, handlePhoneBlur, handleSubmit, isPending }
}
