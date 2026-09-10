# Landing page publique

Page d'accueil publique, statique (HTML/CSS pur, pas de build nécessaire), pré-rendue
pour le référencement (spec §10, SEO). Séparée de la SPA authentifiée (`web/`), qui
reste marquée `noindex` (voir `web/index.html` et `web/public/robots.txt`).

## Lancer en local

```bash
cd landing
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## Avant déploiement

Les boutons "Créer un compte" / "Connexion" pointent vers un domaine d'exemple
(`https://app.petites-annonces.example`) — à remplacer par l'URL réelle de la SPA une
fois hébergée (Phase 8). De même pour `<link rel="canonical">` dans `index.html` et les
URLs dans `robots.txt`/`sitemap.xml`, à adapter au domaine réel de la landing.

## Fichiers

- `index.html` / `styles.css` — la page elle-même, même charte visuelle que l'app
  (`web/src/index.css`).
- `robots.txt` — autorise l'indexation (à l'inverse de celui de `web/`, qui la bloque).
- `sitemap.xml` — un seul URL (la page elle-même) ; à étoffer si d'autres pages
  publiques s'ajoutent plus tard.
