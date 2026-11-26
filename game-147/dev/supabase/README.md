# Inn Over My Head — cloud saves (Supabase)

Players can sign in with a link emailed to them (no password) and keep a copy of their save online, then carry on from
another device or browser. The game talks to Supabase with plain `fetch` ([js/cloud.js](../../js/cloud.js)): Auth for
the magic link and token refresh, PostgREST for the `game_saves` table. Local saves keep working as before.

| | |
|---|---|
| Project | `web-games` (ref `zhjcfwrgvwfmjhfibkjc`, us-east-1), organization Whisperstorm, created 2026-11-24 |
| API URL | `https://zhjcfwrgvwfmjhfibkjc.supabase.co` |
| Key in the page | the **publishable** key (`sb_publishable_…`). It is meant to be public; row-level security guards the data. |
| Table | `public.game_saves`: one row per player, game and slot ([game_saves.sql](game_saves.sql)). The `game` column (`game-147`) lets other games in the repo share the table. |
| Security | RLS: a signed-in player can read, add, change and delete only their own rows; `anon` has no access at all. Checked by running as each role (anonymous read denied; a player can't write as someone else, and doesn't see or change another player's rows). The security advisor reports nothing. |

For other games, and for the full email setup with Resend, see the repo-wide guide
[docs/generic/cloud-saves.md](../../../docs/generic/cloud-saves.md).

## One-time setup in the Supabase dashboard

These can't be set from the game or the SQL editor.

1. **Redirect URLs** (Authentication → URL Configuration). The magic link only returns to listed addresses.
   - Site URL: `https://triptych.github.io/web-games-andrew/`
   - Redirect URLs: `https://triptych.github.io/web-games-andrew/**`, and for local testing `http://127.0.0.1:8147/**`
     and `http://localhost:8147/**`.
2. **Email sending.** Until a custom SMTP provider is set up (Authentication → Emails → SMTP Settings; Resend, Postmark,
   SES and others work), Supabase's built-in email only sends to members of the organization's team, a few per hour.
   Anyone else sees "Cloud saves are invite-only for now" in the game. With custom SMTP, anyone can sign in; then
   raise the email rate limit (Authentication → Rate Limits) and consider CAPTCHA against sign-up abuse.

## In the game

- **Title screen and in-game menu → ☁️ Cloud Save.** Signed out: an email box and "Email me a sign-in link". The link
  opens the game signed in, with the tokens taken out of the address bar. Signed in: the cloud save (day, Maple's level,
  gold, when it was saved), **Save to cloud**, **Load from cloud** (tap twice if it would replace a game on this
  device), a "save to the cloud by itself" switch (on by default) and **Sign out**.
- **Automatic uploads** while signed in: every two minutes of play, on Save & Quit, and as the page is hidden or closed
  (a `keepalive` request when the save is under 60 KB).
- The session (access and refresh tokens) is kept in `localStorage` under `inn-over-my-head.v1.cloud` and refreshed a
  minute before it runs out. An expired sign-in asks the player to sign in again.

## Tests

`dev/browsertest.mjs` (`ONLY=cloud`) runs the whole flow against a mock Supabase in the browser (nothing leaves the
machine): the "invite-only" refusal, asking for a link (checks the email, the redirect address and the publishable
key), the return from the link, a save to the cloud (checks the player's token, the game id and the save), loading it
on a "new device" with no local save, the tap-twice guard, and signing out.
