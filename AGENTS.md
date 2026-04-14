# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

McChicken Index — a Next.js 15 (App Router) web app tracking the average US McChicken price as an economic indicator. Single service: Next.js handles both frontend and API routes. No local database required; uses Upstash Redis over REST with static/file-based fallbacks when env vars are absent.

### Running the app

- `npm run dev` starts the dev server on port 3000.
- The app works **without** Redis or OpenAI credentials — API routes fall back to static data from `lib/mcchicken.ts` and `data/price-history.json`.
- If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in `.env`, live Redis data will be used.

### Lint / Build / Test

- **Lint:** `npm run lint` — uses `next lint` with `eslint-config-next` (flat config in `eslint.config.mjs`). Expect non-blocking warnings in `components/LineChart.tsx` (react-hooks/exhaustive-deps).
- **Build:** `npm run build` — production build; also runs TypeScript type checking.
- **No automated test suite** exists in this repo. Validation is done via build + lint + manual browser testing.

### Environment variables

See `.env.example`. Copy to `.env` for local dev. All are optional for basic dashboard functionality:
- `OPENAI_API_KEY` — only needed for the cron job (`/api/cron/mcchicken-update`) and seed script.
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — for live data; app falls back gracefully without them.
- `CRON_SECRET` — for authenticating the cron endpoint.

### Key caveats

- ESLint and `eslint-config-next` are installed as devDependencies but are **not** in the committed `package.json` — they were added during environment setup. If missing, run `npm install --save-dev eslint eslint-config-next @eslint/compat`.
- The `eslint.config.mjs` flat config file was also added during setup. If `npm run lint` fails with config errors, ensure this file exists.
- `next lint` shows a deprecation notice (will be removed in Next.js 16). This is informational only.
