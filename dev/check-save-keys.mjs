#!/usr/bin/env node
/**
 * check-save-keys.mjs — every game is served from one origin (triptych.github.io), so all of them share one
 * localStorage. Two games writing the same key overwrite each other's saves or settings (and a cloud save would
 * upload the wrong game's data). This finds the storage keys each game uses and fails if two games share one.
 *
 *   node dev/check-save-keys.mjs            # the report; exit 1 on a clash
 *   node dev/check-save-keys.mjs --list     # also list every game's keys
 *
 * It reads string literals passed to localStorage.getItem / setItem / removeItem and to lib/core/store.js
 * (readJSON, writeJSON, removeKey, makeSettings, makeSaveSlot), and literals assigned to names like SAVE_KEY,
 * STORAGE_KEY, SETTINGS_KEY, KEY, _SAVE_KEY or PREFIX (anything containing KEY or PREFIX), keys returned from a
 * getter, Kaplay's getData/setData, a game's own wrappers (storeGet, saveData, …), and, in files that use
 * localStorage, literals shaped like save keys (name_v1, name.v2, name_save, name_settings). Keys built at run time
 * (`${SAVE_KEY}.settings`) follow their base, which is checked. Keys under `web-games.` are shared on purpose (the cloud sign-in in lib/core/cloud.js).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIST = process.argv.includes('--list');
const SHARED = /^web-games\./;
const SKIP_DIRS = new Set(['node_modules', 'dev', 'shots', 'models', 'art', 'audio', 'assets', 'img', 'images', 'sounds', 'music', 'package']);

// calls that take a key: localStorage, lib/core/store.js, Kaplay's getData/setData, and a game's own wrappers
// (storeGet, saveSet, loadData, …)
const CALL = /\b(?:localStorage\.(?:getItem|setItem|removeItem)|readJSON|writeJSON|removeKey|makeSettings|makeSaveSlot|getData|setData|(?:store|storage)[A-Z]\w*|(?:save|load)(?:Data|Get|Set|Item|JSON|Value|Key))\(\s*(['"`])([^'"`$\n]{2,80})\1/g;
// a key returned from a getter: static get _SAVE_KEY() { return '…'; }
const GETTER = /get\s+_?[A-Za-z_]*KEY[A-Za-z_]*\s*\(\)\s*\{\s*return\s+(['"`])([^'"`$\n]{2,80})\1/g;
// in a file that touches localStorage, any literal shaped like a versioned or save key (lanterndeep_run_v1, x.v2)
const SHAPED = /(['"`])([a-z][\w-]*(?:[._-]v\d+(?:[._-]\w+)?|[._-]saves?|[._-]settings|[._-]records?))\1/gi;
const ASSIGN = /(?<![\w$])(_?[A-Z0-9_]*(?:KEY|PREFIX)[A-Z0-9_]*|SAVE|STORAGE|STORE)\s*[:=]\s*(['"`])([^'"`$\n]{2,80})\2/g;

function jsFiles(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) jsFiles(path.join(dir, e.name), out); }
        else if (/\.(m?js|html)$/.test(e.name)) out.push(path.join(dir, e.name));
    }
    return out;
}

const owners = new Map();       // key → Set(game)
const perGame = {};
for (const g of fs.readdirSync(ROOT).filter((d) => /^game-\d+$/.test(d)).sort()) {
    const keys = new Set();
    for (const f of jsFiles(path.join(ROOT, g))) {
        const src = fs.readFileSync(f, 'utf8');
        for (const m of src.matchAll(CALL)) if (!/\s/.test(m[2])) keys.add(m[2]);
        for (const m of src.matchAll(GETTER)) keys.add(m[2]);
        if (/localStorage|setData\(/.test(src)) for (const m of src.matchAll(SHAPED)) keys.add(m[2]);
        for (const m of src.matchAll(ASSIGN)) {
            const v = m[3];
            // only things that look like storage keys: no spaces, not a key-code name like 'ArrowUp' or 'KeyW'
            if (!/\s/.test(v) && /[._-]|\d|^[a-z]/.test(v) && !/^(Key|Digit|Arrow|Numpad)/.test(v)) keys.add(v);
        }
    }
    perGame[g] = [...keys].sort();
    for (const k of keys) if (!SHARED.test(k)) { if (!owners.has(k)) owners.set(k, new Set()); owners.get(k).add(g); }
}

const clashes = [...owners].filter(([, gs]) => gs.size > 1);
if (LIST) for (const [g, ks] of Object.entries(perGame)) console.log(`${g}: ${ks.join(', ') || '(none found)'}`);
const none = Object.entries(perGame).filter(([, ks]) => !ks.length).map(([g]) => g);
console.log(`${Object.keys(perGame).length} games, ${owners.size} storage keys${none.length ? `, ${none.length} with none found (no saves, or keys built at run time)` : ''}`);
if (clashes.length) {
    console.log(`\nFAIL: ${clashes.length} key(s) used by more than one game (they overwrite each other's data):`);
    for (const [k, gs] of clashes) console.log(`  ${k}: ${[...gs].join(', ')}`);
    process.exit(1);
}
console.log('ok: no two games share a storage key');
