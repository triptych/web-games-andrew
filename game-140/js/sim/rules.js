// Effects and conditions for the scene scripts. Pure.
//   effects:    "hope+2 mercy+1 b.edda+1 flag:x !flag:y"
//   conditions: "hope>=6 & mercy>=3 & b.aldwin>=2 & talk.edda>=3 & flag:x & !flag:y"

import { COMPANIONS } from './data/cast.js';

export function applyFx(G, fx) {
    for (const tok of fx.trim().split(/\s+/)) {
        if (!tok) continue;
        if (tok.startsWith('flag:')) { G.flags[tok.slice(5)] = true; continue; }
        if (tok.startsWith('!flag:')) { delete G.flags[tok.slice(6)]; continue; }
        const m = tok.match(/^([a-z.]+)([+-]\d+)$/);
        if (!m) throw new Error('bad effect ' + tok);
        const [, key, n] = m;
        const d = +n;
        if (key === 'hope') { G.hope = Math.max(0, G.hope + d); if (d > 0) G.events.push({ type: 'hope', d }); }
        else if (key === 'mercy') G.mercy = Math.max(0, G.mercy + d);
        else if (key.startsWith('b.')) {
            const id = key.slice(2);
            if (!COMPANIONS.includes(id)) throw new Error('unknown companion ' + id);
            G.bond[id] = Math.max(0, (G.bond[id] || 0) + d);
            if (d > 0) G.events.push({ type: 'bond', who: id, d });
        } else throw new Error('unknown effect ' + tok);
    }
}

/** The value a condition term names. */
function value(G, key) {
    if (key === 'hope') return G.hope;
    if (key === 'mercy') return G.mercy;
    if (key === 'hues') return G.hues.reduce((a, b) => a + b, 0);
    if (key.startsWith('b.')) return G.bond[key.slice(2)] || 0;
    if (key.startsWith('talk.')) return G.talk[key.slice(5)] || 0;
    throw new Error('unknown condition value ' + key);
}

export function evalCond(G, cond) {
    return cond.split('&').every((raw) => {
        const t = raw.trim();
        if (!t) return true;
        if (t.startsWith('!flag:')) return !G.flags[t.slice(6)];
        if (t.startsWith('flag:')) return !!G.flags[t.slice(5)];
        const m = t.match(/^([a-z.]+)\s*(>=|<=|==|>|<)\s*(-?\d+)$/);
        if (!m) throw new Error('bad condition ' + t);
        const v = value(G, m[1]), n = +m[3];
        switch (m[2]) {
            case '>=': return v >= n;
            case '<=': return v <= n;
            case '==': return v === n;
            case '>': return v > n;
            default: return v < n;
        }
    });
}
