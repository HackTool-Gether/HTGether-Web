# CLAUDE.md — HTGether Web

## Stack

- Next.js 16 (App Router) + React 19
- Tailwind CSS v4
- TypeScript
- TipTap v3 (ProseMirror) for rich text editing

## Architecture

- `src/app/` — Pages and layouts (App Router)
- `src/app/dashboard/` — Protected pages (wrapped by AuthGuard)
- `src/app/onboarding/` — Public onboarding wizard
- `src/components/` — Reusable UI components
- `src/lib/api.ts` — All API client functions and types
- `src/lib/auth-context.tsx` — Auth state (JWT tokens, user profile)
- `src/middleware.ts` — Route protection (public paths: /login, /setup, /onboarding)

## Dev commands

- `npm run dev` — Start dev server (port 3000)
- `npx next build` — Production build (also used by pre-commit)

## MANDATORY — Pre-commit checklist (BLOCKING)

**This section is the single most important rule in this file.**
You MUST run ALL 4 checks below before EVERY `git commit`. No exceptions.

```bash
# 1. Pre-commit hooks (linting, secrets, formatting, build)
pre-commit run --all-files

# 2. Grype SCA scan (dependency vulnerabilities)
grype dir:. --fail-on high

# 3. Bearer SAST scan (code-level security issues)
bearer scan . --severity critical,high

# 4. Build check
npx next build
```

**If ANY check fails, DO NOT commit. Fix the issue first, then re-run.**

- Grype High/Critical → update dependency or add npm override in `package.json`
- Bearer Critical/High → fix the flagged code pattern
- Medium/Low from grype or bearer are acceptable
- Pre-commit failures → fix and re-run until all pass

This is not a suggestion — it is a hard gate.

## Code conventions

- UI text in French
- API base URL configured via `NEXT_PUBLIC_API_URL` env var (default: <http://localhost:4100/api>)
- Auth tokens stored in localStorage (htgether_token, htgether_refresh_token, htgether_user)
- Use `ApiError` class for typed API error handling
- Prefer inline styles for onboarding wizard, Tailwind for dashboard components
