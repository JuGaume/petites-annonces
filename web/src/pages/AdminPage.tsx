import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  apiJson,
  ApiError,
  type AdminGroupResponse,
  type AdminListingResponse,
  type AdminUserResponse,
  type AuditLogEntryResponse,
  type CategoryResponse,
} from '../lib/apiClient'

type Tab = 'users' | 'groups' | 'listings' | 'categories' | 'audit'

const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: 'Utilisateurs' },
  { id: 'groups', label: 'Groupes' },
  { id: 'listings', label: 'Annonces' },
  { id: 'categories', label: 'Catégories' },
  { id: 'audit', label: 'Journal' },
]

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('users')

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8 lg:max-w-4xl lg:px-8">
      <Link to="/" className="text-sm text-[var(--color-text-muted)]">
        ← Mes groupes
      </Link>

      <h1 className="text-2xl font-semibold">Administration</h1>

      <nav className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'users' && <UsersSection />}
      {tab === 'groups' && <GroupsSection />}
      {tab === 'listings' && <ListingsSection />}
      {tab === 'categories' && <CategoriesSection />}
      {tab === 'audit' && <AuditLogSection />}
    </main>
  )
}

function UsersSection() {
  const [users, setUsers] = useState<AdminUserResponse[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  async function load() {
    try {
      setUsers(await apiJson<AdminUserResponse[]>('/admin/users'))
    } catch {
      setError('Impossible de charger les utilisateurs.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function toggle(user: AdminUserResponse) {
    setBusyUserId(user.id)
    setError(null)
    try {
      await apiJson(`/admin/users/${user.id}/${user.isDisabled ? 'enable' : 'disable'}`, { method: 'POST' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.')
    } finally {
      setBusyUserId(null)
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!users) return <p className="text-sm text-[var(--color-text-muted)]">Chargement...</p>

  return (
    <ul className="flex flex-col gap-2">
      {users.map((user) => (
        <li
          key={user.id}
          className="flex items-center justify-between gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{user.displayName}</p>
            <p className="truncate text-sm text-[var(--color-text-muted)]">
              {user.email} · {user.roles.join(', ')}
              {user.isDisabled && <span className="ml-2 font-medium text-red-600">Désactivé</span>}
            </p>
          </div>
          <button
            onClick={() => toggle(user)}
            disabled={busyUserId === user.id}
            className="flex-none rounded border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-60"
          >
            {user.isDisabled ? 'Réactiver' : 'Désactiver'}
          </button>
        </li>
      ))}
    </ul>
  )
}

function GroupsSection() {
  const [groups, setGroups] = useState<AdminGroupResponse[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyGroupId, setBusyGroupId] = useState<number | null>(null)

  async function load() {
    try {
      setGroups(await apiJson<AdminGroupResponse[]>('/admin/groups'))
    } catch {
      setError('Impossible de charger les groupes.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function remove(group: AdminGroupResponse) {
    if (!window.confirm(`Supprimer définitivement le groupe « ${group.name} » et tout son contenu ?`)) {
      return
    }

    setBusyGroupId(group.id)
    setError(null)
    try {
      await apiJson(`/admin/groups/${group.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.')
    } finally {
      setBusyGroupId(null)
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!groups) return <p className="text-sm text-[var(--color-text-muted)]">Chargement...</p>

  return (
    <ul className="flex flex-col gap-2">
      {groups.map((group) => (
        <li
          key={group.id}
          className="flex items-center justify-between gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{group.name}</p>
            <p className="truncate text-sm text-[var(--color-text-muted)]">
              {group.memberCount} membre{group.memberCount > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => remove(group)}
            disabled={busyGroupId === group.id}
            className="flex-none rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-60"
          >
            Supprimer
          </button>
        </li>
      ))}
    </ul>
  )
}

function ListingsSection() {
  const [listings, setListings] = useState<AdminListingResponse[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyListingId, setBusyListingId] = useState<number | null>(null)

  async function load() {
    try {
      setListings(await apiJson<AdminListingResponse[]>('/admin/listings'))
    } catch {
      setError('Impossible de charger les annonces.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function remove(listing: AdminListingResponse) {
    if (!window.confirm(`Supprimer définitivement l'annonce « ${listing.title} » ?`)) {
      return
    }

    setBusyListingId(listing.id)
    setError(null)
    try {
      await apiJson(`/admin/listings/${listing.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.')
    } finally {
      setBusyListingId(null)
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!listings) return <p className="text-sm text-[var(--color-text-muted)]">Chargement...</p>

  return (
    <ul className="flex flex-col gap-2">
      {listings.map((listing) => (
        <li
          key={listing.id}
          className="flex items-center justify-between gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{listing.title}</p>
            <p className="truncate text-sm text-[var(--color-text-muted)]">
              {listing.groupName} · {listing.authorDisplayName} · {listing.status}
            </p>
          </div>
          <button
            onClick={() => remove(listing)}
            disabled={busyListingId === listing.id}
            className="flex-none rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-60"
          >
            Supprimer
          </button>
        </li>
      ))}
    </ul>
  )
}

function CategoriesSection() {
  const [categories, setCategories] = useState<CategoryResponse[] | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  async function load() {
    try {
      setCategories(await apiJson<CategoryResponse[]>('/categories'))
    } catch {
      setError('Impossible de charger les catégories.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return

    setIsBusy(true)
    setError(null)
    try {
      await apiJson('/admin/categories', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
      setName('')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Création impossible.')
    } finally {
      setIsBusy(false)
    }
  }

  async function remove(category: CategoryResponse) {
    if (!window.confirm(`Supprimer la catégorie « ${category.name} » ?`)) {
      return
    }

    setError(null)
    try {
      await apiJson(`/admin/categories/${category.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!categories ? (
        <p className="text-sm text-[var(--color-text-muted)]">Chargement...</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
            >
              <span>{category.name}</span>
              <button onClick={() => remove(category)} className="text-sm text-red-600">
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          placeholder="Nouvelle catégorie"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
        <button
          type="submit"
          disabled={isBusy}
          className="rounded bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Ajouter
        </button>
      </form>
    </div>
  )
}

function AuditLogSection() {
  const [entries, setEntries] = useState<AuditLogEntryResponse[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiJson<AuditLogEntryResponse[]>('/admin/audit-log')
      .then(setEntries)
      .catch(() => setError('Impossible de charger le journal.'))
  }, [])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!entries) return <p className="text-sm text-[var(--color-text-muted)]">Chargement...</p>
  if (entries.length === 0) return <p className="text-sm text-[var(--color-text-muted)]">Aucune action pour le moment.</p>

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
          <span className="font-medium">{entry.adminDisplayName}</span> — {entry.action}
          {entry.details && <span className="text-[var(--color-text-muted)]"> ({entry.details})</span>}
          <span className="block text-xs text-[var(--color-text-muted)]">
            {new Date(entry.createdAt).toLocaleString('fr-FR')}
          </span>
        </li>
      ))}
    </ul>
  )
}
