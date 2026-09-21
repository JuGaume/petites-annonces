import { Link } from 'react-router-dom'
import type { ListingStatus, ListingSummaryResponse } from '../lib/apiClient'
import { formatListingAge, isRecentListing } from '../lib/freshness'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll'
import { ImagePlaceholder } from './ImagePlaceholder'

export const STATUS_LABELS: Record<ListingStatus, string> = {
  Available: 'Disponible',
  Reserved: 'Réservé',
  Sold: 'Vendu',
}

const STATUS_BADGE: Record<ListingStatus, { bg: string; text: string }> = {
  Available: { bg: '#dcfce7', text: '#166534' },
  Reserved: { bg: '#fef9c3', text: '#854d0e' },
  Sold: { bg: '#f3f4f6', text: '#6b7280' },
}

const MODE_LABELS: Record<string, string> = {
  Sale: 'Vente',
  Donation: 'Don',
  Trade: 'Troc',
}

// Décalage d'apparition par carte, remis à zéro toutes les 8 cartes (~2 lignes en
// desktop) pour que la grille garde un effet de vague sans jamais faire attendre
// les cartes en fin de liste.
const REVEAL_STAGGER_MS = 40
const REVEAL_STAGGER_CYCLE = 8

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={filled ? '#ef4444' : 'none'}
      stroke={filled ? '#ef4444' : '#ffffff'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

export function ListingCard({
  listing,
  groupId,
  index,
  onToggleFavorite,
}: {
  listing: ListingSummaryResponse
  groupId: string | undefined
  index: number
  onToggleFavorite: (listing: ListingSummaryResponse) => void
}) {
  const { ref, isVisible } = useRevealOnScroll<HTMLLIElement>()
  const revealDelayMs = (index % REVEAL_STAGGER_CYCLE) * REVEAL_STAGGER_MS
  const recent = isRecentListing(listing.createdAt)

  return (
    <li
      ref={ref}
      className={`listing-card-reveal ${isVisible ? 'is-visible' : ''}`}
      style={{ transitionDelay: `${revealDelayMs}ms` }}
    >
      <Link
        to={`/groups/${groupId}/listings/${listing.id}`}
        className="listing-card relative flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      >
        <div className="aspect-square overflow-hidden bg-[var(--color-bg)]">
          {listing.thumbnailUrl ? (
            <img
              src={listing.thumbnailUrl}
              alt={listing.title}
              loading="lazy"
              className="listing-card-image h-full w-full object-cover"
            />
          ) : (
            <ImagePlaceholder className="listing-card-image" />
          )}
        </div>

        {recent && (
          <span className="absolute left-2 top-2 rounded-[var(--radius-pill)] bg-[var(--color-gold)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-accent)]">
            Nouveau
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            onToggleFavorite(listing)
          }}
          aria-label={listing.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40"
        >
          <HeartIcon filled={listing.isFavorite} />
        </button>

        <div className="flex flex-col gap-1 p-2.5">
          <span className="truncate text-sm font-semibold">{listing.title}</span>
          <span className="truncate text-xs text-[var(--color-text-muted)]">{listing.categoryName}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold">
              {listing.price !== null ? `${listing.price} €` : MODE_LABELS[listing.mode]}
            </span>
            {listing.status !== 'Available' && (
              <span
                className="rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-bold"
                style={{
                  background: STATUS_BADGE[listing.status].bg,
                  color: STATUS_BADGE[listing.status].text,
                }}
              >
                {STATUS_LABELS[listing.status]}
              </span>
            )}
          </div>
          {!recent && (
            <span className="text-[11px] text-[var(--color-text-muted)]">{formatListingAge(listing.createdAt)}</span>
          )}
        </div>
      </Link>
    </li>
  )
}
