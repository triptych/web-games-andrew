// sheet.mjs — tile screenshots into one contact sheet: node dev/sheet.mjs out.png a.png b.png ...
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const [out, ...files] = process.argv.slice(2);
const cols = Number(process.env.COLS ?? 4), cw = Number(process.env.CW ?? 300);
const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:4px">${files.map(f => `<div style="color:#ccc;font:11px sans-serif"><img style="width:${cw}px;display:block" src="data:image/png;base64,${readFileSync(f).toString('base64')}">${f.split('/').pop()}</div>`).join('')}</body>`;
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: cols * (cw + 4), height: 400 } });
await p.setContent(html); await p.waitForTimeout(300);
await p.screenshot({ path: out, fullPage: true }); await b.close();
