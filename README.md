# Petites annonces privées

Site de petites annonces pour groupes privés (entreprise, amis) — mobile-first, esprit
Leboncoin.

- Spec : [docs/superpowers/specs/2026-09-09-petites-annonces-design.md](docs/superpowers/specs/2026-09-09-petites-annonces-design.md)
- Plan d'implémentation : [docs/superpowers/plans/2026-09-09-petites-annonces-implementation-plan.md](docs/superpowers/plans/2026-09-09-petites-annonces-implementation-plan.md)

## Structure du repo

- `api/` — ASP.NET Core Web API (.NET 10) + tests xUnit
- `web/` — Application React (Vite + TypeScript + Tailwind)
- `landing/` — Page d'accueil publique, statique (HTML/CSS, pas de build) et indexable,
  à l'inverse du reste du site (voir « Landing page, sécurité, performance » ci-dessous)

## Prérequis locaux

- [.NET SDK 10](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) 20+
- SQL Server LocalDB (fourni avec Visual Studio) — pas de Docker requis en dev

## Lancer l'API

```bash
cd api
dotnet run --project PetitesAnnonces.Api
```

L'API répond sur `/health` une fois démarrée.

## Lancer les tests API

```bash
cd api
dotnet test
```

## Lancer le front

```bash
cd web
npm install
npm run dev
```

Par défaut le front attend l'API sur `http://localhost:5083` (voir
`VITE_API_BASE_URL` pour changer).

## Authentification

- Email + mot de passe fonctionne sans configuration supplémentaire.
- Un compte admin est créé automatiquement au premier démarrage à partir de
  `Seed:AdminEmail` / `Seed:AdminPassword` (valeurs de dev dans
  `appsettings.Development.json` — **à changer avant tout déploiement**, via la
  configuration Azure App Service, jamais commitées).
- **Connexion Google (optionnelle en dev)** : nécessite un Client ID OAuth créé sur
  [Google Cloud Console](https://console.cloud.google.com/) (APIs & Services →
  Identifiants → Créer des identifiants → ID client OAuth → type "Application Web",
  origine JavaScript autorisée `http://localhost:5173`). Renseigner ensuite :
  - côté API : `Google:ClientId` (user-secrets en dev, config Azure en prod)
  - côté front : `VITE_GOOGLE_CLIENT_ID` dans `web/.env.development`

  Sans cette configuration, le bouton "Se connecter avec Google" reste simplement
  masqué — l'auth email/mot de passe n'en dépend pas.

## Groupes et invitations

- Créer un groupe rend automatiquement son créateur admin de ce groupe.
- Deux façons d'inviter (réservées aux admins du groupe) : un lien partageable et
  réutilisable jusqu'à révocation, ou une invitation nominative par email, à usage
  unique et réservée à l'adresse ciblée.
- **Envoi d'email (optionnel en dev)** : sans clé configurée, l'email d'invitation est
  simplement consigné dans les logs de l'API (`LoggingEmailSender`) au lieu d'être
  envoyé — pratique pour tester le flux sans compte SendGrid. Pour un envoi réel,
  renseigner `SendGrid:ApiKey` (et éventuellement `SendGrid:FromEmail`/`FromName`) ainsi
  que `Frontend:BaseUrl` (utilisé pour construire le lien `/join/{token}` dans l'email).

## Annonces et photos

- Catégories fixes, seedées au démarrage (liste dans `Auth/DbSeeder.cs`), listées via
  `GET /categories`.
- Prix requis pour une vente, refusé pour un don/troc ; coordonnées de contact requises
  quand le mode « coordonnées directes » est choisi — validé côté serveur
  (FluentValidation), voir `Validation/CreateListingRequestValidator.cs`.
- **Stockage des photos (optionnel en dev)** : sans chaîne de connexion Azure Storage
  configurée, les photos sont écrites sur le disque de l'API (`App_Data/uploads/`,
  ignoré par git) et servies telles quelles — pas besoin d'Azurite pour développer,
  même logique que SQL Server LocalDB pour la base de données. Une miniature est
  générée à l'upload (SixLabors.ImageSharp). Pour un vrai stockage Azure, renseigner
  `BlobStorage:AzureConnectionString` (et éventuellement `BlobStorage:ContainerName`).

## Messagerie interne

- Disponible quand une annonce a choisi le mode de contact « messagerie interne » (par
  opposition aux coordonnées affichées directement).
- Une personne intéressée ouvre une conversation depuis l'annonce (un seul fil par
  couple annonce/acheteur) ; l'historique se charge via l'API REST (`GET
  /conversations/{id}/messages`) et les nouveaux messages arrivent en temps réel via
  SignalR (`/hubs/conversations`) tant que la fenêtre est ouverte.
- Le token JWT est transmis en paramètre de requête pour la connexion SignalR (un
  WebSocket ne permet pas de poser l'en-tête `Authorization`) — géré automatiquement par
  le client (`web/src/lib/conversationsHub.ts`), rien à configurer.

## Notifications email (digest quotidien)

- Chaque membre reçoit, par groupe, un résumé des nouvelles annonces déposées depuis son
  dernier envoi (jamais ses propres annonces). Désabonnement possible par groupe depuis
  la page de détail du groupe (`GET/PATCH /groups/{id}/notifications`, via
  `GroupMembership.EmailDigestEnabled`).
- Tourne dans le processus de l'API (`DailyDigestService`, un `BackgroundService`), pas
  de ressource séparée à cette échelle. Intervalle configurable via `Digest:IntervalHours`
  (24 par défaut).
- **Test manuel sans attendre le minuteur** : `POST /digest/run-now`, réservé au rôle
  `Admin` (le compte seedé en dev convient). Comme pour les invitations, l'email est
  consigné dans les logs de l'API sans clé SendGrid configurée.

## Interface admin

- Section `/admin` (lien visible sur la page d'accueil pour un compte `Admin`, seul le
  compte seedé en dev par défaut) : utilisateurs (désactivation/réactivation), groupes,
  annonces (visualisation, suppression), catégories (création/suppression), journal
  d'audit minimal des actions ci-dessus.
- Désactiver un compte s'appuie sur le verrouillage natif d'ASP.NET Identity
  (`LockoutEnd`) : login et refresh sont bloqués tant que le compte est désactivé, sans
  colonne supplémentaire.
- Une catégorie utilisée par au moins une annonce ne peut pas être supprimée (409/400
  explicite plutôt qu'une erreur de contrainte en base).

## Landing page, sécurité, performance

- **Landing page publique** (`landing/`) : page statique (aucun outil de build, ouvrable
  directement ou servie via `python3 -m http.server`), pensée pour être indexée — à
  l'opposé du reste du site (`web/`), une application privée réservée aux membres
  connectés. Elle porte son propre `robots.txt` (indexation autorisée) et sitemap ; avant
  tout déploiement, remplacer le domaine `petites-annonces.example` par le vrai domaine
  dans `landing/index.html`, `landing/robots.txt` et `landing/sitemap.xml` (voir
  `landing/README.md`).
- **`web/` non indexable** : balise `<meta name="robots" content="noindex, nofollow">`
  dans `web/index.html` et `web/public/robots.txt` bloquant tout crawl — l'app n'a
  vocation à être visitée que par des membres connectés, jamais listée dans un moteur de
  recherche.
- **En-têtes de sécurité** : `Strict-Transport-Security` (hors dev), `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, ajoutés à toutes les
  réponses de l'API (`Program.cs`). Pas de `Content-Security-Policy` : l'API ne sert que
  du JSON et les fichiers statiques des photos, pas de HTML applicatif.
- **CORS** : origines autorisées restreintes à `Cors:FrontendOrigins` (config, pas de
  wildcard) — à mettre à jour avec le vrai domaine du front avant déploiement.
- **Secrets** : aucun secret commité — mots de passe/clés de dev dans
  `appsettings.Development.json` uniquement, à remplacer par la configuration de
  l'environnement (Azure App Service, variables d'env, user-secrets) en production, comme
  déjà indiqué pour le compte admin seedé, SendGrid, Google OAuth et le stockage Azure.
- **Audit des autorisations** : chaque contrôleur a été revu (attributs `[Authorize]` /
  policy au niveau classe, `[AllowAnonymous]` explicite pour les routes publiques —
  inscription, connexion, refresh, aperçu d'invitation — et vérifications de propriété en
  code, ex. `Forbid()` sur les actions liées à une annonce ou une conversation).
- **Cache des catégories** : `GET /categories` (liste peu volatile) est mis en cache en
  mémoire côté API (`IMemoryCache`, 10 min), invalidé explicitement à la
  création/suppression d'une catégorie par `AdminController`.
- **Index base de données** : ajout d'un index unique sur `RefreshToken.TokenHash`
  (recherché à chaque appel `/auth/refresh`, jusqu'ici non indexé) ; les index déjà en
  place pour les flux paginés (annonces par groupe/catégorie/statut, messages par
  conversation, journal d'audit par date) restent inchangés.
- **Poids des images** : en plus de la miniature (480px), l'image « originale » affichée
  sur la page de détail est désormais elle aussi recompressée à l'upload (1600px max,
  JPEG qualité 85 — `Images/ThumbnailGenerator.cs`) plutôt que stockée telle quelle
  jusqu'à 5 Mo.
- **Chargement différé (lazy loading)** : les images distantes (miniatures du fil
  d'annonces et des conversations, photos de la page de détail hors la première) portent
  `loading="lazy"`.
- **Vérification** : `dotnet list package --vulnerable` et `npm audit` ne remontent aucune
  dépendance vulnérable à ce jour ; passer un outil comme Lighthouse sur `landing/` avant
  mise en production pour valider perf/SEO.

## Favoris, personnalisation et recherche

Fonctionnalités ajoutées après le plan d'implémentation initial (qui s'arrêtait à la
Phase 8), à la demande directe de l'utilisateur.

- **Favoris** : bouton cœur sur une annonce (flux du groupe et page de détail,
  `PUT`/`DELETE /groups/{groupId}/listings/{listingId}/favorite`, idempotent). La page
  « Mes favoris » (`/favorites`, `GET /favorites`) les liste tous groupes confondus,
  en ne remontant que ceux dont on est encore membre du groupe au moment de la lecture.
- **Recherche** : paramètre `search` sur `GET /groups/{groupId}/listings`, filtrant sur
  le titre et la description (insensible à la casse). Champ de recherche sur le flux
  d'annonces, avec un léger anti-rebond (400 ms) pour ne pas relancer une requête à
  chaque caractère tapé.
- **Image de groupe** : upload/suppression réservés aux admins du groupe
  (`POST`/`DELETE /groups/{groupId}/image`, même pipeline de recompression que les
  photos d'annonces). Affichée sur la liste des groupes et la page de détail du groupe.
- **Aperçu d'annonces sur la liste des groupes** : jusqu'à 4 miniatures des annonces
  disponibles les plus récentes de chaque groupe, à côté de son image.
- **Mon compte** (`/account`, nouveau `AccountController`) : photo de profil
  (upload/suppression), nom affiché, téléphone, changement d'adresse email (nécessite le
  mot de passe actuel, met aussi à jour l'identifiant de connexion) et changement de mot
  de passe — ces deux dernières routes partagent le même limiteur de débit que
  `AuthController` (spec §8, anti brute-force).
- **Landing retravaillée** (`landing/`) : nouvelle section présentant ces
  fonctionnalités (recherche, favoris, groupes personnalisés, profil).
- **Vitrine sur `/` quand on n'est pas connecté** : la racine du SPA (`web/`) n'est
  plus une route protégée qui renvoie brutalement vers `/login` — `RootRoute` y
  affiche désormais une page d'accueil publique (`WelcomePage`, CTA « Créer un
  compte »/« Se connecter ») tant qu'il n'y a pas de session, et le tableau de bord
  habituel une fois connecté. Distincte de la landing statique de `landing/`
  (celle-ci reste la page pensée pour l'indexation, hors du SPA).

## Migrations EF Core

```bash
cd api
dotnet ef migrations add NomDeLaMigration --project PetitesAnnonces.Api --startup-project PetitesAnnonces.Api
dotnet ef database update --project PetitesAnnonces.Api --startup-project PetitesAnnonces.Api
```

## CI/CD et déploiement Azure

- **CI** (`.github/workflows/ci.yml`) : à chaque push et pull request, build + tests
  API (`dotnet build`/`dotnet test`) et build + lint front (`npm run build`/`npm run
  lint`). Ne nécessite aucune configuration — actif immédiatement.
- **CD** (`.github/workflows/deploy.yml`) : sur push vers `main`, applique les
  migrations EF Core sur la base Azure SQL de production puis déploie l'API sur Azure
  App Service et le front sur Azure Static Web Apps. **Inactif tant que l'infra Azure
  n'existe pas et que les secrets/variables ci-dessous ne sont pas renseignés** —
  chaque job est gardé par la présence du secret correspondant, donc rien n'échoue
  entre-temps, les jobs sont simplement ignorés.

Ce dépôt ne suppose aucun abonnement Azure existant. Pour activer le déploiement,
quand tu seras prêt :

1. **Provisionner l'infrastructure** : soit à la main dans le [portail
   Azure](https://portal.azure.com) (App Service Linux/.NET 10, Azure SQL, un
   compte de stockage avec un conteneur blob, une Static Web App), soit en une
   commande avec le template Bicep fourni — voir `infra/bicep/README.md` pour le pas
   à pas complet (`az group create` puis `az deployment group create`).
2. **Créer un compte [SendGrid](https://sendgrid.com)** (hors Azure) pour l'envoi
   d'email en production, et récupérer une clé API.
3. **Renseigner les secrets et variables GitHub** (Settings → Secrets and variables →
   Actions, sur ce dépôt) :

   | Nom | Type | Description |
   | --- | --- | --- |
   | `AZURE_WEBAPP_NAME` | Variable | Nom de l'App Service (sortie `webAppName` du déploiement Bicep) |
   | `AZURE_WEBAPP_PUBLISH_PROFILE` | Secret | Profil de publication de l'App Service (`az webapp deployment list-publishing-profiles`) |
   | `AZURE_SQL_CONNECTION_STRING` | Secret | Chaîne de connexion Azure SQL, utilisée pour appliquer les migrations depuis la CI |
   | `AZURE_STATIC_WEB_APPS_API_TOKEN` | Secret | Jeton de déploiement de la Static Web App (`az staticwebapp secrets list`) |
   | `VITE_API_BASE_URL` | Variable | URL publique de l'API (ex. `https://<webAppName>.azurewebsites.net`) — compilée dans le bundle front |
   | `VITE_GOOGLE_CLIENT_ID` | Variable | Optionnel, si la connexion Google est activée en prod |

4. **Configurer l'App Service** (config de l'API en production, jamais commitée —
   voir `infra/bicep/README.md` pour la commande `az webapp config appsettings
   set` complète) : `ConnectionStrings__DefaultConnection`, `Jwt__SigningKey`
   (générer une nouvelle clé, ne jamais réutiliser celle de dev), `Jwt__Issuer`,
   `Jwt__Audience`, `Seed__AdminEmail`/`Seed__AdminPassword`,
   `Cors__FrontendOrigins__0` (URL de la Static Web App), `Frontend__BaseUrl`,
   `SendGrid__ApiKey`, `BlobStorage__AzureConnectionString`,
   `BlobStorage__ContainerName`.
5. Pousser sur `main` : `deploy.yml` se déclenche automatiquement. Suit ensuite un
   smoke test manuel des flux principaux (inscription, création de groupe, dépôt
   d'annonce, message, digest email) sur l'environnement réel.
