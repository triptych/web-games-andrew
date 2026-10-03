// node dev/sheet.mjs out.png cols a.png b.png ... — tile screenshots into one image
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out, cols, ...files] = process.argv.slice(2);
const imgs = files.map((f) => `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}">`).join('');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.setContent(`<style>body{margin:0;background:#000;display:grid;grid-template-columns:repeat(${cols},1fr);gap:2px;width:1400px}img{width:100%;display:block}</style>${imgs}`);
await p.waitForTimeout(200);
await p.screenshot({ path: out, fullPage: true });
await b.close();
