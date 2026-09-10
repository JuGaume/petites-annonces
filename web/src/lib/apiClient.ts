export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5083'

export interface UserResponse {
  id: string
  email: string
  displayName: string
  roles: string[]
}

export interface AuthResponse {
  accessToken: string
  user: UserResponse
}

export interface GroupResponse {
  id: number
  name: string
  description: string | null
  createdByUserId: string
  createdAt: string
  memberCount: number
  currentUserRole: 'Admin' | 'Member'
}

export interface GroupMemberResponse {
  userId: string
  displayName: string
  email: string
  role: 'Admin' | 'Member'
  joinedAt: string
}

export interface InvitationResponse {
  id: number
  groupId: number
  token: string
  type: 'Link' | 'Email'
  targetEmail: string | null
  expiresAt: string | null
  isActive: boolean
}

export interface InvitationPreviewResponse {
  groupName: string
  type: 'Link' | 'Email'
  isValid: boolean
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

/**
 * Effectue une requête vers l'API en attachant le token d'accès courant et en
 * incluant le cookie de refresh token (httpOnly, géré par le navigateur). Sur un
 * 401 (hors endpoints d'auth eux-mêmes), tente une seule fois un rafraîchissement
 * du token avant de rejouer la requête.
 */
export async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers)
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (response.status === 401 && retry && path !== '/auth/refresh' && path !== '/auth/login') {
    const refreshed = await tryRefresh()
    if (refreshed) {
      return apiFetch(path, init, false)
    }
  }

  return response
}

async function tryRefresh(): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    setAccessToken(null)
    return false
  }
  const data: AuthResponse = await response.json()
  setAccessToken(data.accessToken)
  return true
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init)
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }))
    throw new ApiError(response.status, body.message ?? 'Une erreur est survenue.')
  }
  return response.json() as Promise<T>
}
