import { useAuth } from '../auth/AuthContext'

export function HomePage() {
  const { user, logout } = useAuth()

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Petites annonces</h1>
      <p>Bienvenue, {user?.displayName} 👋</p>
      <p className="text-sm text-[var(--color-text-muted)]">
        Les groupes et les annonces arrivent dans les prochaines phases.
      </p>
      <button
        onClick={() => logout()}
        className="rounded border border-[var(--color-border)] px-3 py-2 text-sm"
      >
        Se déconnecter
      </button>
    </main>
  )
}
