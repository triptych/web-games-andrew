// One screenshot after a snippet, for iterating on visuals.
//   node game-028/dev/play.mjs [out.png] [snippet] [w] [h]
// The snippet runs in the page with window.__ea (the debug hooks) after a new game starts.
import { launch, serve, BASE } from './serve.mjs';
const [out = 'game-028/dev/shots/play.png', snippet = '', w = 1280, h = 720] = process.argv.slice(2);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
await serve(page);
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-028/index.html?debug=1`);
await page.waitForFunction(() => window.__ea && !document.getElementById('title').hidden, null, { timeout: 30000 });
if (snippet) { await page.evaluate(`(async () => { ${snippet} })()`); }
await page.waitForTimeout(1200);
await page.screenshot({ path: out });
await browser.close();
console.log('wrote', out);
