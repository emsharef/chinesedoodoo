# Slice 1 — Foundation Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable RLS on the four `chinese_*` tables, scope vocab unique key by language, add FSRS lapses tracking, cascade FKs, and fix the `markStoryAsRead` bug that resets review schedules for tapped words.

**Architecture:** One SQL migration file applied via psql, plus four small server-action edits. No new abstractions; all changes are constraint/column tweaks plus minor code adjustments to match.

**Tech Stack:** Postgres (Supabase), Next.js server actions (`@supabase/ssr`), psql 17, FSRS.js.

**Spec:** `docs/superpowers/specs/2026-05-05-chinesedoodoo-improvements-design.md` — Slice 1.

**Hard constraint:** Do not touch the other app's tables (`babies`, `baby_invites`, `events`, `invites`, `memberships`, `users`). All migration steps must be explicitly scoped to `chinese_*`.

---

## File Structure

**Create:**
- `supabase/migrations/<TIMESTAMP>_foundation.sql` — the migration. Filename uses `date +%Y%m%d%H%M%S`.

**Modify:**
- `app/actions/lookup.ts` — change `onConflict` value.
- `app/actions/complete-story.ts` — change `onConflict`, add `ignoreDuplicates: true` to preserve tapped-word state.
- `app/review/actions.ts` — persist `newCard.lapses` to the new column.
- `app/vocabulary/actions.ts` — drop the manual delete-reviews-first call (FK now cascades).

**Delete:**
- `scripts/migrate-add-debug-mode.ts`
- `scripts/migrate-add-definition.ts`
- `scripts/migrate-add-font-size.ts`
- `scripts/migrate-add-is-read.ts`
- `scripts/migrate-add-story-rating.ts`
- `scripts/migrate-multilang.ts`
- `scripts/setup-db.ts`

---

## Task 1: Pre-flight verification

**Files:** none (read-only DB queries).

This task confirms the database is in the expected state before we change anything. **If anything fails, stop and investigate — do not proceed.**

- [ ] **Step 1: Connect to the database and run pre-flight queries**

Run this from the repo root:

```bash
set -a && source .env.local && set +a && psql "$SUPABASE_DB_URL" <<'SQL'
\echo '=== Expected: 0 rows for each ==='
select 'stories'  as t, count(*) from chinese_stories     where user_id is null
union all
select 'vocab',      count(*) from chinese_vocab_items where user_id is null
union all
select 'reviews',    count(*) from chinese_reviews     where user_id is null;

\echo ''
\echo '=== Expected: 0 rows (no duplicates that would block the new constraint) ==='
select user_id, word, language, count(*)
from chinese_vocab_items
group by 1, 2, 3
having count(*) > 1;

\echo ''
\echo '=== Confirm we are NOT about to touch the other app tables ==='
select tablename from pg_tables where schemaname = 'public' order by tablename;

\echo ''
\echo '=== Snapshot row counts (will compare after migration) ==='
select 'chinese_profiles' as t, count(*) from chinese_profiles
union all select 'chinese_stories',     count(*) from chinese_stories
union all select 'chinese_vocab_items', count(*) from chinese_vocab_items
union all select 'chinese_reviews',     count(*) from chinese_reviews
union all select 'babies',              count(*) from babies
union all select 'events',              count(*) from events
union all select 'invites',             count(*) from invites
union all select 'memberships',         count(*) from memberships
union all select 'baby_invites',        count(*) from baby_invites
union all select 'users',               count(*) from users
order by 1;
SQL
```

Expected:
- First two queries: 0 rows each.
- Tables list contains both the chinese_* and the other-app tables.
- Snapshot is captured (we'll compare after migration).

If any pre-flight check fails, **stop**. Investigate before proceeding.

- [ ] **Step 2: Capture row-count snapshot for the post-migration diff**

Save the snapshot from Step 1 somewhere temporary (a comment in the next commit message works — we'll diff it after migration).

---

## Task 2: Delete obsolete migration scripts

**Files:** delete listed under "File Structure" → "Delete".

- [ ] **Step 1: Delete the seven obsolete `scripts/migrate-*.ts` and `scripts/setup-db.ts` files**

```bash
git rm scripts/migrate-add-debug-mode.ts \
       scripts/migrate-add-definition.ts \
       scripts/migrate-add-font-size.ts \
       scripts/migrate-add-is-read.ts \
       scripts/migrate-add-story-rating.ts \
       scripts/migrate-multilang.ts \
       scripts/setup-db.ts
```

- [ ] **Step 2: Verify `scripts/` is now empty**

```bash
ls scripts/
```

Expected: empty output (directory exists but no files).

- [ ] **Step 3: Confirm CLAUDE.md still mentions the migration approach correctly**

Skim `CLAUDE.md` for the database migrations section — if it still references the deleted scripts as the canonical pattern, plan to update it in a later task. (Don't edit yet; we'll do all CLAUDE.md updates in one place at the end.)

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore: Delete obsolete one-off migration scripts

The chinese_* schema is now managed via supabase/migrations/*.sql.
The old scripts/migrate-*.ts files used a non-orchestrated ad-hoc
pattern and were never re-runnable as a unit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Write the foundation migration SQL

**Files:**
- Create: `supabase/migrations/<TIMESTAMP>_foundation.sql`

- [ ] **Step 1: Generate the timestamp**

```bash
TS=$(date +%Y%m%d%H%M%S) && echo "$TS"
```

Use this exact value as the filename prefix in the next step.

- [ ] **Step 2: Create `supabase/migrations/<TIMESTAMP>_foundation.sql`**

Write this exact content:

```sql
-- Slice 1 foundation migration
-- - Enables RLS + adds "own rows" policies on the four chinese_* tables
-- - Widens the vocab unique constraint to (user_id, word, language)
-- - Adds chinese_vocab_items.lapses for FSRS lapse tracking
-- - Adds chinese_profiles.llm_provider for the per-user model selector
-- - Enforces NOT NULL on user_id
-- - Adds ON DELETE CASCADE to FKs
--
-- Other-app tables (babies, baby_invites, events, invites, memberships, users)
-- are NOT touched. Every statement is scoped to chinese_* explicitly.

begin;

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

-- 4. Add llm_provider preference (used by Slice 2)
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
       foreign key (vocab_item_id) references public.chinese_vocab_items(id) on delete cascade;

commit;
```

The `begin; ... commit;` wrap means the entire migration is atomic — if any statement fails, nothing is applied.

---

## Task 4: Apply the migration

**Files:** none (executes the SQL written in Task 3).

- [ ] **Step 1: Apply the migration**

```bash
set -a && source .env.local && set +a && \
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<TIMESTAMP>_foundation.sql
```

Replace `<TIMESTAMP>` with the actual filename you created. The `-v ON_ERROR_STOP=1` flag halts on the first error — if anything goes wrong, the transaction rolls back.

Expected output: a series of `ALTER TABLE`, `CREATE POLICY`, `COMMIT` lines, no errors.

- [ ] **Step 2: If the migration fails, investigate before re-running**

If you see an error, do **not** re-run blindly. The most likely failure modes:
- **`constraint "chinese_vocab_items_user_id_word_key" does not exist`** — somebody already dropped it. Check `\d chinese_vocab_items` in psql; the new constraint may already exist. Review the actual schema state before deciding.
- **`violates check constraint`** — only relevant for `llm_provider`. Won't happen on a fresh column with a default.
- **`column "lapses" already exists`** — partial prior run. The migration uses `IF NOT EXISTS`, so this shouldn't fire; if it does, the schema is in a non-pristine state and needs manual reconciliation.

Stop and ask the user before doing anything destructive in response to an error.

---

## Task 5: Post-migration verification

**Files:** none (read-only DB queries).

- [ ] **Step 1: Verify all expected schema changes landed**

```bash
set -a && source .env.local && set +a && psql "$SUPABASE_DB_URL" <<'SQL'
\echo '=== RLS now enabled on chinese_* (expected: t for all four) ==='
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename like 'chinese_%'
order by tablename;

\echo ''
\echo '=== Policies created (expected: 4 rows, one per table) ==='
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename like 'chinese_%'
order by tablename;

\echo ''
\echo '=== Vocab unique constraint widened (expected: includes language) ==='
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.chinese_vocab_items'::regclass and contype = 'u';

\echo ''
\echo '=== New columns present ==='
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'chinese_vocab_items' and column_name = 'lapses')
    or (table_name = 'chinese_profiles'    and column_name = 'llm_provider'));

\echo ''
\echo '=== FK cascades in place (expected: all four chinese_* FKs say "ON DELETE CASCADE") ==='
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in (
    'public.chinese_stories'::regclass,
    'public.chinese_vocab_items'::regclass,
    'public.chinese_reviews'::regclass)
  and contype = 'f'
order by 1, 2;

\echo ''
\echo '=== Row counts unchanged (compare to Task 1 snapshot) ==='
select 'chinese_profiles' as t, count(*) from chinese_profiles
union all select 'chinese_stories',     count(*) from chinese_stories
union all select 'chinese_vocab_items', count(*) from chinese_vocab_items
union all select 'chinese_reviews',     count(*) from chinese_reviews
union all select 'babies',              count(*) from babies
union all select 'events',              count(*) from events
union all select 'invites',             count(*) from invites
union all select 'memberships',         count(*) from memberships
union all select 'baby_invites',        count(*) from baby_invites
union all select 'users',               count(*) from users
order by 1;
SQL
```

Expected:
- All four `chinese_*` tables show `rowsecurity = t`.
- Four `policies` rows, one per table, command `ALL`.
- Vocab unique constraint definition contains `(user_id, word, language)`.
- `chinese_vocab_items.lapses` exists with default `0`.
- `chinese_profiles.llm_provider` exists with default `'anthropic'::text`.
- All four chinese_* FKs end with `ON DELETE CASCADE`.
- Row counts in chinese_* match Task 1 snapshot exactly.
- **Row counts in other-app tables (babies, events, invites, memberships, baby_invites, users) match Task 1 snapshot exactly.**

If any check fails, stop and investigate.

- [ ] **Step 2: Commit the migration file**

```bash
git add supabase/migrations/
git commit -m "$(cat <<'EOF'
feat(db): Foundation migration — RLS, FSRS lapses, FK cascades

- Enable RLS on chinese_profiles/stories/vocab_items/reviews with
  "own rows" policies. Closes the data-exposure hole; matches the
  posture of the other tables in the shared Supabase project.
- Widen chinese_vocab_items unique constraint to include language so
  identical word strings don't collide across target languages.
- Add chinese_vocab_items.lapses for FSRS lapse tracking.
- Add chinese_profiles.llm_provider for Slice 2's per-user model
  selector (default 'anthropic').
- NOT NULL on user_id where it was loose.
- ON DELETE CASCADE on FKs to auth.users and chinese_vocab_items.

No data is transformed; only constraints/policies/columns change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update `app/actions/lookup.ts` for the new unique key

**Files:**
- Modify: `app/actions/lookup.ts:51-59`

- [ ] **Step 1: Read the current file to confirm the line range**

```bash
grep -n onConflict app/actions/lookup.ts
```

Expected: a line ending `onConflict: 'user_id, word' })`.

- [ ] **Step 2: Update the `onConflict` value and remove the stale comment**

Find this in `app/actions/lookup.ts`:

```ts
    await supabase.from('chinese_vocab_items').upsert({
        user_id: user.id,
        word,
        pinyin: result.pinyin,
        definition: result.english,
        language: language,
        status: 'learning',
        next_review: new Date().toISOString()
    }, { onConflict: 'user_id, word' }) // Note: Using existing constraint for now
```

Replace with:

```ts
    await supabase.from('chinese_vocab_items').upsert({
        user_id: user.id,
        word,
        pinyin: result.pinyin,
        definition: result.english,
        language: language,
        status: 'learning',
        next_review: new Date().toISOString()
    }, { onConflict: 'user_id, word, language' })
```

(Two changes: `onConflict` value, remove the trailing comment.)

---

## Task 7: Update `app/actions/complete-story.ts` for new key + preserve tapped words

**Files:**
- Modify: `app/actions/complete-story.ts:39`

This task is the most important one in the slice. The current code resets the FSRS schedule of every word the user previously tapped. We fix it by adding `ignoreDuplicates: true` so existing rows are not touched on conflict.

- [ ] **Step 1: Read the current file to confirm the line range**

```bash
grep -n upsert app/actions/complete-story.ts
```

Expected: one line containing `chinese_vocab_items` and `onConflict`.

- [ ] **Step 2: Update the `upsert` options**

Find this in `app/actions/complete-story.ts`:

```ts
        await supabase.from('chinese_vocab_items').upsert(updates, { onConflict: 'user_id, word' })
```

Replace with:

```ts
        // Only INSERT new rows. Words already in vocab (status='learning' from a prior
        // tap, or already 'known' from a previous complete) are NOT touched — completing
        // a story must not reset their FSRS schedule.
        await supabase.from('chinese_vocab_items').upsert(updates, {
            onConflict: 'user_id, word, language',
            ignoreDuplicates: true,
        })
```

The two-line comment explains *why* — non-obvious from the code, easy to regress later.

---

## Task 8: Persist FSRS `lapses` on review submission

**Files:**
- Modify: `app/review/actions.ts:70-79`

- [ ] **Step 1: Read the current file**

```bash
sed -n '40,90p' app/review/actions.ts
```

Confirm the `submitReview` function exists with the FSRS update block.

- [ ] **Step 2: Add `lapses` to the FSRS card construction and to the DB update**

In `app/review/actions.ts`, find:

```ts
    // Construct FSRS Card object
    const card: Card = {
        due: item.next_review ? new Date(item.next_review) : new Date(),
        stability: item.stability,
        difficulty: item.difficulty,
        elapsed_days: item.last_review ? (Date.now() - new Date(item.last_review).getTime()) / (1000 * 60 * 60 * 24) : 0,
        scheduled_days: 0, // Not stored in DB directly, but needed for type? FSRS might calculate it.
        reps: item.repetition_count,
        lapses: 0, // We didn't store lapses, assume 0 or add column
        state: (item.status === 'new' || !item.last_review) ? 0 : item.status === 'learning' ? 1 : item.status === 'review' ? 2 : 3, // 0=New, 1=Learning, 2=Review, 3=Relearning
        last_review: item.last_review ? new Date(item.last_review) : undefined as any,
    }
```

Replace with:

```ts
    // Construct FSRS Card object
    const card: Card = {
        due: item.next_review ? new Date(item.next_review) : new Date(),
        stability: item.stability,
        difficulty: item.difficulty,
        elapsed_days: item.last_review ? (Date.now() - new Date(item.last_review).getTime()) / (1000 * 60 * 60 * 24) : 0,
        scheduled_days: 0,
        reps: item.repetition_count,
        lapses: item.lapses ?? 0,
        state: (item.status === 'new' || !item.last_review) ? 0 : item.status === 'learning' ? 1 : item.status === 'review' ? 2 : 3,
        last_review: item.last_review ? new Date(item.last_review) : undefined as any,
    }
```

(`item.lapses ?? 0` reads the column we added; falls back to 0 for any pre-migration rows that somehow lack it.)

Then find:

```ts
    // Update DB
    await supabase
        .from('chinese_vocab_items')
        .update({
            stability: newCard.stability,
            difficulty: newCard.difficulty,
            repetition_count: newCard.reps,
            last_review: new Date().toISOString(),
            next_review: newCard.due.toISOString(),
            status: newCard.state === 0 ? 'new' : newCard.state === 1 ? 'learning' : newCard.state === 2 ? 'review' : 'relearning',
        })
        .eq('id', itemId)
```

Replace with:

```ts
    // Update DB
    await supabase
        .from('chinese_vocab_items')
        .update({
            stability: newCard.stability,
            difficulty: newCard.difficulty,
            repetition_count: newCard.reps,
            lapses: newCard.lapses,
            last_review: new Date().toISOString(),
            next_review: newCard.due.toISOString(),
            status: newCard.state === 0 ? 'new' : newCard.state === 1 ? 'learning' : newCard.state === 2 ? 'review' : 'relearning',
        })
        .eq('id', itemId)
```

(One line added: `lapses: newCard.lapses`.)

---

## Task 9: Simplify `app/vocabulary/actions.ts` (FK cascade does the work)

**Files:**
- Modify: `app/vocabulary/actions.ts:22-50`

- [ ] **Step 1: Read the current file**

```bash
cat app/vocabulary/actions.ts
```

Locate the `deleteVocabularyItem` function — it currently deletes from `chinese_reviews` first, then from `chinese_vocab_items`.

- [ ] **Step 2: Drop the manual review delete**

In `app/vocabulary/actions.ts`, find:

```ts
export async function deleteVocabularyItem(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    // Also delete related reviews? Or keep them for stats?
    // Foreign key constraint might require deleting reviews first if cascade isn't set.
    // Let's assume cascade or delete reviews manually.

    await supabase
        .from('chinese_reviews')
        .delete()
        .eq('vocab_item_id', id)
        .eq('user_id', user.id)

    const { error } = await supabase
        .from('chinese_vocab_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath('/vocabulary')
    revalidatePath('/review')
}
```

Replace with:

```ts
export async function deleteVocabularyItem(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('chinese_vocab_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath('/vocabulary')
    revalidatePath('/review')
}
```

The FK on `chinese_reviews.vocab_item_id` now cascades, so reviews drop automatically.

---

## Task 10: Type-check and lint

**Files:** none (validates the changes from Tasks 6–9).

- [ ] **Step 1: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

If errors mention `lapses` not existing on the vocab item type, that's because the project doesn't generate DB types — the type is inferred. The `?? 0` in Task 8 handles the case. If TypeScript complains about an excess property in the update, no fix is needed (Supabase's `.update()` accepts any subset).

- [ ] **Step 2: Lint the touched files**

```bash
npx eslint app/actions/lookup.ts app/actions/complete-story.ts app/review/actions.ts app/vocabulary/actions.ts
```

Expected: no new errors. (Pre-existing warnings/errors in other files are out of scope for this slice.)

---

## Task 11: Browser smoke test the full flow

**Files:** none (validates end-to-end behavior).

The dev server is already running at http://localhost:3000 (started earlier in this session). If it's not, start it with `npm run dev`.

- [ ] **Step 1: Verify login still works**

Open http://localhost:3000/login in a browser. Log in. Confirm the dashboard loads with the existing 5 stories.

- [ ] **Step 2: Verify story generation still works**

Click "New Story", pick something from the dropdowns, click Generate. A story should be generated and saved (per the existing flow, no changes to generation in this slice). Confirm it appears in the library.

- [ ] **Step 3: Verify tap-to-lookup still works**

Open any story. Tap an unknown word. Confirm a definition appears (the lookup happens via the same code path as before; only the `onConflict` changed).

- [ ] **Step 4: Verify the FSRS-preservation fix actually works**

This is the bug fix at the heart of the slice. To test it directly:

```bash
set -a && source .env.local && set +a && psql "$SUPABASE_DB_URL" <<'SQL'
\echo '=== Pick any word currently in learning state with non-zero stability ==='
select id, word, status, stability, repetition_count, next_review
from chinese_vocab_items
where status = 'learning' and stability > 0
order by created_at desc
limit 5;
SQL
```

If at least one such word exists, note its `id`, `word`, and `stability`. Then in the browser, open a story that contains that word. Mark the story complete with any rating. Re-run the SELECT. The row's `stability` and `status` should be unchanged (still `learning`, same stability).

If no such word exists in your data, the fix is still correct — it'll matter for the next user who taps a word.

- [ ] **Step 5: Verify reviews still submit correctly and lapses now increment**

Go to `/review`. Review at least one card with each of the four ratings if possible. Then run:

```bash
set -a && source .env.local && set +a && psql "$SUPABASE_DB_URL" <<'SQL'
select word, status, lapses, repetition_count, last_review
from chinese_vocab_items
where last_review > now() - interval '5 minutes'
order by last_review desc;
SQL
```

Expected: rows you just reviewed appear; if you rated any "Again" (1), `lapses` should be > 0. If you only rated Good/Easy, `lapses` may stay at 0 (FSRS only increments on lapse-triggering ratings).

- [ ] **Step 6: Verify vocab deletion still works**

In `/vocabulary`, delete one word using the trash icon. Confirm the row disappears from the list and the operation succeeds (no errors in the browser console). The associated review rows should auto-cascade.

---

## Task 12: Commit app code changes

**Files:** none (commits Tasks 6–9).

- [ ] **Step 1: Stage and review**

```bash
git add app/actions/lookup.ts app/actions/complete-story.ts app/review/actions.ts app/vocabulary/actions.ts
git diff --cached
```

Skim the diff: lookup.ts has `onConflict` widened, complete-story.ts has `onConflict` widened + `ignoreDuplicates: true` + comment, review/actions.ts has `lapses` read and write, vocabulary/actions.ts has the manual review-delete dropped.

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: App code follow-on for foundation migration

- lookup.ts: scope onConflict by language (matches new unique key).
- complete-story.ts: scope onConflict by language + ignoreDuplicates so
  finishing a story no longer resets the FSRS schedule of words the user
  previously tapped. Untapped, never-seen words still insert as 'known'.
- review/actions.ts: persist FSRS lapses to the new column.
- vocabulary/actions.ts: drop manual review-delete (FK now cascades).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Update CLAUDE.md to reflect the new migration approach

**Files:**
- Modify: `CLAUDE.md` — the "Database migrations" section.

The CLAUDE.md description of the migration approach is now obsolete (it describes the deleted `scripts/migrate-*.ts` pattern).

- [ ] **Step 1: Read the current section**

```bash
grep -n "Database migrations\|migrate-\|setup-db" CLAUDE.md
```

- [ ] **Step 2: Replace the "Database migrations" section**

Find the paragraph in `CLAUDE.md` that begins with `### Database migrations` and ends before the next `##` heading. Replace its body with:

```markdown
### Database migrations

Migrations are plain SQL files in `supabase/migrations/`, named `<YYYYMMDDHHMMSS>_<topic>.sql`. Apply with:

```bash
set -a && source .env.local && set +a && \
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<file>.sql
```

`SUPABASE_DB_URL` is a pooled superuser connection string used only locally for migrations — it bypasses RLS by design and must not be referenced from app code.

When adding a schema change, write a new SQL file. Wrap multi-statement migrations in `begin; ... commit;` so they're atomic. Other-app tables in the same Supabase project (`babies`, `events`, `invites`, `memberships`, `users`, `baby_invites`) must remain untouched — every statement should be scoped explicitly to `chinese_*`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: Update CLAUDE.md migration guidance

Replace the obsolete scripts/migrate-*.ts description with the new
supabase/migrations/*.sql approach used in Slice 1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Final verification — slice complete

**Files:** none (final review).

- [ ] **Step 1: Confirm git history**

```bash
git log --oneline main^..HEAD
```

Expected: 4 commits in this order:
1. `chore: Delete obsolete one-off migration scripts`
2. `feat(db): Foundation migration — RLS, FSRS lapses, FK cascades`
3. `feat: App code follow-on for foundation migration`
4. `docs: Update CLAUDE.md migration guidance`

- [ ] **Step 2: Confirm `git status` is clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean` (or only contains the unrelated changes from earlier in the session — password reset flow, original CLAUDE.md, etc.).

- [ ] **Step 3: Final spec-vs-reality check**

Re-open the spec at `docs/superpowers/specs/2026-05-05-chinesedoodoo-improvements-design.md` Slice 1 section. Walk through each bullet under "Database changes", "App code follow-on", and "Cleanup" and confirm everything has shipped.

If anything was missed, file it as a follow-up commit before declaring the slice done.

---

## Out of scope for this slice (collected — handled in later slices)

- LLM provider abstraction (`lib/llm.ts`) — Slice 2.
- CC-CEDICT — Slice 3.
- Streaming generation, calibration restructure — Slice 4.
- Review UX, vocab list UX, library UX, multi-language polish, middleware, papercuts — Slice 5.
