// The visual-novel interpreter. Pure. Scenes are written in a small line language (js/sim/story.js), compiled once
// into ops, and run by runVN() until something needs the player: a line to read, a choice, a battle, a mini-game.
//
//   bg courtyard               music academy          sfx bell          cg hana   /   cg off
//   show hana happy left       hide hana   /   hide all
//   > Narration text.          hana blush: Spoken text. [v:thanks]     (the [v:key] plays audio/vo/hana-thanks)
//   choice                     - Option text | hana+3 flag:asked -> label
//   label x    goto x    if hearts:hana>=5 -> x    do lys+2 give:tart lumens:+20 flag:x join:ren quest:petals:1
//   battle archive    mini runes 1 hana    call scene    chapter 2    end
//
// Text can use {name}, {best}, {captive} and {partner}.

import { STORY } from './story.js';
import { addBond, give, test, subst, healParty, best, catchUp } from './rules.js';
import { CAST } from './data.js';

const cache = new Map();

export function compile(src, sceneName = '?') {
    const ops = [];
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i].trim();
        if (!raw || raw.startsWith('#')) continue;
        const err = (m) => { throw new Error(`[${sceneName}:${i + 1}] ${m}: ${raw}`); };
        let m;
        if (raw.startsWith('> ')) { ops.push({ op: 'say', who: null, text: raw.slice(2) }); continue; }
        if (raw === 'choice') {
            const opts = [];
            while (i + 1 < lines.length && lines[i + 1].trim().startsWith('- ')) {
                i++;
                const t = lines[i].trim().slice(2);
                const [text, rest = ''] = t.split('|').map((s) => s.trim());
                const go = rest.match(/->\s*(\w+)/)?.[1] || null;
                const fx = rest.replace(/->\s*\w+/, '').trim().split(/\s+/).filter(Boolean);
                opts.push({ text, fx, go });
            }
            if (!opts.length) err('choice without options');
            ops.push({ op: 'choice', opts });
            continue;
        }
        if ((m = raw.match(/^(bg|music|sfx|cg|battle|call|label|goto|chapter)\s+(\S+)$/))) {
            ops.push({ op: m[1], v: m[2] === 'off' ? null : m[2] });
            continue;
        }
        if ((m = raw.match(/^show\s+(\w+)\s+(\w+)(?:\s+(left|center|right))?$/))) { ops.push({ op: 'show', who: m[1], expr: m[2], pos: m[3] || 'center' }); continue; }
        if ((m = raw.match(/^hide\s+(\w+)$/))) { ops.push({ op: 'hide', who: m[1] }); continue; }
        if ((m = raw.match(/^if\s+(\S+)\s*->\s*(\w+)$/))) { ops.push({ op: 'if', cond: m[1], go: m[2] }); continue; }
        if ((m = raw.match(/^do\s+(.+)$/))) { ops.push({ op: 'fx', fx: m[1].split(/\s+/) }); continue; }
        if ((m = raw.match(/^mini\s+(\w+)\s+(\d)(?:\s+(\w+))?$/))) { ops.push({ op: 'mini', game: m[1], level: +m[2], partner: m[3] || null }); continue; }
        if (raw === 'end') { ops.push({ op: 'end' }); continue; }
        if (raw === 'ending') { ops.push({ op: 'ending' }); continue; }
        if (raw === 'climax') { ops.push({ op: 'climax' }); continue; }
        if ((m = raw.match(/^(\w+)(?:\s+(\w+))?:\s+(.+)$/))) {
            let text = m[3], voice = null;
            const v = text.match(/\s*\[v:(\w+)\]\s*$/);
            if (v) { voice = v[1]; text = text.slice(0, v.index); }
            if (!CAST[m[1]]) err('unknown speaker');
            ops.push({ op: 'say', who: m[1], expr: m[2] || null, text, voice });
            continue;
        }
        err('cannot parse');
    }
    // resolve labels
    const labels = {};
    ops.forEach((o, i) => { if (o.op === 'label') labels[o.v] = i; });
    for (const o of ops) {
        const target = o.op === 'goto' ? o.v : o.go;
        if (target && labels[target] === undefined && (o.op === 'goto' || o.op === 'if')) throw new Error(`[${sceneName}] no label ${target}`);
        if (o.opts) for (const c of o.opts) if (c.go && labels[c.go] === undefined) throw new Error(`[${sceneName}] no label ${c.go}`);
    }
    return { ops, labels };
}

export function scene(name) {
    if (!cache.has(name)) {
        if (!STORY[name]) throw new Error('no scene ' + name);
        cache.set(name, compile(STORY[name], name));
    }
    return cache.get(name);
}

/** Start a scene (replacing any running one unless keep). */
export function startScene(G, name) {
    scene(name);                     // compile now, so a typo fails here
    G.vn = { scene: name, pc: 0, stack: [], say: null, choices: null, wait: null, bg: G.vn?.bg || null, cg: null, show: {}, chapter: null };
    G.mode = 'vn';
    G.events.push({ type: 'scene', name });
}

export function applyFx(G, fx) {
    for (const f of fx) {
        let m;
        if ((m = f.match(/^(hana|lys|pip|ren)([+-]\d+)$/))) addBond(G, m[1], +m[2]);
        else if ((m = f.match(/^give:(\w+)(?::(\d+))?$/))) give(G, m[1], +(m[2] || 1));
        else if ((m = f.match(/^take:(\w+)(?::(\d+))?$/))) give(G, m[1], -(+(m[2] || 1)));
        else if ((m = f.match(/^lumens:([+-]\d+)$/))) { G.lumens = Math.max(0, G.lumens + +m[1]); G.events.push({ type: 'lumens', n: +m[1] }); }
        else if ((m = f.match(/^flag:(\w+)$/))) G.flags[m[1]] = true;
        else if ((m = f.match(/^unflag:(\w+)$/))) delete G.flags[m[1]];
        else if ((m = f.match(/^join:(\w+)$/))) { if (!G.joined[m[1]]) { G.joined[m[1]] = true; catchUp(G, m[1]); G.events.push({ type: 'join', who: m[1] }); } }
        else if ((m = f.match(/^quest:(\w+):(\d+)$/))) { const before = G.quests[m[1]] || 0; G.quests[m[1]] = +m[2]; G.events.push({ type: 'quest', id: m[1], stage: +m[2], was: before }); }
        else if ((m = f.match(/^(romance|friend):(\w+)$/))) { G.romance[m[2]] = m[1]; G.events.push({ type: 'romance', who: m[2], kind: m[1] }); }
        else if ((m = f.match(/^partner:(\w+)$/))) G.partner = m[1] === 'mochi' ? null : m[1];
        else if (f === 'heal') healParty(G);
        else if (f === 'capture') { G.captive = best(G); G.events.push({ type: 'capture', who: G.captive }); }
        else throw new Error('unknown effect ' + f);
    }
}

/**
 * Run the current scene until it needs the player or ends. Hooks (from game.js) start battles and mini-games and
 * handle the end of a scene: hooks.battle(G, enc), hooks.mini(G, game, level, partner), hooks.done(G, sceneName),
 * hooks.ending(G), hooks.climax(G).
 */
export function runVN(G, hooks) {
    let guard = 0;
    while (G.vn && !G.vn.say && !G.vn.choices && !G.vn.wait) {
        if (++guard > 5000) throw new Error('runaway scene ' + G.vn.scene);
        const V = G.vn;
        const { ops, labels } = scene(V.scene);
        if (V.pc >= ops.length) {
            if (V.stack.length) { const r = V.stack.pop(); V.scene = r.scene; V.pc = r.pc; continue; }
            const name = V.scene;
            G.vn = null;
            hooks.done(G, name);
            return;
        }
        const o = ops[V.pc++];
        switch (o.op) {
            case 'bg': V.bg = o.v; V.show = {}; V.cg = null; G.events.push({ type: 'bg', v: o.v }); break;
            case 'music': G.music = o.v; G.events.push({ type: 'music', v: o.v }); break;
            case 'sfx': G.events.push({ type: 'sfx', v: o.v }); break;
            case 'cg': V.cg = o.v; if (o.v) { G.cgSeen[o.v] = true; G.events.push({ type: 'cg', v: o.v }); } break;
            case 'show': {
                for (const p of Object.keys(V.show)) if (V.show[p].who === o.who) delete V.show[p];
                V.show[o.pos] = { who: o.who, expr: o.expr };
                break;
            }
            case 'hide':
                if (o.who === 'all') V.show = {};
                else for (const p of Object.keys(V.show)) if (V.show[p].who === o.who) delete V.show[p];
                break;
            case 'say': {
                if (o.who && o.expr) for (const p of Object.keys(V.show)) if (V.show[p].who === o.who) V.show[p].expr = o.expr;
                V.say = { who: o.who, expr: o.expr, text: subst(G, o.text), voice: o.voice };
                G.events.push({ type: 'say', who: o.who, voice: o.voice });
                break;
            }
            case 'choice':
                V.choices = o.opts.map((c) => ({ text: subst(G, c.text), fx: c.fx, go: c.go }));
                G.events.push({ type: 'choices', n: o.opts.length });
                break;
            case 'label': break;
            case 'goto': V.pc = labels[o.v]; break;
            case 'if': if (test(G, o.cond)) V.pc = labels[o.go]; break;
            case 'fx': applyFx(G, o.fx); break;
            case 'chapter': V.wait = { kind: 'chapter', n: +o.v }; G.chapter = +o.v; G.events.push({ type: 'chapter', n: +o.v }); break;
            case 'call': V.stack.push({ scene: V.scene, pc: V.pc }); scene(o.v); V.scene = o.v; V.pc = 0; break;
            case 'battle': V.wait = { kind: 'battle', enc: o.v }; hooks.battle(G, o.v); break;
            case 'mini': V.wait = { kind: 'mini', game: o.game }; hooks.mini(G, o.game, o.level, o.partner); break;
            case 'end': V.pc = ops.length; break;      // ends this scene; a caller carries on
            case 'ending': V.pc = ops.length; V.stack.length = 0; G.vn = null; hooks.ending(G); return;
            case 'climax': V.pc = ops.length; V.stack.length = 0; G.vn = null; hooks.climax(G); return;
            default: throw new Error('bad op ' + o.op);
        }
    }
}

/** The player read the line (or the chapter card). */
export function vnNext(G, hooks) {
    const V = G.vn;
    if (!V) return false;
    if (V.choices) return false;
    if (V.wait?.kind === 'chapter') V.wait = null;
    else if (V.say) V.say = null;
    else return false;
    runVN(G, hooks);
    return true;
}

export function vnChoose(G, i, hooks) {
    const V = G.vn;
    if (!V?.choices || !V.choices[i]) return false;
    const c = V.choices[i];
    V.choices = null;
    G.events.push({ type: 'chose', i });
    applyFx(G, c.fx);
    if (c.go) V.pc = scene(V.scene).labels[c.go];
    runVN(G, hooks);
    return true;
}

/** A battle or mini-game the scene started has finished: carry on. */
export function vnResume(G, hooks) {
    if (!G.vn?.wait || G.vn.wait.kind === 'chapter') return false;
    G.vn.wait = null;
    G.mode = 'vn';
    runVN(G, hooks);
    return true;
}
