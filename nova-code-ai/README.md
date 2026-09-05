# NOVA Code AI

Extension VS Code multi-provider pour Ollama local et les endpoints
compatibles OpenAI.

## Installation

```bash
cd nova-code-ai
npm install
npm run compile
code --install-extension nova-code-ai-0.1.0.vsix
```

## Ollama

Installer Ollama, lancer son service local, puis installer au moins un modèle :

```bash
ollama pull qwen3
```

Dans VS Code : `NOVA: Manage AI Providers` → `Add Provider` → `ollama`.
L’URL par défaut est `http://127.0.0.1:11434`. Les modèles sont détectés avec
`/api/tags`; aucun modèle n’est supposé installé.

## Providers personnalisés

Ajoutez plusieurs providers avec un nom, un type, une URL, un modèle et une
clé API. Les clés sont enregistrées uniquement dans `context.secrets`
(SecretStorage VS Code). Elles ne sont jamais écrites dans `settings.json`,
le projet ou les logs.

## Commandes

- `NOVA: Open Chat`
- `NOVA: Explain Code`
- `NOVA: Fix Error`
- `NOVA: Generate Code`
- `NOVA: Improve Code`
- `NOVA: Generate Tests`
- `NOVA: Explain Project`
- `NOVA: Analyze Problems`
- `NOVA: Explain Terminal Error`
- `NOVA: Manage AI Providers`
- `NOVA: Select Provider`
- `NOVA: Select Model`
- `NOVA: Check AI Connection`

Les commandes d’analyse ouvrent une réponse dans un nouvel éditeur et
n’écrivent jamais silencieusement dans les fichiers. Les commandes terminal ne
les exécutent pas automatiquement.

## Contexte et confidentialité

Le contexte est limité au fichier courant et à un petit ensemble de fichiers
de code liés. `node_modules`, `.git`, `dist`, `build`, `.env`, secrets et
credentials sont exclus. Le Webview utilise une CSP avec nonce et ne reçoit
jamais les clés API.

## Modes et réglages

Les réglages `nova.beginnerMode`, `nova.developerMode`, `nova.streaming`,
`nova.automaticContext`, `nova.contextLimit`, `nova.automaticFallback`,
`nova.ignoredFolders` et `nova.ollamaUrl` sont disponibles dans les paramètres
VS Code. Le fallback automatique payant est désactivé par défaut.

## Build

```bash
npm run compile
npm run watch
npm run package
```

Le dernier script produit `nova-code-ai-x.y.z.vsix`.

## Architecture

`AIProvider` est l’interface commune. `OllamaProvider` et
`OpenAICompatibleProvider` sont interchangeables via `ProviderManager`.
L’architecture permet d’ajouter Anthropic, Google, Azure ou un provider local
sans modifier les commandes principales.
