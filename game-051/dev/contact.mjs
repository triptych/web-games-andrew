/**
 * contact.mjs — tiles screenshots into one contact sheet (dev aid).
 *   node contact.mjs out.png cols width img1.png img2.png ...
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [, , out, cols = 5, width = 1600, ...imgs] = process.argv;
const html = `<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;width:${width}px">${imgs.map((f) => `<div style="position:relative"><img style="width:100%;display:block" src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><div style="position:absolute;top:0;left:0;background:#000a;color:#fff;font:12px sans-serif;padding:2px 4px">${path.basename(f)}</div></div>`).join('')}</body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +width, height: 400 } });
await p.setContent(html);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log('saved', out);
