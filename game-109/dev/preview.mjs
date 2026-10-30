/**
 * preview.mjs — the 1200×630 share and Garden Library picture. The game is a portrait arcade
 * cabinet, so the picture is a little poster: the logo and the pitch either side of the playfield,
 * which is caught in the middle of a boss blowing up.
 *
 * The generic dev/screenshots.mjs clicks past the title and photographs wave 1; this one sets up the
 * moment through the debug hooks. It writes dev/shots/preview.jpg; copy it to
 * garden/img/games/game-109.jpg, then `ONLY=game-109 node dev/add-meta.mjs`.
 *
 *   python3 -m http.server 8109          # from the REPO ROOT
 *   node game-109/dev/preview.mjs [boss wave: 5|10|15] [seed]
 *   cp game-109/dev/shots/preview.jpg garden/img/games/game-109.jpg
 *
 * Env: BASE (default http://127.0.0.1:8109), PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8109';
const [wave = '10', seed = '5'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-109/index.html?debug=1`);
await page.waitForFunction(() => window.__sb);
await page.evaluate(([w, s]) => {
    __sb.start(s);
    __sb.wave(w);
    const G = __sb.G;
    G.player.weapon = 5; G.player.speed = 2; G.player.shield = 1; G.player.inv = 0; G.bombs = 4; G.lives = 4;
    G.score = 184350; G.chain = 17; G.chainT = 1;
    __sb.ff(16, 1);                                    // the bot fights the boss
    const boss = G.enemies.find((e) => e.boss);
    if (boss) { boss.hp = 1; G.pbullets.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, dmg: 5, pierce: 0, k: 0 }); }
    __sb.ff(1.5, 1);                                   // ... and it comes apart
    for (const id of [...__sb.ui.stack]) __sb.ui.closeScreen(id);
    document.getElementById('btn-pause').hidden = true;
    document.getElementById('back-link').style.display = 'none';
    // the poster: logo on the left, the pitch on the right
    const css = document.createElement('style');
    css.textContent = `
      .poster { position: fixed; top: 0; bottom: 0; z-index: 5; display: flex; flex-direction: column; justify-content: center; gap: 18px; width: 330px; pointer-events: none; text-align: center; }
      .poster.l { left: 30px; } .poster.r { right: 30px; text-align: left; }
      .poster .logo { margin: 0; } .poster .logo .l1 { font-size: 38px; } .poster .logo .l2 { font-size: 50px; }
      .poster .year { font-size: 22px; } .poster p { font-size: 11px; line-height: 2.1; color: #cfd6ff; margin: 0; }
      .poster ul { list-style: none; margin: 0; padding: 0; font-size: 12px; line-height: 2.3; color: #fff; }
      .poster li::before { content: '\\25B6 '; color: #ffec27; }
      .poster h3 { color: #29e5ff; font-size: 13px; margin: 0 0 6px; }`;
    document.head.appendChild(css);
    const mk = (cls, html) => { const d = document.createElement('div'); d.className = 'poster ' + cls; d.innerHTML = html; document.body.appendChild(d); };
    mk('l', `<h1 class="logo"><span class="l1">STAR</span><span class="l2">BLAZER</span></h1><div class="year">'86</div><p>AN 8-BIT ARCADE<br>SPACE SHOOTER</p>`);
    mk('r', `<h3>INSERT COIN</h3><ul><li>Galaga-style dive waves</li><li>Boss fights &amp; bonus stages</li><li>Chain-kill score combos</li><li>Colourful chiptune chaos</li></ul>`);
}, [+wave, +seed]);
await page.waitForTimeout(350);
await page.screenshot({ path: path.join(HERE, 'shots', 'preview.jpg'), type: 'jpeg', quality: 88 });
console.log('wrote dev/shots/preview.jpg');
await browser.close();
