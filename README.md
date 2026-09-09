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

Par défaut le front attend l'API sur `http://localhost:5000` (voir
`VITE_API_BASE_URL` pour changer).
