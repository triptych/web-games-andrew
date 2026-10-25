// The block language. This catalogue is the single source of truth: the interpreter in world.js
// runs these blocks, the Sticker Press builds its palette and controls from it, and the import
// sanitiser (sanitizeRules) rebuilds untrusted JSON from it, key by key.
//
// A rule is { hat, body }. hat is an event block, body a list of action blocks. Two blocks hold
// more blocks: `if` ({ c, then, else }) and `repeat` ({ n, body }). Conditions are { t, neg, ...params }.
// Everything is plain JSON so a cart is a string you can share.

import { LIMITS } from '../config.js';

export const TAGS = ['hero', 'friend', 'monster', 'boss', 'item', 'building', 'prop', 'fire', 'magic', 'flying', 'door'];
export const ITEMS = ['coin', 'key', 'gem', 'star'];
export const ITEM_ICON = { coin: '🪙', key: '🗝️', gem: '💎', star: '⭐' };
export const MSGS = ['alarm', 'open', 'cheer', 'help'];
export const SOUNDS = ['pew', 'hit', 'coin', 'boom', 'magic', 'roar', 'jump', 'win', 'lose'];
export const FXS = ['sparkle', 'smoke', 'hearts', 'boom', 'stars'];
export const DIRS = ['forward', 'back', 'left', 'right', 'up', 'down'];
export const WHERES = ['front', 'here', 'around', 'random', 'it'];
export const GOTOS = ['next', 'prev', 'first'];
export const VARS = ['A', 'B', 'C'];
export const OPS = ['>=', '<=', '=='];
export const BTNS = ['A', 'B'];
export const WHOS = ['me', 'it', 'nearest', 'around'];
export const CATS = ['events', 'move', 'fight', 'look', 'world', 'logic'];

const P = {
    tag: (def = 'hero') => ({ type: 'tag', def }),
    num: (def, min, max, step = 1) => ({ type: 'num', def, min, max, step }),
    opt: (opts, def) => ({ type: 'opt', opts, def: def ?? opts[0] }),
    sid: (def) => ({ type: 'sid', def }),
    text: (def) => ({ type: 'text', def }),
    who: (m = 'it') => ({ type: 'who', def: { m, tag: 'monster', r: 2 } }),
    secs: (def = 1) => ({ type: 'num', def, min: 0.2, max: 6, step: 0.2 }),
};

/** Events: the first block of a rule. `label` entries starting with $ are parameters. */
export const HATS = {
    start:   { cat: 'events', label: ['when I appear'], params: {} },
    always:  { cat: 'events', label: ['always'], params: {} },
    every:   { cat: 'events', label: ['every', '$sec', 'seconds'], params: { sec: P.num(2, 0.5, 30, 0.5) } },
    touch:   { cat: 'events', label: ['when I touch', '$tag'], params: { tag: P.tag('hero') } },
    near:    { cat: 'events', label: ['when', '$tag', 'comes within', '$r'], params: { tag: P.tag('hero'), r: P.num(4, 1, 12) } },
    press:   { cat: 'events', label: ['when button', '$btn', 'is pressed, wait', '$cd', 's'], params: { btn: P.opt(BTNS), cd: P.num(0.3, 0.1, 2, 0.05) } },
    tapped:  { cat: 'events', label: ['when I am tapped'], params: {} },
    hurt:    { cat: 'events', label: ['when I am hurt'], params: {} },
    die:     { cat: 'events', label: ['when I am defeated'], params: {} },
    message: { cat: 'events', label: ['when I hear', '$msg'], params: { msg: P.opt(MSGS) } },
};

/** Actions. `hidden` blocks are for the console's own stickers and are not offered in the Press. */
export const ACTS = {
    steer:   { cat: 'move', label: ['steer with the stick'], params: { secs: { ...P.secs(0.3), hide: true } } },
    chase:   { cat: 'move', label: ['chase', '$tag', 'for', '$secs', 's'], params: { tag: P.tag('hero'), secs: P.secs(1) } },
    flee:    { cat: 'move', label: ['run from', '$tag', 'for', '$secs', 's'], params: { tag: P.tag('monster'), secs: P.secs(1) } },
    wander:  { cat: 'move', label: ['wander for', '$secs', 's'], params: { secs: P.secs(1) } },
    walk:    { cat: 'move', label: ['walk', '$dir', 'for', '$secs', 's'], params: { dir: P.opt(DIRS), secs: P.secs(1) } },
    fly:     { cat: 'move', label: ['fly forward'], params: { secs: { ...P.secs(0.3), hide: true } } },
    stop:    { cat: 'move', label: ['stand still'], params: {} },

    hurt:    { cat: 'fight', label: ['hurt', '$who', 'by', '$n'], params: { who: P.who('it'), n: P.num(1, 1, 20) } },
    heal:    { cat: 'fight', label: ['heal', '$who', 'by', '$n'], params: { who: P.who('me'), n: P.num(1, 1, 20) } },
    push:    { cat: 'fight', label: ['knock', '$who', 'away'], params: { who: P.who('it') } },
    shoot:   { cat: 'fight', label: ['shoot', '$sid'], params: { sid: P.sid('sparkle') } },

    say:     { cat: 'look', label: ['say', '$text'], params: { text: P.text('Hello!') } },
    fx:      { cat: 'look', label: ['effect', '$kind'], params: { kind: P.opt(FXS) } },
    sound:   { cat: 'look', label: ['play sound', '$name'], params: { name: P.opt(SOUNDS) } },

    spawn:   { cat: 'world', label: ['make', '$n', '$sid', '$where'], params: { n: P.num(1, 1, 5), sid: P.sid('coin'), where: P.opt(WHERES) } },
    become:  { cat: 'world', label: ['turn', '$who', 'into', '$sid'], params: { who: P.who('me'), sid: P.sid('coin') } },
    vanish:  { cat: 'world', label: ['remove', '$who'], params: { who: P.who('me') } },
    give:    { cat: 'world', label: ['give', '$n', '$item'], params: { n: P.num(1, 1, 99), item: P.opt(ITEMS) } },
    take:    { cat: 'world', label: ['take', '$n', '$item'], params: { n: P.num(1, 1, 99), item: P.opt(ITEMS, 'key') } },
    score:   { cat: 'world', label: ['score +', '$n'], params: { n: P.num(10, 1, 999) } },
    goto:    { cat: 'world', label: ['go to the', '$to', 'scene'], params: { to: P.opt(GOTOS) } },
    win:     { cat: 'world', label: ['YOU WIN!'], params: {} },
    lose:    { cat: 'world', label: ['GAME OVER'], params: {} },

    if:      { cat: 'logic', label: ['if', '$c'], params: {}, holds: ['then', 'else'] },
    repeat:  { cat: 'logic', label: ['repeat', '$n', 'times'], params: { n: P.num(3, 2, 10) }, holds: ['body'] },
    setvar:  { cat: 'logic', label: ['set', '$v', 'to', '$n'], params: { v: P.opt(VARS), n: P.num(0, -99, 99) } },
    addvar:  { cat: 'logic', label: ['change', '$v', 'by', '$n'], params: { v: P.opt(VARS), n: P.num(1, -99, 99) } },
    shout:   { cat: 'logic', label: ['shout', '$msg'], params: { msg: P.opt(MSGS) } },

    console: { cat: 'world', hidden: true, label: ['open console', '$open'], params: { open: P.opt(['shelf', 'stage', 'press', 'play']) } },
};

export const CONDS = {
    touching: { label: ['touching', '$tag'], params: { tag: P.tag('hero') } },
    near:     { label: ['a', '$tag', 'is within', '$r'], params: { tag: P.tag('hero'), r: P.num(4, 1, 12) } },
    hp:       { label: ['my health', '$op', '$n'], params: { op: P.opt(OPS, '<='), n: P.num(2, 0, 99) } },
    item:     { label: ['you have', '$item', '$op', '$n'], params: { item: P.opt(ITEMS, 'key'), op: P.opt(OPS), n: P.num(1, 0, 99) } },
    var:      { label: ['variable', '$v', '$op', '$n'], params: { v: P.opt(VARS), op: P.opt(OPS), n: P.num(1, -99, 99) } },
    chance:   { label: ['by chance', '$pct', '%'], params: { pct: P.num(30, 1, 99) } },
    count:    { label: ['how many', '$tag', 'there are', '$op', '$n'], params: { tag: P.tag('monster'), op: P.opt(OPS, '<='), n: P.num(0, 0, 99) } },
};

const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

function fill(spec) {
    const o = {};
    for (const [k, p] of Object.entries(spec.params)) o[k] = clone(p.def);
    return o;
}
export const makeHat = (t) => ({ t, ...fill(HATS[t]) });
export function makeAct(t) {
    const spec = ACTS[t];
    const b = { t, ...fill(spec) };
    if (t === 'if') { b.c = makeCond('near'); b.then = []; b.else = []; }
    if (t === 'repeat') b.body = [];
    return b;
}
export function makeCond(t) { return { t, neg: false, ...fill(CONDS[t]) }; }
export const makeRule = (hatType = 'always') => ({ hat: makeHat(hatType), body: [] });

/** The nested block lists of a block, as [name, array] pairs. */
export function holdsOf(b) {
    const spec = ACTS[b.t];
    return spec?.holds ? spec.holds.map((k) => [k, b[k]]) : [];
}

export function countBlocks(list) {
    let n = 0;
    for (const b of list) { n++; for (const [, sub] of holdsOf(b)) n += countBlocks(sub); }
    return n;
}

/** Visit every action block in a rule list: fn(block, rule). */
export function walkRules(rules, fn) {
    const go = (list, rule) => { for (const b of list) { fn(b, rule); for (const [, sub] of holdsOf(b)) go(sub, rule); } };
    for (const r of rules) go(r.body, r);
}

// ------------------------------------------------------------------ sanitising (untrusted JSON)

const ID_RE = /^[a-z0-9_]{1,16}$/i;
const TAG_RE = /^[a-z0-9_]{1,12}$/i;

function cleanParam(p, v) {
    switch (p.type) {
        case 'num': {
            const n = typeof v === 'number' && Number.isFinite(v) ? v : p.def;
            return Math.min(p.max, Math.max(p.min, n));
        }
        case 'opt': return p.opts.includes(v) ? v : p.def;
        case 'tag': return typeof v === 'string' && TAG_RE.test(v) ? v.toLowerCase() : p.def;
        case 'sid': return typeof v === 'string' && ID_RE.test(v) && !(v in Object.prototype) ? v : p.def;
        case 'text': return typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').slice(0, LIMITS.text) : p.def;
        case 'who': {
            const w = v && typeof v === 'object' ? v : {};
            return {
                m: WHOS.includes(w.m) ? w.m : p.def.m,
                tag: typeof w.tag === 'string' && TAG_RE.test(w.tag) ? w.tag.toLowerCase() : p.def.tag,
                r: typeof w.r === 'number' && Number.isFinite(w.r) ? Math.min(12, Math.max(1, w.r)) : p.def.r,
            };
        }
        default: return p.def;
    }
}

function cleanWith(spec, raw, base) {
    const src = raw && typeof raw === 'object' ? raw : {};
    for (const [k, p] of Object.entries(spec.params)) base[k] = cleanParam(p, src[k]);
    return base;
}

function cleanCond(raw) {
    const t = raw && typeof raw.t === 'string' && Object.hasOwn(CONDS, raw.t) ? raw.t : 'near';
    const c = cleanWith(CONDS[t], raw, { t, neg: !!(raw && raw.neg) });
    return c;
}

function cleanBlocks(list, depth, budget) {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (const raw of list) {
        if (budget.n <= 0) break;
        if (!raw || typeof raw.t !== 'string' || !Object.hasOwn(ACTS, raw.t)) continue;
        const spec = ACTS[raw.t];
        if (spec.hidden) continue;
        if (spec.holds && depth >= LIMITS.depth) continue;
        budget.n--;
        const b = cleanWith(spec, raw, { t: raw.t });
        if (raw.t === 'if') {
            b.c = cleanCond(raw.c);
            b.then = cleanBlocks(raw.then, depth + 1, budget);
            b.else = cleanBlocks(raw.else, depth + 1, budget);
        } else if (raw.t === 'repeat') b.body = cleanBlocks(raw.body, depth + 1, budget);
        out.push(b);
    }
    return out;
}

/** Rebuild a rule list from untrusted JSON: only known blocks, known keys, clamped values. */
export function sanitizeRules(rules) {
    const out = [];
    if (!Array.isArray(rules)) return out;
    for (const r of rules) {
        if (out.length >= LIMITS.rules) break;
        const ht = r && r.hat && typeof r.hat.t === 'string' ? r.hat.t : null;
        if (!ht || !Object.hasOwn(HATS, ht)) continue;
        const budget = { n: LIMITS.blocks };
        const rule = { hat: cleanWith(HATS[ht], r.hat, { t: ht }), body: cleanBlocks(r.body, 0, budget) };
        out.push(rule);
    }
    return out;
}

/** Plain-English text of a value for tooltips and tests. */
export function valueText(p, v) {
    if (p.type === 'who') {
        if (v.m === 'me') return 'me';
        if (v.m === 'it') return 'it';
        if (v.m === 'nearest') return `the nearest ${v.tag}`;
        return `every ${v.tag} within ${v.r}`;
    }
    return String(v);
}

export function blockText(spec, b) {
    return spec.label.map((s) => {
        if (!s.startsWith('$')) return s;
        const k = s.slice(1);
        if (k === 'c') return condText(b.c);
        return valueText(spec.params[k], b[k]);
    }).join(' ');
}
export function condText(c) {
    const spec = CONDS[c.t];
    const s = spec.label.map((x) => (x.startsWith('$') ? valueText(spec.params[x.slice(1)], c[x.slice(1)]) : x)).join(' ');
    return c.neg ? `not (${s})` : s;
}
