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
