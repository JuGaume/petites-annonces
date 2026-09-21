import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ThemeToggle } from './ThemeToggle'

/**
 * Barre de navigation persistante pour le desktop (>= lg). Le mobile garde son propre
 * pattern par page (lien « ← Retour » + icônes dans l'en-tête de chaque écran) : sur
 * grand écran, cette barre remplace ces éléments (masqués via lg:hidden côté pages)
 * pour éviter les doublons et donner une vraie ossature d'appli desktop — l'app était
 * jusqu'ici une simple colonne mobile centrée avec de grandes marges vides de part et
 * d'autre en dehors de ~440px.
 */

function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]"
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.53}
        height={size * 0.53}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <circle cx="7" cy="7" r="1.5" />
      </svg>
    </div>
  )
}

function NavLink({ to, label, exact }: { to: string; label: string; exact?: boolean }) {
  const { pathname } = useLocation()
  const isActive = exact ? pathname === to : pathname.startsWith(to)

  return (
    <Link
      to={to}
      className={
        isActive
          ? 'rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-3.5 py-1.5 text-sm font-semibold text-white'
          : 'rounded-[var(--radius-pill)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]'
      }
    >
      {label}
    </Link>
  )
}

export function AppHeader() {
  const { user, logout } = useAuth()

  if (!user) {
    return null
  }

  return (
    <header className="sticky top-0 z-10 hidden border-b border-[var(--color-border)] bg-[var(--color-surface)] lg:block">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-8 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-base font-bold tracking-tight">Petites annonces</span>
        </Link>

        <nav className="flex flex-1 items-center gap-1">
          <NavLink to="/" label="Mes groupes" exact />
          <NavLink to="/favorites" label="Favoris" />
          <NavLink to="/conversations" label="Messages" />
          {user.roles.includes('Admin') && <NavLink to="/admin" label="Administration" />}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle className="hover:bg-[var(--color-bg)]" />
          <Link to="/account" className="flex items-center gap-2 rounded-[var(--radius-pill)] py-1 pl-1 pr-3 hover:bg-[var(--color-bg)]">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-white">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-sm font-medium">{user.displayName}</span>
          </Link>
          <button
            onClick={() => logout()}
            className="text-sm text-[var(--color-text-muted)] underline decoration-dotted hover:text-[var(--color-text)]"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </header>
  )
}
