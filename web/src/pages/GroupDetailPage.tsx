import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  apiFetch,
  apiJson,
  ApiError,
  extractErrorMessage,
  type GroupMemberResponse,
  type GroupResponse,
  type InvitationResponse,
} from '../lib/apiClient'
import { ImagePlaceholder } from '../components/ImagePlaceholder'

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const { user } = useAuth()
  const [group, setGroup] = useState<GroupResponse | null>(null)
  const [members, setMembers] = useState<GroupMemberResponse[] | null>(null)
  const [linkInvitation, setLinkInvitation] = useState<InvitationResponse | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isSavingImage, setIsSavingImage] = useState(false)
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null)

  function loadMembers() {
    return apiJson<GroupMemberResponse[]>(`/groups/${groupId}/members`).then(setMembers)
  }

  useEffect(() => {
    if (!groupId) {
      return
    }

    Promise.all([apiJson<GroupResponse>(`/groups/${groupId}`), loadMembers()])
      .then(([groupResponse]) => setGroup(groupResponse))
      .catch(() => setLoadError('Impossible de charger ce groupe.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  const isAdmin = group?.currentUserRole === 'Admin'
  const canRemoveMembers = group?.currentUserCanRemoveMembers ?? false

  async function handleChangeRole(memberId: string, role: 'Admin' | 'Member') {
    setActionError(null)
    setBusyMemberId(memberId)
    try {
      await apiJson(`/groups/${groupId}/members/${memberId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })
      await loadMembers()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Impossible de changer ce rôle.')
    } finally {
      setBusyMemberId(null)
    }
  }

  async function handleTogglePermission(
    member: GroupMemberResponse,
    key: 'canInviteMembers' | 'canRemoveMembers' | 'canDeleteListings',
  ) {
    setActionError(null)
    setBusyMemberId(member.userId)
    try {
      await apiJson(`/groups/${groupId}/members/${member.userId}/permissions`, {
        method: 'PATCH',
        body: JSON.stringify({
          canInviteMembers: key === 'canInviteMembers' ? !member.canInviteMembers : member.canInviteMembers,
          canRemoveMembers: key === 'canRemoveMembers' ? !member.canRemoveMembers : member.canRemoveMembers,
          canDeleteListings: key === 'canDeleteListings' ? !member.canDeleteListings : member.canDeleteListings,
        }),
      })
      await loadMembers()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Impossible de mettre à jour ces droits.')
    } finally {
      setBusyMemberId(null)
    }
  }

  async function handleRemoveMember(member: GroupMemberResponse) {
    if (!window.confirm(`Retirer ${member.displayName} du groupe ?`)) {
      return
    }

    setActionError(null)
    setBusyMemberId(member.userId)
    try {
      await apiJson(`/groups/${groupId}/members/${member.userId}`, { method: 'DELETE' })
      await loadMembers()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Impossible de retirer ce membre.')
    } finally {
      setBusyMemberId(null)
    }
  }

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
        <Link to="/" className="text-sm font-medium text-[var(--color-text)]">
          Retour à mes groupes
        </Link>
      </main>
    )
  }

  if (!group || !members) {
    return <p className="p-4 text-center text-[var(--color-text-muted)]">Chargement...</p>
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-[var(--color-bg)] px-4 py-8 text-[var(--color-text)] lg:max-w-5xl lg:px-8 lg:py-10">
      <Link to="/" className="text-sm text-[var(--color-text-muted)] lg:hidden">
        ← Mes groupes
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 flex-none overflow-hidden rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] lg:h-20 lg:w-20">
            {group.imageUrl ? (
              <img src={group.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImagePlaceholder />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight lg:text-3xl">{group.name}</h1>
            {group.description && <p className="text-sm text-[var(--color-text-muted)]">{group.description}</p>}
            {isAdmin && (
              <div className="mt-2 flex gap-2">
                <label className="cursor-pointer rounded border border-[var(--color-border)] px-3 py-1.5 text-xs">
                  {isSavingImage ? 'Envoi...' : "Changer l'image"}
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
                    className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs disabled:opacity-60"
                  >
                    Retirer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <Link
          to={`/groups/${group.id}/listings`}
          className="rounded-[var(--radius-pill)] bg-[var(--color-gold)] px-3 py-2.5 text-center font-bold text-[var(--color-accent)] lg:flex-none lg:px-5"
        >
          Voir les annonces du groupe
        </Link>
      </div>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}
      {notice && <p className="text-sm text-[var(--color-text)]">{notice}</p>}

      {/* Desktop : membres en grille sur 2 colonnes (au lieu d'une pile étroite) à gauche,
          résumé email + invitation regroupés dans une carte latérale à droite. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-8">
      <section className="lg:col-span-2">
        <h2 className="mb-2 font-semibold">Membres ({members.length})</h2>
        <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-3">
          {members.map((member) => {
            const isSelf = member.userId === user?.id
            const isCreator = member.userId === group.createdByUserId
            const isBusy = busyMemberId === member.userId
            // Un admin gère tout le monde (sauf le créateur, protégé) ; un membre avec
            // le droit délégué ne peut agir que sur des membres simples, jamais un admin.
            const canManageThisMember = !isSelf && !isCreator && (isAdmin || (canRemoveMembers && member.role !== 'Admin'))

            const permissionChips: Array<{
              key: 'canInviteMembers' | 'canRemoveMembers' | 'canDeleteListings'
              label: string
              checked: boolean
            }> = [
              { key: 'canInviteMembers', label: 'Inviter', checked: member.canInviteMembers },
              { key: 'canRemoveMembers', label: 'Retirer des membres', checked: member.canRemoveMembers },
              { key: 'canDeleteListings', label: 'Supprimer des annonces', checked: member.canDeleteListings },
            ]

            return (
              <li key={member.userId} className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {member.displayName}
                    {isSelf && <span className="font-normal text-[var(--color-text-muted)]"> (vous)</span>}
                  </span>
                  {(isCreator || member.role === 'Admin') && (
                    <span className="rounded-[var(--radius-pill)] bg-[var(--color-badge-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-accent)]">
                      {isCreator ? 'Créateur' : 'Admin'}
                    </span>
                  )}
                </div>

                {isAdmin && !isSelf && !isCreator && (
                  <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
                    <button
                      onClick={() => handleChangeRole(member.userId, member.role === 'Admin' ? 'Member' : 'Admin')}
                      disabled={isBusy}
                      className="self-start rounded-[var(--radius-pill)] border-[1.5px] border-[var(--color-text)] px-3 py-1 text-xs font-semibold text-[var(--color-text)] disabled:opacity-60"
                    >
                      {member.role === 'Admin' ? 'Rétrograder en membre' : 'Promouvoir admin'}
                    </button>

                    {member.role !== 'Admin' && (
                      <div className="flex flex-wrap gap-1.5">
                        {permissionChips.map((perm) => (
                          <button
                            key={perm.key}
                            type="button"
                            onClick={() => handleTogglePermission(member, perm.key)}
                            disabled={isBusy}
                            aria-pressed={perm.checked}
                            className={
                              perm.checked
                                ? 'rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60'
                                : 'rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)] disabled:opacity-60'
                            }
                          >
                            {perm.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {canManageThisMember && (
                  <button
                    onClick={() => handleRemoveMember(member)}
                    disabled={isBusy}
                    className="self-start text-xs font-medium text-red-600 disabled:opacity-60"
                  >
                    Retirer du groupe
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <div className="flex flex-col gap-6 lg:col-span-1 lg:gap-6 lg:rounded-2xl lg:border lg:border-[var(--color-border)] lg:bg-[var(--color-surface)] lg:p-5">
        <section className="border-t border-[var(--color-border)] pt-4 lg:border-t-0 lg:pt-0">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={group.emailDigestEnabled} onChange={toggleEmailDigest} />
            Recevoir le résumé quotidien des nouvelles annonces de ce groupe par email
          </label>
        </section>

        {group.currentUserCanInviteMembers && (
          <section className="flex flex-col gap-4 border-t border-[var(--color-border)] pt-6 lg:pt-4">
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
                className="rounded-[var(--radius-pill)] bg-[var(--color-gold)] px-3 py-2.5 font-bold text-[var(--color-accent)] disabled:opacity-60"
              >
                Envoyer l'invitation par email
              </button>
            </form>
          </section>
        )}
      </div>
      </div>
    </main>
  )
}
