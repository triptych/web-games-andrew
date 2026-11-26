-- Player counts for every game (applied to project web-games, ref zhjcfwrgvwfmjhfibkjc, on 2026-11-26 as the
-- migration `game_player_counts`). See docs/generic/cloud-saves.md § Player counts.
--
-- game_players: one row per (game, anonymous device id). No access for anon/authenticated: written only by
--   record_play(). (The advisor's "RLS enabled, no policy" note on it is intended.)
-- game_stats:   the totals, readable by anyone (the cartridges and the classic list show them).
-- record_play(game, device): a SECURITY DEFINER function anon may call (the advisor warns about that; it is the
--   point): it can only add the caller's device to one game's count, at most one play per device per 30 minutes.

create table public.game_players (
    game text not null check (game ~ '^game-[0-9]{3}$'),
    player uuid not null,
    first_seen timestamptz not null default now(),
    last_seen timestamptz not null default now(),
    primary key (game, player)
);
alter table public.game_players enable row level security;
revoke all on public.game_players from anon, authenticated;

create table public.game_stats (
    game text primary key check (game ~ '^game-[0-9]{3}$'),
    players integer not null default 0,
    plays integer not null default 0,
    updated_at timestamptz not null default now()
);
alter table public.game_stats enable row level security;
revoke all on public.game_stats from anon, authenticated;
grant select on public.game_stats to anon, authenticated;
create policy "Anyone can read the play counts" on public.game_stats for select to anon, authenticated using (true);

create or replace function public.record_play(p_game text, p_player uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
    is_new boolean;
begin
    if p_game is null or p_game !~ '^game-[0-9]{3}$' or p_player is null then
        return;
    end if;
    insert into public.game_players (game, player) values (p_game, p_player)
        on conflict (game, player) do nothing;
    is_new := found;
    if not is_new then
        -- the same device counts as another play only after 30 minutes
        update public.game_players set last_seen = now()
            where game = p_game and player = p_player and last_seen < now() - interval '30 minutes';
        if not found then
            return;
        end if;
    end if;
    insert into public.game_stats as s (game, players, plays) values (p_game, 1, 1)
        on conflict (game) do update
        set players = s.players + case when is_new then 1 else 0 end, plays = s.plays + 1, updated_at = now();
end;
$$;
revoke all on function public.record_play(text, uuid) from public;
grant execute on function public.record_play(text, uuid) to anon, authenticated;

-- Reading the totals (what lib/core/stats.js does):
--   GET /rest/v1/game_stats?select=game,players,plays   (apikey: the publishable key)
-- Counting a play (what lib/plays.js does):
--   POST /rest/v1/rpc/record_play  {"p_game":"game-031","p_player":"<uuid>"}
