import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AppHeader } from './AppHeader'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <p className="p-4 text-center text-[var(--color-text-muted)]">Chargement...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // AppHeader posée ici une seule fois plutôt que dans chaque page protégée : la nav
  // desktop persistante (voir AppHeader.tsx) couvre ainsi tous les écrans de l'appli
  // sans dupliquer l'import/rendu 8 fois.
  return (
    <>
      <AppHeader />
      {children}
    </>
  )
}
