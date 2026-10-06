/**
 * itch.mjs — build a self-contained Worldroot for itch.io (or any static host).
 *
 *   node game-065/dev/itch.mjs
 *
 * Writes game-065/dev/itch/worldroot/ (the folder, for testing) and
 * game-065/dev/itch/worldroot-itch.zip (upload this; index.html is at the top).
 *
 * What it changes from the repo version, so nothing outside the zip is needed:
 *  - three.js r165 is copied in (vendor/three/: the core build and only the
 *    add-on files the game imports, followed through their own imports, plus
 *    three.js's MIT licence), and the import map points there instead of unpkg.
 *  - ../lib/page-audio.js (silence while the tab is hidden) is copied to lib/.
 *  - the "← Games" link back to this repo's launcher is removed.
 * dev/ is left out. Google Fonts stay a link: if they are blocked, the page
 * falls back to Georgia and the system font and plays the same.
 *
 * three.js comes from dev/package (see dev/README.md) if it is there, else it
 * is downloaded once from unpkg.com.
 *
 * Test the build like the repo version:
 *   python3 -m http.server 8066 -d game-065/dev/itch/worldroot
 *   ITCH=1 node game-065/dev/browsertest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.join(HERE, '..');
const REPO = path.join(GAME, '..');
const OUT = path.join(HERE, 'itch');
const DIR = path.join(OUT, 'worldroot');
const ZIP = path.join(OUT, 'worldroot-itch.zip');
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const CDN = 'https://unpkg.com/three@0.165.0/';

// ------------------------------------------------------------------ the game itself
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
for (const f of ['index.html', 'style.css', 'js']) fs.cpSync(path.join(GAME, f), path.join(DIR, f), { recursive: true });
fs.mkdirSync(path.join(DIR, 'lib'));
fs.copyFileSync(path.join(REPO, 'lib', 'page-audio.js'), path.join(DIR, 'lib', 'page-audio.js'));

// ------------------------------------------------------------------ three.js
async function threeFile(rel) {
    const local = path.join(PKG, rel);
    if (fs.existsSync(local)) return fs.readFileSync(local);
    const res = await fetch(CDN + rel);
    if (!res.ok) throw new Error(`${CDN + rel}: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}
async function vendor(rel) {
    const dest = path.join(DIR, 'vendor', 'three', rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const buf = await threeFile(rel);
    fs.writeFileSync(dest, buf);
    return buf.toString('utf8');
}
const importRe = /(?:\bfrom|\bimport)\s*['"]([^'"]+)['"]/g;

// every three/addons/… the game imports, then whatever those import in turn
const addons = new Set();
for (const f of walk(path.join(DIR, 'js'))) {
    for (const [, spec] of fs.readFileSync(f, 'utf8').matchAll(importRe)) {
        if (spec.startsWith('three/addons/')) addons.add(`examples/jsm/${spec.slice('three/addons/'.length)}`);
    }
}
const done = new Set();
const todo = [...addons];
while (todo.length) {
    const rel = todo.pop();
    if (done.has(rel)) continue;
    done.add(rel);
    const src = await vendor(rel);
    for (const [, spec] of src.matchAll(importRe)) {
        if (spec === 'three') continue;
        if (!spec.startsWith('.')) throw new Error(`${rel} imports ${spec}: not handled`);
        todo.push(path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec)));
    }
}
const core = await vendor('build/three.module.js');
for (const [, spec] of core.matchAll(importRe)) throw new Error(`three.module.js imports ${spec}: not handled`);
await vendor('LICENSE');

// ------------------------------------------------------------------ index.html
let html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const swap = (from, to, what) => {
    if (!html.includes(from)) throw new Error(`index.html: ${what} not found`);
    html = html.replace(from, to);
};
swap(`"three": "${CDN}build/three.module.js"`, '"three": "./vendor/three/build/three.module.js"', 'three in the import map');
swap(`"three/addons/": "${CDN}examples/jsm/"`, '"three/addons/": "./vendor/three/examples/jsm/"', 'three/addons/ in the import map');
swap('<script src="../lib/page-audio.js"></script>', '<script src="lib/page-audio.js"></script>', 'page-audio.js');
const link = html.match(/\n[ \t]*<a href="\.\.\/index\.html" id="games-link"[^\n]*<\/a>/);
if (!link) throw new Error('index.html: the games link not found');
html = html.replace(link[0], '');
if (/\.\.\//.test(html) || html.includes('unpkg.com')) throw new Error('index.html still reaches outside the build');
fs.writeFileSync(path.join(DIR, 'index.html'), html);

// ------------------------------------------------------------------ zip (deflate, no external tools)
const files = [...walk(DIR)].sort();
fs.writeFileSync(ZIP, zip(files.map((f) => [path.relative(DIR, f).split(path.sep).join('/'), fs.readFileSync(f)])));

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const total = files.reduce((n, f) => n + fs.statSync(f).size, 0);
console.log(`three.js: build/three.module.js + ${done.size} add-on files (${[...done].map((f) => path.basename(f)).join(', ')})`);
console.log(`${files.length} files, ${kb(total)} → ${path.relative(REPO, ZIP)} (${kb(fs.statSync(ZIP).size)})`);
console.log('Upload the zip to itch.io as an HTML project ("This file will be played in the browser").');

// ------------------------------------------------------------------ helpers
function* walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) yield* walk(p); else yield p;
    }
}

function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        c = (crc ^ buf[i]) & 0xff;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
}

/** A plain zip archive: deflated entries, a central directory, no extras. */
function zip(entries) {
    const parts = [], central = [];
    let offset = 0;
    const dosTime = 0, dosDate = (2026 - 1980) << 9 | 1 << 5 | 1;    // fixed date: the same input gives the same zip
    for (const [name, data] of entries) {
        const nameBuf = Buffer.from(name, 'utf8');
        const packed = zlib.deflateRawSync(data, { level: 9 });
        const crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
        local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
        parts.push(local, nameBuf, packed);
        const cen = Buffer.alloc(46);
        cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
        cen.writeUInt16LE(dosTime, 12); cen.writeUInt16LE(dosDate, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(packed.length, 20);
        cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
        central.push(cen, nameBuf);
        offset += local.length + nameBuf.length + packed.length;
    }
    const cenBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...parts, cenBuf, end]);
}
