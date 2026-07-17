import type { JSX, FormEvent } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth.store'
import { useTeam, useInviteMember, useRemoveMember } from '@/hooks/useSettings'
import { useCrews } from '@/hooks/useCrews'
import { ApiError } from '@/lib/api'

const ROLE_STYLES: Record<string, string> = {
  owner: 'bg-blue-100 text-blue-700',
  dispatcher: 'bg-gray-100 text-gray-600',
  crew: 'bg-green-100 text-green-700',
}

type InviteRole = 'dispatcher' | 'crew'

export default function TeamTab(): JSX.Element {
  const { user } = useAuthStore()
  const { data: team = [] } = useTeam()
  const { data: crews = [] } = useCrews()
  const { mutate: invite, isPending: isInviting } = useInviteMember()
  const { mutate: remove } = useRemoveMember()
  const [inviteEmail, setInviteEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('dispatcher')
  const [crewId, setCrewId] = useState('')
  const [sent, setSent] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  function handleInvite(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    if (role === 'crew' && !crewId) {
      setInviteError('Select a crew for the crew member')
      return
    }
    setInviteError(null)
    invite(
      { email: inviteEmail, role, crewId: role === 'crew' ? crewId : undefined },
      {
        onSuccess: () => {
          setInviteEmail('')
          setRole('dispatcher')
          setCrewId('')
          setSent(true)
          setTimeout(() => setSent(false), 3000)
        },
        onError: (err) => {
          setInviteError(err instanceof ApiError ? err.message : 'Failed to send invite')
        },
      },
    )
  }

  return (
    <div className="mt-4 space-y-5">
      <div className="divide-y border rounded-md">
        {team.map((member) => (
          <div key={member.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{member.name}</p>
              <p className="text-xs text-gray-500">{member.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_STYLES[member.role] ?? ''}`}>{member.role}</span>
              {member.id !== user?.id && member.role !== 'owner' && (
                <button type="button" onClick={() => remove(member.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleInvite} className="space-y-3">
        <p className="text-sm font-medium">Invite team member</p>
        <Input
          type="email"
          placeholder="teammate@company.com"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex-1 text-xs text-gray-500">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as InviteRole)}
              className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900"
            >
              <option value="dispatcher">Dispatcher</option>
              <option value="crew">Crew member</option>
            </select>
          </label>
          {role === 'crew' && (
            <label className="flex-1 text-xs text-gray-500">
              Crew
              <select
                value={crewId}
                onChange={(e) => setCrewId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900"
              >
                <option value="">Select crew</option>
                {crews.map((crew) => (
                  <option key={crew.id} value={crew.id}>
                    {crew.truckLabel ? `${crew.name} — ${crew.truckLabel}` : crew.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <Button type="submit" disabled={isInviting}>{isInviting ? 'Sending...' : 'Send invite'}</Button>
      </form>
      {sent && <p className="text-sm text-green-600">Invite sent!</p>}
      {inviteError !== null && <p className="text-sm text-destructive">{inviteError}</p>}
    </div>
  )
}
