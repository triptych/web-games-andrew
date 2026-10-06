// Screenshots any page of the game (or the dev viewer) with real WebGL.
//   node game-062/dev/shot.mjs "dev/view.html?hole=1-2&cam=aim" name [w h]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8062/game-062/';
const [url, name = 'shot', w = 1280, h = 760] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
if (PKG) await page.route('https://unpkg.com/**', (r) => { const rel = new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); const f = path.join(PKG, rel); return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : r.abort(); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
let nlog = 0;
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && nlog++ < 12) console.log(m.type(), m.text().slice(0, 600)); });
page.on('pageerror', (e) => console.log('pageerror', e.message, e.stack?.split('\n').slice(0, 4).join(' | ')));
await page.goto(BASE + url);
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 }).catch((e) => console.log('not ready', e.message));
await page.screenshot({ path: path.join(HERE, 'shots', name + '.png') });
await browser.close();
console.log('saved', name);
