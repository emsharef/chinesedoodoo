-- Reader v2: track reading progress as a segment index instead of a page index.
--
-- Page indices are unstable across devices/font sizes — same story produces
-- different page counts. Segment index is stable: word N is word N regardless
-- of how the reader paginates today.
--
-- Old current_page column is left in place as a no-op. App stops reading it.
alter table public.chinese_stories
  add column if not exists current_position integer not null default 0;
