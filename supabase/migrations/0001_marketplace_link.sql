-- Keep the link between a local game and its marketplace listing in the
-- database instead of only in the browser tab that created it.
--
-- Without these columns mkt_game_id lived in React state alone, so:
--   * a reload, or any other device signed into the same account, loaded the
--     game as "Not connected to marketplace" and could not publish it;
--   * the Live Game page fell back to the local session id, broadcasting
--     called numbers and prize claims to an ad-hoc namespace rather than to
--     the real listing players are watching.
--
-- The app tolerates a database without these columns (it retries the write
-- without them and logs a warning), but games will not sync across devices
-- until this has been applied.

alter table public.scheduled_games
  add column if not exists mkt_game_id  text,
  add column if not exists join_link    text,
  add column if not exists join_details text;

alter table public.game_sessions
  add column if not exists mkt_game_id  text,
  add column if not exists join_link    text,
  add column if not exists join_details text;

create index if not exists scheduled_games_mkt_game_id_idx
  on public.scheduled_games (mkt_game_id);
