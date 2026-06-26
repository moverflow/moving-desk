import type { JSX, FormEvent } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth.store'
import { useTeam, useInviteMember, useRemoveMember } from '@/hooks/useSettings'
import { ApiError } from '@/lib/api'

const ROLE_STYLES: Record<string, string> = {
  owner: 'bg-blue-100 text-blue-700',
  dispatcher: 'bg-gray-100 text-gray-600',
}

export default function TeamTab(): JSX.Element {
  const { user } = useAuthStore()
  const { data: team = [] } = useTeam()
  const { mutate: invite, isPending: isInviting } = useInviteMember()
  const { mutate: remove } = useRemoveMember()
  const [inviteEmail, setInviteEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  function handleInvite(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteError(null)
    invite(inviteEmail, {
      onSuccess: () => {
        setInviteEmail('')
        setSent(true)
        setTimeout(() => setSent(false), 3000)
      },
      onError: (err) => {
        setInviteError(err instanceof ApiError ? err.message : 'Failed to send invite')
      },
    })
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
      <form onSubmit={handleInvite} className="flex gap-2">
        <Input type="email" placeholder="teammate@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1" />
        <Button type="submit" disabled={isInviting}>{isInviting ? 'Sending...' : 'Invite'}</Button>
      </form>
      {sent && <p className="text-sm text-green-600">Invite sent!</p>}
      {inviteError !== null && <p className="text-sm text-destructive">{inviteError}</p>}
    </div>
  )
}
