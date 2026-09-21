import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson, type FavoriteListingResponse, type ListingStatus } from '../lib/apiClient'
import { ImagePlaceholder } from '../components/ImagePlaceholder'

const STATUS_LABELS: Record<ListingStatus, string> = {
  Available: 'Disponible',
  Reserved: 'Réservé',
  Sold: 'Vendu',
}

const STATUS_BADGE: Record<ListingStatus, { bg: string; text: string }> = {
  Available: { bg: 'var(--status-available-bg)', text: 'var(--status-available-text)' },
  Reserved: { bg: 'var(--status-reserved-bg)', text: 'var(--status-reserved-text)' },
  Sold: { bg: 'var(--status-sold-bg)', text: 'var(--status-sold-text)' },
}

const MODE_LABELS: Record<string, string> = {
  Sale: 'Vente',
  Donation: 'Don',
  Trade: 'Troc',
}

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteListingResponse[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiJson<FavoriteListingResponse[]>('/favorites')
      .then(setFavorites)
      .catch(() => setError('Impossible de charger vos favoris.'))
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-[var(--color-bg)] px-4 py-6 text-[var(--color-text)] lg:max-w-6xl lg:px-8 lg:py-10">
      <Link to="/" className="text-sm text-[var(--color-text-muted)] lg:hidden">
        ← Mes groupes
      </Link>

      <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Mes favoris</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {favorites && favorites.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">
          Aucune annonce en favori pour le moment. Ouvrez une annonce et appuyez sur le cœur pour
          la retrouver ici.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5">
        {favorites?.map((favorite) => (
          <li key={favorite.listingId}>
            <Link
              to={`/groups/${favorite.groupId}/listings/${favorite.listingId}`}
              className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <div className="aspect-square bg-[var(--color-bg)]">
                {favorite.thumbnailUrl ? (
                  <img
                    src={favorite.thumbnailUrl}
                    alt={favorite.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlaceholder />
                )}
              </div>
              <div className="flex flex-col gap-1 p-2.5">
                <span className="truncate text-sm font-semibold">{favorite.title}</span>
                <span className="truncate text-xs text-[var(--color-text-muted)]">{favorite.groupName}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold">
                    {favorite.price !== null ? `${favorite.price} €` : MODE_LABELS[favorite.mode]}
                  </span>
                  {favorite.status !== 'Available' && (
                    <span
                      className="rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-bold"
                      style={{
                        background: STATUS_BADGE[favorite.status].bg,
                        color: STATUS_BADGE[favorite.status].text,
                      }}
                    >
                      {STATUS_LABELS[favorite.status]}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
