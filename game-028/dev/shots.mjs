// Screenshots of many places and screens in one browser, for looking at the art in place.
//   node game-028/dev/shots.mjs [w] [h]   → game-028/dev/shots/*.png
import { launch, serve, BASE } from './serve.mjs';
const [w = 1280, h = 720] = process.argv.slice(2).map(Number);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: w, height: h } });
await serve(page);
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(`${BASE}/game-028/index.html?debug=1`);
await page.waitForFunction(() => window.__ea && !document.getElementById('title').hidden, null, { timeout: 30000 });
const tag = `${w}x${h}`;
const shot = async (name, js, wait = 900) => { await page.evaluate(`(async () => { ${js} })()`); await page.waitForTimeout(wait); await page.screenshot({ path: `game-028/dev/shots/${name}-${tag}.png` }); console.log('shot', name); };
const skip = `for (let i=0;i<60 && __ea.G.mode==='dialog';i++) { if (__ea.send({t:'next'}) === 'choose') __ea.send({t:'choose', i: 0}); }`;
const party = `const G=__ea.G; for (const id of ['orin','sera','thane']) if(!G.party.includes(id)){G.party.push(id); G.equip[id]={weapon:null,armor:null}; G.hp[id]=120; G.mp[id]=40;} G.level=8; G.chapter=4;`;
await shot('dialog', `__ea.start(4); ${skip}; __ea.G.x=3; __ea.G.y=5; __ea.G.face='up'; __ea.send({t:'interact'}); __ea.send({t:'next'});`, 1500);
await shot('thornwood', `${skip}; __ea.warp('thornwood', 11, 9);`);
await shot('village', `__ea.warp('thornhaven', 9, 7);`);
await shot('grove', `${party} __ea.warp('grove', 8, 7);`);
await shot('grove2', `__ea.warp('grove', 8, 5);`);
await shot('academy', `__ea.warp('academy', 7, 6);`);
await shot('chapel', `__ea.warp('chapel', 6, 6);`);
await shot('ruins', `__ea.warp('ruins', 11, 12);`);
await shot('sanctum', `__ea.warp('sanctum', 6, 7);`);
await shot('inn', `__ea.warp('inn', 4, 4);`);
await shot('menu', `__ea.ui.openMenu(__ea.G, 'party');`);
await shot('journal', `__ea.ui.closeTop(); __ea.ui.openMenu(__ea.G, 'journal');`);
await shot('boss', `__ea.ui.closeTop(); __ea.fight('boss_lich', true);`, 3500);
await browser.close();
