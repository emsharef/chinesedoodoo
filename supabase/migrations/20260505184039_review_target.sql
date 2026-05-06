-- Slice 5: per-user daily review target (replaces the previous hard-coded 20-card cap).
alter table public.chinese_profiles
  add column if not exists daily_review_target integer not null default 30;
