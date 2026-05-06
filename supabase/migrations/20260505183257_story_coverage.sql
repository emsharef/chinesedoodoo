-- Slice 4: Add per-story coverage stats persisted at generation time.
-- Used by the library card chip and reader header.
--
-- review_word_coverage: fraction of requested review words that landed (0..1)
-- new_word_count: count of words in the story not in the user's vocab (estimate at gen-time)

alter table public.chinese_stories
  add column if not exists review_word_coverage real,
  add column if not exists new_word_count integer;
