# Petites annonces privées

Site de petites annonces pour groupes privés (entreprise, amis) — mobile-first, esprit
Leboncoin.

- Spec : [docs/superpowers/specs/2026-09-09-petites-annonces-design.md](docs/superpowers/specs/2026-09-09-petites-annonces-design.md)
- Plan d'implémentation : [docs/superpowers/plans/2026-09-09-petites-annonces-implementation-plan.md](docs/superpowers/plans/2026-09-09-petites-annonces-implementation-plan.md)

## Structure du repo

- `api/` — ASP.NET Core Web API (.NET 10) + tests xUnit
- `web/` — Application React (Vite + TypeScript + Tailwind)
- `landing/` — Page d'accueil publique (à construire en Phase 7)

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

## Migrations EF Core

```bash
cd api
dotnet ef migrations add NomDeLaMigration --project PetitesAnnonces.Api --startup-project PetitesAnnonces.Api
dotnet ef database update --project PetitesAnnonces.Api --startup-project PetitesAnnonces.Api
```
