# Emberchain

PWA React/Vite du prototype Emberchain Auto-Battle.

## Développement

```bash
pnpm install
pnpm dev
```

Le serveur local utilise la racine `/`. Le build de production cible automatiquement `/emberchain/` pour GitHub Pages.

## Vérifications

```bash
pnpm test
pnpm build
```

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) construit et déploie le dossier `dist` sur GitHub Pages.

URL publique : https://brunodal.github.io/emberchain/

## Installation sur iPhone

Ouvre l’URL dans Safari, touche le bouton Partager, puis « Sur l’écran d’accueil ». L’application s’ouvrira ensuite comme une PWA, y compris hors connexion après une première visite.
