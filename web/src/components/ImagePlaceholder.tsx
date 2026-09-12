/**
 * Icône « pas de photo » affichée à la place d'une image manquante (annonce, groupe...).
 * Reprend le picto de la maquette Feed.dc.html (2026-09-10) : cadre gris clair + icône
 * photo en trait gris, plutôt qu'un carré vide — pour que l'absence d'image reste
 * identifiable au premier coup d'œil, y compris dans une grille dense.
 */
export function ImagePlaceholder({ className = '' }: { className?: string }) {
  return (
    <div className={`flex h-full w-full items-center justify-center bg-[#f3f4f6] ${className}`}>
      <svg
        width="34%"
        height="34%"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#d1d5db"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    </div>
  )
}
