-- Calibration v2: per-story count of words the user explicitly tapped while reading.
-- Combined with new_word_count this gives a continuous difficulty signal —
-- a far richer input to calibration than the three-bucket Easy/Good/Hard rating.
alter table public.chinese_stories
  add column if not exists tapped_word_count integer;
