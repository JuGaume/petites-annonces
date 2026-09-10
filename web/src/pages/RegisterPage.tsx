import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/apiClient'
import { isValidEmail } from '../lib/validation'
import { GoogleSignInButton } from '../components/GoogleSignInButton'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!isValidEmail(email)) {
      setError('Adresse email invalide.')
      return
    }

    setIsSubmitting(true)
    try {
      await register(email, password, displayName)
      navigate(redirect)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Inscription impossible.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Créer un compte</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Nom affiché"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
        <input
          type="password"
          placeholder="Mot de passe (8 caractères minimum)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-[var(--color-accent)] px-3 py-2 font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? 'Création...' : "S'inscrire"}
        </button>
      </form>

      <div className="flex items-center justify-center">
        <GoogleSignInButton />
      </div>

      <p className="text-center text-sm text-[var(--color-text-muted)]">
        Déjà un compte ?{' '}
        <Link
          to={`/login?redirect=${encodeURIComponent(redirect)}`}
          className="font-medium text-[var(--color-accent)]"
        >
          Connexion
        </Link>
      </p>
    </main>
  )
}
