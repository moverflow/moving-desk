import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { HomeSize, CreateOrderData } from '@/types'
import { useCreateOrder, findClientByPhone } from '@/hooks/useOrders'

export interface NewOrderFormState {
  phone: string
  clientName: string
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

const INITIAL: NewOrderFormState = {
  phone: '', clientName: '', fromAddress: '', toAddress: '',
  moveDate: '', homeSize: '2br', fromFloor: 1, toFloor: 1,
  fromElevator: false, toElevator: false, packing: false,
  crewId: '', notes: '',
}

export function useNewOrderForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState<NewOrderFormState>(INITIAL)
  const { mutate, isPending } = useCreateOrder()

  function set<K extends keyof NewOrderFormState>(k: K, v: NewOrderFormState[K]): void {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function handlePhoneBlur(): void {
    const client = findClientByPhone(form.phone)
    if (client) setForm((p) => ({ ...p, ...client }))
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    const data: CreateOrderData = {
      clientName: form.clientName, phone: form.phone,
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
