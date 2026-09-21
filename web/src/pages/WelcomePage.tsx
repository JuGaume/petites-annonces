import { Link } from 'react-router-dom'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll'

/**
 * Vitrine affichée sur "/" tant qu'on n'est pas connecté (voir RootRoute) — pas un
 * redirect immédiat vers /login, pour qu'un visiteur qui tombe sur l'appli comprenne
 * de quoi il s'agit avant de devoir s'authentifier. Distincte de la landing publique
 * statique (landing/, Phase 7) : celle-ci vit dans le SPA, pensée pour l'usage local/
 * app (pas d'enjeu SEO, web/index.html reste en noindex).
 *
 * Reprend la charte crème/marine/or (voir web/src/index.css), mais remplace le mockup
 * SVG du hero par un aperçu des vraies ListingCard et casse la symétrie des sections
 * "Comment ça marche" / "Catégories" pour ne pas retomber dans les gabarits IA
 * (3 cartes identiques, grille parfaite, eyebrows en majuscules partout).
 */

const CATEGORY_TILES = [
  {
    name: 'Meubles',
    bg: '#FDE7D3',
    stroke: '#C2410C',
    icon: (
      <>
        <rect x="3" y="11" width="18" height="7" rx="2" />
        <path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" />
        <path d="M4 18v1M20 18v1" />
      </>
    ),
  },
  {
    name: 'Électronique',
    bg: '#DBEAFE',
    stroke: '#2563EB',
    icon: (
      <>
        <rect x="2" y="8" width="20" height="9" rx="4" />
        <path d="M6 11.5v3M4.5 13h3" />
        <circle cx="15" cy="11.5" r="1" />
        <circle cx="18" cy="13.5" r="1" />
      </>
    ),
  },
  {
    name: 'Vêtements',
    bg: '#FCE7F3',
    stroke: '#BE185C',
    icon: <path d="M9 4l3-1 3 1 3.5 3-2.5 2v12H8V9L5.5 7z" />,
  },
  {
    name: 'Sport & Loisirs',
    bg: '#DCFCE7',
    stroke: '#15803D',
    icon: (
      <>
        <rect x="2" y="9" width="3" height="6" rx="1" />
        <rect x="19" y="9" width="3" height="6" rx="1" />
        <path d="M7 12h10" />
        <rect x="6.5" y="10" width="2.5" height="4" rx="0.5" />
        <rect x="15" y="10" width="2.5" height="4" rx="0.5" />
      </>
    ),
  },
  {
    name: 'Enfants & Bébé',
    bg: '#EDE9FE',
    stroke: '#6D28D9',
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M12 4v16M4 12h16" />
      </>
    ),
  },
  {
    name: 'Autre',
    bg: '#CFFAFE',
    stroke: '#0E7490',
    icon: (
      <>
        <path d="M21 8l-9-5-9 5 9 5 9-5z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </>
    ),
  },
]

const STEPS = [
  {
    title: 'Invitez vos proches dans un groupe privé',
    text: "Famille, amis ou collègues : un simple lien d'invitation suffit, vous seul décidez qui peut rejoindre votre groupe.",
  },
  {
    title: 'Déposez vos annonces',
    text: 'Un objet à vendre, à donner ou à échanger : photos, prix et catégorie en quelques secondes.',
  },
  {
    title: 'Échangez directement',
    text: 'Messagerie intégrée ou coordonnées directes, au choix du vendeur. Favoris et recherche pour retrouver ce qui vous intéresse.',
  },
]

// Deux annonces types réutilisant le style de la vraie ListingCard (mêmes cadres
// d'image teintés que la section "Catégories" plus bas) : un aperçu honnête du
// produit plutôt qu'un mockup d'app dessiné à la main.
const HERO_PREVIEW_CARDS = [
  {
    variant: 'a' as const,
    title: 'Vélo enfant 16"',
    category: CATEGORY_TILES[3],
    price: '45 €',
    badge: 'Nouveau',
  },
  {
    variant: 'b' as const,
    title: 'Canapé 3 places',
    category: CATEGORY_TILES[0],
    price: 'Don',
    badge: null,
  },
]

function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]"
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.53}
        height={size * 0.53}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <circle cx="7" cy="7" r="1.5" />
      </svg>
    </div>
  )
}

function HeroPreviewCard({ card }: { card: (typeof HERO_PREVIEW_CARDS)[number] }) {
  // "a" (vélo, badge Nouveau) est la carte de devant : z-index au-dessus de "b", qui
  // reste partiellement dans son ombre, façon deux photos posées l'une sur l'autre.
  const position =
    card.variant === 'a'
      ? 'z-10 right-[2%] bottom-0 lg:right-[10%] lg:bottom-[6%]'
      : 'z-0 left-[2%] top-0 lg:left-[6%] lg:top-[8%]'

  return (
    <div
      className={`welcome-hero-card welcome-hero-card--${card.variant} absolute ${position} w-[50%] max-w-[180px] lg:w-[58%] lg:max-w-[210px]`}
    >
      <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_16px_32px_-16px_rgba(28,43,58,0.28)]">
        <div
          className="relative flex aspect-square items-center justify-center"
          style={{ background: card.category.bg }}
        >
          <svg
            width="32%"
            height="32%"
            viewBox="0 0 24 24"
            fill="none"
            stroke={card.category.stroke}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {card.category.icon}
          </svg>
          {card.badge && (
            <span className="absolute left-2 top-2 rounded-[var(--radius-pill)] bg-[var(--color-gold)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-accent)]">
              {card.badge}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5 p-2.5">
          <span className="truncate text-sm font-semibold">{card.title}</span>
          <span className="truncate text-xs text-[var(--color-text-muted)]">{card.category.name}</span>
          <span className="text-sm font-bold">{card.price}</span>
        </div>
      </div>
    </div>
  )
}

function HowItWorksStep({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  const { ref, isVisible } = useRevealOnScroll<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={`reveal-on-scroll relative flex items-start gap-3.5 lg:flex-col lg:items-center lg:gap-3 lg:text-center ${isVisible ? 'is-visible' : ''}`}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <div className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[var(--color-gold)] text-[13px] font-bold text-[var(--color-accent)] ring-4 ring-[var(--color-bg)]">
        {index + 1}
      </div>
      <div className="flex flex-col gap-0.5 pt-0.5 lg:pt-0">
        <div className="text-[15px] font-semibold">{step.title}</div>
        <div className="text-sm leading-snug text-[var(--color-text-muted)]">{step.text}</div>
      </div>
    </div>
  )
}

function CategoryTile({ category, index }: { category: (typeof CATEGORY_TILES)[number]; index: number }) {
  const { ref, isVisible } = useRevealOnScroll<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={`welcome-category-tile flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center lg:py-6 ${isVisible ? 'is-visible' : ''}`}
      style={{ background: category.bg, transitionDelay: `${index * 60}ms` }}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke={category.stroke}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {category.icon}
      </svg>
      <div className="text-xs font-semibold">{category.name}</div>
    </div>
  )
}

export function WelcomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* top bar / logo */}
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-4 lg:max-w-5xl lg:px-8 lg:py-5">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="text-base font-bold tracking-tight">Petites annonces</span>
        </div>
        <Link to="/login" className="text-sm font-medium text-[var(--color-accent)]">
          Connexion
        </Link>
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-5xl">
        {/* hero + aperçu produit : côte à côte sur desktop plutôt qu'empilés dans une
            colonne étroite perdue au milieu de l'écran. */}
        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-8 lg:py-12">
          <div className="flex flex-col gap-3.5 px-6 pb-7 pt-2 lg:px-0 lg:pb-0 lg:pt-0">
            <h1 className="text-[30px] font-bold leading-tight tracking-tight lg:text-3xl">
              Votre petit cercle, pour vos petites annonces.
            </h1>
            <p className="text-base leading-relaxed text-[var(--color-text-muted)] lg:text-lg">
              Créez un groupe privé avec vos amis, famille ou collègues, invitez-les en un lien, et
              échangez vos objets en toute confidentialité.
            </p>

            {/* CTA */}
            <div className="mt-3.5 flex flex-col gap-2.5 lg:flex-row">
              <Link
                to="/register"
                className="btn-press flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-gold)] px-5 py-3.5 text-center text-[15px] font-bold text-[var(--color-accent)]"
              >
                Créer mon groupe gratuitement
              </Link>
              <Link
                to="/login"
                className="btn-press flex items-center justify-center rounded-[var(--radius-pill)] border-[1.5px] border-[var(--color-accent)] px-5 py-3.5 text-center text-[15px] font-bold text-[var(--color-accent)]"
              >
                J'ai déjà un compte
              </Link>
            </div>
          </div>

          {/* aperçu produit : deux vraies ListingCard superposées et inclinées, plutôt
              qu'un mockup d'app dessiné à la main. */}
          <div className="relative mx-6 mb-12 h-[290px] lg:mx-0 lg:mb-0 lg:h-full lg:min-h-[360px]">
            {HERO_PREVIEW_CARDS.map((card) => (
              <HeroPreviewCard key={card.variant} card={card} />
            ))}
          </div>
        </div>

        {/* comment ça marche : un parcours relié plutôt que 3 cartes interchangeables. */}
        <div id="comment-ca-marche" className="flex flex-col gap-6 px-6 pb-8 lg:px-8 lg:pb-14 lg:pt-4">
          <h2 className="text-xl font-bold tracking-tight lg:text-2xl">Comment ça marche</h2>
          <div className="relative flex flex-col gap-8 lg:grid lg:grid-cols-3 lg:gap-8">
            <div
              aria-hidden
              className="pointer-events-none absolute left-[15px] top-3 bottom-3 w-px bg-[var(--color-border)] lg:bottom-auto lg:left-[16.6667%] lg:right-[16.6667%] lg:top-[15px] lg:h-px lg:w-auto"
            />
            {STEPS.map((step, i) => (
              <HowItWorksStep key={step.title} step={step} index={i} />
            ))}
          </div>
        </div>

        {/* quelques catégories : collage légèrement incliné plutôt qu'une grille
            d'icônes parfaitement alignée. */}
        <div className="flex flex-col gap-4 px-6 pb-8 lg:px-8 lg:pb-16">
          <h2 className="text-xl font-bold tracking-tight lg:text-2xl">Quelques catégories</h2>
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-6 lg:gap-5">
            {CATEGORY_TILES.map((category, i) => (
              <CategoryTile key={category.name} category={category} index={i} />
            ))}
          </div>
        </div>

        {/* footer */}
        <div className="mt-auto flex flex-col gap-3.5 border-t border-[var(--color-border)] px-6 pb-7 pt-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-6">
          <div className="flex items-center gap-2">
            <LogoMark size={22} />
            <span className="text-[13px] font-bold">Petites annonces</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <a href="#comment-ca-marche" className="text-[13px] text-[var(--color-text-muted)]">
              Comment ça marche
            </a>
            <Link to="/login" className="text-[13px] text-[var(--color-text-muted)]">
              Connexion
            </Link>
          </div>
          <p className="text-xs leading-relaxed text-[#9ca3af] lg:max-w-sm lg:text-right">
            Gratuit, sans transaction en ligne.
            <br />
            Vos annonces ne sont visibles que par les membres de votre groupe.
          </p>
        </div>
      </main>
    </div>
  )
}
