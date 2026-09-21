import { CaretRight, ChatCircle, Heart, Plus, Shield } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiJson, ApiError, type GroupResponse } from '../lib/apiClient'

// Mêmes teintes pastel que la grille de catégories de la home publique — réutilisées ici
// comme couleur de repli pour l'avatar d'un groupe sans image, par cohérence visuelle.
const AVATAR_TINTS = [
  { bg: '#FDE7D3', text: '#C2410C' },
  { bg: '#DBEAFE', text: '#2563EB' },
  { bg: '#FCE7F3', text: '#BE185C' },
  { bg: '#DCFCE7', text: '#15803D' },
  { bg: '#EDE9FE', text: '#6D28D9' },
  { bg: '#CFFAFE', text: '#0E7490' },
]

function avatarTint(id: number | string) {
  const key = String(id)
  let sum = 0
  for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i)
  return AVATAR_TINTS[sum % AVATAR_TINTS.length]
}

function NavIconLink({
  to,
  label,
  children,
}: {
  to: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-accent)] hover:bg-[var(--color-surface)]"
    >
      {children}
    </Link>
  )
}

export function HomePage() {
  const { user, logout } = useAuth()
  const [groups, setGroups] = useState<GroupResponse[] | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  async function loadGroups() {
    try {
      setGroups(await apiJson<GroupResponse[]>('/groups'))
    } catch {
      setError('Impossible de charger vos groupes.')
    }
  }

  useEffect(() => {
    loadGroups()
  }, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      return
    }

    setIsCreating(true)
    try {
      await apiJson('/groups', {
        method: 'POST',
        body: JSON.stringify({ name, description: description.trim() || null }),
      })
      setName('')
      setDescription('')
      await loadGroups()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de créer le groupe.')
    } finally {
      setIsCreating(false)
    }
  }

  const createGroupForm = (
    <form onSubmit={handleCreate} className="flex flex-col gap-3">
      <h2 className="font-semibold">Créer un groupe</h2>
      <input
        type="text"
        placeholder="Nom du groupe"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[15px] placeholder:text-[#9ca3af] lg:bg-[var(--color-bg)]"
      />
      <input
        type="text"
        placeholder="Description (optionnel)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[15px] placeholder:text-[#9ca3af] lg:bg-[var(--color-bg)]"
      />

      <button
        type="submit"
        disabled={isCreating}
        className="flex items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-gold)] px-3 py-2.5 font-bold text-[var(--color-accent)] disabled:opacity-60"
      >
        <Plus size={16} weight="bold" />
        {isCreating ? 'Création...' : 'Créer le groupe'}
      </button>
    </form>
  )

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-[var(--color-bg)] px-4 py-6 text-[var(--color-text)] lg:max-w-6xl lg:px-8 lg:py-10">
      {/* Sur desktop, la nav (AppHeader) couvre déjà Admin/Favoris/Messages/Compte : on
          masque cette rangée d'icônes redondante et on ne garde que le titre. */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Mes groupes</h1>
        <div className="flex items-center gap-0.5 lg:hidden">
          {user?.roles.includes('Admin') && (
            <NavIconLink to="/admin" label="Administration">
              <Shield size={19} weight="bold" />
            </NavIconLink>
          )}
          <NavIconLink to="/favorites" label="Favoris">
            <Heart size={19} weight="bold" />
          </NavIconLink>
          <NavIconLink to="/conversations" label="Messages">
            <ChatCircle size={19} weight="bold" />
          </NavIconLink>
          <Link to="/account" className="ml-1 flex items-center" aria-label="Mon compte">
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-white">
                {user?.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between lg:hidden">
        <p className="text-sm text-[var(--color-text-muted)]">Bienvenue, {user?.displayName} 👋</p>
        <button onClick={() => logout()} className="text-sm text-[var(--color-text-muted)] underline decoration-dotted">
          Se déconnecter
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {groups && groups.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">
          Vous ne faites partie d'aucun groupe pour le moment. Créez-en un pour commencer à
          partager des annonces avec vos proches.
        </p>
      )}

      {/* Desktop : liste de groupes en grille à gauche, formulaire de création dans une
          carte latérale fixe à droite (plutôt qu'empilé en bas de la longue colonne
          mobile) — usage réel de la largeur disponible. */}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {groups && groups.length > 0 && (
          <ul className="flex flex-1 flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3.5 xl:grid-cols-3">
            {groups.map((group) => {
              const tint = avatarTint(group.id)
              return (
                <li key={group.id}>
                  <Link
                    to={`/groups/${group.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 lg:h-full lg:items-start lg:hover:border-[var(--color-accent)]"
                  >
                    <div
                      className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-xl text-base font-bold"
                      style={{ background: tint.bg, color: tint.text }}
                    >
                      {group.imageUrl ? (
                        <img src={group.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        group.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{group.name}</span>
                      <span className="block text-[13px] text-[var(--color-text-muted)]">
                        {group.memberCount} membre{group.memberCount > 1 ? 's' : ''}
                      </span>
                      {group.listingPreviewUrls.length > 0 && (
                        <div className="mt-2 hidden flex-none -space-x-2 lg:flex">
                          {group.listingPreviewUrls.map((url, index) => (
                            <img
                              key={url}
                              src={url}
                              alt=""
                              loading="lazy"
                              style={{ zIndex: group.listingPreviewUrls.length - index }}
                              className="h-7 w-7 flex-none rounded-full border-2 border-[var(--color-surface)] object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    {group.listingPreviewUrls.length > 0 && (
                      <div className="flex flex-none -space-x-2 lg:hidden">
                        {group.listingPreviewUrls.map((url, index) => (
                          <img
                            key={url}
                            src={url}
                            alt=""
                            loading="lazy"
                            style={{ zIndex: group.listingPreviewUrls.length - index }}
                            className="h-8 w-8 flex-none rounded-full border-2 border-[var(--color-surface)] object-cover"
                          />
                        ))}
                      </div>
                    )}
                    <CaretRight size={18} weight="bold" color="#9ca3af" className="lg:hidden" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        <div className="border-t border-[var(--color-border)] pt-6 lg:w-80 lg:flex-none lg:rounded-2xl lg:border lg:bg-[var(--color-surface)] lg:p-5 lg:pt-5">
          {createGroupForm}
        </div>
      </div>
    </main>
  )
}
