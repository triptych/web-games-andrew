# Cloud saves with Supabase (sign in by email link, save online)

How to give a game a login and an online copy of its save, the way Inn Over My Head (game-147, v1.2.0) does it. The
backend is already set up and shared: a new game only needs its own copy of the client module, a screen and a few
hooks. Vanilla JS with plain `fetch`, no Supabase client library.

- Working example: [game-147/js/cloud.js](../../game-147/js/cloud.js) (the client), the cloud controller in
  [game-147/js/main.js](../../game-147/js/main.js) (search for `cloud saves`), and the `cloud` section of
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

1. **Copy the client.** Copy [game-147/js/cloud.js](../../game-147/js/cloud.js) into the game's `js/` and change:
   - `GAME = 'game-147'` → the new game's folder id (this keeps each game's saves apart in the shared table);
   - the `SAVE_KEY` import → the new game's own save key (the session is stored under `SAVE_KEY + '.cloud'`);
   - the "invite-only" wording if you like.
   Its methods: `consumeRedirect()`, `signIn(email)`, `signOut()`, `upload(save, { version, summary, keepalive })`,
   `download()`, plus `signedIn` and `email`. Tokens are refreshed a minute before they expire.
2. **Read the magic link on boot.** Call `cloud.consumeRedirect()` once the UI exists. It returns `'signed-in'` (show
   the cloud screen), an error message, or `null`. It strips the tokens out of the address bar.
3. **Add a screen.** Signed out: an email box and "Email me a sign-in link". Signed in: the cloud save's summary and
   when it was saved, **Save to cloud**, **Load from cloud** (ask for a second tap if it would replace a game on the
   device), an auto-save switch, **Sign out**. Game-147's `renderCloud()` and `cloudAction()` in `main.js` can be
   copied nearly as they are.
4. **Hooks.** Upload the local save quietly every couple of minutes of play, on save-and-quit, and on
   `visibilitychange` (hidden) and `pagehide` with `keepalive: true` (a keepalive request carries at most 64 KB; the
   client skips keepalive for bigger saves). To load: write the downloaded `data` into local storage with the game's
   own save function, then go through the normal Continue path, so idle catch-up and the like still run.
5. **Keep the save shape.** Upload exactly what the local save holds (game-147: `{ savedAt, data }`), so loading is
   just "write it locally and continue".
6. **Summary text.** A short line such as `Day 7 · Maple Lv 9 · 4,321 G` makes the cloud slot recognisable on the title
   screen and in the cloud screen.
7. **No new table or settings are needed.** The `game` column separates games. Only if a game needs something else
   (a leaderboard, say) add a new table, with RLS enabled and policies written before any data goes in.

## Testing

- **Mock Supabase in the browser test** with `page.route('https://zhjcfwrgvwfmjhfibkjc.supabase.co/**', …)`. Answer
  `/auth/v1/otp`, `/auth/v1/logout` and GET/POST `/rest/v1/game_saves` from a variable in the test, and check the
  requests: the email and `redirect_to`, the `apikey` header, `Authorization: Bearer <token>`, `game`, `slot`,
  `on_conflict=user_id,game,slot`. Nothing leaves the machine, and the dev container's network blocks supabase.co
  anyway.
- **Fake the return from the email** by opening the game with
  `#access_token=<jwt>&refresh_token=…&expires_in=3600&token_type=bearer&type=magiclink`. The JWT only needs a payload
  the client can read (`sub`, `email`, `exp`), base64url-encoded; the signature isn't checked in the browser.
- **Gotcha: reopening the page in a test.** A second load in the same Playwright browser context missed the routes that
  serve three.js locally (the module requests failed before the route saw them), and going to the same URL with only a
  new `#fragment` doesn't reload at all. Open a **fresh context with the same storage**:
  `browser.newContext({ storageState: await page.context().storageState() })` (game-147's `newTab()` helper).
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
- **Upsert needs the conflict target:** `POST /rest/v1/game_saves?on_conflict=user_id,game,slot` with
  `Prefer: resolution=merge-duplicates`. Send `user_id` from the token's `sub` so the row matches the policy check.
- **Paused projects:** free-plan projects pause after a week without traffic, and API calls then fail. Restore it in the
  dashboard if cloud saves stop working after a quiet spell.
