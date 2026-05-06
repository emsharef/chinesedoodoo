-- Per-story reading progress for paginated Reader. Stores the user's last-viewed
-- (zero-based) page index so they can resume mid-story. We never downgrade this
-- value when the user navigates back, only bump it forward — see saveReadingProgress.
alter table public.chinese_stories
  add column if not exists current_page integer not null default 0;
