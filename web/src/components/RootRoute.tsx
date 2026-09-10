import { useAuth } from '../auth/AuthContext'
import { HomePage } from '../pages/HomePage'
import { WelcomePage } from '../pages/WelcomePage'

/**
 * Racine du site : le tableau de bord (HomePage) une fois connecté, une vitrine
 * publique (WelcomePage) sinon — pas de redirect vers /login comme le ferait
 * ProtectedRoute, pour qu'un visiteur non connecté comprenne de quoi il s'agit avant
 * de devoir s'authentifier.
 */
export function RootRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <p className="p-4 text-center text-[var(--color-text-muted)]">Chargement...</p>
  }

  return user ? <HomePage /> : <WelcomePage />
}
