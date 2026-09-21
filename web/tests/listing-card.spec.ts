import { test, expect } from '@playwright/test'
import { buildListing, hoursAgo, mockListingsFeed } from './support/mockApi'

const GROUP_ID = '1'

test.describe('ListingCard', () => {
  test('affiche titre, catégorie, prix et badge de statut', async ({ page }) => {
    await mockListingsFeed(page, GROUP_ID, [
      buildListing({ id: 1, title: 'Vélo enfant 16 pouces', price: 45, categoryName: 'Enfants' }),
      buildListing({ id: 2, title: 'Perceuse Bosch', price: 60, status: 'Reserved' }),
      buildListing({ id: 3, title: 'Canapé gris', price: null, mode: 'Donation' }),
    ])

    await page.goto(`/groups/${GROUP_ID}/listings`)

    const veloCard = page.getByRole('link', { name: /Vélo enfant 16 pouces/ })
    await expect(veloCard).toBeVisible()
    await expect(veloCard).toContainText('Enfants')
    await expect(veloCard).toContainText('45 €')

    const perceuseCard = page.getByRole('link', { name: /Perceuse Bosch/ })
    await expect(perceuseCard).toContainText('Réservé')

    const canapeCard = page.getByRole('link', { name: /Canapé gris/ })
    await expect(canapeCard).toContainText('Don')
  })

  test('affiche "Nouveau" pour une annonce récente, l\'ancienneté sinon', async ({ page }) => {
    await mockListingsFeed(page, GROUP_ID, [
      buildListing({ id: 1, title: 'Annonce fraîche', createdAt: hoursAgo(3) }),
      buildListing({ id: 2, title: 'Annonce ancienne', createdAt: hoursAgo(24 * 10) }),
    ])

    await page.goto(`/groups/${GROUP_ID}/listings`)

    const fresh = page.getByRole('link', { name: /Annonce fraîche/ })
    await expect(fresh.getByText('Nouveau')).toBeVisible()
    await expect(fresh.getByText(/Il y a/)).toHaveCount(0)

    const old = page.getByRole('link', { name: /Annonce ancienne/ })
    await expect(old.getByText('Nouveau')).toHaveCount(0)
    await expect(old.getByText('Il y a 10 jours')).toBeVisible()
  })

  test('lève la carte au survol (pointeur fin)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'survol pertinent uniquement avec un pointeur fin (desktop)')

    await mockListingsFeed(page, GROUP_ID, [buildListing({ id: 1, title: 'Vélo enfant' })])
    await page.goto(`/groups/${GROUP_ID}/listings`)

    const card = page.getByRole('link', { name: /Vélo enfant/ })
    await expect(card).toHaveCSS('transform', 'none')

    await card.hover()
    await expect(card).not.toHaveCSS('transform', 'none')
  })

  test('désactive le survol sous prefers-reduced-motion', async ({ page, isMobile }) => {
    test.skip(isMobile, 'survol pertinent uniquement avec un pointeur fin (desktop)')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockListingsFeed(page, GROUP_ID, [buildListing({ id: 1, title: 'Vélo enfant' })])
    await page.goto(`/groups/${GROUP_ID}/listings`)

    const card = page.getByRole('link', { name: /Vélo enfant/ })
    await card.hover()
    await expect(card).toHaveCSS('transform', 'none')
  })

  test('fait apparaître les cartes au scroll', async ({ page }) => {
    const listings = Array.from({ length: 16 }, (_, i) => buildListing({ id: i + 1, title: `Annonce ${i + 1}` }))
    await mockListingsFeed(page, GROUP_ID, listings)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/groups/${GROUP_ID}/listings`)

    const lastCardItem = page.locator('li.listing-card-reveal').last()
    await expect(lastCardItem).toHaveCSS('opacity', '0')

    await lastCardItem.scrollIntoViewIfNeeded()
    await expect(lastCardItem).toHaveClass(/is-visible/)
    await expect(lastCardItem).toHaveCSS('opacity', '1')
  })

  test('reste utilisable en grille 2 colonnes sur mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'vérifie spécifiquement la mise en page mobile')

    await mockListingsFeed(page, GROUP_ID, [
      buildListing({ id: 1, title: 'Carte A' }),
      buildListing({ id: 2, title: 'Carte B' }),
    ])
    await page.goto(`/groups/${GROUP_ID}/listings`)

    const cardA = await page.getByRole('link', { name: /Carte A/ }).boundingBox()
    const cardB = await page.getByRole('link', { name: /Carte B/ }).boundingBox()

    expect(cardA).not.toBeNull()
    expect(cardB).not.toBeNull()
    // Deux colonnes : même ligne (y quasi identique), colonnes distinctes (x différent).
    expect(Math.abs(cardA!.y - cardB!.y)).toBeLessThan(5)
    expect(Math.abs(cardA!.x - cardB!.x)).toBeGreaterThan(50)
  })
})
