import { Link } from 'react-router-dom'

/**
 * Vitrine affichée sur "/" tant qu'on n'est pas connecté (voir RootRoute) — pas un
 * redirect immédiat vers /login, pour qu'un visiteur qui tombe sur l'appli comprenne
 * de quoi il s'agit avant de devoir s'authentifier. Distincte de la landing publique
 * statique (landing/, Phase 7) : celle-ci vit dans le SPA, pensée pour l'usage local/
 * app (pas d'enjeu SEO, web/index.html reste en noindex).
 *
 * Reprend la maquette "Main" du 2026-09-10 (charte crème/marine, accent or, boutons
 * pilule) — voir web/src/index.css pour les tokens.
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
    title: 'Créez ou rejoignez un groupe',
    text: "Votre entreprise, vos amis ou votre famille — invitez par lien ou par email, vous seul décidez qui en fait partie.",
  },
  {
    title: 'Déposez vos annonces',
    text: 'Un objet à vendre, à donner ou à échanger — photos, prix et catégorie en quelques secondes.',
  },
  {
    title: 'Échangez directement',
    text: 'Messagerie intégrée ou coordonnées directes, au choix du vendeur. Favoris et recherche pour retrouver ce qui vous intéresse.',
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

export function WelcomePage() {
  const illustration = (
    <div className="relative mx-6 mb-7 h-[200px] overflow-hidden rounded-2xl bg-[#FEF3C7] lg:mx-0 lg:mb-0 lg:h-full lg:min-h-[320px]">
      <svg width="100%" height="100%" viewBox="0 0 342 200" fill="none" preserveAspectRatio="xMidYMid slice">
        <circle cx="60" cy="164" r="90" fill="#FDE68A" />
        <circle cx="300" cy="20" r="60" fill="#FDE68A" />
        <g transform="translate(121,58)">
          <rect x="0" y="34" width="100" height="66" rx="6" fill="#ffffff" />
          <rect x="0" y="34" width="100" height="20" fill="#1C2B3A" />
          <rect x="44" y="0" width="12" height="100" fill="#1C2B3A" />
          <path d="M30 0 C10 0 10 24 34 24 L50 24 C50 8 46 0 30 0 Z" fill="#1C2B3A" />
          <path d="M70 0 C90 0 90 24 66 24 L50 24 C50 8 54 0 70 0 Z" fill="#1C2B3A" />
        </g>
        <g transform="translate(226,30)">
          <circle cx="16" cy="16" r="16" fill="#ffffff" />
          <path
            d="M22 15.5c0 3.6-3.3 6.5-7.4 6.5-1 0-1.9-.15-2.7-.4L8 23l1.1-3.6C8.4 18.3 8 17 8 15.5 8 11.9 11.3 9 15.4 9c4.1 0 7.4 2.9 7.4 6.5"
            stroke="#1C2B3A"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <g transform="translate(58,20)">
          <circle cx="15" cy="15" r="15" fill="#ffffff" />
          <rect x="7" y="11" width="16" height="11" rx="2" stroke="#1C2B3A" strokeWidth="1.5" />
          <circle cx="15" cy="16.5" r="3.2" stroke="#1C2B3A" strokeWidth="1.5" />
          <path d="M12 11l1.2-2h3.6l1.2 2" stroke="#1C2B3A" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  )

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
        {/* hero + illustration : côte à côte sur desktop plutôt qu'empilés dans une
            colonne étroite perdue au milieu de l'écran. */}
        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-8 lg:py-12">
          <div className="flex flex-col gap-3.5 px-6 pb-7 pt-2 lg:px-0 lg:pb-0 lg:pt-0">
            <h1 className="text-[30px] font-bold leading-tight tracking-tight lg:text-5xl">
              Les petites annonces, juste entre vous.
            </h1>
            <p className="text-base leading-relaxed text-[var(--color-text-muted)] lg:text-lg">
              Un groupe privé avec vos proches ou vos collègues pour échanger vos objets — en toute
              confidentialité, personne d'autre ne voit vos annonces.
            </p>

            {/* CTA */}
            <div className="mt-3.5 flex flex-col gap-2.5 lg:flex-row">
              <Link
                to="/register"
                className="flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-gold)] px-5 py-3.5 text-center text-[15px] font-bold text-[var(--color-accent)]"
              >
                Créer un compte gratuitement
              </Link>
              <Link
                to="/login"
                className="flex items-center justify-center rounded-[var(--radius-pill)] border-[1.5px] border-[var(--color-accent)] px-5 py-3.5 text-center text-[15px] font-bold text-[var(--color-accent)]"
              >
                J'ai déjà un compte
              </Link>
            </div>
          </div>

          {illustration}
        </div>

        {/* comment ça marche : 3 colonnes sur desktop plutôt qu'une liste verticale. */}
        <div id="comment-ca-marche" className="flex flex-col gap-5 px-6 pb-8 lg:px-8 lg:pb-14 lg:pt-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Comment ça marche
          </div>
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:gap-8">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-3.5 lg:flex-col lg:items-start lg:gap-3 lg:rounded-2xl lg:border lg:border-[var(--color-border)] lg:bg-[var(--color-surface)] lg:p-5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-gold)] text-[13px] font-bold text-[var(--color-accent)]">
                  {i + 1}
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="text-[15px] font-semibold">{step.title}</div>
                  <div className="text-sm leading-snug text-[var(--color-text-muted)]">{step.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* quelques catégories : les 6 tuiles sur une seule rangée sur desktop. */}
        <div className="flex flex-col gap-4 px-6 pb-8 lg:px-8 lg:pb-16">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Quelques catégories
          </div>
          <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-6 lg:gap-4">
            {CATEGORY_TILES.map((cat) => (
              <div
                key={cat.name}
                className="flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center lg:py-6"
                style={{ background: cat.bg }}
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={cat.stroke}
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {cat.icon}
                </svg>
                <div className="text-xs font-semibold">{cat.name}</div>
              </div>
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
            Gratuit · Aucune transaction en ligne · Annonces visibles uniquement par les membres de
            votre groupe.
          </p>
        </div>
      </main>
    </div>
  )
}
