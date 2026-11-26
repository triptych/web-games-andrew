#!/usr/bin/env node
/**
 * cloudtest.mjs — cloud saves in every game that uses the shared Cloud Save (lib/core/cloud-ui.js), against a mock
 * Supabase in the browser (nothing leaves the machine). For each game, in real Chromium:
 *
 *   - the title's ☁️ Cloud Save opens the dialog with the sign-in form (the first game only: asking for a link sends
 *     the email and this page as the address to come back to);
 *   - one sign-in for all: the first game is signed in by coming back from the emailed link; every later game opens
 *     already signed in, with the session in `web-games.cloud`;
 *   - Save to cloud uploads this game's id (its folder) and everything under its SAVE_KEY, with the player's token;
 *   - on a "new device" (the game's local keys gone), Load from cloud writes them back and reloads the game, which
 *     shows "Loaded your cloud save";
 *   - no page errors, console errors or failed requests.
 * Then, on one game: play on a phone (it saves to the cloud) and open the game on a desktop with an older game of its
 * own: the desktop's autosave never overwrites the phone's newer save (it warns, and holds off), its Cloud Save offers
 * to load it (keeping the desktop's game takes a second tap), and an upload from a device a version behind is refused
 * by the conditional update itself. Finally Sign out signs out of every game.
 *
 *   python3 -m http.server 8147                 # from the REPO ROOT
 *   node dev/cloudtest.mjs                      # every game that imports lib/core/cloud-ui.js
 *   ONLY=game-145,game-149 node dev/cloudtest.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8147';
const PKG = [path.join(ROOT, 'dev/package')].find((p) => fs.existsSync(p));
const SB = 'https://zhjcfwrgvwfmjhfibkjc.supabase.co';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);

// the games: every one whose code imports the shared cloud screen
const games = fs.readdirSync(ROOT).filter((d) => /^game-\d+$/.test(d)).sort().filter((g) => {
    const dir = path.join(ROOT, g, 'js');
    if (!fs.existsSync(dir) || (ONLY.length && !ONLY.includes(g))) return false;
    return fs.readdirSync(dir).some((f) => f.endsWith('.js') && fs.readFileSync(path.join(dir, f), 'utf8').includes('lib/core/cloud-ui.js'));
});
// games that draw the screen inside their own sheet (cloudUI.mount) and load in place have their own full cloud test
// (game-147's dev/browsertest.mjs ONLY=cloud); here they only show that the one sign-in reaches them
const mounted = (g) => fs.readdirSync(path.join(ROOT, g, 'js')).some((f) => f.endsWith('.js') && fs.readFileSync(path.join(ROOT, g, 'js', f), 'utf8').includes('cloudUI.mount('));
const saveKey = (g) => fs.readFileSync(path.join(ROOT, g, 'js/config.js'), 'utf8').match(/export const SAVE_KEY = ['"]([^'"]+)/)?.[1];

let fails = 0;
const check = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else console.log('  ok', m); return c; };

// the mock Supabase: one player's rows, kept here
const rows = {}, log = [];
let tick = 0;
const stamp = () => new Date(Date.UTC(2026, 10, 26, 12, 0, 0) + 1000 * ++tick).toISOString().replace('Z', '+00:00');
let refuseNext = true;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '0b7c6c1e-1111-4a4a-9999-0123456789ab', email: 'player@example.com', exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.sig`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

/** A browser context with the routes (on the context, so they survive reloads) and optional storage. */
async function context(storageState) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1, storageState });
    if (PKG) await ctx.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(file) });
    });
    await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.route(`${SB}/**`, async (route) => {
        const req = route.request(), url = new URL(req.url());
        log.push({ method: req.method(), path: url.pathname, query: url.search, auth: req.headers().authorization || '', body: req.postData() });
        const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.pathname === '/auth/v1/otp') {
            if (refuseNext) { refuseNext = false; return json(400, { code: 400, error_code: 'email_address_not_authorized', msg: 'Email address not authorized' }); }
            return json(200, {});
        }
        if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' });
        if (url.pathname === '/rest/v1/game_saves') {
            const game = url.searchParams.get('game')?.replace(/^eq\./, '');
            if (req.method() === 'GET') return json(200, rows[game] ? [rows[game]] : []);
            // as PostgREST does: an insert that ignores duplicates returns nothing when the row exists; an update
            // filtered on updated_at returns nothing when the cloud version has moved on
            const prefer = req.headers().prefer || '';
            if (req.method() === 'POST') {
                const b = JSON.parse(req.postData());
                if (rows[b.game] && prefer.includes('ignore-duplicates')) return json(201, []);
                rows[b.game] = { data: b.data, version: b.version, summary: b.summary, updated_at: stamp() };
                return json(201, [{ updated_at: rows[b.game].updated_at }]);
            }
            if (req.method() === 'PATCH') {
                const want = url.searchParams.get('updated_at')?.replace(/^eq\./, '');
                if (!rows[game] || rows[game].updated_at !== want) return json(200, []);
                const b = JSON.parse(req.postData());
                rows[game] = { ...rows[game], ...b, updated_at: stamp() };
                return json(200, [{ updated_at: rows[game].updated_at }]);
            }
        }
        return json(404, { message: 'not mocked' });
    });
    return ctx;
}

async function openGame(ctx, g, hash = '') {
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/${g}/index.html${hash}`);
    await page.waitForFunction(() => !!document.querySelector('[data-act="cloud"]'), null, { timeout: 90000 });
    await page.waitForTimeout(800);
    page.errors = errors;
    return page;
}
const until = (page, fn, msg, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout, polling: 150 }).then(() => check(true, msg), () => check(false, msg));
const openCloud = (page) => page.evaluate(() => document.querySelector('[data-act="cloud"]').click());
const click = (page, sel) => page.evaluate((s) => { const b = document.querySelector(s); if (!b || b.disabled) return false; b.click(); return true; }, sel);

console.log(`cloud saves: ${games.length} game(s): ${games.join(', ')}`);
let storage;                                   // the shared browser storage, carried from game to game
try {
    for (const [i, g] of games.entries()) {
        const key = saveKey(g);
        console.log(`\n== ${g} (SAVE_KEY ${key})`);
        if (!check(!!key, 'config.js exports SAVE_KEY')) continue;
        let ctx = await context(storage);
        let page = await openGame(ctx, g);
        if (mounted(g)) {
            await openCloud(page);
            await until(page, () => [...document.querySelectorAll('.wg-cloud')].some((el) => el.offsetParent && el.textContent.includes('player@example.com')), 'its own Cloud Save screen opens already signed in: one sign-in covers every game');
            for (const e of page.errors) console.log('    ', e);
            check(page.errors.length === 0, 'no page errors, console errors or failed requests');
            storage = await ctx.storageState();
            await ctx.close();
            continue;
        }
        if (i === 0) {
            await openCloud(page);
            await until(page, () => document.querySelector('dialog.wg-cloud')?.open && !!document.querySelector('dialog.wg-cloud input[type=email]'), 'the title\'s Cloud Save opens the sign-in form');
            await page.fill('dialog.wg-cloud input[type=email]', 'player@example.com');
            await click(page, 'dialog.wg-cloud [data-wgc="signin"]');
            await until(page, () => document.querySelector('dialog.wg-cloud .wg-msg')?.textContent.includes('invite-only'), 'an address Supabase won\'t email yet gets a plain explanation');
            await click(page, 'dialog.wg-cloud [data-wgc="signin"]');
            await until(page, () => document.querySelector('dialog.wg-cloud .wg-msg')?.textContent.includes('Check your inbox'), 'asking for a link says to check the inbox');
            const otp = log.filter((r) => r.path === '/auth/v1/otp').pop();
            check(otp && JSON.parse(otp.body).email === 'player@example.com' && decodeURIComponent(otp.query).includes(`redirect_to=${BASE}/${g}/index.html`), 'the link will bring the player back to this game');
            // back from the emailed link
            await ctx.close();
            ctx = await context(storage);
            page = await openGame(ctx, g, `#access_token=${jwt}&refresh_token=rt1&expires_in=3600&token_type=bearer&type=magiclink`);
            await until(page, () => document.querySelector('dialog.wg-cloud')?.open && document.querySelector('dialog.wg-cloud').textContent.includes('player@example.com') && !location.hash.includes('access_token'), 'back from the link: signed in, the dialog open, the tokens gone from the address');
            await page.keyboard.press('Escape');
        } else {
            await openCloud(page);
            await until(page, () => document.querySelector('dialog.wg-cloud')?.open && document.querySelector('dialog.wg-cloud').textContent.includes('player@example.com'), 'already signed in: one sign-in covers every game');
            await page.keyboard.press('Escape');
        }
        check(await page.evaluate(() => JSON.parse(localStorage.getItem('web-games.cloud') || 'null')?.email === 'player@example.com'), 'the session is the shared one (web-games.cloud)');
        // something saved under this game's key, then Save to cloud
        await page.evaluate((k) => localStorage.setItem(k + '.cloudtest', JSON.stringify({ marker: k })), key);
        await openCloud(page);
        await until(page, () => !!document.querySelector('dialog.wg-cloud [data-wgc="up"]:not([disabled])'), 'Save to cloud is offered');
        await click(page, 'dialog.wg-cloud [data-wgc="up"]');
        if (!await until(page, () => document.querySelector('dialog.wg-cloud .wg-msg')?.textContent.includes('Saved to the cloud'), 'Save to cloud says it saved'))
            console.log('     it said:', await page.evaluate(() => [document.querySelector('dialog.wg-cloud')?.open, document.querySelector('dialog.wg-cloud .wg-msg')?.textContent, document.querySelector('dialog.wg-cloud [data-wgc="up"]')?.textContent]), log.slice(-6).map((r) => r.method + ' ' + r.path + ' ' + (r.query || '').slice(0, 90)));
        const up = log.filter((r) => r.path === '/rest/v1/game_saves' && r.method === 'POST').pop();
        const ub = up && JSON.parse(up.body);
        check(ub && ub.game === g && up.auth === `Bearer ${jwt}` && ub.data?.[key + '.cloudtest'] && Object.keys(ub.data).every((k) => k === key || k.startsWith(key + '.')) && !Object.keys(ub.data).some((k) => k.endsWith('.settings')),
            `the upload is this game's (${g}) keys only, without settings, with the player's token`);
        for (const e of page.errors) console.log('    ', e);
        check(page.errors.length === 0, 'no page errors, console errors or failed requests');
        storage = await ctx.storageState();
        await ctx.close();
        // a "new device": the same sign-in, this game's keys gone
        const origin = storage.origins.find((o) => BASE.startsWith(o.origin));
        const fresh = { ...storage, origins: storage.origins.map((o) => (o === origin ? { ...o, localStorage: o.localStorage.filter((x) => x.name !== key && !x.name.startsWith(key + '.')) } : o)) };
        ctx = await context(fresh);
        page = await openGame(ctx, g);
        await openCloud(page);
        await until(page, () => !!document.querySelector('dialog.wg-cloud [data-wgc="down"]:not([disabled])'), 'on a new device, Load from cloud is offered');
        // a game with something of its own already here asks for a second tap first (Lanternhollow builds a dungeon at once)
        if (await page.evaluate(() => { document.querySelector('dialog.wg-cloud [data-wgc="down"]').click(); return document.querySelector('dialog.wg-cloud [data-wgc="down"]')?.textContent.includes('Tap again'); }).catch(() => false)) {
            check(true, 'with something already on this device it asks for a second tap');
            await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => null), click(page, 'dialog.wg-cloud [data-wgc="down"]')]);
        } else await page.waitForNavigation({ timeout: 60000 }).catch(() => null);
        await page.waitForFunction(() => !!document.querySelector('[data-act="cloud"]'), null, { timeout: 90000 });
        check(await page.evaluate((k) => JSON.parse(localStorage.getItem(k + '.cloudtest') || 'null')?.marker === k, key), 'Load from cloud writes the save back and reloads the game');
        await until(page, () => [...document.querySelectorAll('.wg-cloud-toast')].some((t) => t.textContent.includes('Loaded your cloud save')), 'and says so once it\'s back');
        await page.evaluate((k) => localStorage.removeItem(k + '.cloudtest'), key);
        storage = await ctx.storageState();
        await ctx.close();
    }
    // ------------------------------------------------------------------ phone, then desktop
    // Play on a phone (it saves to the cloud), then open the game on a desktop that has an older game of its own: the
    // desktop's autosave must never overwrite the phone's newer cloud save. It warns, holds off, and lets the player load
    // the newer save (or, with a second tap, keep the desktop's). And once the desktop is in step, a newer save from the
    // phone is still refused by the database's own check (a conditional update), not just by the page.
    const g0 = games.find((g) => !mounted(g));
    if (g0) {
        const key = saveKey(g0), mk = key + '.cloudtest';
        console.log(`\n== phone, then desktop (${g0})`);
        const edit = (state, fn) => ({ ...state, origins: state.origins.map((o) => (BASE.startsWith(o.origin) ? { ...o, localStorage: fn(o.localStorage.slice()) } : o)) });
        const put = (ls, name, value) => [...ls.filter((x) => x.name !== name), { name, value }];
        const marker = () => { try { return JSON.parse(rows[g0]?.data?.[mk] || 'null')?.marker; } catch { return null; } };
        // the phone plays and saves
        let ctx = await context(storage);
        let page = await openGame(ctx, g0);
        await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ marker: 'phone' })), mk);
        await openCloud(page);
        await until(page, () => !!document.querySelector('dialog.wg-cloud [data-wgc="up"]:not([disabled])'), 'the phone: Save to cloud');
        await click(page, 'dialog.wg-cloud [data-wgc="up"]');
        await until(page, () => document.querySelector('dialog.wg-cloud .wg-msg')?.textContent.includes('Saved to the cloud'), 'the phone\'s game is in the cloud');
        check(marker() === 'phone', 'the cloud holds the phone\'s game');
        const phone = await ctx.storageState();
        await ctx.close();
        // the desktop: the same sign-in, an older game of its own, never in step with the cloud
        const desktop = edit(phone, (ls) => put(ls.filter((x) => x.name !== 'web-games.cloud.sync'), mk, JSON.stringify({ marker: 'desktop (older)' })));
        ctx = await context(desktop);
        page = await openGame(ctx, g0);
        await until(page, () => [...document.querySelectorAll('.wg-cloud-toast')].some((t) => t.textContent.includes('newer save')), 'the desktop says at once that the cloud has a newer save, and that cloud saving is paused');
        const before = JSON.stringify(rows[g0]), writes = log.filter((r) => r.path === '/rest/v1/game_saves' && r.method !== 'GET').length;
        await page.goto('about:blank');                       // leaving the page fires its pagehide autosave
        await new Promise((r) => setTimeout(r, 2000));
        check(JSON.stringify(rows[g0]) === before && marker() === 'phone', 'the desktop\'s autosave on leaving does not overwrite the phone\'s cloud save');
        check(log.filter((r) => r.path === '/rest/v1/game_saves' && r.method !== 'GET').length === writes, 'it doesn\'t even try');
        await page.close();
        page = await openGame(ctx, g0);
        await openCloud(page);
        await until(page, () => !!document.querySelector('dialog.wg-cloud .wg-warn') && document.querySelector('dialog.wg-cloud [data-wgc="down"]')?.textContent.includes('newer cloud save'), 'its Cloud Save warns and offers to load the newer save');
        await click(page, 'dialog.wg-cloud [data-wgc="up"]');
        check(await page.evaluate(() => document.querySelector('dialog.wg-cloud [data-wgc="up"]').textContent.includes('Tap again')) && marker() === 'phone', 'keeping the desktop\'s game instead needs a second tap (one tap overwrites nothing)');
        // loading replaces the desktop's own game, so it asks for a second tap too
        await click(page, 'dialog.wg-cloud [data-wgc="down"]');
        check(await page.evaluate(() => document.querySelector('dialog.wg-cloud [data-wgc="down"]')?.textContent.includes('Tap again')), 'loading over the desktop\'s game asks for a second tap');
        await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => null), click(page, 'dialog.wg-cloud [data-wgc="down"]')]);
        await page.waitForFunction(() => !!document.querySelector('[data-act="cloud"]'), null, { timeout: 90000 });
        check(await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null')?.marker === 'phone', mk), 'loading it brings the phone\'s game to the desktop');
        // the phone saves again; the desktop (in step with the older version) tries to upload: the database refuses
        rows[g0] = { ...rows[g0], data: { ...rows[g0].data, [mk]: JSON.stringify({ marker: 'phone, later' }) }, updated_at: stamp() };
        const r = await page.evaluate(async (g) => {
            const m = await import('/lib/core/cloud.js');
            try { await m.makeCloud({ game: g }).upload({ stale: true }); return 'uploaded'; } catch (e) { return e.code || e.message; }
        }, g0);
        check(r === 'cloud_newer' && marker() === 'phone, later', `an upload from a device a version behind is refused by the conditional update (${r}), and the newer save stays`);
        storage = await ctx.storageState();
        await ctx.close();
    }

    if (games.length) {
        const g = games[games.length - 1];
        console.log(`\n== sign out (${g})`);
        const ctx = await context(storage);
        const page = await openGame(ctx, g);
        await openCloud(page);
        await until(page, () => !!document.querySelector('dialog.wg-cloud [data-wgc="signout"]'), 'signed in');
        await click(page, 'dialog.wg-cloud [data-wgc="signout"]');
        await until(page, () => !!document.querySelector('dialog.wg-cloud input[type=email]') && !localStorage.getItem('web-games.cloud'), 'Sign out: the sign-in form again, and the shared session gone (signed out of every game)');
        // the logout request goes out after the form is redrawn; on a slow page it lands a moment later
        for (let i = 0; i < 50 && !log.some((r) => r.path === '/auth/v1/logout'); i++) await page.waitForTimeout(100);
        check(log.some((r) => r.path === '/auth/v1/logout'), 'and it tells Supabase');
        await ctx.close();
    }
} catch (err) {
    fails++;
    console.log('  FAIL threw:', err.message.split('\n')[0]);
} finally {
    await browser.close();
}
console.log(`\n${fails ? `${fails} FAILED` : 'all passed'}`);
process.exit(fails ? 1 : 0);
