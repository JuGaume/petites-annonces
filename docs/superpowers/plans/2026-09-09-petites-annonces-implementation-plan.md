# Plan d'implémentation — Petites annonces privées

**Spec de référence :** [2026-09-09-petites-annonces-design.md](../specs/2026-09-09-petites-annonces-design.md)
**Date :** 2026-09-09

Le plan est découpé en phases livrables indépendamment testables, dans l'ordre où elles
doivent être construites. Chaque phase se termine dans un état fonctionnel et testé
avant de passer à la suivante.

## Note sur le graphisme

Pas de maquettes séparées avant le code : le design se fait directement en React/
Tailwind, avec une direction visuelle inspirée de l'esprit Leboncoin (cartes d'annonces
simples et lisibles, accent chaleureux, UI fonctionnelle et épurée plutôt que
décorative). Une petite charte (couleurs, typographie, espacements) est posée dès la
Phase 0 pour garder les écrans cohérents entre eux. Des captures d'écran sont partagées
au fil de la Phase 3 (annonces) pour validation/ajustement du rendu.

## Phase 0 — Squelette du projet

**Objectif :** un repo qui compile et se lance, vide de logique métier.

- Solution .NET : `api/PetitesAnnonces.sln` avec projets `PetitesAnnonces.Api`,
  `PetitesAnnonces.Tests` (xUnit)
- Projet React : `web/` (Vite + TypeScript + React Router + Tailwind)
- Dossier `landing/` pour la page publique statique (Vite en mode SSG, ou simple HTML/CSS
  si plus rapide à livrer)
- `docker-compose.yml` local pour dev : SQL Server/PostgreSQL local + Azurite (émulateur
  Blob Storage) — évite de dépendre d'Azure pour développer
- `.gitignore`, `README.md` (comment lancer le projet en local)
- CI GitHub Actions minimal : build API + build web sur chaque push (pas encore de
  déploiement)

**Vérification :** `dotnet build` et `npm run build` passent tous les deux ; l'API
répond sur un endpoint `/health` ; le front affiche une page vide.

## Phase 1 — Authentification

**Objectif :** un utilisateur peut s'inscrire, se connecter (email/mdp ou Google), et
l'API distingue les requêtes authentifiées des anonymes.

- EF Core + ASP.NET Identity (`ApplicationUser`), migration initiale
- Endpoints : `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`,
  `POST /auth/google`
- JWT access token + refresh token en cookie `httpOnly`
- Rôles `User` / `Admin` (seed d'un premier compte admin via config/migration)
- Rate limiting sur `/auth/*`
- Frontend : pages inscription/connexion, contexte d'auth React (token, utilisateur
  courant), routes protégées

**Vérification :** tests d'intégration API (inscription, connexion, refresh, accès
refusé sans token) ; test manuel du flux Google OAuth en local.

## Phase 2 — Groupes et invitations

**Objectif :** un utilisateur connecté peut créer un groupe, générer un lien
d'invitation ou inviter par email, et une autre personne peut rejoindre le groupe.

- Entités `Group`, `GroupMembership`, `GroupInvitation` + migrations
- Endpoints : créer un groupe, lister mes groupes, générer un lien d'invitation, envoyer
  une invitation par email, rejoindre via token
- Vérification d'appartenance au groupe (middleware/filtre d'autorisation réutilisé
  dans toutes les phases suivantes)
- Envoi de l'email d'invitation nominative (intégration SendGrid/Azure Communication
  Services, même mécanisme que la Phase 5)
- Frontend : création de groupe, page « Rejoindre le groupe », gestion des membres

**Vérification :** tests d'intégration (création, invitation par lien, invitation par
email, rejoindre, isolation entre groupes — un membre du groupe A ne voit rien du
groupe B).

## Phase 3 — Annonces

**Objectif :** cœur du produit — créer, consulter, filtrer des annonces avec photos.

- Entités `Listing`, `ListingImage`, `Category` (seed des catégories fixes) +
  migrations
- Upload d'images vers Blob Storage (Azurite en local), génération de miniature
- Endpoints CRUD annonces (création, mise à jour de statut, suppression par l'auteur),
  liste paginée/filtrée par groupe
- Validation stricte (FluentValidation), contrôle serveur du type/taille des images
- Frontend mobile-first : formulaire de dépôt d'annonce, flux d'annonces du groupe
  (scroll infini), filtres catégorie/statut, page détail annonce

**Vérification :** tests d'intégration (CRUD, permissions par groupe, transitions de
statut) ; tests de composants React sur le formulaire d'annonce.

## Phase 4 — Messagerie interne

**Objectif :** un intéressé peut contacter le vendeur via chat intégré, quand ce mode
est choisi sur l'annonce.

- Entités `Conversation`, `Message` + migrations
- Hub SignalR pour la diffusion temps réel + endpoints REST pour l'historique
- Frontend : ouverture d'une conversation depuis une annonce, liste des conversations,
  fil de discussion en temps réel

**Vérification :** test d'intégration sur la création de conversation et la
persistance des messages ; test manuel du temps réel (deux sessions navigateur).

## Phase 5 — Notifications email

**Objectif :** chaque membre reçoit un digest quotidien des nouvelles annonces de ses
groupes.

- `BackgroundService` avec timer quotidien, requête des annonces créées depuis le
  dernier envoi par groupe, envoi via SendGrid/Azure Communication Services
- Template d'email simple (liste des nouvelles annonces + lien vers le groupe)
- Option de désabonnement par groupe dans les préférences utilisateur

**Vérification :** test unitaire sur la logique de sélection des annonces à inclure ;
test manuel d'un envoi réel en environnement de dev.

## Phase 6 — Interface admin

**Objectif :** un compte `Admin` peut modérer la plateforme.

- Endpoints `[Authorize(Roles="Admin")]` : liste/désactivation des utilisateurs,
  liste/suppression des groupes et annonces, gestion des catégories, journal d'audit
- Frontend : section `/admin` avec ces vues

**Vérification :** tests d'intégration sur le contrôle d'accès (un non-admin ne peut
pas atteindre ces endpoints) et sur chaque action de modération.

## Phase 7 — Landing page, sécurité, performance

**Objectif :** finitions transverses avant mise en production.

- Landing page publique pré-rendue (SEO), `robots.txt` + `noindex` sur le reste du site
- Revue sécurité : CORS, en-têtes de sécurité, secrets hors repo, audit rapide des
  autorisations par endpoint
- Revue performance : index DB, taille des payloads/images, lazy loading frontend

**Vérification :** passage d'un outil d'audit (Lighthouse pour perf/SEO de la landing,
`dotnet list package --vulnerable` ou équivalent pour les dépendances).

## Phase 8 — CI/CD et déploiement Azure

**Objectif :** déploiement automatisé et reproductible.

- Provisionnement Azure (App Service, Azure SQL, Blob Storage, Static Web Apps,
  service d'email) — via portail ou Bicep/Terraform si tu veux l'infra as code
- GitHub Actions : build + tests + migrations EF Core + déploiement sur push `main`
- Variables/secrets de production dans la configuration Azure App Service

**Vérification :** déploiement de bout en bout sur un environnement réel, smoke test
des flux principaux (inscription, création de groupe, dépôt d'annonce, message,
digest email).

---

## Ordre et dépendances

Les phases sont séquentielles (chacune dépend des entités/endpoints de la précédente),
à l'exception de la Phase 7 qui peut être travaillée en continu plutôt qu'en bloc final
strict. La Phase 8 (déploiement) peut être avancée dès la Phase 0 si tu préfères
valider la chaîne de déploiement tôt plutôt qu'à la fin.
