import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson, type FavoriteListingResponse, type ListingStatus } from '../lib/apiClient'

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

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteListingResponse[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiJson<FavoriteListingResponse[]>('/favorites')
      .then(setFavorites)
      .catch(() => setError('Impossible de charger vos favoris.'))
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8">
      <Link to="/" className="text-sm text-[var(--color-text-muted)]">
        ← Mes groupes
      </Link>

      <h1 className="text-2xl font-semibold">Mes favoris</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {favorites && favorites.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">
          Aucune annonce en favori pour le moment. Ouvrez une annonce et appuyez sur le cœur pour
          la retrouver ici.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3">
        {favorites?.map((favorite) => (
          <li key={favorite.listingId}>
            <Link
              to={`/groups/${favorite.groupId}/listings/${favorite.listingId}`}
              className="flex flex-col overflow-hidden rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <div className="aspect-square bg-[var(--color-bg)]">
                {favorite.thumbnailUrl && (
                  <img
                    src={favorite.thumbnailUrl}
                    alt={favorite.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex flex-col gap-0.5 p-2">
                <span className="truncate text-sm font-medium">{favorite.title}</span>
                <span className="truncate text-xs text-[var(--color-text-muted)]">{favorite.groupName}</span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {favorite.price !== null ? `${favorite.price} €` : MODE_LABELS[favorite.mode]}
                </span>
                {favorite.status !== 'Available' && (
                  <span className="text-xs font-medium text-[var(--color-accent)]">
                    {STATUS_LABELS[favorite.status]}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
