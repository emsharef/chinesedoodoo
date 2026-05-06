# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Next.js dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — run the built app
- `npm run lint` — ESLint (uses `eslint-config-next`, flat config in `eslint.config.mjs`)

There is no test suite.

### Database migrations

Migrations are one-off TypeScript scripts in `scripts/`, not a managed framework. Each script:
- loads `.env.local` manually with `dotenv`
- connects via `SUPABASE_DB_URL` (the pooled Postgres URL — only used locally, not by the deployed app)
- runs idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` SQL

There is no npm script for them. Run individually with `ts-node` (an ESM-aware runner is needed because the scripts use `import.meta.url`), e.g. `npx ts-node --esm scripts/migrate-multilang.ts`. `scripts/setup-db.ts` creates the initial schema; the remaining `migrate-*.ts` scripts each add one column/feature and should be run in chronological order if rebuilding a database from scratch.

When adding a schema change, write a new `migrate-*.ts` following the existing pattern rather than editing prior ones.

## Architecture

ChineseDuDu (中文读读) is a Next.js 16 / React 19 app for learning a target language by reading AI-generated short stories. Originally Chinese-only — the `chinese_*` table prefix and many file/component names predate multi-language support and now also serve `zh-TW`, `de`, `it`, `es`. Don't rename the tables; do branch on `language` in any new code.

### Stack

- Next.js App Router with **server actions** doing all auth, DB, and OpenAI work. There are no API routes.
- Supabase (`@supabase/ssr`) for auth + Postgres. Two clients: `utils/supabase/server.ts` (cookie-based, for server components / actions) and `utils/supabase/client.ts` (browser).
- OpenAI SDK directly. Models: `gpt-5.1` for story generation (`app/actions.ts`), `gpt-5-mini` for word lookup (`app/actions/lookup.ts`).
- `fsrs.js` for spaced-repetition scheduling of vocab cards.
- `segmentit` for Chinese word segmentation; `pinyin-pro` for pinyin in the reader. Non-Chinese languages are split with a regex in `app/story/[id]/page.tsx`.
- Tailwind v4 with a custom `retro-*` color palette in `tailwind.config.ts` (`retro-bg`, `retro-paper`, `retro-primary`, etc.). Use these tokens — components don't use raw hex colors.
- Path alias `@/*` → repo root.

### Data model

Four user-scoped tables, all prefixed `chinese_`:
- `chinese_profiles` — `id` (= `auth.users.id`), `target_language`, `font_size`, `debug_mode`, plus older fields (`hsk_level`, `pinyin_preference`, `script_preference`).
- `chinese_stories` — generated stories. Tracks `is_read`, `read_at`, `difficulty_rating` (`easy`/`good`/`hard`), `difficulty_level` (1–6), `language`, and `debug_prompt` (full LLM prompt, populated only when the user has `debug_mode`).
- `chinese_vocab_items` — per-user words. `status ∈ {new, learning, review, relearning, known}`, FSRS fields (`stability`, `difficulty`, `repetition_count`, `last_review`, `next_review`), cached `pinyin` + `definition`. Unique on `(user_id, word)` — note this constraint does **not** include `language`, which can cause collisions across languages and is a known caveat (see `app/actions/lookup.ts` and `complete-story.ts`).
- `chinese_reviews` — append-only log of FSRS ratings (1=Again … 4=Easy).

Most queries are filtered by both `user_id` and `language` (the active `target_language` from the user's profile). When adding queries, follow this pattern.

### Core flows

- **Story generation** (`app/actions.ts → generateStory`): pulls vocab count, last 3 read stories with their ratings, the user's "difficult words" (low FSRS stability), and the set of non-known words actually present in recent stories. The LLM prompt instructs the model to calibrate up/down based on those past ratings rather than a fixed level. New users (<20 known words) get a beginner-level prompt instead. The full prompt is stored on the story when `debug_mode` is on.
- **Reader** (`components/Reader.tsx` + `app/story/[id]/page.tsx`): server component segments the text (Chinese via `segmentit`, others via regex), passes segments to the client `Reader`. Tapping a segment calls `lookupWord` which checks the vocab table first, falls back to OpenAI, and upserts the result with `status: 'learning'`. Pinyin is only rendered for `zh-CN`/`zh-TW`. Marking a story complete adds **every** word to the vocab table with `status: 'known'` and `stability: 1.0`, then redirects home.
- **Review** (`app/review/`): `getDueCards` fetches up to 20 items where `next_review <= now` or `next_review IS NULL`. `submitReview` reconstructs an FSRS `Card`, calls `fsrs.repeat(...)`, picks the scheduling result for the rating, and writes back the new state + a row to `chinese_reviews`.

### Layout

`app/layout.tsx` mounts a persistent `Sidebar` (desktop), `MobileHeader`, and `BottomNav` around the routed page. Most pages assume an authenticated user and `redirect('/login')` when there isn't one — keep that pattern.

### Environment

Runtime env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`. `SUPABASE_DB_URL` is for migrations only and must not be referenced from app code. Deployment guide for Vercel lives at `.agent/workflows/deploy_to_vercel.md`.
