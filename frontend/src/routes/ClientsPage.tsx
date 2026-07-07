import type { JSX } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Client } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import ClientTableRow from '@/components/shared/ClientTableRow'
import ClientDetailSheet from '@/components/shared/ClientDetailSheet'
import AddClientPanel from '@/components/shared/AddClientPanel'
import { useClients } from '@/hooks/useClients'

export default function ClientsPage(): JSX.Element {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Client | null>(null)
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false)
  const { data: clients = [], isLoading } = useClients(search || undefined)
  const navigate = useNavigate()

  function handleNewOrder(client: Client): void {
    navigate('/new-order', { state: { clientPhone: client.phone, clientName: client.name } })
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="text-xl font-semibold">Clients</h1>
        <div className="flex items-center gap-3">
          <Input placeholder="Search by name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Button onClick={() => setIsAddOpen(true)}>+ Add client</Button>
        </div>
      </div>
      {isLoading
        ? <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" /></div>
        : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Phone</th>
                <th className="px-4 py-2">Last move</th>
                <th className="px-4 py-2 text-center">Orders</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <ClientTableRow key={client.id} client={client} onViewDetails={setSelected} onNewOrder={handleNewOrder} />
              ))}
            </tbody>
          </table>
        )}
      {selected !== null && (
        <ClientDetailSheet key={selected.id} client={selected} onNewOrder={handleNewOrder} onClose={() => setSelected(null)} />
      )}
      {isAddOpen && (
        <AddClientPanel onClose={() => setIsAddOpen(false)} />
      )}
    </div>
  )
}
