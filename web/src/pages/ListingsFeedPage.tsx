import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  apiJson,
  type CategoryResponse,
  type ListingStatus,
  type ListingSummaryResponse,
  type PagedResult,
} from '../lib/apiClient'

// Attend une pause dans la frappe avant de relancer la recherche, pour ne pas
// déclencher une requête à chaque caractère tapé.
const SEARCH_DEBOUNCE_MS = 400

const PAGE_SIZE = 20

const STATUS_LABELS: Record<ListingStatus, string> = {
  Available: 'Disponible',
  Reserved: 'Réservé',
  Sold: 'Vendu',
}

const MODE_LABELS: Record<string, string> = {
  Sale: 'Vente',
  Donation: 'Don',
  Trade: 'Troc',
}

export function ListingsFeedPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [items, setItems] = useState<ListingSummaryResponse[]>([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const hasMore = items.length < totalCount

  useEffect(() => {
    apiJson<CategoryResponse[]>('/categories').then(setCategories).catch(() => undefined)
  }, [])

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
        const params = new URLSearchParams({ page: String(pageToLoad), pageSize: String(PAGE_SIZE) })
        if (categoryId) params.set('categoryId', categoryId)
        if (status) params.set('status', status)
        if (search) params.set('search', search)

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
    [groupId, categoryId, status, search],
  )

  // Filtres changés : on repart de la première page.
  useEffect(() => {
    setItems([])
    loadPage(1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, categoryId, status, search])

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8 md:max-w-5xl md:px-8">
      <Link to={`/groups/${groupId}`} className="text-sm text-[var(--color-text-muted)]">
        ← Retour au groupe
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Annonces</h1>
        <Link
          to={`/groups/${groupId}/listings/new`}
          className="rounded bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white"
        >
          + Déposer
        </Link>
      </div>

      {/* Barre de filtres alignée en ligne à partir de sm : sur mobile, la recherche
          reste seule au-dessus des deux menus pour ne pas trop la rétrécir. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          placeholder="Rechercher une annonce..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm sm:flex-1"
        />
        <div className="flex gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm sm:flex-none"
          >
            <option value="">Toutes catégories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm sm:flex-none"
          >
            <option value="">Tous statuts</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!isLoading && items.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">Aucune annonce pour le moment.</p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((listing) => (
          <li key={listing.id}>
            <Link
              to={`/groups/${groupId}/listings/${listing.id}`}
              className="relative flex flex-col overflow-hidden rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <div className="aspect-square bg-[var(--color-bg)]">
                {listing.thumbnailUrl && (
                  <img
                    src={listing.thumbnailUrl}
                    alt={listing.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  toggleFavorite(listing)
                }}
                aria-label={listing.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-base leading-none text-white"
              >
                {listing.isFavorite ? '♥' : '♡'}
              </button>
              <div className="flex flex-col gap-0.5 p-2">
                <span className="truncate text-sm font-medium">{listing.title}</span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {listing.price !== null ? `${listing.price} €` : MODE_LABELS[listing.mode]}
                </span>
                {listing.status !== 'Available' && (
                  <span className="text-xs font-medium text-[var(--color-accent)]">
                    {STATUS_LABELS[listing.status]}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div ref={sentinelRef} />
      {isLoading && <p className="text-center text-sm text-[var(--color-text-muted)]">Chargement...</p>}
    </main>
  )
}
