/**
 * Build a self-contained zip for itch.io (or any static host).
 *
 * Usage from the repo root:
 *   node dev/itch/export.mjs game-065
 *   node dev/itch/export.mjs game-064 --name krakens-gambit
 *
 * The build copies the game folder without dev/, vendors shared repo files that
 * the page references with ../lib/, vendors three.js import maps that point at
 * unpkg, removes the repo launcher link, and writes an itch-ready zip with
 * index.html at the top.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const CDN_DEFAULT = 'https://unpkg.com/three@0.165.0/';

export async function buildItch(options = {}) {
    const gameDir = path.resolve(fromUrl(options.gameDir ?? process.argv[2] ?? 'game-065'));
    const repoDir = path.resolve(fromUrl(options.repoDir ?? REPO));
    const htmlPath = path.join(gameDir, 'index.html');
    if (!fs.existsSync(htmlPath)) throw new Error(`${path.relative(repoDir, gameDir)} has no index.html`);

    const html0 = fs.readFileSync(htmlPath, 'utf8');
    const title = options.title ?? titleFromHtml(html0) ?? path.basename(gameDir);
    const name = options.outName ?? cliValue('--name') ?? slug(title) ?? path.basename(gameDir);
    const outRoot = path.resolve(fromUrl(options.outRoot ?? path.join(gameDir, 'dev', 'itch')));
    const outDir = path.join(outRoot, name);
    const zipPath = path.join(outRoot, `${name}-itch.zip`);
    const pkg = path.resolve(fromUrl(options.threePackage ?? process.env.THREE_PKG ?? path.join(gameDir, 'dev', 'package')));

    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    copyGame(gameDir, outDir);

    let html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    html = copyRepoScripts(html, repoDir, outDir);
    const three = await vendorThree(html, outDir, pkg);
    html = three.html;
    html = removeLauncherLink(html);
    if (/\.\.\//.test(html)) {
        throw new Error('index.html still contains ../ paths; add exporter support for those shared files before uploading');
    }
    fs.writeFileSync(path.join(outDir, 'index.html'), html);

    const files = [...walk(outDir)].sort();
    fs.writeFileSync(zipPath, zip(files.map((f) => [rel(outDir, f), fs.readFileSync(f)])));

    const total = files.reduce((n, f) => n + fs.statSync(f).size, 0);
    if (three.used) {
        console.log(`three.js: build/three.module.js + ${three.addons.size} add-on files (${[...three.addons].map((f) => path.basename(f)).join(', ') || 'none'})`);
    }
    console.log(`${files.length} files, ${kb(total)} -> ${path.relative(repoDir, zipPath)} (${kb(fs.statSync(zipPath).size)})`);
    console.log('Upload the zip to itch.io as an HTML project ("This file will be played in the browser").');

    return { outDir, zipPath, files, title, name };
}

function copyGame(gameDir, outDir) {
    for (const entry of fs.readdirSync(gameDir, { withFileTypes: true })) {
        if (entry.name === 'dev') continue;
        if (entry.name === 'game-plan.md') continue;
        const src = path.join(gameDir, entry.name);
        const dest = path.join(outDir, entry.name);
        fs.cpSync(src, dest, { recursive: true });
    }
}

function copyRepoScripts(html, repoDir, outDir) {
    return html.replace(/<script\b([^>]*?)\bsrc=["']\.\.\/lib\/([^"']+)["']([^>]*)><\/script>/g, (m, before, libFile, after) => {
        const src = path.join(repoDir, 'lib', libFile);
        if (!fs.existsSync(src)) throw new Error(`shared script ../lib/${libFile} not found`);
        const dest = path.join(outDir, 'lib', libFile);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        return `<script${before}src="lib/${libFile}"${after}></script>`;
    });
}

async function vendorThree(html, outDir, pkg) {
    const map = parseThreeMap(html);
    if (!map) return { html, used: false, addons: new Set() };
    const cdn = map.core.slice(0, -'build/three.module.js'.length);

    async function threeFile(file) {
        const local = path.join(pkg, file);
        if (fs.existsSync(local)) return fs.readFileSync(local);
        const res = await fetch(cdn + file);
        if (!res.ok) throw new Error(`${cdn + file}: ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
    }

    async function vendor(file) {
        const dest = path.join(outDir, 'vendor', 'three', file);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const buf = await threeFile(file);
        fs.writeFileSync(dest, buf);
        return buf.toString('utf8');
    }

    const importRe = /(?:\bfrom|\bimport)\s*['"]([^'"]+)['"]/g;
    const addons = new Set();
    const jsDir = path.join(outDir, 'js');
    if (fs.existsSync(jsDir)) {
        for (const file of walk(jsDir)) {
            const src = fs.readFileSync(file, 'utf8');
            for (const [, spec] of src.matchAll(importRe)) {
                if (spec.startsWith('three/addons/')) addons.add(`examples/jsm/${spec.slice('three/addons/'.length)}`);
            }
        }
    }

    const done = new Set();
    const todo = [...addons];
    while (todo.length) {
        const file = todo.pop();
        if (done.has(file)) continue;
        done.add(file);
        const src = await vendor(file);
        for (const [, spec] of src.matchAll(importRe)) {
            if (spec === 'three') continue;
            if (!spec.startsWith('.')) throw new Error(`${file} imports ${spec}: not handled`);
            todo.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));
        }
    }

    const core = await vendor('build/three.module.js');
    for (const [, spec] of core.matchAll(importRe)) throw new Error(`three.module.js imports ${spec}: not handled`);
    await vendor('LICENSE');

    html = html.replace(map.core, './vendor/three/build/three.module.js');
    if (map.addons) html = html.replace(map.addons, './vendor/three/examples/jsm/');
    if (html.includes(cdn) || html.includes(CDN_DEFAULT)) throw new Error('index.html still reaches the three.js CDN');
    return { html, used: true, addons: done };
}

function parseThreeMap(html) {
    const core = html.match(/"three"\s*:\s*"([^"]+build\/three\.module\.js)"/)?.[1];
    if (!core) return null;
    return {
        core,
        addons: html.match(/"three\/addons\/"\s*:\s*"([^"]+examples\/jsm\/)"/)?.[1] ?? null,
    };
}

function removeLauncherLink(html) {
    const before = html;
    html = html.replace(/\n[ \t]*<a\b(?=[^>]*\bhref=["']\.\.\/index\.html["'])(?=[^>]*\bid=["'](?:games-link|back-link)["'])[^>]*>[\s\S]*?<\/a>/, '');
    html = html.replace(/\n[ \t]*<a\b(?=[^>]*\bid=["'](?:games-link|back-link)["'])(?=[^>]*\bhref=["']\.\.\/index\.html["'])[^>]*>[\s\S]*?<\/a>/, '');
    if (before === html && /\.\.\/index\.html/.test(html)) {
        throw new Error('index.html: launcher link found but not recognized');
    }
    return html;
}

function* walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(p); else yield p;
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

function zip(entries) {
    const parts = [], central = [];
    let offset = 0;
    const dosTime = 0, dosDate = (2026 - 1980) << 9 | 1 << 5 | 1;
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

function titleFromHtml(html) {
    const raw = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    return raw ? raw.replace(/&amp;/g, '&') : null;
}

function slug(s) {
    return String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function cliValue(flag) {
    const i = process.argv.indexOf(flag);
    return i >= 0 ? process.argv[i + 1] : null;
}

function fromUrl(v) {
    return v instanceof URL ? fileURLToPath(v) : v;
}

function rel(from, to) {
    return path.relative(from, to).split(path.sep).join('/');
}

function kb(n) {
    return `${(n / 1024).toFixed(0)} KB`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    await buildItch();
}
