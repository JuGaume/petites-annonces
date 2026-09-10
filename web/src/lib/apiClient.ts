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
  emailDigestEnabled: boolean
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

export interface CategoryResponse {
  id: number
  name: string
}

export type ListingMode = 'Sale' | 'Donation' | 'Trade'
export type ListingStatus = 'Available' | 'Reserved' | 'Sold'
export type ContactMode = 'InternalMessaging' | 'DirectContact'

export interface ListingImageResponse {
  id: number
  url: string
  thumbnailUrl: string
}

export interface ListingSummaryResponse {
  id: number
  title: string
  price: number | null
  mode: ListingMode
  status: ListingStatus
  categoryName: string
  thumbnailUrl: string | null
  createdAt: string
}

export interface ListingDetailResponse {
  id: number
  title: string
  description: string | null
  price: number | null
  mode: ListingMode
  status: ListingStatus
  categoryId: number
  categoryName: string
  authorUserId: string
  authorDisplayName: string
  contactMode: ContactMode
  contactDetails: string | null
  createdAt: string
  images: ListingImageResponse[]
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}

export interface ConversationResponse {
  id: number
  listingId: number
  listingTitle: string
  listingThumbnailUrl: string | null
  buyerUserId: string
  buyerDisplayName: string
  sellerUserId: string
  sellerDisplayName: string
  createdAt: string
  lastMessageContent: string | null
  lastMessageAuthorUserId: string | null
  lastMessageAt: string | null
}

export interface MessageResponse {
  id: number
  conversationId: number
  authorUserId: string
  authorDisplayName: string
  content: string
  createdAt: string
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

/** Utilisé par le client SignalR (ConversationsHub) : le token doit être passé en
 * paramètre de requête pour le handshake WebSocket, qui ne peut pas poser d'en-tête. */
export function getAccessToken(): string | null {
  return accessToken
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
  // Un corps FormData (upload de photos) doit garder son Content-Type multipart
  // avec la boundary générée par le navigateur : ne jamais le forcer en JSON.
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
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
