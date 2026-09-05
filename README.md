# NOVA

Application de communication NOVA avec authentification, messagerie temps réel,
messages vocaux et appels audio WebRTC.

## Développement local

```bash
npm install
npm start
```

Ouvrir http://localhost:3000.

Le centre **Support** propose une FAQ, la recherche, les tickets et les
réponses. Les rôles sont `user`, `support` et `admin`. Configure les comptes
support dans `NOVA_SUPPORT_USERS` au format `pseudo:role`.

## Application Windows

Le client Tauri réutilise `public/` et se connecte au backend distant via
HTTPS/WSS en production.

```bash
npm run tauri:dev
npm run tauri:build
```

Les installateurs Windows (`.msi`/`.exe`) sont générés dans
`src-tauri/target/release/bundle/`. Des icônes Windows valides doivent être
ajoutées dans `src-tauri/icons/` avant une distribution finale.

## Déploiement Render gratuit

Le fichier [render.yaml](./render.yaml) configure automatiquement un Web
Service gratuit Node.js :

- Build : `npm install`
- Start : `npm start`
- Health check : `/api/status`
- WebSocket : même domaine HTTPS via `wss://`
- `SESSION_SECRET` généré automatiquement par Render

Dans Render : **New + → Blueprint** → sélectionner
`anormadaise2-ops/NOVA` → appliquer `render.yaml`. Renseigner seulement
`NOVA_SUPPORT_USERS` si des comptes support/admin sont nécessaires.

Render fournira une URL de type `https://nova-xxxx.onrender.com`. Un domaine
personnalisé peut ensuite être ajouté dans **Settings → Custom Domains**.

Important : le stockage `data/database.json` et `data/voices/` n'est pas
persistent sur l'offre gratuite. Prévoir PostgreSQL et un stockage objet pour
la production.

`data/database.json` et `data/voices/` sont adaptés au développement local.
Pour la production, remplacer ces stockages par une base persistante et un
stockage objet.

## Structure

- `server.js` : Express, sessions, WebSocket, support et stockage local.
- `public/index.html` : interface NOVA web/desktop partagée.
- `data/database.json` : données locales de développement.
- `src-tauri/` : enveloppe Windows Tauri.

## GitHub

```bash
git init
git add .
git commit -m "NOVA initial release"
git branch -M main
git remote add origin https://github.com/anormadaise2-ops/NOVA.git
git push -u origin main
```
