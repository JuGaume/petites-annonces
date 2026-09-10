import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiJson, setAccessToken, type AuthResponse, type UserResponse } from '../lib/apiClient'

interface AuthContextValue {
  user: UserResponse | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  loginWithGoogle: (idToken: string) => Promise<void>
  logout: () => Promise<void>
  /** Recharge l'utilisateur courant (ex. après modification du profil sur /account). */
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Au chargement, on tente de restaurer la session via le refresh token
  // (cookie httpOnly) sans que l'utilisateur ait à se reconnecter.
  useEffect(() => {
    apiJson<AuthResponse>('/auth/refresh', { method: 'POST' })
      .then((auth) => {
        setAccessToken(auth.accessToken)
        setUser(auth.user)
      })
      .catch(() => {
        setAccessToken(null)
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const applyAuth = useCallback((auth: AuthResponse) => {
    setAccessToken(auth.accessToken)
    setUser(auth.user)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const auth = await apiJson<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      applyAuth(auth)
    },
    [applyAuth],
  )

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const auth = await apiJson<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName }),
      })
      applyAuth(auth)
    },
    [applyAuth],
  )

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      const auth = await apiJson<AuthResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      })
      applyAuth(auth)
    },
    [applyAuth],
  )

  const logout = useCallback(async () => {
    await apiJson('/auth/logout', { method: 'POST' }).catch(() => undefined)
    setAccessToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      setUser(await apiJson<UserResponse>('/auth/me'))
    } catch {
      // Garde l'utilisateur affiché tel quel si le rechargement échoue (coupure
      // réseau passagère) plutôt que de vider la session en cours.
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur de <AuthProvider>.')
  }
  return context
}
