import { Image } from '@phosphor-icons/react'

/**
 * Icône « pas de photo » affichée à la place d'une image manquante (annonce, groupe...).
 * Reprend le picto de la maquette Feed.dc.html (2026-09-10) : cadre gris clair + icône
 * photo en trait gris, plutôt qu'un carré vide — pour que l'absence d'image reste
 * identifiable au premier coup d'œil, y compris dans une grille dense.
 */
export function ImagePlaceholder({ className = '' }: { className?: string }) {
  return (
    <div className={`flex h-full w-full items-center justify-center bg-[var(--color-placeholder-bg)] ${className}`}>
      <Image weight="bold" color="var(--color-placeholder-icon)" style={{ width: '34%', height: '34%' }} />
    </div>
  )
}
