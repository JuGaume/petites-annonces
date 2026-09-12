# Revue — Complétude fonctionnelle & Sécurité

**Projet :** Petites annonces privées
**Date :** 2026-09-12
**Périmètre :** comparaison du code (`api/` + `web/`) avec `docs/superpowers/specs/2026-09-09-petites-annonces-design.md`, sur les deux axes demandés : complétude fonctionnelle et sécurité. Qualité de code et performance non couvertes (hors périmètre de cette revue, à ta demande).

## En résumé

Le projet est **fonctionnellement complet** par rapport au spec : les 7 exigences de la section 2 sont toutes implémentées, backend comme frontend, y compris les détails fins (droits délégués par membre, digest email, isolation stricte entre groupes). C'est un projet solo à un stade avancé, pas un squelette.

Côté sécurité, l'architecture est globalement **bien pensée et correctement exécutée** (JWT + refresh cookie, double autorisation, validation stricte, uploads recontrôlés côté serveur, en-têtes de sécurité). Il y a cependant **un problème sérieux à corriger rapidement** : une clé secrète JWT et un mot de passe admin sont commités en clair dans le repo public GitHub. Deux autres écarts, plus mineurs, concernent le rate limiting.

---

## 1. Complétude fonctionnelle (spec §2)

| Exigence spec | Statut | Détail |
|---|---|---|
| Inscription / connexion email+mdp ou Google | ✅ Complet | `AuthController` (register/login/google), `GoogleSignInButton.tsx` |
| Création de groupes ; invitation par lien **et** par email nominatif | ✅ Complet | `GroupsController` (`/invitations/link`, `/invitations/email`), UI dans `GroupDetailPage.tsx` |
| Dépôt d'annonces (titre, description, photos, prix/don/troc, catégorie, statut) | ✅ Complet | `ListingsController.Create`, `CreateListingPage.tsx` |
| Consultation filtrable par catégorie et statut | ✅ Complet | `ListingsFeedPage.tsx` (+ recherche texte, au-delà du spec) |
| Contact interne **ou** coordonnées directes, au choix du vendeur | ✅ Complet | `ContactMode` (InternalMessaging/DirectContact), `ConversationsController` + SignalR, affichage conditionnel dans `ListingDetailPage.tsx` |
| Digest email quotidien des nouvelles annonces | ✅ Complet | `DailyDigestService` (hosted service), `DigestBuilder`, toggle par groupe (`EmailDigestEnabled`) |
| Interface admin (utilisateurs, groupes, annonces, catégories, journal d'audit) | ✅ Complet | `AdminController` + `AdminPage.tsx`, toutes les sous-fonctions présentes |

Bonus au-delà du spec : droits délégués par membre (`CanInviteMembers`/`CanRemoveMembers`/`CanDeleteListings`, spec "Phase 10"), favoris, recherche texte sur les annonces, mise en page desktop complète (travail récent).

**Seul écart réel identifié — tests frontend absents (spec §12) :**
Le spec demande explicitement des "tests de composants (Vitest + React Testing Library) sur le formulaire d'annonce et le flux d'invitation". Aujourd'hui `web/package.json` ne contient **aucune dépendance de test** (pas de `vitest`, pas de `@testing-library/*`) et aucun fichier `*.test.*`/`*.spec.*` n'existe dans `web/src`. Côté API en revanche, la couverture xUnit est bonne et correspond exactement à ce que demande le spec (`AuthTests`, `GroupsTests`, `ListingsTests`, `ConversationsTests`, `FavoritesTests`, `AdminTests`, `DigestBuilderTests`/`DigestEndpointTests`, `AccountTests`).

Le reste de la section 12 (tests d'intégration API via `WebApplicationFactory`) est couvert. La section 13 (CI/CD) est également en place : `ci.yml` build+teste API et web sur chaque PR, `deploy.yml` déploie vers Azure de façon conditionnelle (gardé par la présence des secrets), migrations EF Core appliquées automatiquement au déploiement — conforme au spec.

---

## 2. Sécurité (spec §8)

### 🔴 À corriger en priorité — secrets commités dans le repo public

`api/PetitesAnnonces.Api/appsettings.Development.json` est suivi par git (`.gitignore` n'exclut que `appsettings.*.local.json`, pas ce fichier) et contient :
- une vraie clé de signature JWT en clair (`Jwt:SigningKey`) ;
- un mot de passe admin de seed en clair (`Seed:AdminPassword`).

C'est exactement ce que le spec interdit ("secrets en configuration Azure App Service ... jamais dans le repo"). Comme le repo est public sur GitHub, cette clé et ce mot de passe sont visibles par n'importe qui — y compris dans l'historique git, donc les retirer du fichier ne suffira pas si le commit reste accessible.

**Recommandation :**
1. Générer une nouvelle clé JWT et un nouveau mot de passe admin (ne jamais réutiliser ceux exposés, même en dev).
2. Sortir ces valeurs du fichier : `dotnet user-secrets` en local, variables d'environnement / Key Vault en Azure (comme le prévoit déjà le spec).
3. Réécrire l'historique git (`git filter-repo` ou équivalent) ou, a minima, accepter que ces valeurs anciennes soient définitivement compromises et ne plus jamais les utiliser en production.

### 🟠 Rate limiting incomplet (spec §8)

Le spec demande explicitement un rate limiting sur *login, inscription et création d'annonce*. Deux écarts :

- **Non partitionné par IP** : le `FixedWindowLimiter` configuré dans `Program.cs` n'a pas de clé de partition — c'est un compteur **global**, partagé par tous les appelants de l'API (10 requêtes/60s par défaut, tous utilisateurs confondus). Concrètement : un seul client un peu trop actif épuise le quota et bloque tout le monde (auto-DoS), alors qu'un attaquant distribué (plusieurs IP) n'est quasiment pas freiné. Il faudrait partitionner par IP avec `RateLimitPartition.GetFixedWindowLimiter(httpContext => IP, ...)`.
- **Absent sur la création d'annonce** : `AuthController` et `AccountController.ChangePassword/ChangeEmail` utilisent bien `[EnableRateLimiting(RateLimiting.AuthPolicy)]`, mais `ListingsController.Create` n'a aucune limite — alors que le spec la cite nommément à côté de login/inscription.

### 🟡 Pas de verrouillage de compte après échecs de connexion

`AuthController.Login` appelle `userManager.CheckPasswordAsync` directement, qui ne compte pas les échecs (`AccessFailedCount`) ni ne déclenche de lockout automatique — le seul frein au brute-force est le rate limiter global ci-dessus. Une fois le rate limiting corrigé (par IP), ça reste une défense en profondeur à considérer si le projet grandit, mais ce n'est pas bloquant vu l'échelle actuelle du projet.

### Ce qui est bien fait (le reste de §8 est conforme)

- **JWT + refresh cookie** : access token courte durée (15 min par défaut), refresh token en cookie `HttpOnly` + `Secure` + `SameSite=Strict`, scope `Path=/auth`, avec rotation et révocation à chaque refresh/logout, et stockage hashé (SHA-256) en base plutôt qu'en clair. Le token d'accès est gardé en mémoire JS côté client (pas de `localStorage`), ce qui limite l'exposition en cas de XSS.
- **Double niveau d'autorisation** exactement comme demandé : rôle global (`User`/`Admin`) + `GroupMembershipAuthorizationHandler` vérifiant l'appartenance (et le rôle admin du groupe si requis) sur chaque route scopée à un groupe, appliqué de façon cohérente sur tous les contrôleurs (`Listings`, `Groups`, `Favorites`, `Conversations`). Les actions plus fines (suppression d'annonce, retrait de membre) ajoutent une vérification par propriétaire/permission déléguée en plus de la policy.
- **Validation des entrées** : FluentValidation pour la création d'annonce, validation manuelle systématique (longueurs max, formats) ailleurs.
- **Uploads** : type et taille revérifiés côté serveur (jpeg/png/webp, 5 Mo max) en plus du contrôle client, sur les trois points d'upload (annonces, photo de groupe, photo de profil). Les images sont toujours réencodées côté serveur (`ThumbnailGenerator`) — un fichier malveillant déguisé en image ne peut pas être stocké tel quel. Le nom de fichier stocké est un GUID généré côté serveur (pas de traversée de chemin possible via le nom envoyé par le client).
- **CORS** restreint à une liste explicite d'origines (pas de wildcard), avec credentials.
- **En-têtes de sécurité** ajoutés en plus du strict nécessaire du spec : HSTS en prod, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **Frontend** : aucun `dangerouslySetInnerHTML` dans tout `web/src`.
- **SEO/confidentialité** : `robots.txt` présent, contenu applicatif non indexé, seule la landing statique est SEO-friendly — conforme §10.

---

## 3. Recommandations, par ordre de priorité

1. **Rotation immédiate** de la clé JWT et du mot de passe admin exposés, sortie des secrets du repo (même juste "dev").
2. Partitionner le rate limiter par IP, et l'appliquer à `ListingsController.Create`.
3. Ajouter Vitest + React Testing Library et au moins les deux suites que le spec nomme (formulaire d'annonce, flux d'invitation) — le reste de la couverture peut suivre progressivement.
4. (Optionnel, defense in depth) envisager un lockout de compte après N échecs de connexion, une fois le rate limiting par IP en place.

En dehors de ces points, le projet correspond bien à ce que le spec décrit, et l'exécution technique (auth, autorisation, uploads) est nettement au-dessus de la moyenne pour un projet solo.
