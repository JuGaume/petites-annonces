import { useEffect, useState } from 'react'

type HealthStatus = 'checking' | 'ok' | 'error'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5083'

function App() {
  const [apiStatus, setApiStatus] = useState<HealthStatus>('checking')

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then((res) => setApiStatus(res.ok ? 'ok' : 'error'))
      .catch(() => setApiStatus('error'))
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Petites annonces</h1>
      <p className="text-[var(--color-text-muted)]">
        Squelette du projet — Phase 0.
      </p>
      <p className="text-sm">
        API :{' '}
        <span
          className={
            apiStatus === 'ok'
              ? 'font-medium text-green-600'
              : apiStatus === 'error'
                ? 'font-medium text-red-600'
                : 'text-[var(--color-text-muted)]'
          }
        >
          {apiStatus === 'checking' && 'vérification...'}
          {apiStatus === 'ok' && 'connectée'}
          {apiStatus === 'error' && 'injoignable'}
        </span>
      </p>
    </main>
  )
}

export default App
