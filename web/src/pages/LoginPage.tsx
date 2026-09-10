import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/apiClient'
import { GoogleSignInButton } from '../components/GoogleSignInButton'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(email, password)
      navigate(redirect)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion impossible.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Connexion</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-[var(--color-accent)] px-3 py-2 font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      <div className="flex items-center justify-center">
        <GoogleSignInButton />
      </div>

      <p className="text-center text-sm text-[var(--color-text-muted)]">
        Pas encore de compte ?{' '}
        <Link
          to={`/register?redirect=${encodeURIComponent(redirect)}`}
          className="font-medium text-[var(--color-accent)]"
        >
          Inscription
        </Link>
      </p>
    </main>
  )
}
