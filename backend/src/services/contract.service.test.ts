import { beforeEach, describe, expect, it, vi } from 'vitest'

// signContract issues: one order+client read (leftJoin), an orders update, then
// an owners read. The fake queues rows per read and records update sets.
const { selectQueue, updateSets } = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  updateSets: [] as unknown[],
}))

vi.mock('../db/index.js', () => {
  const read = () => {
    const rows = selectQueue.shift() ?? []
    const promise = Promise.resolve(rows) as Promise<unknown[]> & {
      limit: (n: number) => Promise<unknown[]>
    }
    promise.limit = (n: number) => Promise.resolve(rows.slice(0, n))
    return promise
  }
  return {
    db: {
      select: () => ({
        from: () => ({
          leftJoin: () => ({ where: read }),
          where: read,
        }),
      }),
      update: () => ({
        set: (v: unknown) => {
          updateSets.push(v)
          return { where: () => Promise.resolve() }
        },
      }),
      insert: () => ({ values: () => Promise.resolve() }),
    },
  }
})

vi.mock('../lib/env.js', () => ({ env: { FRONTEND_URL: 'http://localhost:5173' } }))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

const sendContractSignedNotificationMock = vi.fn()
vi.mock('../lib/email.js', () => ({
  sendContractEmail: vi.fn(),
  sendContractSignedNotification: (...a: unknown[]) => sendContractSignedNotificationMock(...a),
}))

vi.mock('../lib/r2.js', () => ({
  uploadBinary: () => Promise.resolve({ url: 'https://cdn.example/signature.png' }),
}))

const createNotificationMock = vi.fn()
vi.mock('./notifications.service.js', () => ({
  createNotification: (...a: unknown[]) => createNotificationMock(...a),
}))

const { signContract } = await import('./contract.service.js')

const TENANT_A = '11111111-1111-1111-1111-111111111111'
const ORDER_ID = '55555555-5555-4555-8555-555555555555'
const TOKEN = '66666666-6666-4666-8666-666666666666'
const SIGNATURE = `data:image/png;base64,${Buffer.from('png').toString('base64')}`

function orderRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ORDER_ID,
    tenant_id: TENANT_A,
    contract_status: 'sent',
    move_date: '2026-08-20',
    clientName: 'Rick Adams',
    ...overrides,
  }
}

beforeEach(() => {
  selectQueue.length = 0
  updateSets.length = 0
  sendContractSignedNotificationMock.mockReset()
  createNotificationMock.mockReset()
  createNotificationMock.mockResolvedValue(undefined)
})

describe('signContract — in-app notification', () => {
  it('AC1 — raises a tenant-scoped notification pointing at the signed order', async () => {
    selectQueue.push([orderRow()]) // order + client
    selectQueue.push([{ email: 'owner@example.com' }]) // owners

    const result = await signContract(TOKEN, { signedName: 'Rick Adams', signatureDataUrl: SIGNATURE })

    expect(result).toEqual({ status: 'signed', orderId: ORDER_ID, tenantId: TENANT_A })
    expect(createNotificationMock).toHaveBeenCalledWith({
      tenantId: TENANT_A,
      type: 'contract_signed',
      title: 'Contract signed by Rick Adams',
      body: 'Move on Aug 20, 2026',
      relatedType: 'order',
      relatedId: ORDER_ID,
    })
  })

  // The point of the whole feature: the owner still finds out even when the
  // outbound email never lands.
  it('AC1 — notifies even when the tenant has no owner to email', async () => {
    selectQueue.push([orderRow()])
    selectQueue.push([]) // no owners

    await signContract(TOKEN, { signedName: 'Rick Adams', signatureDataUrl: SIGNATURE })

    expect(sendContractSignedNotificationMock).not.toHaveBeenCalled()
    expect(createNotificationMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to a generic name when the order has no client', async () => {
    selectQueue.push([orderRow({ clientName: null })])
    selectQueue.push([{ email: 'owner@example.com' }])

    await signContract(TOKEN, { signedName: 'Rick', signatureDataUrl: SIGNATURE })

    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Contract signed by A client' }),
    )
  })

  it('does not notify for an already-signed contract', async () => {
    selectQueue.push([orderRow({ contract_status: 'signed' })])

    const result = await signContract(TOKEN, { signedName: 'Rick', signatureDataUrl: SIGNATURE })

    expect(result).toEqual({ status: 'already_signed' })
    expect(createNotificationMock).not.toHaveBeenCalled()
  })

  it('does not notify when the token matches no order', async () => {
    selectQueue.push([])

    const result = await signContract(TOKEN, { signedName: 'Rick', signatureDataUrl: SIGNATURE })

    expect(result).toEqual({ status: 'not_found' })
    expect(createNotificationMock).not.toHaveBeenCalled()
  })

  it('does not notify when the signature is not a PNG data url', async () => {
    selectQueue.push([orderRow()])

    const result = await signContract(TOKEN, { signedName: 'Rick', signatureDataUrl: 'nope' })

    expect(result).toEqual({ status: 'invalid_signature' })
    expect(updateSets).toHaveLength(0)
    expect(createNotificationMock).not.toHaveBeenCalled()
  })
})
