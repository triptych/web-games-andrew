#!/usr/bin/env node
/**
 * check-avatars.mjs — every game (and the Garden) has a Messages character.
 *
 * For each game in js/gamedata.js, and for garden/, checks avatar/avatar.json
 * (see docs/generic/avatars.md): the fields the Pocket Garden's Messages app
 * reads are there and the right shape, every {placeholder} is one the console
 * knows, the update line names {version}, and each save key really appears in
 * the game's own code (a key that doesn't is a character that can never read
 * your save). Then that avatar.webp (256) and avatar-tiny.webp (64) exist, and
 * how many are still the icon stand-in rather than a fal painting.
 *
 *   node dev/check-avatars.mjs            # exits 1 on any error
 *   ONLY=game-001,garden node dev/check-avatars.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const games = (await import(path.join(ROOT, 'js/gamedata.js'))).default;
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;

const KNOWN = new Set(['you', 'game', 'name', 'df', 'version', 'count', 'days', 'ago', 'level', 'gold', 'best', 'score', 'wave', 'day', 'floor', 'stage', 'stars', 'gems', 'wins', 'solved', 'rescued', 'words', 'age']);
const STRINGS = ['name', 'role', 'emoji', 'color', 'bio', 'request', 'about', 'how', 'update'];
const LISTS = { hello: 1, tips: 2, chat: 3, nudge: 1, idle: 1, bye: 1 };

let errors = 0;
let warnings = 0;
let painted = 0;
let checked = 0;
const err = (id, msg) => (errors++, console.log(`  ✗ ${id}: ${msg}`));
const warn = (id, msg) => (warnings++, console.log(`  ! ${id}: ${msg}`));

/** Every .js and .html file of a game (not dev/ or node_modules), as one string. */
function source(dir) {
    let out = '';
    const walk = (d) => {
        for (const f of fs.readdirSync(d, { withFileTypes: true })) {
            if (['dev', 'node_modules', 'avatar', 'icons', 'audio', 'art'].includes(f.name)) continue;
            const p = path.join(d, f.name);
            if (f.isDirectory()) walk(p);
            else if (/\.(js|html)$/.test(f.name) && fs.statSync(p).size < 4e6) out += fs.readFileSync(p, 'utf8');
        }
    };
    walk(dir);
    return out;
}

function lines(a) {
    const out = [];
    for (const k of [...Object.keys(LISTS), 'progress']) for (const x of a[k] || []) out.push([k, x]);
    for (const k of STRINGS) if (typeof a[k] === 'string') out.push([k, a[k]]);
    for (const q of a.questions || []) {
        out.push(['questions', q.q]);
        for (const o of q.a || []) out.push(['questions', o[1]]);
    }
    for (const v of Object.values(a.updates || {})) out.push(['updates', v]);
    return out;
}

const targets = [...games.map((g) => ({ id: g.id, dir: path.join(ROOT, g.folder) })), { id: 'garden', dir: path.join(ROOT, 'garden') }];
for (const { id, dir } of targets) {
    if (only && !only.has(id)) continue;
    checked++;
    const f = path.join(dir, 'avatar', 'avatar.json');
    if (!fs.existsSync(f)) {
        err(id, 'no avatar/avatar.json');
        continue;
    }
    let a;
    try {
        a = JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch (e) {
        err(id, `avatar.json is not JSON (${e.message})`);
        continue;
    }
    if (a.id !== id) err(id, `id is "${a.id}"`);
    for (const k of STRINGS) if (typeof a[k] !== 'string' || !a[k].trim()) err(id, `missing "${k}"`);
    if (a.color && !/^#[0-9a-f]{6}$/i.test(a.color)) err(id, `color "${a.color}" is not #rrggbb`);
    if (!a.portrait?.subject || !a.portrait?.background) err(id, 'missing portrait.subject / portrait.background (the fal prompt)');
    for (const [k, min] of Object.entries(LISTS)) if (!Array.isArray(a[k]) || a[k].length < min) err(id, `"${k}" needs at least ${min} line${min > 1 ? 's' : ''}`);
    for (const q of a.questions || []) {
        if (!q.q || !Array.isArray(q.a) || q.a.length < 2 || q.a.some((o) => !Array.isArray(o) || o.length !== 2)) err(id, `question "${q.q}" needs 2+ answers as [label, reply]`);
    }
    if (id !== 'garden' && a.update && !a.update.includes('{version}')) err(id, 'the update line should name {version}');
    for (const [k, x] of lines(a)) {
        for (const m of x.matchAll(/\{([a-z]+)(\+\d+|\^)?\}/gi)) if (!KNOWN.has(m[1]) && !(a.save?.stats && m[1] in a.save.stats)) err(id, `${k}: unknown placeholder {${m[1]}} in "${x.slice(0, 50)}…"`);
        if (x.length > 260) warn(id, `${k}: a long line (${x.length} chars) for a chat bubble`);
    }
    if (id !== 'garden') {
        const keys = a.save?.keys || [];
        const src = source(dir);
        if (!keys.length && /localStorage/.test(src)) warn(id, 'the game saves, but avatar.json lists no save keys: its character can not talk about your progress');
        if (keys.length) {
            for (const k of keys) {
                const bare = k.replace(/\*$/, '');
                if (!src.includes(bare)) err(id, `save key "${k}" does not appear in the game's code`);
            }
        }
        if (a.progress?.length && !keys.length) warn(id, 'progress lines but no save keys to fill them');
    }
    for (const pic of ['avatar.webp', 'avatar-tiny.webp']) {
        const p = path.join(dir, 'avatar', pic);
        if (!fs.existsSync(p) || fs.statSync(p).size < 200) err(id, `missing avatar/${pic} (python3 dev/make-avatars.py)`);
    }
    if (a.art === 'fal') painted++;
}

console.log(`\n${checked} characters checked: ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}; ${painted} painted with fal, ${checked - painted} still on their icon (python3 dev/make-avatars.py --pending).`);
process.exitCode = errors ? 1 : 0;
