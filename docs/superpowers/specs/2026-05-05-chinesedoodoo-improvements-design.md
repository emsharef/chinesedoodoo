# ChineseDuDu — Improvements Design

**Date:** 2026-05-05
**Status:** Approved (sections 1–5)
**Audience scope:** Personal use now, friends/family later. Not a public product.

## Background

ChineseDuDu is a Next.js 16 / React 19 app for learning a target language by reading AI-generated short stories and reviewing tapped vocabulary via FSRS spaced repetition. Originally Chinese-only, now supports `zh-CN`, `zh-TW`, `de`, `it`, `es`. The core loop (generate → read → tap unknowns → rate → review → next story) is sound, but multiple issues make daily use clunky and at least one issue (RLS off on all tables) is exploitable.

The Postgres database is shared with another app in the same Supabase project. **Other-app tables (`babies`, `events`, `invites`, `memberships`, `users`, `baby_invites`) must remain untouched.**

## Goals

1. Stop silent data corruption and close the RLS hole.
2. Make story generation higher-quality and feel responsive (streaming, better calibration, post-generation verification).
3. Make word lookup feel instant for Chinese.
4. Bring the review screen up to Anki/SRS expectations (keyboard, due-count visibility, daily target, example sentences).
5. Make the vocab list usable at scale (search, filter, bulk actions).
6. Polish multi-language UX so non-Chinese learners aren't seeing "HSK" labels.
7. Support both Anthropic and OpenAI models with a per-user runtime switch.

## Non-goals

- Audio / TTS
- Reading streaks, heatmaps, statistics dashboard
- Onboarding wizard beyond a one-time "what are you learning" picker
- Theme switcher (currently dark-only)
- Renaming `chinese_*` tables to language-neutral names
- Auto-generated DB types (`supabase gen types`)
- Sharing / social features
- Importing decks from Anki

## Models

| Provider  | Generation         | Lookup fallback     |
| --------- | ------------------ | ------------------- |
| Anthropic | claude-sonnet-4-6  | claude-haiku-4-5    |
| OpenAI    | gpt-5.4            | gpt-5-mini          |

- Selected per-user via `chinese_profiles.llm_provider` (`'anthropic' | 'openai'`, default `'anthropic'`).
- Settings page exposes the choice next to existing preferences.
- Both provider envs (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) remain in `.env.local` and the Vercel project.

## Architectural notes

- New `lib/llm.ts` — unified vendor-agnostic interface. Slice 2 introduces non-streaming `generateStory()` and `lookupWord()`. Slice 4 adds `generateStoryStream()` alongside.
- New `lib/dictionary/cedict.ts` — server-side CC-CEDICT lookup for Chinese.
- New `lib/levels.ts` — `levelLabel(language, level)` returning HSK or CEFR.
- New `middleware.ts` — Supabase session refresh + auth gating, replacing per-page `getUser()` redirects.
- In Slice 4, story generation moves from server action to Route Handler (`app/api/stories/generate/route.ts`) to support streaming. The empty `app/actions.ts` is deleted in the same slice.
- All other server actions remain colocated with their routes.
- Old `scripts/migrate-*.ts` files are deleted; new migration lives at `supabase/migrations/YYYYMMDDHHMMSS_foundation.sql` (Supabase CLI naming convention).

---

## Slice 1 — Foundation migration

**Outcome:** RLS enabled and policies set; vocab unique key scoped by language; FSRS `lapses` tracked; FKs cascade; `user_id` not nullable.

### Migration SQL

```sql
-- Path: supabase/migrations/<timestamp>_foundation.sql

-- 1. RLS — match the rest of the project
alter table public.chinese_profiles    enable row level security;
alter table public.chinese_stories     enable row level security;
alter table public.chinese_vocab_items enable row level security;
alter table public.chinese_reviews     enable row level security;

create policy "own rows" on public.chinese_profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "own rows" on public.chinese_stories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.chinese_vocab_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.chinese_reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Widen vocab unique key from (user_id, word) to (user_id, word, language)
alter table public.chinese_vocab_items
  drop constraint chinese_vocab_items_user_id_word_key;
alter table public.chinese_vocab_items
  add constraint chinese_vocab_items_user_id_word_lang_key
  unique (user_id, word, language);

-- 3. Add FSRS lapses column
alter table public.chinese_vocab_items
  add column if not exists lapses integer not null default 0;

-- 4. Add llm_provider preference
alter table public.chinese_profiles
  add column if not exists llm_provider text not null default 'anthropic'
  check (llm_provider in ('anthropic', 'openai'));

-- 5. NOT NULL on user_id
alter table public.chinese_stories     alter column user_id set not null;
alter table public.chinese_vocab_items alter column user_id set not null;
alter table public.chinese_reviews     alter column user_id set not null;

-- 6. ON DELETE CASCADE on FKs
alter table public.chinese_stories
  drop constraint chinese_stories_user_id_fkey,
  add  constraint chinese_stories_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.chinese_vocab_items
  drop constraint chinese_vocab_items_user_id_fkey,
  add  constraint chinese_vocab_items_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.chinese_reviews
  drop constraint chinese_reviews_user_id_fkey,
  add  constraint chinese_reviews_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.chinese_reviews
  drop constraint chinese_reviews_vocab_item_id_fkey,
  add  constraint chinese_reviews_vocab_item_id_fkey
  foreign key (vocab_item_id) references chinese_vocab_items(id) on delete cascade;
```

### Pre-flight check (must pass before applying)

```sql
-- Confirm zero NULL user_ids
select 'stories' as t, count(*) from chinese_stories where user_id is null
union all select 'vocab',   count(*) from chinese_vocab_items where user_id is null
union all select 'reviews', count(*) from chinese_reviews where user_id is null;

-- Confirm no (user_id, word, language) duplicates that would block the new constraint
select user_id, word, language, count(*)
from chinese_vocab_items
group by 1,2,3
having count(*) > 1;
```

### App code follow-on

- `app/actions/lookup.ts`: change `onConflict: 'user_id, word'` → `'user_id, word, language'`
- `app/actions/complete-story.ts`: same `onConflict` change
- `app/review/actions.ts`: persist `newCard.lapses` to the new column
- `app/vocabulary/actions.ts`: drop manual delete-reviews-first (FK now cascades)

### Cleanup

- Delete `scripts/migrate-add-debug-mode.ts`, `migrate-add-definition.ts`, `migrate-add-font-size.ts`, `migrate-add-is-read.ts`, `migrate-add-story-rating.ts`, `migrate-multilang.ts`, `setup-db.ts`. Keep the `scripts/` directory; Slice 3 adds `sync-cedict.ts`.

### Verification

- Re-run the diagnostic queries (RLS state, constraint definitions, row counts) before/after; document in commit message.
- Test in browser: log in, generate a story, tap words, complete, review. Confirm flows still work.

---

## Slice 2 — LLM wrapper + model upgrade (no streaming yet)

**Outcome:** Generation and lookup go through `lib/llm.ts`; provider-switchable per user; OpenAI uses `gpt-5.4`; Claude is the default and uses `claude-sonnet-4-6` for generation, `claude-haiku-4-5` for lookup. No streaming yet, no calibration prompt restructure yet, no CC-CEDICT yet.

### `lib/llm.ts` interface

```ts
type Provider = 'anthropic' | 'openai'

export async function generateStory(input: {
  provider: Provider
  systemPrompt: string
  userPrompt: string
}): Promise<{ title: string; content: string; estimated_level: number }>

export async function lookupWord(input: {
  provider: Provider
  word: string
  language: string
}): Promise<{ pinyin?: string; english: string }>
```

### Behavior changes

- `app/actions.ts` and `app/actions/lookup.ts`: replace direct OpenAI calls with `lib/llm.ts` calls.
- Provider determined by reading `chinese_profiles.llm_provider` of the calling user.
- Settings page: add a provider selector (`Anthropic / OpenAI`, default Anthropic) next to language and font-size selectors.
- Vercel deployment: add `ANTHROPIC_API_KEY` to environment variables; update `.agent/workflows/deploy_to_vercel.md` to list it.

### Verification

- Generate a story with each provider, confirm both work.
- Tap an unknown word with each provider, confirm both look up.

---

## Slice 3 — Lookup speed (CC-CEDICT)

**Outcome:** Tapping a Chinese word feels instant in 95%+ of cases.

### Data

- Source: CC-CEDICT, public domain (CC-BY-SA 4.0). Roughly 120k entries, ~7 MB compressed.
- Storage: parsed JSON loaded into server memory once on first lookup. Estimated ~50 MB RAM.
- Refresh script: `scripts/sync-cedict.ts` — downloads, parses, writes a tight binary or JSON file under `lib/dictionary/data/`. Run manually when we want to update.

### Lookup order in `lib/llm.ts → lookupWord()`

1. `chinese_vocab_items` cache (existing) — return immediately if hit.
2. **(Chinese only)** CC-CEDICT — return entry, upsert to `chinese_vocab_items` with `status: 'learning'` if not already present.
3. LLM fallback (provider-specific small model) — same as today.

### Attribution

- Footer or `/about` page mentions CC-CEDICT and links to the source. Required by license.

### Out of scope this slice

- Client-side dictionary (would require shipping ~7 MB to browser; defer).
- Pre-warming definitions during story generation (defer).
- Dictionaries for non-Chinese languages (no comparable open source).

### Verification

- Tap 10 different Chinese words, time the response on the second tap (cache) and on a fresh word (CC-CEDICT). Both should be < 100 ms perceived.
- Tap a word that's unlikely to be in CC-CEDICT (e.g. a name), confirm LLM fallback fires and saves to cache.

---

## Slice 4 — Generation overhaul

**Outcome:** Story generation streams in real-time, uses a calibrated structured prompt, supports free-text input, and verifies that requested review words actually appeared.

### Streaming

- New Route Handler: `app/api/stories/generate/route.ts`
- POST body: `{ genre?, theme?, setting?, length?, freeText? }`
- Returns SSE stream of token deltas; final event includes the persisted `storyId`
- Client (`app/story/new/page.tsx`):
  - Calls the endpoint with `fetch`
  - Reads stream via `response.body.getReader()`
  - Renders title + body progressively
  - On final event, navigates to `/story/[storyId]`
- Persistence: server-side, after stream completes, insert into `chinese_stories` with the assembled content + computed `coverage` and `new_word_count`.

### Calibration prompt restructure

Move from raw past-story text to structured signal. Server-side helper (e.g. `lib/calibration.ts`) computes:

```
USER PROFILE
- Target language: {lang}
- Inferred level: {weighted_median_level}
- Vocab known: {n}
- Vocab learning: {n}: [{words}]
- Recent reading (last 5):
    1. "{title}" — {RATING} (level {n}, {chars} chars, {unknown_count} unknown)
    ...
- Words user didn't know in recent stories: [{words}]

CALIBRATION RULES
- Push above inferred if last 3 ratings ≥ GOOD
- Drop to inferred if last 3 ratings ≤ HARD
- Maintain if mixed
- Prioritize review over new words if learning backlog > 10
```

Inferred level is computed as: weighted median of `(story_difficulty_level + rating_offset)` over the last 5 read stories, where rating_offset is `+1.0` for EASY, `0` for GOOD, `-0.5` for HARD.

### Free-text input

- New textarea on `app/story/new/page.tsx` below the dropdowns: *"Or tell me what to write about."*
- If filled: prompt uses the textarea as the primary directive, dropdowns demoted to weak hints.
- Empty: current dropdown-driven behavior.
- Last selection persisted in `localStorage`; remove the on-mount randomize.

### Post-generation verification

After streaming completes, server-side:

1. Segment the generated content (existing `segmentit` for Chinese, regex for European).
2. Compute review-word coverage: `requested_review_words ∩ present_in_story / requested_review_words`.
3. If coverage < 50%, regenerate **once** with stronger emphasis (no infinite loop).
4. Compute new-word density: words in story not in user's vocab.
5. Persist on `chinese_stories`:
    - Schema add: `review_word_coverage real`, `new_word_count integer`
    - Display these on library card and reader header (e.g. *"4 review words · 7 new"*).

### Length scaling per language

- Chinese: characters (current).
- German/Italian/Spanish: words. Update `lengthMap` in the prompt construction. Update UI labels (`~600 words` instead of `~600 chars`).

### Schema add (small)

```sql
alter table public.chinese_stories
  add column if not exists review_word_coverage real,
  add column if not exists new_word_count integer;
```

### Verification

- Generate 3 stories with different genre/theme/setting combos. Confirm streaming.
- Generate 1 story with free-text "a dog visiting Tokyo". Confirm prompt picked it up.
- Mark a story HARD, generate another, confirm the new prompt drops level.
- Confirm coverage badge appears on library card.

---

## Slice 5 — Polish (review + vocab + library + multi-language + papercuts + middleware)

**Outcome:** the daily-use feel of the app gets dramatically better.

### 5.1 Review screen

- Keyboard shortcuts: `space` (show answer), `1`/`2`/`3`/`4` (Again/Hard/Good/Easy).
- Due-today badge in sidebar + bottom nav: live count of `next_review <= now`.
- Replace 20-card hard cap with daily-target setting (default 30, configurable in settings).
- Header breakdown: *"15 due · 3 new · 2 learning"*.
- Show-answer reveal includes an example sentence pulled from the most recent story containing the word.
- Stability hint below the card: *"Seen {n} times. Last interval: {n} days."*
- Pre-fetch next card's definition on Show Answer reveal.

Schema: no new columns needed (daily target lives on `chinese_profiles`):

```sql
alter table public.chinese_profiles
  add column if not exists daily_review_target integer not null default 30;
```

### 5.2 Vocab list

- Search box (instant client-side filter on word, pinyin, definition).
- Status filter chips (All / New / Learning / Review / Known) with counts.
- Bulk select column + bulk actions: Delete, Mark known, Reset schedule.
- Difficulty display: drop the `* 10` and `%`. Show `D 6.2` numerical or color dot.
- Schedule display: relative (`Due in 3 days`) with absolute on hover.
- Empty state for filters: *"No words match. [Clear filters]"*

### 5.3 Library

- Tabs: All / Unread / Read (defaults Unread when any unread exist, else All).
- Search by title (instant client-side).
- Story-card chips show review-word + new-word counts (from Slice 4).
- Level label per language family (Chinese: HSK; European: CEFR), via `lib/levels.ts`.

### 5.4 Multi-language UX

- `lib/levels.ts` — `levelLabel(language, level)` returning `HSK 3`, `B1`, etc.
- Length unit copy in story generator + library (`chars` vs `words`).
- Empty-state copy uses the language name (`No Italian stories yet`).
- One-time language picker on first dashboard visit when `target_language` is unset (silent if set).

### 5.5 Auth middleware

- New `middleware.ts` — Supabase session refresh + auth gating for protected routes.
- Pages drop their per-page `getUser()` + `redirect('/login')` boilerplate.
- Unauthenticated requests to `/`, `/story/*`, `/review`, `/vocabulary`, `/settings` redirect to `/login`.
- `/login`, `/login/*`, `/auth/callback`, `/error` remain public.

### 5.6 Papercuts (collected)

- Replace `<a href="/">` with `<Link>` (`app/review/page.tsx`).
- Fix or justify `useEffect` dependency warnings (review, vocab list, reader).
- Remove unused imports: `Segment, useDefault` in `app/story/[id]/page.tsx`; `redirect` in `app/settings/actions.ts`; `useEffect`, `Volume2` in `Reader.tsx`.
- Replace `any` types with FSRS-typed `Card` shape in review action and review page.
- Login page surfaces `?message=...` query param instead of swallowing it.
- Story generator persists last selection in `localStorage` (replace on-mount randomize with explicit-click randomize).
- Reader: rate buttons sticky at bottom on mobile; pinyin toggle moves to header button (today they overlap).
- Reader popover dismissed by ESC.
- Library card: reading-time estimate (`~2 min read`).
- Confirm `app/actions.ts` was deleted in Slice 4 (it should be empty after generation moved to a Route Handler). Otherwise relocate any residual exports to `app/story/new/actions.ts`.

### Verification

- Full flow run-through in browser: signup → language pick → generate → read (mobile viewport) → tap → complete → review with keyboard → vocab list → library filter.
- Check the running app's mobile layout in Chrome devtools' device mode.

---

## Risk register

| # | Risk | Likelihood | Mitigation |
|---|------|-----------|----|
| 1 | RLS migration locks user out due to malformed policy | Low | Test against the live account post-migration; rollback SQL prepared in commit |
| 2 | `gpt-5.4` doesn't resolve to a real model | Low-Med | User specified, but I'll smoke-test in Slice 2 before rolling out; if it 404s we fall back to a known-good gpt model |
| 3 | Claude model regresses story quality vs current OpenAI | Med | Per-user provider switch already in design; user can flip back |
| 4 | Streaming via Route Handler proves clunky | Med | Fallback: keep server-action with progress indicator; same model, no streaming |
| 5 | CC-CEDICT memory bloat on Vercel | Low-Med | Lazy-load on first lookup; if cold-start times spike, switch to a tighter binary format |
| 6 | Coverage verification regenerates too often, costs balloon | Low | Cap at 1 retry, then accept whatever the model produced |
| 7 | Other-app tables get accidentally touched | Low | All migrations restricted to `chinese_*`; pre-flight query lists targets explicitly |
| 8 | Middleware breaks the auth callback flow | Med | Whitelist `/auth/callback`, `/login*`, `/error` explicitly; integration-test sign-in immediately after |

## Success criteria

- ✅ All four `chinese_*` tables have RLS enabled with policies; verified via `pg_tables`/`pg_policies`.
- ✅ FSRS `lapses` increment on Again ratings; verified by inspecting the column after a session.
- ✅ Generating a 600-character Chinese story shows progressive text within 1 second of click.
- ✅ Tapping a common Chinese word returns a definition in < 200 ms.
- ✅ Switching `llm_provider` in settings actually changes which model handles the next request (visible in network logs / debug output).
- ✅ Review session works without touching the mouse — `space, 3, space, 3, space, 4` runs through three cards.
- ✅ Vocab list with 161 items remains responsive under search/filter.
- ✅ Generating an Italian story shows "A2" / "B1" labels, not "HSK".
- ✅ Other app's tables (`babies`, `events`, etc.) untouched: row counts unchanged after migration.

## Sequencing

Five slices, each independently shippable. After each slice: I exercise the affected flow in the browser, commit, move on. User can interrupt or test independently at any point.

| # | Slice | Estimate |
|---|-------|--------|
| 1 | Foundation migration | 0.5 day |
| 2 | LLM wrapper + model upgrade | 0.5 day |
| 3 | CC-CEDICT lookup | 1 day |
| 4 | Generation overhaul | 1.5 days |
| 5 | Polish (review + vocab + library + multi-lang + middleware + papercuts) | 1.5 days |
| **Total** | | **~5 days** |
