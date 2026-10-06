/**
 * promo.mjs — screenshots for an itch.io page (or anywhere): a 630×500 cover
 * and 1280×720 shots of the game at its best moments, plus a phone shot.
 *
 *   python3 -m http.server 8065                  # from the REPO ROOT
 *   node game-065/dev/promo.mjs                  # → game-065/dev/itch/promo/*.png
 *   ONLY=cover,worldtree node game-065/dev/promo.mjs
 *
 * Each shot stages a grove through the ?debug=1 hooks (tree level, spirits,
 * season, realms, the wilds), frames the camera through the page's own
 * stage.js, waits for the spirits to settle in, and captures. Hero shots hide
 * the UI and centre the tree; gameplay shots keep the HUD and a tab open.
 * Software WebGL is slow: a full run takes a few minutes.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8065';
const OUT = path.join(HERE, 'itch', 'promo');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });

// season: 0 spring, 1 summer, 2 autumn, 3 winter. cam: [yaw, pitch drag, zoom]. ui: false hides the HUD and panel.
const ALL = [21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21];
const SHOTS = [
    { name: 'cover', size: [630, 500], tree: 74, season: 0, gens: [60, 50, 40, 30, 20, 12, 10, 6, 4, 4, 3, 0], ui: false, cam: [0.5, 0, 1.0], top: 150, title: true },
    { name: '1-sprout', size: [1280, 720], tree: 14, season: 0, gens: [25, 18, 10, 5, 2, 0, 0, 0, 0, 0, 0, 0], tab: 'grove', clicks: 2, cam: [0.4, 0, 1.15] },
    { name: '2-sapling', size: [1280, 720], tree: 38, season: 1, gens: [45, 40, 30, 22, 12, 6, 3, 0, 0, 0, 0, 0], tab: 'ups', cam: [2.4, 0, 1.15] },
    { name: '3-elder-autumn', size: [1280, 720], tree: 66, season: 2, gens: [80, 70, 60, 50, 40, 30, 20, 14, 8, 5, 0, 0], tab: 'magic', buffs: true, cam: [-0.4, 0, 1] },
    { name: '4-world-tree', size: [1280, 720], tree: 100, season: 0, gens: ALL, realms: ['midgard', 'alfheim', 'asgard', 'vanaheim', 'muspel'], ui: false, cam: [0.3, 0, 1.02] },
    { name: '5-wilds-garden', size: [1280, 720], tree: 58, season: 0, gens: [60, 50, 45, 40, 30, 25, 20, 12, 5, 0, 0, 0], tab: 'wilds', wilds: 'garden', cam: [-0.9, 0, 1] },
    { name: '6-winter-badges', size: [1280, 720], tree: 82, season: 3, gens: [90, 80, 70, 60, 50, 40, 30, 20, 14, 10, 6, 3], tab: 'journal', journal: 'badges', cam: [2.2, 0, 1] },
    { name: '7-phone', size: [390, 844], phone: true, tree: 58, season: 0, gens: [60, 50, 45, 40, 30, 25, 20, 12, 6, 0, 0, 0], tab: 'grove', cam: [0.2, 0, 1] },
].filter((s) => !ONLY.length || ONLY.some((o) => s.name.includes(o)));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
for (const shot of SHOTS) {
    const [w, h] = shot.size;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: shot.phone ? 2 : 1, hasTouch: !!shot.phone, isMobile: !!shot.phone });
    await ctx.addInitScript(() => localStorage.setItem('worldroot-settings', JSON.stringify({ seenHelp: true, quality: '0', floaters: true, rotate: false })));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.goto(`${BASE}/game-065/index.html?debug=1&q=0`);
    await page.waitForFunction(() => window.__wr && window.__wr.state().frames > 1, null, { timeout: 120000 });
    await page.evaluate(() => document.fonts.ready);
    await page.click('#btn-start');
    await page.waitForFunction(() => window.__wr.state().started);
    await page.waitForTimeout(1000);

    await page.evaluate(async (s) => {
        const wr = window.__wr, g = wr.grove;
        wr.season(s.season);
        g.s.realms = s.realms || [];
        wr.tree(s.tree);
        wr.gens(s.gens);
        g.s.bestStage = Math.max(g.s.bestStage, Math.min(10, Math.floor(s.tree / 10)));
        g.s.motes = Math.max(1e3, g.mps() * 3700);
        g.s.totalMotes = g.s.motes * 40;
        g.s.stats.clicks = s.clicks ?? 4200;
        g.s.wisp = { next: 1e12, active: null };       // no golden wisp drifting into the shot
        if (s.tree > 10) {
            // a lived-in grove: kinship, a few relics and herbs, some wisps, a second party, a bigger garden
            g.s.kinLv = g.s.gens.map((n) => Math.min(14, Math.floor(Math.sqrt(n) * 1.4)));
            g.s.relics = { acorn: 1, shell: 1, nest: 2, flute: 1, beetle: 1, scale: 1, bell: 1, orb: 1 };
            g.s.herbs = { moonpetal: 30, dewbell: 12, starmint: 8, sunheart: 5 };
            g.s.herbGlim = { moonpetal: true };
            g.s.stats.harvests = 55; g.s.stats.expeditions = 14; g.s.stats.quests = 31; g.s.stats.wisps = 230; g.s.stats.spells = 160;
            g.s.stats.wispKinds = { lucky: 60, frenzy: 50, kinship: 18, storm: 7, spring: 5 };
            g.s.rebirths = 4; g.s.hwEarned = 600; g.s.stats.gensBought = 2400; g.s.stats.nourished = 650; g.s.stats.offlineTime = 30 * 3600;
            g.s.amber = 214; g.s.amberEver = 900;
            g.s.shop = { party: 1, plots: 4, loam: 1 };
            g.mark(); g.fitGarden();
            g.sendExpedition('hollow', 2); g.sendExpedition('mere', 1);
            const herbs = ['sunheart', 'moonpetal', 'starmint', 'dewbell', 'foxglove', 'moonpetal'];
            herbs.forEach((h, i) => g.plant(i, h));
            g.s.garden.forEach((p, i) => { if (p) { const span = p.end - p.start; p.start -= span * [1.2, 1.1, 0.7, 0.45, 0.3, 0.85][i]; p.end = p.start + span; } });
            g.checkAchievements(); g.checkWilds();
            g.setTitle('wisp3');
        }
        if (s.buffs) { g.s.sap = 1e6; g.cast('surge'); g.cast('starfall'); g.s.sap = g.derive().sapMax * 0.7; }
        g.mark();
        wr.snap();
    }, shot);

    // camera: the page's own stage.js module (same URL, same instance)
    await page.evaluate(async ({ cam, ui, top }) => {
        const stage = await import(new URL('js/view/stage.js', location.href).href);
        stage.setAutoRotate(false);
        stage.orbitBy(-cam[0] / 0.006, cam[1] / 0.004);
        stage.zoomBy(cam[2]);
        if (ui === false) stage.setInsets(0, 0, top || 0);
        stage.snapCamera();
    }, { cam: shot.cam, ui: shot.ui, top: shot.top });

    // the itch build has no link back to the repo's launcher
    await page.addStyleTag({ content: '#games-link { display: none !important; }' });
    if (shot.ui === false) {
        await page.addStyleTag({ content: '#hud, #panel, #toasts, #lore-banner, #hint, #wisp-hint, #floaters { display: none !important; }' });
    } else {
        await page.addStyleTag({ content: '#toasts, #lore-banner, #hint, #wisp-hint { display: none !important; }' });
        if (await page.evaluate(() => document.getElementById('panel').classList.contains('closed'))) await page.click('#panel-toggle');
        if (shot.tab) await page.click(`.tab[data-tab="${shot.tab}"]`);
        if (shot.wilds) await page.click(`#wilds-seg [data-w="${shot.wilds}"]`);
        if (shot.journal) await page.click(`#journal-seg [data-j="${shot.journal}"]`);
    }
    if (shot.title) {
        await page.addStyleTag({ content: `
            #promo-title { position: fixed; left: 0; right: 0; top: 26px; z-index: 500; text-align: center; pointer-events: none; }
            #promo-title h1 { margin: 0; font-family: 'Cinzel', Georgia, serif; font-size: 64px; color: #fff3c4; letter-spacing: 0.04em;
                text-shadow: 0 0 26px rgba(255, 210, 122, 0.75), 0 0 60px rgba(127, 224, 122, 0.4), 0 3px 10px rgba(0, 0, 0, 0.8); }
            #promo-title p { margin: 4px 0 0; font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 17px; color: #d4ecdf; letter-spacing: 0.06em;
                text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9); }` });
        await page.evaluate(() => { const d = document.createElement('div'); d.id = 'promo-title'; d.innerHTML = '<h1>Worldroot</h1><p>Grow a seed of light into the World Tree</p>'; document.body.appendChild(d); });
    }
    // let the spirits walk in, the glow settle and the camera ease into place
    const f0 = await page.evaluate(() => window.__wr.state().frames);
    await page.waitForFunction((f) => window.__wr.state().frames >= f, f0 + 45, { timeout: 600000 });
    if (shot.clicks !== undefined) {
        for (let i = 0; i < 3; i++) { const p = await page.evaluate(() => window.__wr.treeScreen(0.45)); await page.mouse.click(p.x, p.y); await page.waitForTimeout(120); }
        await page.waitForTimeout(500);
    }
    const file = path.join(OUT, `${shot.name}.png`);
    await page.screenshot({ path: file });
    console.log(`  ${shot.name}.png ${w}×${h}${errors.length ? `  errors: ${errors.join(' | ')}` : ''}`);
    await ctx.close();
}
await browser.close();
console.log(`→ ${path.relative(path.join(HERE, '..', '..'), OUT)}`);
