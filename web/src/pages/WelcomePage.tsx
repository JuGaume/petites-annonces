import { Link } from 'react-router-dom'

/**
 * Vitrine affichée sur "/" tant qu'on n'est pas connecté (voir RootRoute) — pas un
 * redirect immédiat vers /login, pour qu'un visiteur qui tombe sur l'appli comprenne
 * de quoi il s'agit avant de devoir s'authentifier. Distincte de la landing publique
 * statique (landing/, Phase 7) : celle-ci vit dans le SPA, pensée pour l'usage local/
 * app (pas d'enjeu SEO, web/index.html reste en noindex).
 */
const STEPS = [
  {
    title: '1. Créez ou rejoignez un groupe',
    text: 'Invitez par lien ou par email — vous seul décidez qui en fait partie.',
  },
  {
    title: '2. Déposez vos annonces',
    text: 'Photos, prix ou don/troc, catégorie : visible de tout le groupe, et seulement de lui.',
  },
  {
    title: '3. Échangez en toute simplicité',
    text: 'Messagerie intégrée ou coordonnées directes, favoris, recherche, au choix.',
  },
]

export function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-10 px-4 py-12 md:max-w-5xl md:justify-center md:gap-16 md:px-8">
      {/* Deux colonnes à partir de md : texte + CTA à gauche, aperçu des étapes à
          droite, plutôt qu'une unique colonne étroite perdue au milieu d'un grand
          écran (voir feedback desktop). */}
      <div className="flex flex-col gap-10 md:flex-row md:items-center md:gap-16">
        <div className="flex flex-col gap-4 text-center md:flex-1 md:text-left">
          <span className="text-sm font-medium text-[var(--color-accent)]">Petites annonces</span>
          <h1 className="text-3xl font-semibold md:text-4xl">La brocante privée de vos groupes</h1>
          <p className="text-[var(--color-text-muted)] md:text-lg">
            Créez un groupe pour votre entreprise, vos amis ou votre famille, et échangez entre vous
            des objets à vendre, donner ou troquer — à l'abri des regards, sans inconnus.
          </p>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row md:flex-col md:pt-4 lg:flex-row">
            <Link
              to="/register"
              className="rounded bg-[var(--color-accent)] px-4 py-2 text-center font-medium text-white sm:flex-1 lg:flex-none"
            >
              Créer un compte
            </Link>
            <Link
              to="/login"
              className="rounded border border-[var(--color-border)] px-4 py-2 text-center font-medium sm:flex-1 lg:flex-none"
            >
              Se connecter
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:w-96 md:flex-none">
          <h2 className="text-center font-semibold md:text-left">Comment ça marche</h2>
          <ol className="flex flex-col gap-3 text-sm text-[var(--color-text-muted)]">
            {STEPS.map((step) => (
              <li key={step.title} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <span className="font-medium text-[var(--color-text)]">{step.title}</span>
                <br />
                {step.text}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  )
}
