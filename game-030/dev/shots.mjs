// Screenshots of many places and screens in one browser, for looking at the art in place.
//   node game-030/dev/shots.mjs [w] [h]   → game-030/dev/shots/*.png
import { launch, serve, BASE } from './serve.mjs';
const [w = 1280, h = 720] = process.argv.slice(2).map(Number);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: w, height: h } });
await serve(page);
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(`${BASE}/game-030/index.html?debug=1`);
await page.waitForFunction(() => window.__cl && !document.getElementById('title').hidden, null, { timeout: 30000 });
const tag = `${w}x${h}`;
const shot = async (name, js, wait = 900) => { await page.evaluate(`(async () => { ${js} })()`); await page.waitForTimeout(wait); await page.screenshot({ path: `game-030/dev/shots/${name}-${tag}.png` }); console.log('shot', name); };
const skip = `for (let i=0;i<60 && __cl.G.mode==='dialog';i++) { if (__cl.send({t:'next'}) === 'choose') __cl.send({t:'choose', i: 0}); }`;
const party = `const G=__cl.G; for (const id of ['orin','sera','thane']) if(!G.party.includes(id)){G.party.push(id); G.equip[id]={weapon:null,armor:null}; G.hp[id]=120; G.mp[id]=40;} G.level=8; G.chapter=4;`;
await shot('dialog', `__cl.start(4); ${skip}; __cl.G.x=3; __cl.G.y=5; __cl.G.face='up'; __cl.send({t:'interact'}); __cl.send({t:'next'});`, 1500);
await shot('thornwood', `${skip}; __cl.warp('thornwood', 11, 9);`);
await shot('village', `__cl.warp('thornhaven', 9, 7);`);
await shot('grove', `${party} __cl.warp('grove', 8, 7);`);
await shot('grove2', `__cl.warp('grove', 8, 5);`);
await shot('academy', `__cl.warp('academy', 7, 6);`);
await shot('chapel', `__cl.warp('chapel', 6, 6);`);
await shot('ruins', `__cl.warp('ruins', 11, 12);`);
await shot('sanctum', `__cl.warp('sanctum', 6, 7);`);
await shot('inn', `__cl.warp('inn', 4, 4);`);
await shot('menu', `__cl.ui.openMenu(__cl.G, 'party');`);
await shot('journal', `__cl.ui.closeTop(); __cl.ui.openMenu(__cl.G, 'journal');`);
await shot('boss', `__cl.ui.closeTop(); __cl.fight('boss_lich', true);`, 3500);
await browser.close();
