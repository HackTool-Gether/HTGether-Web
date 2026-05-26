# HTGether-Web

Frontend de **HTGether**, plateforme collaborative de pentest.
Interface de gestion de projets d'audit, editeur de findings,
rapports avec templates, chat temps reel et assistance IA.

## 1. Presentation

- **Framework** : Next.js 16 (App Router)
- **UI** : React 19 + Tailwind CSS v4
- **Editeur** : TipTap v3 (ProseMirror), contenu stocke en JSON
- **Temps reel** : Socket.IO (messagerie, presence en ligne)
- **Theming** : CSS custom properties, mode clair/sombre
- **Langage** : TypeScript

### Fonctionnalites principales

| Feature | Description |
| --- | --- |
| **Dashboard** | Statistiques et activite recente |
| **Projets** | CRUD, membres, roles, invitations |
| **Findings** | Editeur riche, CVSS, severite, statut |
| **Scopes** | Perimetres d'audit, composants, notes |
| **Rapports** | Sections editables, templates, export PDF |
| **Chat** | Messagerie temps reel par projet |
| **Kanban** | Gestion des taches par projet |
| **IA** | Reformulation/generation multi-provider |
| **Palette** | Commande rapide (Ctrl+K) |

## 2. Installation et lancement

### Prerequis

- Docker + Docker Compose (recommande)
- Ou Node.js 20+ (pour le developpement local)
- L'API HTGether-API doit tourner (`http://localhost:4000`)

### Lancement rapide (Docker)

```bash
docker compose up -d    # frontend sur http://localhost:3000
```

Par defaut l'API est attendue sur `http://localhost:4000/api`.
Pour changer, modifier le `build.args` dans `docker-compose.yml`.

### Developpement local

```bash
npm ci

# Creer le fichier de configuration
echo 'NEXT_PUBLIC_API_URL=http://localhost:4000/api' > .env.local

# Lancer le serveur de dev
npm run dev     # http://localhost:3000
```

### Commandes utiles

```bash
npm run dev        # Dev server (hot reload)
npm run build      # Build production
npm run lint       # ESLint
npx tsc --noEmit   # Type-check
```

### Premier lancement

1. Acceder a `http://localhost:3000`
2. L'application redirige vers `/setup` (compte super admin)
3. Puis `/onboarding` (entreprise, auth, IA)

## 3. Pipeline DevSecOps

Chaque commit passe par **4 couches de verification** avant
d'etre pousse, plus **4 workflows GitHub Actions** en CI.

### Checks locaux (obligatoires avant commit)

```bash
pre-commit run --all-files              # 1. Hooks de qualite
grype dir:. --fail-on high              # 2. SCA (dependances)
bearer scan . --severity critical,high  # 3. SAST (code)
npx next build                          # 4. Build
```

### Pre-commit hooks

Installation : `pip install pre-commit && pre-commit install`

| Hook | Role |
| --- | --- |
| `trailing-whitespace` | Espaces en fin de ligne |
| `end-of-file-fixer` | Newline en fin de fichier |
| `check-yaml` / `check-json` | Valide la syntaxe |
| `check-added-large-files` | Bloque fichiers > 500 Ko |
| `check-merge-conflict` | Marqueurs de conflit |
| `detect-private-key` | Cles privees commitees |
| `gitleaks` | Secrets dans le code |
| `yamllint` / `markdownlint` | Lint YAML et Markdown |
| `build-app` | Verifie que `npm run build` passe |

### GitHub Actions

| Workflow | Declencheur | Description |
| --- | --- | --- |
| `ci.yml` | Push `main`/`develop`, PR | Lint, type-check, build |
| `pre-commit.yml` | Push, PR | Hooks pre-commit |
| `security-scan.yml` | Push `main`, PR | SCA Grype (fail High+) |
| `bearer.yml` | Push `main`, PR | SAST Bearer (fail High+) |

### Outils de securite

| Outil | Type | Cible | Seuil |
| --- | --- | --- | --- |
| **Grype** | SCA | Dependances npm (CVE/GHSA) | High |
| **Bearer** | SAST | Code source (XSS, injection) | High |
| **Gitleaks** | Secrets | Commits (cles, tokens) | Tout |
| **ESLint** | Lint | TypeScript/React | Error |

### Faux positifs

Les faux positifs Bearer sont documentes dans `bearer.ignore`
avec justification. Les `dangerouslySetInnerHTML` des avatars
utilisent des SVG generes cote client a partir de seeds
deterministes, pas d'input utilisateur.
