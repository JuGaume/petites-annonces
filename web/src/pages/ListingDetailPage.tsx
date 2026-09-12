import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  apiJson,
  ApiError,
  type ConversationResponse,
  type GroupResponse,
  type ListingDetailResponse,
  type ListingStatus,
} from '../lib/apiClient'

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

export function ListingDetailPage() {
  const { groupId, listingId } = useParams<{ groupId: string; listingId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [listing, setListing] = useState<ListingDetailResponse | null>(null)
  const [group, setGroup] = useState<GroupResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isContacting, setIsContacting] = useState(false)

  useEffect(() => {
    Promise.all([
      apiJson<ListingDetailResponse>(`/groups/${groupId}/listings/${listingId}`),
      apiJson<GroupResponse>(`/groups/${groupId}`),
    ])
      .then(([listingResponse, groupResponse]) => {
        setListing(listingResponse)
        setGroup(groupResponse)
      })
      .catch(() => setLoadError('Impossible de charger cette annonce.'))
  }, [groupId, listingId])

  const isAuthor = listing?.authorUserId === user?.id
  // Un modérateur disposant du droit délégué peut aussi supprimer l'annonce d'un
  // autre (spec Phase 10), même sans en être l'auteur.
  const canDelete = isAuthor || (group?.currentUserCanDeleteListings ?? false)

  async function toggleFavorite() {
    if (!listing) {
      return
    }

    const nextIsFavorite = !listing.isFavorite
    setListing({ ...listing, isFavorite: nextIsFavorite })
    try {
      await apiJson(`/groups/${groupId}/listings/${listingId}/favorite`, {
        method: nextIsFavorite ? 'PUT' : 'DELETE',
      })
    } catch {
      setListing((current) => (current ? { ...current, isFavorite: !nextIsFavorite } : current))
    }
  }

  async function updateStatus(status: ListingStatus) {
    setIsBusy(true)
    setActionError(null)
    try {
      const updated = await apiJson<ListingDetailResponse>(`/groups/${groupId}/listings/${listingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setListing(updated)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Impossible de mettre à jour le statut.')
    } finally {
      setIsBusy(false)
    }
  }

  async function contactSeller() {
    setIsContacting(true)
    setActionError(null)
    try {
      const conversation = await apiJson<ConversationResponse>(
        `/groups/${groupId}/listings/${listingId}/conversations`,
        { method: 'POST' },
      )
      navigate(`/conversations/${conversation.id}`)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Impossible de contacter le vendeur.')
      setIsContacting(false)
    }
  }

  async function deleteListing() {
    if (!window.confirm('Supprimer définitivement cette annonce ?')) {
      return
    }

    setIsBusy(true)
    setActionError(null)
    try {
      await apiJson(`/groups/${groupId}/listings/${listingId}`, { method: 'DELETE' })
      navigate(`/groups/${groupId}/listings`)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Impossible de supprimer cette annonce.')
      setIsBusy(false)
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-red-600">{loadError}</p>
        <Link to={`/groups/${groupId}/listings`} className="text-sm font-medium text-[var(--color-accent)]">
          Retour aux annonces
        </Link>
      </main>
    )
  }

  if (!listing) {
    return <p className="p-4 text-center text-[var(--color-text-muted)]">Chargement...</p>
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8 lg:max-w-4xl lg:px-8">
      <Link to={`/groups/${groupId}/listings`} className="text-sm text-[var(--color-text-muted)]">
        ← Annonces du groupe
      </Link>

      {/* Deux colonnes à partir de lg : photos à gauche (fixées en haut au défilement),
          informations et actions à droite — plutôt qu'une colonne unique noyée dans le
          vide sur un grand écran (voir feedback desktop). */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
        {listing.images.length > 0 && (
          <div className="flex snap-x gap-2 overflow-x-auto lg:sticky lg:top-8 lg:w-1/2 lg:flex-none lg:flex-col lg:snap-y">
            {listing.images.map((image, index) => (
              <img
                key={image.id}
                src={image.url}
                alt={listing.title}
                // La première photo est visible immédiatement (au-dessus de la ligne de
                // flottaison) ; les suivantes, dans le carrousel horizontal, ne le sont pas
                // forcément (spec §9, performance).
                loading={index === 0 ? "eager" : "lazy"}
                className="aspect-square w-full flex-none snap-center rounded object-cover"
              />
            ))}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-2xl font-semibold">{listing.title}</h1>
              <div className="flex flex-none items-center gap-2">
                {listing.status !== 'Available' && (
                  <span className="whitespace-nowrap rounded bg-[var(--color-bg)] px-2 py-1 text-xs font-medium text-[var(--color-accent)]">
                    {STATUS_LABELS[listing.status]}
                  </span>
                )}
                <button
                  type="button"
                  onClick={toggleFavorite}
                  aria-label={listing.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  className="text-2xl leading-none text-[var(--color-accent)]"
                >
                  {listing.isFavorite ? '♥' : '♡'}
                </button>
              </div>
            </div>
            <p className="text-lg font-medium">
              {listing.price !== null ? `${listing.price} €` : MODE_LABELS[listing.mode]}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {listing.categoryName} · déposée par {listing.authorDisplayName}
            </p>
          </div>

          {listing.description && <p className="whitespace-pre-wrap text-sm">{listing.description}</p>}

          <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <h2 className="mb-1 font-semibold">Contact</h2>
            {listing.contactMode === 'DirectContact' ? (
              <p className="text-sm">{listing.contactDetails}</p>
            ) : isAuthor ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                Les messages des personnes intéressées apparaissent dans{' '}
                <Link to="/conversations" className="font-medium text-[var(--color-accent)]">
                  vos conversations
                </Link>
                .
              </p>
            ) : (
              <button
                onClick={contactSeller}
                disabled={isContacting}
                className="rounded bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {isContacting ? 'Ouverture...' : 'Contacter le vendeur'}
              </button>
            )}
          </section>

          {actionError && <p className="text-sm text-red-600">{actionError}</p>}

          {(isAuthor || canDelete) && (
            <section className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-4">
              <h2 className="font-semibold">Gérer {isAuthor ? 'mon annonce' : 'cette annonce'}</h2>
              {isAuthor && (
                <div className="flex flex-wrap gap-2">
                  {(['Available', 'Reserved', 'Sold'] as const)
                    .filter((status) => status !== listing.status)
                    .map((status) => (
                      <button
                        key={status}
                        onClick={() => updateStatus(status)}
                        disabled={isBusy}
                        className="rounded border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-60"
                      >
                        Marquer {STATUS_LABELS[status].toLowerCase()}
                      </button>
                    ))}
                </div>
              )}
              {canDelete && (
                <button
                  onClick={deleteListing}
                  disabled={isBusy}
                  className="self-start rounded border border-red-300 px-3 py-2 text-sm text-red-600 disabled:opacity-60"
                >
                  Supprimer l'annonce
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
