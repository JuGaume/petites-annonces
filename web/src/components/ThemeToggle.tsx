import { Moon, Sun } from '@phosphor-icons/react'
import { useTheme } from '../theme/ThemeContext'

/**
 * Bascule clair/sombre manuelle, indépendante de la préférence système — voir
 * ThemeContext.tsx. Icône unique dont le contenu change plutôt que deux icônes
 * superposées : l'état est binaire et rarement regardé de près, pas besoin de plus.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
      title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
      className={`btn-press flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text)] ${className}`}
    >
      {theme === 'dark' ? <Sun size={18} weight="bold" /> : <Moon size={18} weight="bold" />}
    </button>
  )
}
