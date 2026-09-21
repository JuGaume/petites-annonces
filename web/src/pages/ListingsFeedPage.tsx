import { Bell, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import {
  apiJson,
  ApiError,
  type CategoryResponse,
  type ListingSortBy,
  type ListingStatus,
  type ListingSummaryResponse,
  type PagedResult,
  type SavedSearchResponse,
} from '../lib/apiClient'
import { ListingCard, STATUS_LABELS } from '../components/ListingCard'

const SORT_LABELS: Record<ListingSortBy, string> = {
  newest: 'Plus récentes',
  priceAsc: 'Prix croissant',
  priceDesc: 'Prix décroissant',
}

// Attend une pause dans la frappe avant de relancer la recherche, pour ne pas
// déclencher une requête à chaque caractère tapé.
const SEARCH_DEBOUNCE_MS = 400

const PAGE_SIZE = 20

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'flex-none whitespace-nowrap rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-3 py-1.5 text-[13px] font-medium text-white'
          : 'flex-none whitespace-nowrap rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] font-medium text-[#374151]'
      }
    >
      {children}
    </button>
  )
}

export function ListingsFeedPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const authorId = searchParams.get('author')
  const authorName = (location.state as { authorName?: string } | null)?.authorName ?? null

  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<ListingSortBy>('newest')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const [items, setItems] = useState<ListingSummaryResponse[]>([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [savedSearches, setSavedSearches] = useState<SavedSearchResponse[] | null>(null)
  const [showAlerts, setShowAlerts] = useState(false)
  const [alertLabel, setAlertLabel] = useState('')
  const [isSavingAlert, setIsSavingAlert] = useState(false)
  const [alertError, setAlertError] = useState<string | null>(null)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const hasMore = items.length < totalCount

  useEffect(() => {
    apiJson<CategoryResponse[]>('/categories').then(setCategories).catch(() => undefined)
  }, [])

  function loadSavedSearches() {
    if (!groupId) return
    apiJson<SavedSearchResponse[]>(`/groups/${groupId}/saved-searches`)
      .then(setSavedSearches)
      .catch(() => setSavedSearches([]))
  }

  useEffect(loadSavedSearches, [groupId])

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

  const loadPage = useCallback(
    async (pageToLoad: number, replace: boolean) => {
      if (!groupId) {
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ page: String(pageToLoad), pageSize: String(PAGE_SIZE), sortBy })
        if (categoryId) params.set('categoryId', categoryId)
        if (status) params.set('status', status)
        if (search) params.set('search', search)
        if (authorId) params.set('authorUserId', authorId)
        if (minPrice) params.set('minPrice', minPrice)
        if (maxPrice) params.set('maxPrice', maxPrice)

        const result = await apiJson<PagedResult<ListingSummaryResponse>>(
          `/groups/${groupId}/listings?${params.toString()}`,
        )
        setItems((current) => (replace ? result.items : [...current, ...result.items]))
        setTotalCount(result.totalCount)
        setPage(pageToLoad)
      } catch {
        setError('Impossible de charger les annonces.')
      } finally {
        setIsLoading(false)
      }
    },
    [groupId, categoryId, status, search, sortBy, minPrice, maxPrice, authorId],
  )

  // Filtres changés : on repart de la première page.
  useEffect(() => {
    setItems([])
    loadPage(1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, categoryId, status, search, sortBy, minPrice, maxPrice, authorId])

  async function saveCurrentSearch() {
    if (!groupId || !alertLabel.trim()) return

    setIsSavingAlert(true)
    setAlertError(null)
    try {
      await apiJson(`/groups/${groupId}/saved-searches`, {
        method: 'POST',
        body: JSON.stringify({
          label: alertLabel.trim(),
          categoryId: categoryId ? Number(categoryId) : null,
          search: search || null,
          minPrice: minPrice ? Number(minPrice) : null,
          maxPrice: maxPrice ? Number(maxPrice) : null,
        }),
      })
      setAlertLabel('')
      loadSavedSearches()
    } catch (err) {
      setAlertError(err instanceof ApiError ? err.message : 'Impossible d\'enregistrer cette alerte.')
    } finally {
      setIsSavingAlert(false)
    }
  }

  async function deleteSavedSearch(id: number) {
    if (!groupId) return
    setSavedSearches((current) => current?.filter((s) => s.id !== id) ?? null)
    try {
      await apiJson(`/groups/${groupId}/saved-searches/${id}`, { method: 'DELETE' })
    } catch {
      loadSavedSearches()
    }
  }

  async function toggleFavorite(listing: ListingSummaryResponse) {
    const nextIsFavorite = !listing.isFavorite
    // Optimiste : on met à jour l'affichage avant la réponse du serveur, pour un
    // retour immédiat au tap sur le cœur.
    setItems((current) => current.map((i) => (i.id === listing.id ? { ...i, isFavorite: nextIsFavorite } : i)))
    try {
      await apiJson(`/groups/${groupId}/listings/${listing.id}/favorite`, {
        method: nextIsFavorite ? 'PUT' : 'DELETE',
      })
    } catch {
      // Échec : on revient à l'état précédent.
      setItems((current) => current.map((i) => (i.id === listing.id ? { ...i, isFavorite: listing.isFavorite } : i)))
    }
  }

  // Scroll infini : on charge la page suivante quand la sentinelle devient visible.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadPage(page + 1, false)
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoading, page, loadPage])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-[var(--color-bg)] px-4 py-6 text-[var(--color-text)] lg:max-w-6xl lg:px-8 lg:py-10">
      <Link to={`/groups/${groupId}`} className="text-sm text-[var(--color-text-muted)]">
        ← Retour au groupe
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
          {authorId ? `Annonces de ${authorName ?? 'ce membre'}` : 'Annonces'}
        </h1>
        <Link
          to={`/groups/${groupId}/listings/new`}
          className="flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-gold)] px-3.5 py-2 text-sm font-bold text-[var(--color-accent)]"
        >
          <Plus size={15} weight="bold" />
          Déposer
        </Link>
      </div>

      {authorId && (
        <Link to={`/groups/${groupId}/listings`} className="-mt-2 self-start text-sm text-[var(--color-text)]">
          ← Voir toutes les annonces du groupe
        </Link>
      )}

      <div className="relative lg:max-w-sm">
        <MagnifyingGlass
          size={16}
          weight="bold"
          color="var(--color-text-faint)"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
        />
        <input
          type="search"
          placeholder="Rechercher une annonce..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-9 pr-3.5 text-sm placeholder:text-[var(--color-text-faint)]"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
        <Chip active={categoryId === ''} onClick={() => setCategoryId('')}>
          Toutes catégories
        </Chip>
        {categories.map((category) => (
          <Chip key={category.id} active={categoryId === String(category.id)} onClick={() => setCategoryId(String(category.id))}>
            {category.name}
          </Chip>
        ))}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
        <Chip active={status === ''} onClick={() => setStatus('')}>
          Tous statuts
        </Chip>
        {(Object.entries(STATUS_LABELS) as Array<[ListingStatus, string]>).map(([value, label]) => (
          <Chip key={value} active={status === value} onClick={() => setStatus(value)}>
            {label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:gap-3">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as ListingSortBy)}
          className="rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] font-medium"
        >
          {(Object.entries(SORT_LABELS) as [ListingSortBy, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <input
          type="number"
          inputMode="numeric"
          placeholder="Prix min"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          className="w-24 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px]"
        />
        <span className="text-[13px] text-[var(--color-text-muted)]">–</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="Prix max"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className="w-24 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px]"
        />

        <button
          type="button"
          onClick={() => setShowAlerts((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-text)]"
        >
          <Bell size={14} weight="bold" />
          Mes alertes{savedSearches && savedSearches.length > 0 ? ` (${savedSearches.length})` : ''}
        </button>
      </div>

      {showAlerts && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Nom de l'alerte (ex. Meubles < 50€)"
              value={alertLabel}
              onChange={(e) => setAlertLabel(e.target.value)}
              className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={saveCurrentSearch}
              disabled={isSavingAlert || !alertLabel.trim()}
              className="flex-none rounded-[var(--radius-pill)] bg-[var(--color-gold)] px-3.5 py-1.5 text-sm font-bold text-[var(--color-accent)] disabled:opacity-60"
            >
              Enregistrer cette recherche
            </button>
          </div>
          {alertError && <p className="text-sm text-red-600">{alertError}</p>}

          {savedSearches && savedSearches.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {savedSearches.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{s.label}</span>
                  <button
                    type="button"
                    onClick={() => deleteSavedSearch(s.id)}
                    className="flex-none text-[13px] text-red-600"
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!isLoading && items.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">Aucune annonce pour le moment.</p>
      )}

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5">
        {items.map((listing, index) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            groupId={groupId}
            index={index}
            onToggleFavorite={toggleFavorite}
          />
        ))}
      </ul>

      <div ref={sentinelRef} />
      {isLoading && <p className="text-center text-sm text-[var(--color-text-muted)]">Chargement...</p>}
    </main>
  )
}
