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

## Migrations EF Core

```bash
cd api
dotnet ef migrations add NomDeLaMigration --project PetitesAnnonces.Api --startup-project PetitesAnnonces.Api
dotnet ef database update --project PetitesAnnonces.Api --startup-project PetitesAnnonces.Api
```
