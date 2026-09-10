import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  apiFetch,
  apiJson,
  ApiError,
  extractErrorMessage,
  type GroupMemberResponse,
  type GroupResponse,
  type InvitationResponse,
} from '../lib/apiClient'

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const [group, setGroup] = useState<GroupResponse | null>(null)
  const [members, setMembers] = useState<GroupMemberResponse[] | null>(null)
  const [linkInvitation, setLinkInvitation] = useState<InvitationResponse | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isSavingImage, setIsSavingImage] = useState(false)

  useEffect(() => {
    if (!groupId) {
      return
    }

    Promise.all([
      apiJson<GroupResponse>(`/groups/${groupId}`),
      apiJson<GroupMemberResponse[]>(`/groups/${groupId}/members`),
    ])
      .then(([groupResponse, membersResponse]) => {
        setGroup(groupResponse)
        setMembers(membersResponse)
      })
      .catch(() => setLoadError('Impossible de charger ce groupe.'))
  }, [groupId])

  const isAdmin = group?.currentUserRole === 'Admin'

  async function generateLink() {
    setActionError(null)
    setIsBusy(true)
    try {
      setLinkInvitation(await apiJson<InvitationResponse>(`/groups/${groupId}/invitations/link`, { method: 'POST' }))
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Impossible de générer le lien.')
    } finally {
      setIsBusy(false)
    }
  }

  async function revokeLink() {
    setActionError(null)
    setIsBusy(true)
    try {
      await apiJson(`/groups/${groupId}/invitations/link/revoke`, { method: 'POST' })
      setLinkInvitation(null)
      setNotice('Le lien a été révoqué.')
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Impossible de révoquer le lien.')
    } finally {
      setIsBusy(false)
    }
  }

  async function copyLink() {
    if (!linkInvitation) {
      return
    }

    const url = `${window.location.origin}/join/${linkInvitation.token}`
    try {
      await navigator.clipboard.writeText(url)
      setNotice('Lien copié dans le presse-papiers.')
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé, permission refusée...) :
      // le lien reste affiché à l'écran, la copie manuelle reste possible.
      setNotice(null)
    }
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    setActionError(null)
    setIsSavingImage(true)
    try {
      const form = new FormData()
      form.set('image', file)
      const response = await apiFetch(`/groups/${groupId}/image`, { method: 'POST', body: form })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new ApiError(response.status, extractErrorMessage(body, "Impossible de mettre à jour l'image."))
      }
      setGroup(await response.json())
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Impossible de mettre à jour l'image du groupe.")
    } finally {
      setIsSavingImage(false)
    }
  }

  async function handleDeleteImage() {
    if (!group) {
      return
    }

    setActionError(null)
    setIsSavingImage(true)
    try {
      await apiJson(`/groups/${groupId}/image`, { method: 'DELETE' })
      setGroup({ ...group, imageUrl: null })
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Impossible de retirer l'image du groupe.")
    } finally {
      setIsSavingImage(false)
    }
  }

  async function toggleEmailDigest() {
    if (!group) {
      return
    }

    const nextValue = !group.emailDigestEnabled
    setActionError(null)
    try {
      await apiJson(`/groups/${groupId}/notifications`, {
        method: 'PATCH',
        body: JSON.stringify({ emailDigestEnabled: nextValue }),
      })
      setGroup({ ...group, emailDigestEnabled: nextValue })
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Impossible de mettre à jour cette préférence.')
    }
  }

  async function handleInviteByEmail(event: FormEvent) {
    event.preventDefault()
    setActionError(null)
    setNotice(null)
    if (!inviteEmail.trim()) {
      return
    }

    setIsBusy(true)
    try {
      await apiJson(`/groups/${groupId}/invitations/email`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      setNotice(`Invitation envoyée à ${inviteEmail.trim()}.`)
      setInviteEmail('')
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Impossible d'envoyer l'invitation.")
    } finally {
      setIsBusy(false)
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-red-600">{loadError}</p>
        <Link to="/" className="text-sm font-medium text-[var(--color-accent)]">
          Retour à mes groupes
        </Link>
      </main>
    )
  }

  if (!group || !members) {
    return <p className="p-4 text-center text-[var(--color-text-muted)]">Chargement...</p>
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-8">
      <Link to="/" className="text-sm text-[var(--color-text-muted)]">
        ← Mes groupes
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-16 w-16 flex-none overflow-hidden rounded bg-[var(--color-bg)]">
          {group.imageUrl && <img src={group.imageUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{group.name}</h1>
          {group.description && <p className="text-sm text-[var(--color-text-muted)]">{group.description}</p>}
        </div>
      </div>

      {isAdmin && (
        <div className="flex gap-2">
          <label className="cursor-pointer rounded border border-[var(--color-border)] px-3 py-2 text-sm">
            {isSavingImage ? 'Envoi...' : "Changer l'image du groupe"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              disabled={isSavingImage}
              className="hidden"
            />
          </label>
          {group.imageUrl && (
            <button
              onClick={handleDeleteImage}
              disabled={isSavingImage}
              className="rounded border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-60"
            >
              Retirer
            </button>
          )}
        </div>
      )}

      <Link
        to={`/groups/${group.id}/listings`}
        className="rounded bg-[var(--color-accent)] px-3 py-2 text-center font-medium text-white"
      >
        Voir les annonces du groupe
      </Link>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}
      {notice && <p className="text-sm text-[var(--color-accent)]">{notice}</p>}

      <section>
        <h2 className="mb-2 font-semibold">Membres ({members.length})</h2>
        <ul className="flex flex-col gap-1">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center justify-between text-sm">
              <span>{member.displayName}</span>
              {member.role === 'Admin' && (
                <span className="text-xs text-[var(--color-text-muted)]">Admin</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-[var(--color-border)] pt-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={group.emailDigestEnabled} onChange={toggleEmailDigest} />
          Recevoir le résumé quotidien des nouvelles annonces de ce groupe par email
        </label>
      </section>

      {isAdmin && (
        <section className="flex flex-col gap-4 border-t border-[var(--color-border)] pt-6">
          <h2 className="font-semibold">Inviter</h2>

          {linkInvitation ? (
            <div className="flex flex-col gap-2">
              <p className="break-all rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                {window.location.origin}/join/{linkInvitation.token}
              </p>
              <div className="flex gap-2">
                <button onClick={copyLink} className="rounded border border-[var(--color-border)] px-3 py-2 text-sm">
                  Copier le lien
                </button>
                <button
                  onClick={revokeLink}
                  disabled={isBusy}
                  className="rounded border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-60"
                >
                  Révoquer
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={generateLink}
              disabled={isBusy}
              className="rounded border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-60"
            >
              Générer un lien d'invitation
            </button>
          )}

          <form onSubmit={handleInviteByEmail} className="flex flex-col gap-2">
            <input
              type="email"
              placeholder="Email de la personne à inviter"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
            />
            <button
              type="submit"
              disabled={isBusy}
              className="rounded bg-[var(--color-accent)] px-3 py-2 font-medium text-white disabled:opacity-60"
            >
              Envoyer l'invitation par email
            </button>
          </form>
        </section>
      )}
    </main>
  )
}
