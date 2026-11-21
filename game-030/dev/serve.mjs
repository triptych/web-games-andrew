/**
 * serve.mjs — the browser harnesses' shared setup. Launches Chromium (SwiftShader WebGL) and serves
 * the repo straight from disk through Playwright's request routing, so no web server has to run:
 * http://game.local/<path> is the file at <repo>/<path>. three.js comes from unpkg.com, or from a
 * local copy of the package if one is there (dev/package or THREE_PKG). Google Fonts are stubbed.
 * Set BASE=http://127.0.0.1:8111 to use a real server instead.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const BASE = process.env.BASE ?? 'http://game.local';
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(ROOT, 'dev/package')].find((p) => fs.existsSync(p));
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
    '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon' };

export async function launch() {
    return chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
}

/** Route a page (or a context) so the game loads from disk. */
export async function serve(page) {
    if (BASE === 'http://game.local') {
        await page.route('http://game.local/**', (route) => {
            const rel = decodeURIComponent(new URL(route.request().url()).pathname);
            let file = path.join(ROOT, rel);
            if (!file.startsWith(ROOT)) return route.abort();
            if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
            if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
            route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
        });
    }
    if (PKG) {
        await page.route('https://unpkg.com/**', (route) => {
            const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
}
