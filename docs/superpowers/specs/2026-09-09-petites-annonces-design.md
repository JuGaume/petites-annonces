# Petites annonces privées — Design

**Date :** 2026-09-09
**Statut :** En attente de revue utilisateur

## 1. Contexte et objectif

Créer un site web mobile-first permettant à des groupes privés (entreprise, amis) de
partager entre eux des petites annonces d'objets, dans l'esprit de Leboncoin mais en
version simple et réservée à un réseau proche.

Le site est une **plateforme ouverte** : n'importe qui peut créer un compte, créer un ou
plusieurs groupes, et inviter d'autres personnes à les rejoindre. Chaque groupe est
étanche : les membres d'un groupe ne voient pas les annonces des autres groupes dont ils
ne font pas partie.

## 2. Exigences fonctionnelles

- Inscription / connexion par email+mot de passe ou compte Google
- Création de groupes ; invitation par lien partageable **et** par email nominatif
- Dépôt d'annonces : titre, description, une ou plusieurs photos, prix (ou don/troc),
  catégorie, statut (disponible / réservé / vendu)
- Consultation des annonces du groupe, filtrables par catégorie et statut
- Contact entre membres : messagerie interne **ou** coordonnées directes affichées, au
  choix du vendeur, par annonce
- Notification email : digest quotidien des nouvelles annonces par groupe
- Interface d'administration (rôle `Admin`) : gestion des utilisateurs, groupes,
  annonces (modération), catégories, journal d'actions admin

## 3. Exigences non fonctionnelles

- Mobile-first (l'essentiel du trafic est attendu sur mobile)
- Sécurité : isolation stricte entre groupes, protection des comptes, validation des
  entrées, uploads contrôlés
- Performance raisonnable sur mobile / réseau moyen (listes paginées, images optimisées)
- Contenu privé non indexable par les moteurs de recherche ; seule la page d'accueil
  publique doit être SEO-friendly
- Hébergement budget modéré, faible charge opérationnelle pour un porteur de projet solo

## 4. Hors périmètre (v1)

- Application mobile native (l'architecture API/SPA le permettra plus tard sans
  réécriture du backend)
- Notifications push
- Paiement en ligne / transaction financière sur la plateforme (l'échange reste géré
  entre les membres eux-mêmes, hors site)
- Catégories dynamiques/configurables par les utilisateurs (liste fixe gérée par
  l'admin en v1)
- Environnement de staging séparé, suite e2e complète

## 5. Architecture générale

```
┌─────────────────┐         ┌──────────────────────┐
│  React (SPA)      │  HTTPS  │  ASP.NET Core Web API │
│  Vite + TypeScript │ ───────▶│  (.NET 9)             │
│  Azure Static      │  REST + │                       │
│  Web Apps           │  JWT    │  - Auth (Identity +   │
└─────────────────┘  + WS     │    Google OAuth)      │
   Landing page SEO   (SignalR)│  - Groupes / Invites  │
   pré-rendue à part           │  - Annonces           │
                                │  - Messagerie         │
                                │  - Notifications email│
                                └──────────┬────────────┘
                                           │ EF Core
                       ┌───────────────────┼───────────────────┐
                       ▼                   ▼                   ▼
                Azure SQL DB        Azure Blob Storage    Azure Comm. Services
                (données)           (photos annonces)      / SendGrid (emails)
```

- **Backend** : ASP.NET Core Web API (.NET 9), architecture en couches simples
  (Controllers → Services → EF Core DbContext). Pas de CQRS/DDD : le périmètre ne le
  justifie pas.
- **Frontend** : React + TypeScript (Vite), CSS mobile-first (Tailwind).
- **Landing page publique** : page d'accueil pré-rendue statiquement (SSG), séparée de
  la SPA authentifiée, pour le référencement.
- **Auth** : ASP.NET Identity côté API, JWT (access token courte durée + refresh token
  en cookie `httpOnly`/`secure`), Google OAuth greffé sur Identity.
- **Temps réel** : SignalR pour la messagerie interne.
- **Hébergement** : Azure App Service (API), Azure Static Web Apps (React + landing),
  Azure SQL Database, Azure Blob Storage, Azure Communication Services ou SendGrid pour
  les emails.

## 6. Modèle de données

| Entité | Champs clés | Notes |
|---|---|---|
| `User` (ASP.NET Identity) | email, mot de passe hashé, nom affiché, lien compte Google | |
| `Group` | nom, description, créateur, date de création | |
| `GroupMembership` | UserId, GroupId, rôle (`Admin` du groupe / `Member`) | |
| `GroupInvitation` | GroupId, type (lien / email nominatif), token, email cible (nullable), expiration, statut | Token à usage unique pour l'email, réutilisable/révocable pour le lien |
| `Listing` | titre, description, prix (nullable), mode (vente/don/troc), catégorie, statut (disponible/réservé/vendu), GroupId, AuteurId, mode de contact, coordonnées (si choisi), date création | |
| `ListingImage` | ListingId, URL Blob Storage (original), URL miniature | |
| `Category` | nom | Liste fixe gérée par l'admin |
| `Conversation` | ListingId, AcheteurId, VendeurId | |
| `Message` | ConversationId, AuteurId, contenu, date | |

## 7. Flux clés

**Création de groupe et invitation**
1. Un utilisateur connecté crée un groupe → devient admin de ce groupe.
2. Il génère un lien d'invitation (token, révocable, expiration optionnelle) et/ou
   envoie une invitation nominative par email (token à usage unique).
3. Le lien mène vers une page « Rejoindre le groupe X » ; une personne sans compte
   s'inscrit d'abord puis rejoint automatiquement le groupe.

**Cycle de vie d'une annonce**
1. Un membre crée une annonce dans un de ses groupes.
2. Les membres du groupe la voient dans le flux (paginé, filtrable par
   catégorie/statut).
3. Un intéressé contacte via messagerie interne ou coordonnées directes, selon le choix
   du vendeur.
4. Le vendeur met à jour le statut manuellement (disponible → réservé → vendu).

**Messagerie interne**
Une conversation lie une annonce, son auteur et un acheteur. Connexion SignalR pour la
réception en temps réel quand l'utilisateur est sur l'app ; historique chargé par API
REST à l'ouverture d'une conversation.

**Notifications email**
Un `IHostedService` planifié (`BackgroundService` avec un timer quotidien), intégré à
l'API existante, envoie un digest quotidien par groupe aux membres ayant reçu de
nouvelles annonces depuis la veille. Pas de ressource Azure séparée nécessaire à cette
échelle ; une Azure Function planifiée reste une évolution possible si le volume
justifie un jour de sortir ce traitement du processus API.

## 8. Sécurité

- HTTPS forcé, JWT access token courte durée + refresh token en cookie
  `httpOnly`/`secure`.
- Double niveau d'autorisation : rôle global (`User`/`Admin`) + vérification
  d'appartenance au groupe sur chaque action (impossible d'accéder à une annonce d'un
  groupe dont on n'est pas membre).
- Validation stricte des entrées (FluentValidation), upload d'images limité en
  taille/type, revérifié côté serveur.
- Rate limiting sur les endpoints sensibles (login, inscription, création d'annonce).
- CORS restreint au domaine du frontend ; secrets en configuration Azure App Service
  (Key Vault en option), jamais dans le repo.
- Échappement par défaut côté React ; pas de `dangerouslySetInnerHTML` sur du contenu
  utilisateur.

## 9. Performance et cache

- Pagination sur tous les flux d'annonces (scroll infini).
- Index DB sur GroupId, Category, Status.
- Génération d'une miniature à l'upload en plus de l'original ; Blob Storage servi via
  CDN.
- Azure Static Web Apps sert la SPA via un CDN global par défaut.
- Cache mémoire côté API pour les données peu volatiles (liste des catégories) ; pas de
  Redis nécessaire à cette échelle (ajoutable plus tard).

## 10. SEO

Le contenu des annonces est privé et ne doit **pas** être indexé (balise `noindex` +
`robots.txt` bloquant tout sauf la racine publique). Seule la page d'accueil publique
(présentation du service, incitation à créer un compte) est pré-rendue statiquement
pour un bon référencement.

## 11. Interface admin

Section protégée par rôle (`Admin`) intégrée à la SPA (`/admin/...`), consommant des
endpoints `[Authorize(Roles="Admin")]` dédiés :
- Gestion des utilisateurs (désactivation)
- Modération des groupes et annonces (visualisation, suppression)
- Gestion de la liste des catégories
- Journal des actions admin (audit log minimal)

## 12. Tests

- **API** : tests unitaires (xUnit) sur les règles métier (appartenance à un groupe,
  transitions de statut, génération/validation de tokens d'invitation) ; tests
  d'intégration sur les endpoints critiques (auth, création d'annonce, permissions de
  groupe) via `WebApplicationFactory` + base SQLite/InMemory.
- **Frontend** : tests de composants (Vitest + React Testing Library) sur le formulaire
  d'annonce et le flux d'invitation. Pas de suite e2e complète en v1.

## 13. Déploiement

- Un repo Git avec `/api`, `/web`, et un dossier pour la landing page statique.
- CI/CD GitHub Actions : build + tests sur chaque PR, déploiement automatique de `main`
  vers Azure App Service (API) et Azure Static Web Apps (React + landing).
- Migrations EF Core appliquées automatiquement au déploiement.
- Un seul environnement pour commencer ; slot de staging Azure ajoutable plus tard si
  besoin.
