import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiJson, ApiError, type GroupResponse } from '../lib/apiClient'

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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mes groupes</h1>
        <div className="flex items-center gap-3">
          {user?.roles.includes('Admin') && (
            <Link to="/admin" className="text-sm font-medium text-[var(--color-accent)]">
              Admin
            </Link>
          )}
          <Link to="/favorites" className="text-sm font-medium text-[var(--color-accent)]">
            Favoris
          </Link>
          <Link to="/conversations" className="text-sm font-medium text-[var(--color-accent)]">
            Messages
          </Link>
          <Link to="/account" className="flex items-center" aria-label="Mon compte">
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-bg)] text-xs font-medium text-[var(--color-text-muted)]">
                {user?.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
          <button onClick={() => logout()} className="text-sm text-[var(--color-text-muted)]">
            Se déconnecter
          </button>
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-muted)]">Bienvenue, {user?.displayName} 👋</p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {groups && groups.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">
          Vous ne faites partie d'aucun groupe pour le moment. Créez-en un pour commencer à
          partager des annonces avec vos proches.
        </p>
      )}

      {groups && groups.length > 0 && (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                to={`/groups/${group.id}`}
                className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
              >
                <div className="h-12 w-12 flex-none overflow-hidden rounded bg-[var(--color-bg)]">
                  {group.imageUrl && (
                    <img src={group.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{group.name}</span>
                  <span className="block text-sm text-[var(--color-text-muted)]">
                    {group.memberCount} membre{group.memberCount > 1 ? 's' : ''}
                  </span>
                </div>
                {group.listingPreviewUrls.length > 0 && (
                  <div className="flex flex-none -space-x-2">
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
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-6">
        <h2 className="font-semibold">Créer un groupe</h2>
        <input
          type="text"
          placeholder="Nom du groupe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
        <input
          type="text"
          placeholder="Description (optionnel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />

        <button
          type="submit"
          disabled={isCreating}
          className="rounded bg-[var(--color-accent)] px-3 py-2 font-medium text-white disabled:opacity-60"
        >
          {isCreating ? 'Création...' : 'Créer le groupe'}
        </button>
      </form>
    </main>
  )
}
