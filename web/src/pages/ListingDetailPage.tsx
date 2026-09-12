import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  apiJson,
  ApiError,
  type ConversationResponse,
  type GroupResponse,
  type ListingDetailResponse,
  type ListingStatus,
  type ListingSummaryResponse,
  type ReportReason,
} from '../lib/apiClient'
import { ImagePlaceholder } from '../components/ImagePlaceholder'
import { ImageLightbox } from '../components/ImageLightbox'

const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  Spam: 'Spam / publicité',
  Inapproprie: 'Contenu inapproprié',
  Interdit: 'Objet interdit à la vente',
  Autre: 'Autre',
}

const STATUS_LABELS: Record<ListingStatus, string> = {
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

// Mêmes teintes pastel que les avatars de groupe — repli pour l'initiale de l'auteur.
const AVATAR_TINTS = [
  { bg: '#FDE7D3', text: '#C2410C' },
  { bg: '#DBEAFE', text: '#2563EB' },
  { bg: '#FCE7F3', text: '#BE185C' },
  { bg: '#DCFCE7', text: '#15803D' },
  { bg: '#EDE9FE', text: '#6D28D9' },
  { bg: '#CFFAFE', text: '#0E7490' },
]

function avatarTint(id: string) {
  let sum = 0
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i)
  return AVATAR_TINTS[sum % AVATAR_TINTS.length]
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffH = Math.floor(diffMs / 3_600_000)
  if (diffH < 1) return "à l'instant"
  if (diffH < 24) return `il y a ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  return `il y a ${diffD} jour${diffD > 1 ? 's' : ''}`
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={filled ? '#ef4444' : 'none'}
      stroke={filled ? '#ef4444' : 'var(--color-accent)'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
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
  const [activePhoto, setActivePhoto] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [similar, setSimilar] = useState<ListingSummaryResponse[]>([])
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState<ReportReason>('Spam')
  const [reportDetails, setReportDetails] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportSent, setReportSent] = useState(false)
  const carouselRef = useRef<HTMLDivElement | null>(null)

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

    apiJson<ListingSummaryResponse[]>(`/groups/${groupId}/listings/${listingId}/similar`)
      .then(setSimilar)
      .catch(() => setSimilar([]))
  }, [groupId, listingId])

  async function submitReport() {
    setReportBusy(true)
    setReportError(null)
    try {
      await apiJson(`/groups/${groupId}/listings/${listingId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason: reportReason, details: reportDetails.trim() || null }),
      })
      setReportSent(true)
    } catch (err) {
      setReportError(err instanceof ApiError ? err.message : 'Impossible d\'envoyer le signalement.')
    } finally {
      setReportBusy(false)
    }
  }

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

  function handleCarouselScroll() {
    const el = carouselRef.current
    if (!el || el.clientWidth === 0) return
    setActivePhoto(Math.round(el.scrollLeft / el.clientWidth))
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-[var(--color-bg)] px-4 text-center text-[var(--color-text)]">
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

  const tint = avatarTint(listing.authorUserId)

  const photoBlock =
    listing.images.length > 0 ? (
      <div className="relative">
        <div
          ref={carouselRef}
          onScroll={handleCarouselScroll}
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto lg:rounded-2xl"
        >
          {listing.images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setLightboxIndex(index)}
              aria-label="Agrandir la photo"
              className="aspect-square w-full flex-none snap-center"
            >
              <img
                src={image.url}
                alt={listing.title}
                // La première photo est visible immédiatement (au-dessus de la ligne de
                // flottaison) ; les suivantes, dans le carrousel horizontal, ne le sont pas
                // forcément (spec §9, performance).
                loading={index === 0 ? 'eager' : 'lazy'}
                className="h-full w-full rounded-2xl object-cover"
              />
            </button>
          ))}
        </div>
        {listing.images.length > 1 && (
          <div className="pointer-events-none absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5">
            {listing.images.map((image, index) => (
              <div
                key={image.id}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: index === activePhoto ? 'var(--color-accent)' : '#d1d5db' }}
              />
            ))}
          </div>
        )}
      </div>
    ) : (
      <div className="aspect-square w-full overflow-hidden rounded-2xl">
        <ImagePlaceholder />
      </div>
    )

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 bg-[var(--color-bg)] px-4 py-6 text-[var(--color-text)] lg:max-w-5xl lg:px-8 lg:py-10">
      <Link to={`/groups/${groupId}/listings`} className="text-sm text-[var(--color-text-muted)]">
        ← Annonces du groupe
      </Link>

      {/* Desktop : photos à gauche (collées au défilement), infos/contact à droite —
          plutôt que tout empiler dans une colonne de 448px perdue au milieu de l'écran. */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-20">{photoBlock}</div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-bold"
                  style={{ background: STATUS_BADGE[listing.status].bg, color: STATUS_BADGE[listing.status].text }}
                >
                  {STATUS_LABELS[listing.status]}
                </span>
                <span className="text-[13px] text-[var(--color-text-muted)]">{listing.categoryName}</span>
              </div>
              <button
                type="button"
                onClick={toggleFavorite}
                aria-label={listing.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                className="flex-none"
              >
                <HeartIcon filled={listing.isFavorite} />
              </button>
            </div>
            <h1 className="text-xl font-bold lg:text-2xl">{listing.title}</h1>
            <div className="text-[22px] font-bold lg:text-2xl">
              {listing.price !== null ? `${listing.price} €` : MODE_LABELS[listing.mode]}
            </div>
          </div>

          {listing.description && (
            <>
              <div className="h-px bg-[var(--color-border)]" />
              <div className="flex flex-col gap-1.5">
                <div className="text-[13px] font-semibold text-[var(--color-text-muted)]">Description</div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{listing.description}</p>
              </div>
            </>
          )}

          <div className="h-px bg-[var(--color-border)]" />

          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-bold"
              style={{ background: tint.bg, color: tint.text }}
            >
              {listing.authorDisplayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <Link
                to={`/groups/${groupId}/listings?author=${listing.authorUserId}`}
                state={{ authorName: listing.authorDisplayName }}
                className="text-sm font-semibold hover:underline"
              >
                Déposée par {listing.authorDisplayName}
              </Link>
              <div className="text-[13px] text-[var(--color-text-muted)]">{relativeTime(listing.createdAt)}</div>
            </div>
          </div>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
            <h2 className="mb-1 text-sm font-semibold">Contact</h2>
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
                className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-gold)] px-4 py-3 text-[15px] font-bold text-[var(--color-accent)] disabled:opacity-60"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                {isContacting ? 'Ouverture...' : `Contacter ${listing.authorDisplayName}`}
              </button>
            )}
          </section>

          {actionError && <p className="text-sm text-red-600">{actionError}</p>}

          {(isAuthor || canDelete) && (
            <section className="flex flex-col gap-2.5 border-t border-[var(--color-border)] pt-4">
              <h2 className="text-sm font-semibold">Gérer {isAuthor ? 'mon annonce' : 'cette annonce'}</h2>
              {isAuthor && (
                <div className="flex flex-wrap gap-2">
                  {(['Available', 'Reserved', 'Sold'] as const)
                    .filter((status) => status !== listing.status)
                    .map((status) => (
                      <button
                        key={status}
                        onClick={() => updateStatus(status)}
                        disabled={isBusy}
                        className="rounded-[var(--radius-pill)] border border-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] disabled:opacity-60"
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
                  className="self-start rounded-[var(--radius-pill)] border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-60"
                >
                  Supprimer l'annonce
                </button>
              )}
            </section>
          )}

          {!isAuthor && (
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="self-start text-sm text-[var(--color-text-muted)] underline underline-offset-2"
            >
              Signaler cette annonce
            </button>
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mx-auto flex w-full max-w-md flex-col gap-3 lg:max-w-5xl">
          <h2 className="text-lg font-bold tracking-tight">Annonces similaires</h2>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {similar.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/groups/${groupId}/listings/${item.id}`}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
                >
                  <div className="aspect-square bg-[var(--color-bg)]">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlaceholder />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 p-2.5">
                    <span className="truncate text-sm font-semibold">{item.title}</span>
                    <span className="text-sm font-bold">
                      {item.price !== null ? `${item.price} €` : MODE_LABELS[item.mode]}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={listing.images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      {showReportModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !reportBusy && setShowReportModal(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 lg:items-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-[var(--color-surface)] p-5 lg:rounded-2xl"
          >
            {reportSent ? (
              <>
                <h2 className="text-lg font-bold">Signalement envoyé</h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Merci, l'équipe de modération va l'examiner.
                </p>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="self-end rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
                >
                  Fermer
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold">Signaler cette annonce</h2>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Motif</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value as ReportReason)}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                  >
                    {(Object.entries(REPORT_REASON_LABELS) as [ReportReason, string][]).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Détails (facultatif)</label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="resize-none rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                  />
                </div>
                {reportError && <p className="text-sm text-red-600">{reportError}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowReportModal(false)}
                    disabled={reportBusy}
                    className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium disabled:opacity-60"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={submitReport}
                    disabled={reportBusy}
                    className="rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {reportBusy ? 'Envoi...' : 'Envoyer le signalement'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
