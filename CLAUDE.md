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

## MANDATORY — Before every commit

These steps are NON-NEGOTIABLE. A commit that breaks CI is unacceptable.

1. **Pre-commit hooks** — Run `pre-commit run --all-files`. Fix ALL failures (trailing whitespace, EOF, yamllint, markdownlint, gitleaks, large files, build). Do NOT commit until every hook passes.
2. **Grype SCA scan** — Run `grype dir:. --fail-on high`. If any High or Critical vulnerability is found, fix it (update dependency, add npm override in package.json) BEFORE committing. Medium/Low are acceptable.
3. **Build check** — Run `npx next build` to verify no build errors.

If any of these 3 checks fail, DO NOT commit. Fix the issue first.

## Code conventions

- UI text in French
- API base URL configured via `NEXT_PUBLIC_API_URL` env var (default: http://localhost:4100/api)
- Auth tokens stored in localStorage (htgether_token, htgether_refresh_token, htgether_user)
- Use `ApiError` class for typed API error handling
- Prefer inline styles for onboarding wizard, Tailwind for dashboard components
