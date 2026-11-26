# Cloud saves with Supabase (sign in by email link, save online)

How to give a game a login and an online copy of its save. The backend is set up and shared, and so is the code: the
client [lib/core/cloud.js](../../lib/core/cloud.js) and the screen [lib/core/cloud-ui.js](../../lib/core/cloud-ui.js).
One sign-in covers every game. Vanilla JS with plain `fetch`, no Supabase client library.

- Working example: Inn Over My Head (game-147): the cloud section of [game-147/js/main.js](../../game-147/js/main.js)
  (search for `cloud saves`) and the `cloud` section of
  [game-147/dev/browsertest.mjs](../../game-147/dev/browsertest.mjs) (the test against a mock Supabase).
- Game-147's own notes: [game-147/dev/supabase/README.md](../../game-147/dev/supabase/README.md).

## What is already set up (shared by every game)

| | |
|---|---|
| Supabase project | **web-games**, ref `zhjcfwrgvwfmjhfibkjc`, region us-east-1, organization **Whisperstorm**. Created 2026-11-24. |
| API URL | `https://zhjcfwrgvwfmjhfibkjc.supabase.co` |
| Key used in pages | the **publishable** key, `sb_publishable_6ayGkiwjNSgNbIL_gFoCcw_dgw_Dl3r`. It is meant to be public: it only lets a browser talk to the API, and row-level security decides what each player can see. Never put the `service_role` or secret key in a page. |
| Table | `public.game_saves`: `user_id`, `game` (e.g. `game-147`), `slot` (default `main`), `data` (jsonb, under 1 MB), `version`, `summary` (≤ 200 chars), `updated_at`. The primary key is (user_id, game, slot), so one row per player per game per slot. SQL: [game-147/dev/supabase/game_saves.sql](../../game-147/dev/supabase/game_saves.sql). |
| Security | Row-level security: a signed-in player can read, add, change and delete only their own rows; anonymous visitors get nothing. `updated_at` is set by a trigger. |
| Sign-in | Email magic link (passwordless). Players are created on first sign-in. |

Dashboard: https://supabase.com/dashboard/project/zhjcfwrgvwfmjhfibkjc

## One-time dashboard setup (already needed for game-147; check it's done)

### 1. Redirect URLs (required)

The email link only sends players back to addresses on this list; anything else goes to the Site URL.

1. Open https://supabase.com/dashboard/project/zhjcfwrgvwfmjhfibkjc/auth/url-configuration
2. **Site URL:** `https://triptych.github.io/web-games-andrew/`
3. **Redirect URLs → Add URL:** `https://triptych.github.io/web-games-andrew/**`. The `**` covers every game folder, so
   new games need nothing extra here.
4. For local testing, also add `http://127.0.0.1:8147/**` and `http://localhost:8147/**` (or whichever port you serve
   on).
5. Save.

### 2. Email sending with Resend (needed before anyone but you can sign in)

Supabase's built-in email only sends to members of the Supabase organization, a few per hour. Everyone else gets the
error code `email_address_not_authorized` (game-147 shows "Cloud saves are invite-only for now"). To let anyone sign
in, send through Resend (free for about 3,000 emails a month, 100 a day).

**In Resend:**

1. Sign up at https://resend.com.
2. **Domains → Add Domain:** a domain you own. A subdomain such as `mail.yourdomain.com` keeps it apart from your other
   email.
3. Add the DNS records Resend lists (an MX record and TXT records for SPF and DKIM) at your registrar (Cloudflare,
   Namecheap, …). Click **Verify** and wait until the domain shows **Verified** (minutes to a few hours).
4. **API Keys → Create API Key:** name `supabase`, **Sending access**, optionally limited to that domain. Copy the key
   (`re_…`). Resend shows it only once.

**Connect it to Supabase (either way):**

- *Easiest:* in Resend, **Settings → Integrations → Supabase → Connect**, sign in to Supabase, pick the **web-games**
  project and the verified domain. It fills in the SMTP settings.
- *By hand:* open https://supabase.com/dashboard/project/zhjcfwrgvwfmjhfibkjc/auth/smtp, turn on **Enable custom SMTP**:

  | Field | Value |
  |---|---|
  | Sender email | `no-reply@yourdomain.com` (on the verified domain) |
  | Sender name | e.g. `Web Games` |
  | Host | `smtp.resend.com` |
  | Port | `465` |
  | Username | `resend` (literally that word) |
  | Password | the `re_…` API key |

**Then:**

1. Raise the limit at https://supabase.com/dashboard/project/zhjcfwrgvwfmjhfibkjc/auth/rate-limits (custom SMTP starts
   at 30 emails an hour; ~100 is plenty for hobby games).
2. Optional but wise once games are public: CAPTCHA under **Authentication → Attack Protection**, against bots signing
   up random addresses.
3. Test: request a sign-in link in a game for an address that isn't on the Supabase account. It should arrive within a
   minute; Resend's **Emails** page shows each message and whether it was delivered.

**If the email doesn't arrive:**

| What you see | Why |
|---|---|
| "Invite-only" in the game | SMTP isn't saved/enabled in Supabase. |
| Nothing on Resend's Emails page | Supabase can't log in to Resend: username must be `resend`, password the whole API key. |
| Bounced or failed in Resend | Domain not verified yet, or the sender email isn't on that domain. |
| Lands in spam | Normal on a new domain at first; add the DMARC record Resend suggests. |
| "Too many sign-in emails" in the game | Supabase's hourly limit: wait, or raise it (step 1 above). |
| The link opens a `localhost:3000` page | The Site URL / Redirect URLs aren't saved (section 1). |

## Adding cloud saves to another game

The client and the screen are shared modules in [lib/core/](../../lib/core/README.md), so a game only writes a few
hooks. **One sign-in covers every game**: all the games are served from one origin, so they share one `localStorage`,
and the session is stored once under `web-games.cloud`. Signing in on any game signs the player in on all of them;
signing out signs out everywhere.

**Why saves can't collide.** Each row is (player, game, slot). A game passes its folder id as `game`
(`makeCloud({ game: 'game-031' })`), so one player has a separate row per game. Never change a game's id (if a folder
is ever renamed, keep sending the old id). Games with several save slots pass `slot: 'slot-1'`, `'slot-2'`, …; others
use the default `main`. Locally, each game's own save keys must be unique too: `node dev/check-save-keys.mjs` checks
all 149 games and fails on a shared key.

**Games with cloud saves:** the 20 newest, game-130 to game-149. Inn Over My Head (game-147) draws the screen in its
own sheet and loads in place; the other 19 use the shared dialog with snapshot and reload. Pinch & Place (game-136) and
Kaboom Keep (game-142) keep data under a second prefix (`pinch-and-place.album.v1`, `kaboom-keep.progress.v1`), so
they pass both: `snapshot([SAVE_KEY, 'pinch-and-place.album.v1'])`. Lanternhollow (game-138) has no menu, so its
button is on the title only. `node dev/cloudtest.mjs` finds every game that imports `lib/core/cloud-ui.js` and tests them all.

**The quickest way: snapshot and reload** (VACANCY, JINGLE POP, Glimmerglade, Echoheart). It needs no knowledge of the
game's save format. `snapshot(SAVE_KEY)` takes every `localStorage` key equal to SAVE_KEY or under `SAVE_KEY.` (the save,
progress, records, …) except `….settings`. `restore()` writes them back and `cloudUI.reload()` restarts the game from
them, as if they had always been local:

```js
import { makeCloud, snapshot, restore, snapValue } from '../../lib/core/cloud.js';
import { makeCloudUI } from '../../lib/core/cloud-ui.js';

ui.openScreen('title');                               // (at top level, once the title is up)
const cloud = makeCloud({ game: 'game-145' });
const cloudUI = makeCloudUI(cloud, {
    getSave: () => { if (mode === 'play' && G) saveGame(G); return snapshot(SAVE_KEY); },
    applySave: (snap) => { restore(snap); cloudUI.reload(); },
    summary: (snap) => { const s = snapValue(snap, SAVE_KEY)?.data; return s ? `${s.got.length} keepsakes` : 'A journey'; },
    hasGame: () => mode === 'play' || !!snapshot(SAVE_KEY),
    version: VERSION,
});
cloudUI.boot();
```

Then a `<button data-act="cloud" class="btn">☁️ Cloud Save</button>` beside Settings in the title and pause menus, a
`cloud` case in their handlers (`cloudUI.open()`), and `cloudUI.autosave()` / `autosave({ force: true })` /
`autosave({ keepalive: true })` next to the game's periodic save, save-and-quit and `pagehide`. Put the block at **top
level**: one game's first `ui.openScreen('title')` was inside its `toTitle()` function, so `cloudUI` didn't exist for
the menus. Check the game's keys really share the prefix (`node dev/check-save-keys.mjs --list`); for keys under another prefix,
pass an array to `snapshot()`.

**The detailed way** (game-147, which loads in place without a reload and draws the screen in its own sheet):

1. **Import the shared modules** (paths from the game's `js/` folder; the itch exporter copies `lib/` files into the
   zip):

   ```js
   import { makeCloud } from '../../lib/core/cloud.js';
   import { makeCloudUI } from '../../lib/core/cloud-ui.js';

   const cloud = makeCloud({ game: 'game-031' });
   const cloudUI = makeCloudUI(cloud, {
       getSave: () => readMySave(),                       // the save as stored locally (any JSON), or null
       applySave: (save) => { writeMySave(save); continueFromSave(); },   // then the normal Continue path
       summary: (save) => `Floor ${save.floor} · ${save.gold} G`,         // one line, shown in the cloud slot
       hasGame: () => playing || !!readMySave(),          // loading would replace something: asks for a second tap
       version: VERSION,
       onOpen: pause, onClose: resume,                    // dialog mode: hold the game while it's open
       toast: (text, kind) => showToast(text),            // optional: "Signed in as …", "Loaded your cloud save"
   });
   cloudUI.boot();          // at startup, once the page is up: back from the emailed link → opens the dialog
   ```

2. **A button.** Put **☁️ Cloud Save** on the title screen and in the pause menu: `onclick = () => cloudUI.open()`
   opens a ready-made modal dialog (Escape closes it; the game's own keys don't see presses inside it). A game with its
   own screens can draw it inside one instead: `cloudUI.mount(element)` (game-147 does this, passing
   `classes: { btn: 'btn', primary: 'btn primary' }` so the buttons match, and colouring it with the
   `--wg-cloud-edge` / `--wg-cloud-accent` / `--wg-cloud-bg` / `--wg-cloud-ink` CSS variables).

3. **Hooks while playing.** Call `cloudUI.autosave()` where the game autosaves (it uploads at most every two minutes),
   `cloudUI.autosave({ force: true })` on save-and-quit, and `cloudUI.autosave({ keepalive: true })` on
   `visibilitychange` (hidden) and `pagehide`. The player's "save to the cloud by itself" switch is shared by all games
   (`web-games.cloud.auto`).

4. **Keep the save shape.** Upload exactly what the local save holds, so loading is "write it locally and continue"
   (idle catch-up and save upgrades then run as usual). Each row also records `version`, so a game can upgrade or
   refuse an old save.

5. **Optional: a title label.** `cloudUI.onInfo = (info) => …` is called when the online save is learned, e.g. to show
   `☁️ Cloud Save · Day 7` (game-147's `refreshTitle`). `cloud.listAll()` returns every game's cloud saves for the
   player, for a launcher or Pocket Garden view.

6. **A test.** `node dev/cloudtest.mjs` picks the game up by itself (it imports `lib/core/cloud-ui.js`) and runs the
   whole flow on a mock Supabase; a game that mounts the screen in its own sheet gets the sign-on check there and keeps
   its own full test (copy game-147's `cloud` section of `dev/browsertest.mjs`).

7. **No new table or dashboard settings are needed.** The `game` column separates games, and the redirect URL
   `https://triptych.github.io/web-games-andrew/**` covers every game folder. Only a different kind of data (a
   leaderboard, say) needs a new table, with RLS enabled and policies written before any data goes in.

**Exported builds (itch.io).** They run on another address, which isn't on the redirect list, so a sign-in link
from there couldn't come back. `cloudUI.boot()` hides every `[data-act="cloud"]` button when the page isn't served from
one of `CLOUD_HOSTS` in `lib/core/cloud.js` (`triptych.github.io`, `localhost`, `127.0.0.1`), so give the button that
attribute. To allow another host, add it both there and to the project's Redirect URLs.

## Testing

- **Mock Supabase in the browser test** with `page.route('https://zhjcfwrgvwfmjhfibkjc.supabase.co/**', …)`. Answer
  `/auth/v1/otp`, `/auth/v1/logout` and GET/POST `/rest/v1/game_saves` from a variable in the test, and check the
  requests: the email and `redirect_to`, the `apikey` header, `Authorization: Bearer <token>`, `game`, `slot`,
  `on_conflict=user_id,game,slot`. Nothing leaves the machine, and the dev container's network blocks supabase.co
  anyway.
- **Fake the return from the email** by opening the game with
  `#access_token=<jwt>&refresh_token=…&expires_in=3600&token_type=bearer&type=magiclink`. The JWT only needs a payload
  the client can read (`sub`, `email`, `exp`), base64url-encoded; the signature isn't checked in the browser.
- **Gotcha: reopening the page in a test.** Routes set with `page.route` were missed on the page's second load (the
  module requests for three.js failed before the route saw them); routes set with **`context.route` survive reloads
  and new pages**, which `dev/cloudtest.mjs` relies on for the reload after Load from cloud. Going to the same URL
  with only a new `#fragment` doesn't reload at all. game-147's own test opens a fresh context with the same storage
  instead (`browser.newContext({ storageState })`).
- **Check the security with SQL**, not just the UI: in one transaction, `set local role anon` and try a select (should
  fail with 42501); insert two users into `auth.users`, then `set local role authenticated` with
  `set local request.jwt.claims = '{"sub":"…"}'` for each and check that neither can see or change the other's rows.
  Roll back (or end the session) so nothing is kept, then confirm no test users remain. Run the Supabase security
  advisor after any schema change.
- A real end-to-end sign-in needs a browser that can reach supabase.co and an inbox: do it by hand after the dashboard
  setup.

## Gotchas met so far

- **Built-in email is team-only** (see section 2). It looks like a bug until you know.
- **Implicit flow:** the link returns with tokens in the URL fragment, which servers never see. Read it, store it,
  `history.replaceState` it away.
- **Magic links are single-use and expire** (about an hour by default). An old link gives an error in the fragment
  (`#error=…&error_description=…`); show it.
- **A reload fires the game's own save.** `restore()` then `reload()` triggers the game's `pagehide` /
  `visibilitychange` saves, which wrote the game on screen straight back over the restored one. `restore()` now freezes
  the keys it wrote (later writes to them are ignored) until the page goes away.
- **Games that use the `#fragment` themselves** (Lanternhollow keeps its shared dungeon there) would read or rewrite
  the sign-in tokens first. `lib/core/cloud.js` takes them as soon as it's imported, before any game code runs, and
  `boot()` reports it. Such a game also clears its own fragment before reloading into a cloud save, or the address would
  win over the restored save.
- **Refresh tokens rotate.** Supabase replaces the refresh token on every refresh and refuses a used one, so two
  game tabs refreshing at once would sign one of them out. `lib/core/cloud.js` refreshes under a Web Lock and re-reads
  the stored session first; without the Locks API, a refused refresh adopts whatever another tab stored.
- **Upsert needs the conflict target:** `POST /rest/v1/game_saves?on_conflict=user_id,game,slot` with
  `Prefer: resolution=merge-duplicates`. Send `user_id` from the token's `sub` so the row matches the policy check.
- **Paused projects:** free-plan projects pause after a week without traffic, and API calls then fail. Restore it in the
  dashboard if cloud saves stop working after a quiet spell.
