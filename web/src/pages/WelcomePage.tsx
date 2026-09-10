import { Link } from 'react-router-dom'

/**
 * Vitrine affichée sur "/" tant qu'on n'est pas connecté (voir RootRoute) — pas un
 * redirect immédiat vers /login, pour qu'un visiteur qui tombe sur l'appli comprenne
 * de quoi il s'agit avant de devoir s'authentifier. Distincte de la landing publique
 * statique (landing/, Phase 7) : celle-ci vit dans le SPA, pensée pour l'usage local/
 * app (pas d'enjeu SEO, web/index.html reste en noindex).
 */
export function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-10 px-4 py-12">
      <div className="flex flex-col gap-4 text-center">
        <span className="text-sm font-medium text-[var(--color-accent)]">Petites annonces</span>
        <h1 className="text-3xl font-semibold">La brocante privée de vos groupes</h1>
        <p className="text-[var(--color-text-muted)]">
          Créez un groupe pour votre entreprise, vos amis ou votre famille, et échangez entre vous
          des objets à vendre, donner ou troquer — à l'abri des regards, sans inconnus.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          to="/register"
          className="rounded bg-[var(--color-accent)] px-3 py-2 text-center font-medium text-white"
        >
          Créer un compte
        </Link>
        <Link
          to="/login"
          className="rounded border border-[var(--color-border)] px-3 py-2 text-center font-medium"
        >
          Se connecter
        </Link>
      </div>

      <div className="flex flex-col gap-4 border-t border-[var(--color-border)] pt-8">
        <h2 className="text-center font-semibold">Comment ça marche</h2>
        <ol className="flex flex-col gap-3 text-sm text-[var(--color-text-muted)]">
          <li className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <span className="font-medium text-[var(--color-text)]">1. Créez ou rejoignez un groupe</span>
            <br />
            Invitez par lien ou par email — vous seul décidez qui en fait partie.
          </li>
          <li className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <span className="font-medium text-[var(--color-text)]">2. Déposez vos annonces</span>
            <br />
            Photos, prix ou don/troc, catégorie : visible de tout le groupe, et seulement de lui.
          </li>
          <li className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <span className="font-medium text-[var(--color-text)]">3. Échangez en toute simplicité</span>
            <br />
            Messagerie intégrée ou coordonnées directes, favoris, recherche, au choix.
          </li>
        </ol>
      </div>
    </main>
  )
}
