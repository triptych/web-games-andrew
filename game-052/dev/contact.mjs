/**
 * contact.mjs — tiles screenshots into one contact sheet.
 *   node game-052/dev/contact.mjs out.png cols width a.png b.png …
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [out, cols, width, ...files] = process.argv.slice(2);
const imgs = files.map((f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`);
const c = +cols, w = +width;
const html = `<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(${c},${w}px);gap:4px">${imgs.map((s, i) => `<div style="position:relative"><img src="${s}" style="width:${w}px;display:block"><span style="position:absolute;left:4px;top:2px;color:#fff;font:12px monospace;background:#000a">${path.basename(files[i])}</span></div>`).join('')}</body>`;
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: c * (w + 4), height: 300 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out);
