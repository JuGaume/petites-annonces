import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  apiJson,
  ApiError,
  type AdminGroupResponse,
  type AdminListingResponse,
  type AdminReportResponse,
  type AdminStatsResponse,
  type AdminUserResponse,
  type AuditLogEntryResponse,
  type CategoryResponse,
  type ReportReason,
} from '../lib/apiClient'

type Tab = 'overview' | 'users' | 'groups' | 'listings' | 'reports' | 'categories' | 'audit'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'groups', label: 'Groupes' },
  { id: 'listings', label: 'Annonces' },
  { id: 'reports', label: 'Signalements' },
  { id: 'categories', label: 'Catégories' },
  { id: 'audit', label: 'Journal' },
]

const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  Spam: 'Spam / publicité',
  Inapproprie: 'Contenu inapproprié',
  Interdit: 'Objet interdit',
  Autre: 'Autre',
}

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-[var(--color-bg)] px-4 py-6 text-[var(--color-text)] lg:max-w-5xl lg:px-8 lg:py-10">
      <Link to="/" className="text-sm text-[var(--color-text-muted)] lg:hidden">
        ← Mes groupes
      </Link>

      <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Administration</h1>

      {/* Desktop : tabs en colonne fixe à gauche (comme une vraie console d'admin) plutôt
          qu'une rangée de puces qui défile horizontalement. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <nav className="flex flex-wrap gap-2 overflow-x-auto pb-1 lg:w-52 lg:flex-none lg:flex-col lg:flex-nowrap lg:overflow-visible lg:pb-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? 'flex-none rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-3.5 py-1.5 text-sm font-semibold text-white lg:text-left'
                  : 'flex-none rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-text-muted)] lg:border-none lg:bg-transparent lg:text-left'
              }
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {tab === 'overview' && <OverviewSection />}
          {tab === 'users' && <UsersSection />}
          {tab === 'groups' && <GroupsSection />}
          {tab === 'listings' && <ListingsSection />}
          {tab === 'reports' && <ReportsSection />}
          {tab === 'categories' && <CategoriesSection />}
          {tab === 'audit' && <AuditLogSection />}
        </div>
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
      <span className="text-3xl font-bold tracking-tight">{value.toLocaleString('fr-FR')}</span>
    </div>
  )
}

function OverviewSection() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiJson<AdminStatsResponse>('/admin/stats')
      .then(setStats)
      .catch(() => setError('Impossible de charger les statistiques.'))
  }, [])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!stats) return <p className="text-sm text-[var(--color-text-muted)]">Chargement...</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Utilisateurs" value={stats.totalUsers} />
        <StatCard label="Groupes" value={stats.totalGroups} />
        <StatCard label="Annonces" value={stats.totalListings} />
        <StatCard label="Messages" value={stats.totalMessages} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Annonces disponibles" value={stats.availableListings} />
        <StatCard label="Conversations" value={stats.totalConversations} />
        <StatCard label="Utilisateurs désactivés" value={stats.disabledUsers} />
        <StatCard label="Signalements en attente" value={stats.pendingReports} />
      </div>
    </div>
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
    <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-2.5">
      {users.map((user) => (
        <li
          key={user.id}
          className="flex items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5"
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
            className="flex-none rounded-[var(--radius-pill)] border-[1.5px] border-[var(--color-accent)] px-3.5 py-1.5 text-sm font-semibold text-[var(--color-accent)] disabled:opacity-60"
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
    <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-2.5">
      {groups.map((group) => (
        <li
          key={group.id}
          className="flex items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5"
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
            className="flex-none rounded-[var(--radius-pill)] border border-red-300 px-3.5 py-1.5 text-sm text-red-600 disabled:opacity-60"
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
    <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-2.5">
      {listings.map((listing) => (
        <li
          key={listing.id}
          className="flex items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5"
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
            className="flex-none rounded-[var(--radius-pill)] border border-red-300 px-3.5 py-1.5 text-sm text-red-600 disabled:opacity-60"
          >
            Supprimer
          </button>
        </li>
      ))}
    </ul>
  )
}

function ReportsSection() {
  const [reports, setReports] = useState<AdminReportResponse[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyReportId, setBusyReportId] = useState<number | null>(null)

  async function load() {
    try {
      setReports(await apiJson<AdminReportResponse[]>('/admin/reports'))
    } catch {
      setError('Impossible de charger les signalements.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function act(report: AdminReportResponse, action: 'resolve' | 'dismiss') {
    setBusyReportId(report.id)
    setError(null)
    try {
      await apiJson(`/admin/reports/${report.id}/${action}`, { method: 'POST' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.')
    } finally {
      setBusyReportId(null)
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!reports) return <p className="text-sm text-[var(--color-text-muted)]">Chargement...</p>
  if (reports.length === 0) return <p className="text-sm text-[var(--color-text-muted)]">Aucun signalement pour le moment.</p>

  return (
    <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-2.5">
      {reports.map((report) => (
        <li key={report.id} className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{report.listingTitle}</p>
              <p className="truncate text-sm text-[var(--color-text-muted)]">
                {report.groupName} · signalé par {report.reporterDisplayName} · {REPORT_REASON_LABELS[report.reason]}
              </p>
              {report.details && <p className="mt-1 text-sm">{report.details}</p>}
            </div>
            <span
              className={`flex-none rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-bold ${
                report.status === 'Pending'
                  ? 'bg-[#fef9c3] text-[#854d0e]'
                  : report.status === 'Reviewed'
                    ? 'bg-[#dcfce7] text-[#166534]'
                    : 'bg-[#f3f4f6] text-[#6b7280]'
              }`}
            >
              {report.status === 'Pending' ? 'En attente' : report.status === 'Reviewed' ? 'Traité' : 'Rejeté'}
            </span>
          </div>
          {report.status === 'Pending' && (
            <div className="flex gap-2">
              <button
                onClick={() => act(report, 'resolve')}
                disabled={busyReportId === report.id}
                className="rounded-[var(--radius-pill)] border-[1.5px] border-[var(--color-accent)] px-3.5 py-1.5 text-sm font-semibold text-[var(--color-accent)] disabled:opacity-60"
              >
                Marquer traité
              </button>
              <button
                onClick={() => act(report, 'dismiss')}
                disabled={busyReportId === report.id}
                className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3.5 py-1.5 text-sm disabled:opacity-60"
              >
                Rejeter
              </button>
            </div>
          )}
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
        <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-2.5">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5"
            >
              <span>{category.name}</span>
              <button onClick={() => remove(category)} className="text-sm font-medium text-red-600">
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
          className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[15px] placeholder:text-[#9ca3af]"
        />
        <button
          type="submit"
          disabled={isBusy}
          className="rounded-[var(--radius-pill)] bg-[var(--color-gold)] px-4 py-2 text-sm font-bold text-[var(--color-accent)] disabled:opacity-60"
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
        <li key={entry.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 text-sm">
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
