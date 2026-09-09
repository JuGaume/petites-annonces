import { useEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

/**
 * Bouton "Se connecter avec Google". Ne s'affiche que si VITE_GOOGLE_CLIENT_ID est
 * configuré — voir README pour la procédure de création du Client ID OAuth côté
 * Google Cloud Console.
 */
export function GoogleSignInButton() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { loginWithGoogle } = useAuth()

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !containerRef.current) {
      return
    }

    const scriptId = 'google-identity-services'
    const renderButton = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          loginWithGoogle(response.credential).catch(() => {
            // L'échec est déjà géré au niveau du formulaire appelant via l'état d'erreur global si besoin.
          })
        },
      })
      if (containerRef.current) {
        window.google?.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          width: 300,
        })
      }
    }

    if (window.google) {
      renderButton()
      return
    }

    if (document.getElementById(scriptId)) {
      document.getElementById(scriptId)!.addEventListener('load', renderButton)
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = renderButton
    document.body.appendChild(script)
  }, [loginWithGoogle])

  if (!GOOGLE_CLIENT_ID) {
    return null
  }

  return <div ref={containerRef} />
}
