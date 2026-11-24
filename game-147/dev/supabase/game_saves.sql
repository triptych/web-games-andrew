-- Cloud saves for the web games (Supabase project "web-games", ref zhjcfwrgvwfmjhfibkjc), applied as the migration
-- "game_saves" on 2026-11-24. One row per player, game and slot; only the signed-in owner can see or change a row.
-- Kept here so the table can be rebuilt in another project: run it in the SQL editor.
create table public.game_saves (
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    game text not null check (char_length(game) between 1 and 64),
    slot text not null default 'main' check (char_length(slot) between 1 and 32),
    data jsonb not null check (pg_column_size(data) < 1000000),
    version text check (char_length(version) <= 32),
    summary text check (char_length(summary) <= 200),
    updated_at timestamptz not null default now(),
    primary key (user_id, game, slot)
);

comment on table public.game_saves is 'Cloud saves for the web games (game id, e.g. game-147, and a slot). Owner-only via RLS.';

alter table public.game_saves enable row level security;

create policy "Players read their own saves" on public.game_saves
    for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players create their own saves" on public.game_saves
    for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Players update their own saves" on public.game_saves
    for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Players delete their own saves" on public.game_saves
    for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.game_saves from anon;
grant select, insert, update, delete on public.game_saves to authenticated;

-- keep updated_at honest whatever the client sends
create or replace function public.game_saves_touch() returns trigger
    language plpgsql set search_path = '' as $$
begin
    new.updated_at := now();
    return new;
end $$;

create trigger game_saves_touch before insert or update on public.game_saves
    for each row execute function public.game_saves_touch();
