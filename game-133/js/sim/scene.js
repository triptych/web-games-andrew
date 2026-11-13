// The scene runner. Pure: it walks a scene script (see data/story.js for the format), applies its effects to G,
// keeps the stage (background, CG, music, who is standing where) in G.scene.stage, and stops at each line of
// dialogue or choice for the UI to show. The UI never interprets a script; it renders G.scene.

import { applyFx, evalCond } from './rules.js';

const POS = ['c', 'l', 'r'];

/** Split a script line into a directive or a line of dialogue. */
export function parseLine(s) {
    if (typeof s !== 'string') return { kind: 'choice', opts: s.choice };
    if (s[0] === '@') {
        const sp = s.indexOf(' ');
        return { kind: 'dir', cmd: sp < 0 ? s.slice(1) : s.slice(1, sp), arg: sp < 0 ? '' : s.slice(sp + 1).trim() };
    }
    const c = s.indexOf(': ');
    const head = s.slice(0, c);
    const [who, expr] = head.split('.');
    return { kind: 'say', who, expr: expr || 'neutral', text: s.slice(c + 2) };
}

export function newStage() {
    return { bg: null, cg: null, music: null, actors: [] };
}

/**
 * Begin a scene. `lines` is the script, `meta` { id, title, kind, args } is kept for saves and the album.
 * Returns false if it is already finished (an empty script).
 */
export function beginScene(G, meta, lines, { replay = false } = {}) {
    G.scene = { ...meta, pc: 0, stage: G.scene?.stage && meta.keepStage ? G.scene.stage : newStage(), cur: null, replay, n: lines.length };
    G.events.push({ type: 'sceneStart', id: meta.id, title: meta.title, kind: meta.kind });
    return runTo(G, lines);
}

/** Move the stage forward to the next line or choice. Returns false when the scene has ended. */
export function runTo(G, lines) {
    const S = G.scene;
    let guard = 0;
    while (S.pc < lines.length) {
        if (++guard > 5000) throw new Error(`scene ${S.id} loops`);
        const L = parseLine(lines[S.pc]);
        if (L.kind === 'say') {
            stageSpeaker(S.stage, L.who, L.expr);
            S.cur = { who: L.who, expr: L.expr, text: L.text, pc: S.pc };
            return true;
        }
        if (L.kind === 'choice') {
            const opts = L.opts.map((o, i) => ({ ...o, i })).filter((o) => !o.if || evalCond(G, o.if));
            S.cur = { choice: opts, pc: S.pc };
            return true;
        }
        S.pc++;
        if (directive(G, L, lines) === 'end') { S.pc = lines.length; break; }
    }
    S.cur = null;
    return false;
}

function directive(G, L, lines) {
    const S = G.scene, st = S.stage, a = L.arg;
    switch (L.cmd) {
        case 'bg': st.bg = a; st.cg = null; break;
        case 'cg': st.cg = a || null; if (a) G.events.push({ type: 'cg', id: a }); break;
        case 'music': st.music = a; G.events.push({ type: 'music', id: a }); break;
        case 'sfx': G.events.push({ type: 'sfx', id: a }); break;
        case 'show': {
            const [idx, pos] = a.split(' ');
            const [id, expr] = idx.split('.');
            place(st, id, expr || 'neutral', pos);
            break;
        }
        case 'hide':
            st.actors = a === 'all' ? [] : st.actors.filter((x) => x.id !== a);
            break;
        case 'fx': if (!S.replay) applyFx(G, a); break;
        case 'label': break;
        case 'goto': jump(S, lines, a); break;
        case 'if': {
            const m = a.match(/^(.*)\s+goto\s+(\S+)$/);
            if (m && evalCond(G, m[1].trim())) jump(S, lines, m[2]);
            break;
        }
        case 'end': return 'end';
        default: throw new Error(`unknown directive @${L.cmd} in ${S.id}`);
    }
    return null;
}

function jump(S, lines, label) {
    const i = lines.indexOf('@label ' + label);
    if (i < 0) throw new Error(`no label ${label} in ${S.id}`);
    S.pc = i + 1;
}

function place(st, id, expr, pos) {
    const have = st.actors.find((x) => x.id === id);
    if (have) { have.expr = expr; if (pos) have.pos = pos; return; }
    if (!pos) {
        const used = new Set(st.actors.map((x) => x.pos));
        pos = POS.find((p) => !used.has(p));
        if (!pos) {               // full: replace whoever spoke least recently
            const victim = [...st.actors].sort((a, b) => a.t - b.t)[0];
            st.actors = st.actors.filter((x) => x !== victim);
            pos = victim.pos;
        }
    }
    st.actors = st.actors.filter((x) => x.pos !== pos);
    st.actors.push({ id, expr, pos, t: 0 });
}

/** A speaker who is not on stage steps on; a speaker who is changes expression. */
function stageSpeaker(st, who, expr) {
    if (who === 'n' || who === 'you') return;
    st.tick = (st.tick || 0) + 1;
    const have = st.actors.find((x) => x.id === who);
    if (have) { have.expr = expr; have.t = st.tick; return; }
    place(st, who, expr);
    st.actors.find((x) => x.id === who).t = st.tick;
}

/** Advance past the current line. */
export function advance(G, lines) {
    const S = G.scene;
    if (!S || !S.cur || S.cur.choice) return false;
    S.pc++;
    return runTo(G, lines);
}

/** Pick option i (an index into the original choice list) at the current choice. */
export function choose(G, lines, i) {
    const S = G.scene;
    if (!S?.cur?.choice) return false;
    const o = S.cur.choice.find((x) => x.i === i);
    if (!o) return false;
    G.events.push({ type: 'choose', scene: S.id, i, t: o.t });
    if (o.fx && !S.replay) applyFx(G, o.fx);
    S.pc++;
    if (o.go) jump(S, lines, o.go);
    return runTo(G, lines);
}

/** Every label a script jumps to exists, every directive is known, every speaker is a cast id. Used by the tests. */
export function lintScript(lines, castIds) {
    const errs = [];
    const labels = new Set(lines.filter((l) => typeof l === 'string' && l.startsWith('@label ')).map((l) => l.slice(7)));
    const known = new Set(['bg', 'cg', 'music', 'sfx', 'show', 'hide', 'fx', 'label', 'goto', 'if', 'end']);
    for (const raw of lines) {
        const L = parseLine(raw);
        if (L.kind === 'dir') {
            if (!known.has(L.cmd)) errs.push(`unknown @${L.cmd}`);
            if (L.cmd === 'goto' && !labels.has(L.arg)) errs.push(`goto ${L.arg} has no label`);
            if (L.cmd === 'if') { const m = L.arg.match(/goto\s+(\S+)$/); if (!m || !labels.has(m[1])) errs.push(`if ${L.arg}: no label`); }
            if (L.cmd === 'show' && !castIds.has(L.arg.split(' ')[0].split('.')[0])) errs.push(`show unknown ${L.arg}`);
        } else if (L.kind === 'say') {
            if (!castIds.has(L.who)) errs.push(`unknown speaker ${L.who}`);
            if (!L.text) errs.push(`empty line for ${L.who}`);
        } else if (L.kind === 'choice') {
            for (const o of L.opts) if (o.go && !labels.has(o.go)) errs.push(`choice go ${o.go} has no label`);
        }
    }
    return errs;
}
