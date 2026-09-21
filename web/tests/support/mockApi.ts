import type { Page } from '@playwright/test'
import type {
  AuthResponse,
  CategoryResponse,
  ListingSummaryResponse,
  PagedResult,
  UserResponse,
} from '../../src/lib/apiClient'

// Doit correspondre à VITE_API_BASE_URL (web/.env.development) : apiClient construit
// des URLs absolues vers le backend, pas de proxy Vite à intercepter côté relatif.
const API_BASE_URL = 'http://localhost:5083'

const fakeUser: UserResponse = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Testeur',
  roles: [],
  photoUrl: null,
}

export function buildListing(overrides: Partial<ListingSummaryResponse> = {}): ListingSummaryResponse {
  return {
    id: 1,
    title: 'Vélo enfant 16 pouces',
    price: 45,
    mode: 'Sale',
    status: 'Available',
    categoryName: 'Enfants',
    thumbnailUrl: null,
    createdAt: new Date().toISOString(),
    isFavorite: false,
    authorUserId: 'author-1',
    authorDisplayName: 'Marie',
    ...overrides,
  }
}

export function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 60 * 60 * 1000).toISOString()
}

/**
 * Simule le backend ASP.NET Core pour la page /groups/:groupId/listings : session
 * restaurée via /auth/refresh, catégories, alertes enregistrées et page d'annonces.
 */
export async function mockListingsFeed(
  page: Page,
  groupId: string,
  listings: ListingSummaryResponse[],
  categories: CategoryResponse[] = [],
): Promise<void> {
  await page.route(`${API_BASE_URL}/auth/refresh`, (route) =>
    route.fulfill({ json: { accessToken: 'fake-token', user: fakeUser } satisfies AuthResponse }),
  )

  await page.route(`${API_BASE_URL}/categories`, (route) => route.fulfill({ json: categories }))

  await page.route(`${API_BASE_URL}/groups/${groupId}/saved-searches`, (route) =>
    route.fulfill({ json: [] }),
  )

  await page.route(`${API_BASE_URL}/groups/${groupId}/listings**`, (route) =>
    route.fulfill({
      json: {
        items: listings,
        page: 1,
        pageSize: 20,
        totalCount: listings.length,
      } satisfies PagedResult<ListingSummaryResponse>,
    }),
  )

  await page.route(`${API_BASE_URL}/groups/${groupId}/listings/*/favorite`, (route) =>
    route.fulfill({ status: 204, body: '' }),
  )
}
