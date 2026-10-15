/**
 * Build a self-contained zip for itch.io (or any static host).
 *
 * Usage from the repo root:
 *   node dev/itch/export.mjs game-065
 *   node dev/itch/export.mjs game-064 --name krakens-gambit
 *
 * The build copies the game folder without dev/, vendors shared repo files that
 * the game references from /lib (script tags and ES module imports), vendors
 * three.js import maps that point at unpkg, hides the repo launcher link, and
 * writes an itch-ready zip with index.html at the top.
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
    const pkg = path.resolve(fromUrl(options.threePackage ?? process.env.THREE_PKG ?? firstDir(path.join(gameDir, 'dev', 'package'), path.join(repoDir, 'dev', 'package'))));

    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    copyGame(gameDir, outDir);

    fs.writeFileSync(path.join(outDir, 'index.html'), hideLauncherLinks(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')));
    const shared = vendorRepoFiles(gameDir, outDir, repoDir);
    const three = await vendorThree(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8'), outDir, pkg);
    fs.writeFileSync(path.join(outDir, 'index.html'), three.html);

    const files = [...walk(outDir)].sort();
    fs.writeFileSync(zipPath, zip(files.map((f) => [rel(outDir, f), fs.readFileSync(f)])));

    const total = files.reduce((n, f) => n + fs.statSync(f).size, 0);
    if (three.used) {
        console.log(`three.js: build/three.module.js + ${three.addons.size} add-on files (${[...three.addons].map((f) => path.basename(f)).join(', ') || 'none'})`);
    }
    if (shared.copied.size) console.log(`shared: ${[...shared.copied].join(', ')}`);
    for (const w of shared.warnings) console.warn(`warning: ${w}`);
    console.log(`${files.length} files, ${kb(total)} -> ${path.relative(repoDir, zipPath)} (${kb(fs.statSync(zipPath).size)})`);
    console.log('Upload the zip to itch.io as an HTML project ("This file will be played in the browser").');

    return { outDir, zipPath, files, title, name, warnings: shared.warnings };
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

// Rewrites every relative path in the game's HTML, JS and CSS that leaves the
// game folder. Files under the repo's /lib are copied into lib/ in the build.
// A link back to the repo launcher, or a path to a file that does not exist
// (usually a comment), is left alone with a warning. Anything else stops the
// build, because it would 404 on itch.io.
function vendorRepoFiles(gameDir, outDir, repoDir) {
    const libDir = path.join(repoDir, 'lib');
    const launcher = path.join(repoDir, 'index.html');
    const copied = new Set();
    const warnings = [];
    for (const file of [...walk(outDir)]) {
        if (!/\.(html|m?js|css)$/.test(file)) continue;
        const relPath = rel(outDir, file);
        const srcDir = path.dirname(path.join(gameDir, relPath));
        const src = fs.readFileSync(file, 'utf8');
        const out = src.replace(/(["'`(])((?:\.\.\/)+[^"'`)\s?#]*)/g, (m, quote, spec) => {
            const target = path.resolve(srcDir, spec);
            // Script strings such as location.href resolve against the page, not the module.
            if (target === launcher || (spec === '../index.html' && /\.m?js$/.test(file))) {
                warnings.push(`${relPath} links to ../index.html (the repo launcher); that link is dead on itch.io`);
                return m;
            }
            if (inside(gameDir, target)) return m;
            if (!fs.existsSync(target)) {
                warnings.push(`${relPath} mentions ${spec}, which does not exist (a comment?); left as is`);
                return m;
            }
            if (!inside(libDir, target)) {
                throw new Error(`${relPath}: ${spec} points outside the game folder; add exporter support for it before uploading`);
            }
            const libFile = rel(libDir, target);
            const dest = path.join(outDir, 'lib', libFile);
            if (!copied.has(libFile)) {
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                fs.copyFileSync(target, dest);
                copied.add(libFile);
            }
            const ref = rel(path.dirname(file), dest);
            return quote + (ref.startsWith('.') ? ref : `./${ref}`);
        });
        if (out !== src) fs.writeFileSync(file, out);
    }
    return { copied, warnings };
}

async function vendorThree(html, outDir, pkg) {
    const map = parseThreeMap(html);
    if (!map) return { html, used: false, addons: new Set() };
    const cdn = map.core.slice(0, -'build/three.module.js'.length);
    const want = cdn.match(/three@([\d.]+)/)?.[1];
    const have = fs.existsSync(path.join(pkg, 'package.json')) && JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8')).version;
    if (want && have && want !== have) throw new Error(`${pkg} is three ${have}, but the game imports three ${want}`);

    async function threeFile(file) {
        const local = path.join(pkg, file);
        if (fs.existsSync(local)) return fs.readFileSync(local);
        const res = await fetch(cdn + file).catch((e) => {
            throw new Error(`${cdn + file}: ${e.cause?.message ?? e.message}. No network? Put an npm pack of three in dev/package (see dev/itch/README.md)`);
        });
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

// The "← Games" link back to the repo launcher means nothing on itch.io. Some
// games' scripts look the link up, so it is hidden rather than removed; other
// links to the launcher (in running text) are unwrapped to plain text.
function hideLauncherLinks(html) {
    const style = '<style>[data-itch-hidden] { display: none !important; }</style>';
    const hasHead = /<\/head>/i.test(html);
    let hidden = 0;
    html = html.replace(/<a\b([^>]*?)\s+href=["']\.\.\/index\.html["']([^>]*)>([\s\S]*?)<\/a>/g, (m, before, after, text) => {
        if (!/^\s*(←|&larr;|⌂)/.test(text)) return text;
        const link = `<a${before}${after} data-itch-hidden aria-hidden="true" tabindex="-1">${text}</a>`;
        // A page without </head> gets the style next to its first hidden link.
        return hidden++ || hasHead ? link : style + link;
    });
    if (hidden && hasHead) html = html.replace(/<\/head>/i, `    ${style}\n</head>`);
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

function inside(dir, p) {
    const r = path.relative(dir, p);
    return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
}

function firstDir(...dirs) {
    return dirs.find((d) => fs.existsSync(d)) ?? dirs[0];
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
