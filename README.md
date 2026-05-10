# HTGether-Web

Frontend web pour HTGether — plateforme collaborative de pentest.

## Stack

- **Framework** : Next.js 16 (App Router)
- **UI** : React 19 + Tailwind CSS v4
- **Editeur** : TipTap v3 (ProseMirror) avec stockage JSON
- **Langage** : TypeScript

## Lancement

```bash
npm ci
cp .env.example .env.local   # adapter les variables
npm run dev
```

Le serveur ecoute sur `http://localhost:3002` par defaut.

## Pipeline CI/CD

### Pre-commit hooks

Le projet utilise [pre-commit](https://pre-commit.com/) pour executer des
verifications automatiques avant chaque commit.

Installation :

```bash
pip install pre-commit
pre-commit install
```

Hooks configures (`.pre-commit-config.yaml`) :

| Hook | Role |
| --- | --- |
| `trailing-whitespace` | Supprime les espaces en fin de ligne |
| `end-of-file-fixer` | Assure un newline en fin de fichier |
| `check-yaml` | Valide la syntaxe YAML |
| `check-json` | Valide la syntaxe JSON |
| `check-added-large-files` | Bloque les fichiers > 500 Ko |
| `check-merge-conflict` | Detecte les marqueurs de conflit |
| `detect-private-key` | Bloque les cles privees commitees |
| `check-case-conflict` | Detecte les conflits de casse |
| `mixed-line-ending` | Force LF |
| `gitleaks` | Scanne les secrets dans le code |
| `yamllint` | Lint YAML |
| `markdownlint` | Lint + fix Markdown |
| `shellcheck` | Lint scripts shell |
| `build-app` | Verifie que `npm run build` passe |

### GitHub Actions

Deux workflows dans `.github/workflows/` :

- **`pre-commit.yml`** — Execute les hooks pre-commit sur chaque push et PR.
- **`security-scan.yml`** — Analyse SCA avec
  [Grype](https://github.com/anchore/grype) sur push `main` et PR.
  Echoue si une vulnerabilite High+ est detectee.

### SCA (Software Composition Analysis)

Grype scanne les dependances a la recherche de vulnerabilites connues (CVE/GHSA).

Execution locale :

```bash
grype dir:.
```

Derniere analyse (2026-05-08) :

| Dependance | Version | Fix | Severite | GHSA |
| --- | --- | --- | --- | --- |
| next | 16.1.6 | 16.2.3 | High | GHSA-q4gf-8mx6-v5v3 |
| path-to-regexp | 8.3.0 | 8.4.0 | High | GHSA-j3q9-mxjg-w52f |
| picomatch | 2.3.1 | 2.3.2 | High | GHSA-c2c7-rcm5-vvqj |
| picomatch | 4.0.3 | 4.0.4 | High | GHSA-c2c7-rcm5-vvqj |
| next | 16.1.6 | 16.1.7 | Medium | GHSA-ggv3-7p47-pfv8 |
| next | 16.1.6 | 16.1.7 | Medium | GHSA-3x4c-7xq6-9pq8 |
| next | 16.1.6 | 16.1.7 | Medium | GHSA-h27x-g6w4-24gq |
| next | 16.1.6 | 16.1.7 | Medium | GHSA-mq59-m269-xvcx |
| postcss | 8.4.31 / 8.5.8 | 8.5.10 | Medium | GHSA-qx2v-qp2m-jg93 |
| hono | 4.12.8 | 4.12.12 | Medium | GHSA-r5rp-j6wh-rvv4 |
| hono | 4.12.8 | 4.12.12 | Medium | GHSA-wmmm-f939-6g9c |
| hono | 4.12.8 | 4.12.12 | Medium | GHSA-xf4j-xp2r-rqqx |
| hono | 4.12.8 | 4.12.12 | Medium | GHSA-xpcf-pg52-r92g |
| hono | 4.12.8 | 4.12.12 | Medium | GHSA-26pp-8wgv-hjvm |
| hono | 4.12.8 | 4.12.14 | Medium | GHSA-458j-xx4x-4375 |
| hono | 4.12.8 | 4.12.16 | Medium | GHSA-69xw-7hcm-h432 |
| hono | 4.12.8 | 4.12.16 | Medium | GHSA-9vqf-7f2p-gf9v |
| @hono/node-server | 1.19.11 | 1.19.13 | Medium | GHSA-92pp-h63x-v22m |
| brace-expansion | 5.0.4 | 5.0.5 | Medium | GHSA-f886-m6hf-6m8v |
| picomatch | 2.3.1 / 4.0.3 | 2.3.2 / 4.0.4 | Medium | GHSA-3v7f-55p6-f55p |
| path-to-regexp | 8.3.0 | 8.4.0 | Medium | GHSA-27v5-c462-wpq7 |
| ip-address | 10.1.0 | 10.1.1 | Medium | GHSA-v2v4-37r5-5v8g |
| next | 16.1.6 | 16.1.7 | Low | GHSA-jcc7-9wpm-mj36 |
