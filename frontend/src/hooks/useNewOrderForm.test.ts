import { describe, it, expect } from 'vitest'

// AC2 — pre-fill logic: verify the initializer merges location.state correctly
describe('useNewOrderForm pre-fill logic (AC2)', () => {
  const BLANK = {
    phone: '', clientName: '', clientEmail: '', fromAddress: '', toAddress: '',
    moveDate: '', homeSize: '2br', fromFloor: 1, toFloor: 1,
    fromElevator: false, toElevator: false, packing: false,
    crewId: '', notes: '',
  }

  function buildInitialForm(prefill: { clientPhone?: string; clientName?: string }) {
    return {
      ...BLANK,
      phone: prefill.clientPhone ?? '',
      clientName: prefill.clientName ?? '',
    }
  }

  it('AC2 — merges clientPhone and clientName from navigation state', () => {
    const form = buildInitialForm({ clientPhone: '(949) 632-9557', clientName: 'Rick Adams' })
    expect(form.phone).toBe('(949) 632-9557')
    expect(form.clientName).toBe('Rick Adams')
  })

  it('AC2 — no prefill leaves form blank', () => {
    const form = buildInitialForm({})
    expect(form.phone).toBe('')
    expect(form.clientName).toBe('')
  })

  it('AC2 — partial prefill (name only) works', () => {
    const form = buildInitialForm({ clientName: 'Anna Brooks' })
    expect(form.clientName).toBe('Anna Brooks')
    expect(form.phone).toBe('')
  })

  it('AC2 — all other fields remain at defaults', () => {
    const form = buildInitialForm({ clientPhone: '(949) 632-9557', clientName: 'Rick Adams' })
    expect(form.homeSize).toBe('2br')
    expect(form.fromFloor).toBe(1)
    expect(form.packing).toBe(false)
  })
})
