import type { JSX, FormEvent } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth.store'
import { useTeam, useInviteMember, useRemoveMember } from '@/hooks/useSettings'
import { useCrews } from '@/hooks/useCrews'
import { ApiError } from '@/lib/api'
import type { Crew, TeamMember } from '@/types'

const ROLE_STYLES: Record<string, string> = {
  owner: 'bg-blue-100 text-blue-700',
  dispatcher: 'bg-gray-100 text-gray-600',
  crew: 'bg-green-100 text-green-700',
}

type InviteRole = 'dispatcher' | 'crew'

interface SentInvite {
  email: string
  token: string
}

// Shown right after "Send invite", not buried in the team list — the link
// stays visible (no auto-hide timer) since the owner may need a moment to
// copy it, and this is the only fallback if email delivery fails or isn't
// configured at all (same "Copy link" pattern as BookingTab.tsx).
function InviteSentBanner({ email, token }: SentInvite): JSX.Element {
  const [copied, setCopied] = useState(false)
  const inviteUrl = `${window.location.origin}/join?token=${token}`

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-md border border-green-200 bg-green-50 p-3 space-y-2">
      <p className="text-sm text-green-700">Invite sent to {email}.</p>
      <p className="text-xs text-green-700">If the email doesn't arrive, share this link directly:</p>
      <div className="flex items-center gap-2 flex-wrap">
        <code className="text-xs bg-white rounded px-2 py-1.5 text-gray-700 break-all flex-1 min-w-[200px] border border-green-200">
          {inviteUrl}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy link'}
        </Button>
      </div>
    </div>
  )
}

interface TeamMemberListProps {
  team: TeamMember[]
  currentUserId: string | undefined
  onRemove: (id: string) => void
}

function TeamMemberList({ team, currentUserId, onRemove }: TeamMemberListProps): JSX.Element {
  return (
    <div className="divide-y border rounded-md">
      {team.map((member) => (
        <div key={member.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium">{member.name}</p>
            <p className="text-xs text-gray-500">{member.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_STYLES[member.role] ?? ''}`}>{member.role}</span>
            {member.id !== currentUserId && member.role !== 'owner' && (
              <button type="button" onClick={() => onRemove(member.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

interface InviteRoleFieldsProps {
  role: InviteRole
  onRoleChange: (role: InviteRole) => void
  crewId: string
  onCrewIdChange: (crewId: string) => void
  crews: Crew[]
}

function InviteRoleFields({ role, onRoleChange, crewId, onCrewIdChange, crews }: InviteRoleFieldsProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <label className="flex-1 text-xs text-gray-500">
        Role
        <select
          value={role}
          onChange={(e) => onRoleChange(e.target.value as InviteRole)}
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
            onChange={(e) => onCrewIdChange(e.target.value)}
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
  )
}

interface InviteMemberFormProps {
  crews: Crew[]
}

// Slightly over the 40-line guideline; the remainder is mutation-state
// handling tightly coupled to local state (email/role/crewId/sentInvite),
// not mechanically separable JSX — same call made for BookingTab.tsx.
function InviteMemberForm({ crews }: InviteMemberFormProps): JSX.Element {
  const { mutate: invite, isPending: isInviting } = useInviteMember()
  const [inviteEmail, setInviteEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('dispatcher')
  const [crewId, setCrewId] = useState('')
  const [sentInvite, setSentInvite] = useState<SentInvite | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  function handleInvite(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    if (role === 'crew' && !crewId) {
      setInviteError('Select a crew for the crew member')
      return
    }
    setInviteError(null)
    setSentInvite(null)
    invite(
      { email: inviteEmail, role, crewId: role === 'crew' ? crewId : undefined },
      {
        onSuccess: (data) => {
          setInviteEmail('')
          setRole('dispatcher')
          setCrewId('')
          setSentInvite({ email: data.email, token: data.token })
        },
        onError: (err) => {
          setInviteError(err instanceof ApiError ? err.message : 'Failed to send invite')
        },
      },
    )
  }

  return (
    <>
      <form onSubmit={handleInvite} className="space-y-3">
        <p className="text-sm font-medium">Invite team member</p>
        <Input
          type="email"
          placeholder="teammate@company.com"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
        />
        <InviteRoleFields role={role} onRoleChange={setRole} crewId={crewId} onCrewIdChange={setCrewId} crews={crews} />
        <Button type="submit" disabled={isInviting}>{isInviting ? 'Sending...' : 'Send invite'}</Button>
      </form>
      {sentInvite && <InviteSentBanner email={sentInvite.email} token={sentInvite.token} />}
      {inviteError !== null && <p className="text-sm text-destructive">{inviteError}</p>}
    </>
  )
}

export default function TeamTab(): JSX.Element {
  const { user } = useAuthStore()
  const { data: team = [] } = useTeam()
  const { data: crews = [] } = useCrews()
  const { mutate: remove } = useRemoveMember()

  return (
    <div className="mt-4 space-y-5">
      <TeamMemberList team={team} currentUserId={user?.id} onRemove={remove} />
      <InviteMemberForm crews={crews} />
    </div>
  )
}
