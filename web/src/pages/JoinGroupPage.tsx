import { Users } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiJson, ApiError, type GroupResponse, type InvitationPreviewResponse } from '../lib/apiClient'

export function JoinGroupPage() {
  const { token } = useParams<{ token: string }>()
  const { user, isLoading: isAuthLoading } = useAuth()
  const navigate = useNavigate()

  const [preview, setPreview] = useState<InvitationPreviewResponse | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const hasAutoJoined = useRef(false)

  useEffect(() => {
    if (!token) {
      return
    }

    apiJson<InvitationPreviewResponse>(`/invitations/${token}`)
      .then(setPreview)
      .catch(() => setPreviewError("Cette invitation n'existe pas ou n'est plus valide."))
  }, [token])

  async function join() {
    if (!token) {
      return
    }

    setIsJoining(true)
    setJoinError(null)
    try {
      const group = await apiJson<GroupResponse>(`/invitations/${token}/accept`, { method: 'POST' })
      navigate(`/groups/${group.id}`)
    } catch (err) {
      setJoinError(err instanceof ApiError ? err.message : 'Impossible de rejoindre ce groupe.')
    } finally {
      setIsJoining(false)
    }
  }

  // Après une inscription ou une connexion lancée depuis cette page (redirigée ici
  // ensuite), on rejoint automatiquement le groupe sans action supplémentaire — voir la
  // note sur le flux d'invitation dans la spec.
  useEffect(() => {
    if (user && preview?.isValid && !hasAutoJoined.current) {
      hasAutoJoined.current = true
      join()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, preview])

  if (isAuthLoading || (!preview && !previewError)) {
    return <p className="p-4 text-center text-[var(--color-text-muted)]">Chargement...</p>
  }

  if (previewError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-red-600">{previewError}</p>
        <Link to="/" className="text-sm font-medium text-[var(--color-text)]">
          Retour à l'accueil
        </Link>
      </main>
    )
  }

  if (preview && !preview.isValid) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
        <p>Cette invitation n'est plus valide.</p>
        <Link to="/" className="text-sm font-medium text-[var(--color-text)]">
          Retour à l'accueil
        </Link>
      </main>
    )
  }

  const redirect = `/join/${token}`

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 bg-[var(--color-bg)] px-7 text-center text-[var(--color-text)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-badge-bg)]">
        <Users size={30} weight="bold" color="var(--color-accent)" />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-[var(--color-text-muted)]">Vous êtes invité·e à rejoindre</p>
        <h1 className="text-[22px] font-bold">{preview?.groupName}</h1>
      </div>

      {joinError && <p className="text-sm text-red-600">{joinError}</p>}

      {user ? (
        <button
          onClick={join}
          disabled={isJoining}
          className="w-full rounded-[var(--radius-pill)] bg-[var(--color-gold)] px-4 py-3 font-bold text-[var(--color-accent)] disabled:opacity-60"
        >
          {isJoining ? 'Adhésion...' : 'Rejoindre le groupe'}
        </button>
      ) : (
        <div className="flex w-full flex-col gap-2.5">
          <Link
            to={`/register?redirect=${encodeURIComponent(redirect)}`}
            className="w-full rounded-[var(--radius-pill)] bg-[var(--color-gold)] px-4 py-3 font-bold text-[var(--color-accent)]"
          >
            Créer un compte et rejoindre
          </Link>
          <Link
            to={`/login?redirect=${encodeURIComponent(redirect)}`}
            className="w-full rounded-[var(--radius-pill)] border-[1.5px] border-[var(--color-text)] px-4 py-3 font-bold text-[var(--color-text)]"
          >
            J'ai déjà un compte
          </Link>
        </div>
      )}

      <p className="text-xs leading-relaxed text-[var(--color-text-faint)]">
        Ce lien d'invitation est réservé aux personnes conviées par les membres du groupe.
      </p>
    </main>
  )
}
