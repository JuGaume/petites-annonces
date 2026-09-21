const RECENT_THRESHOLD_MS = 48 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function isRecentListing(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < RECENT_THRESHOLD_MS
}

// N'est appelée que pour les annonces déjà écartées par isRecentListing, donc
// toujours à 2 jours ou plus : pas besoin de gérer "aujourd'hui" / "hier".
export function formatListingAge(createdAt: string): string {
  const diffDays = Math.floor((Date.now() - new Date(createdAt).getTime()) / DAY_MS)

  if (diffDays < 30) return `Il y a ${diffDays} jours`

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `Il y a ${diffMonths} mois`

  const diffYears = Math.floor(diffMonths / 12)
  return `Il y a ${diffYears} an${diffYears > 1 ? 's' : ''}`
}
