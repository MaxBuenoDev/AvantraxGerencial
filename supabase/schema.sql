-- Avantrax Gerencial - Supabase setup
--
-- This file creates:
-- - 2 metadata tables: public.embarcados_uploads and public.inventario_uploads
-- - 1 Storage bucket: avantrax-files
--
-- SECURITY NOTE:
-- The policies below allow anonymous (public) read/insert for both tables and bucket.
-- This is convenient for a browser-only dashboard, but NOT suitable for a public site.
-- For production, prefer Supabase Auth + tighter RLS, or a server that uses SERVICE_ROLE.

-- Extensions (gen_random_uuid)
create extension if not exists "pgcrypto";

-- Tables
create table if not exists public.embarcados_uploads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  file_name text not null,
  storage_path text not null,
  file_size bigint,
  mime_type text
);

create table if not exists public.inventario_uploads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  file_name text not null,
  storage_path text not null,
  file_size bigint,
  mime_type text
);

-- RLS + policies (PUBLIC)
alter table public.embarcados_uploads enable row level security;
alter table public.inventario_uploads enable row level security;

drop policy if exists "public_select" on public.embarcados_uploads;
create policy "public_select"
on public.embarcados_uploads
for select
using (true);

drop policy if exists "public_insert" on public.embarcados_uploads;
create policy "public_insert"
on public.embarcados_uploads
for insert
with check (true);

drop policy if exists "public_select" on public.inventario_uploads;
create policy "public_select"
on public.inventario_uploads
for select
using (true);

drop policy if exists "public_insert" on public.inventario_uploads;
create policy "public_insert"
on public.inventario_uploads
for insert
with check (true);

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('avantrax-files', 'avantrax-files', true)
on conflict (id) do update set public = excluded.public;

-- Storage policies (PUBLIC)
-- Note: storage.objects already has RLS enabled in Supabase projects.
drop policy if exists "public_read_avantrax_files" on storage.objects;
create policy "public_read_avantrax_files"
on storage.objects
for select
using (bucket_id = 'avantrax-files');

drop policy if exists "public_insert_avantrax_files" on storage.objects;
create policy "public_insert_avantrax_files"
on storage.objects
for insert
with check (bucket_id = 'avantrax-files');

