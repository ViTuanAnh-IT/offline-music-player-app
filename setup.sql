-- ============================================================
-- Kho nhạc cá nhân: chạy MỘT LẦN trong Supabase > SQL Editor
-- ============================================================

-- 1) Bảng danh sách bài
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text not null unique,
  size bigint not null default 0,
  created_at timestamptz not null default now()
);

-- 2) Bảng playlist (song_ids là danh sách id bài theo thứ tự)
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  song_ids uuid[] not null default '{}',
  updated_at bigint not null default 0
);

-- 3) Bật bảo mật theo dòng: chỉ người đã đăng nhập mới đọc/ghi được
alter table public.songs enable row level security;
alter table public.playlists enable row level security;

drop policy if exists "songs_all_authenticated" on public.songs;
create policy "songs_all_authenticated" on public.songs
  for all to authenticated using (true) with check (true);

drop policy if exists "playlists_all_authenticated" on public.playlists;
create policy "playlists_all_authenticated" on public.playlists
  for all to authenticated using (true) with check (true);

-- 4) Kho chứa file mp3 (riêng tư)
insert into storage.buckets (id, name, public)
values ('music', 'music', false)
on conflict (id) do nothing;

drop policy if exists "music_all_authenticated" on storage.objects;
create policy "music_all_authenticated" on storage.objects
  for all to authenticated
  using (bucket_id = 'music')
  with check (bucket_id = 'music');
