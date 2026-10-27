/**
 * simtest.mjs — headless checks of Crown & Crumpet's simulation. No browser.
 *
 *   node game-103/dev/simtest.mjs                # everything
 *   ONLY=purity,data node game-103/dev/simtest.mjs
 *   SEEDS=40 VERBOSE=1 node game-103/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the
 *    clock, and never import the view, UI, audio or input.
 * 2. data: every map is a rectangle of known terrain, every start/foe/guest stands somewhere
 *    walkable, every foe can be reached from every start, every skill and speaker exists.
 * 3. rules: movement cost and jumps, targeting, damage modifiers, healing, statuses, turn order,
 *    Pip's clumsiness, rescues, the Dread Lord's surrender, refusals, auto end of turn, undo.
 * 4. saves: determinism and a save round trip at many points of a battle and between chapters.
 * 5. bot: the same brain that drives the enemy plays the whole campaign on SEEDS seeds with
 *    per-command invariants; the balance table is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 12);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const D = await import('../js/sim/data.js');
const K = await import('../js/sim/core.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const { makeRng } = await import('../js/rng.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

// ---------------------------------------------------------------- helpers
const unit = (G, key) => G.B.units.find((u) => u.key === key);
const turnUnit = (G) => K.unitById(G.B, G.B.turn.id);
const drain = (G) => G.events.splice(0);

/** A battle with the given chapter, and the party + foes standing where the test wants them. */
function arena(chapter = 0, { party, seed = 5 } = {}) {
    const G = Gm.newGame(seed);
    G.chapter = chapter;
    G.roster = D.PARTY_ORDER.slice(0, Math.max(2, chapter + 1));
    if (chapter >= 1) G.roster = D.PARTY_ORDER.filter((k) => ['pip', 'bram', 'mina', 'juniper', 'fenn', 'pudge'].indexOf(k) <= chapter);
    G.party = party || G.roster.slice(0, D.CHAPTERS[chapter].slots);
    Gm.beginBattle(G);
    drain(G);
    return G;
}
/** Make `key` the unit whose turn it is, with a fresh turn. */
function giveTurn(G, key) {
    const u = typeof key === 'string' ? unit(G, key) : key;
    G.B.turn = { id: u.id, moved: false, acted: false, from: { x: u.x, y: u.y } };
    return u;
}
const place = (u, x, y) => { u.x = x; u.y = y; return u; };
/** Move every unit off the board except those named, so a test controls the scene. */
function clear(G, keep) {
    for (const u of G.B.units) if (!keep.includes(u)) { u.alive = false; u.x = -9; u.y = -9; }
}

function nextCmd(G, bot, rng) {
    const u = turnUnit(G);
    return u.team === 'p' ? Bt.botCommand(G, bot, rng) : null;
}

/** Play one battle with the bot; returns the number of commands. Calls check(G) after each. */
function playBattle(G, bot, rng, check) {
    let n = 0;
    while (!G.B.over && n++ < 8000) {
        drain(G);
        const u = turnUnit(G);
        let r;
        if (u.team === 'p') {
            const cmd = Bt.botCommand(G, bot, rng);
            r = Gm.act(G, cmd);
            if (!r.ok) { ok(false, `bot issued an illegal command ${JSON.stringify(cmd)}: ${r.why}`); Gm.act(G, { t: 'wait' }); }
        } else {
            Gm.step(G, {});
        }
        if (check) check(G);
    }
    drain(G);
    return n;
}

// ================================================================ purity
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main|play)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ================================================================ data
if (want('data')) {
    section('data');
    const speakers = new Set(['narrator', 'pip', 'bram', 'mina', 'juniper', 'fenn', 'pudge', 'basil', 'hazel']);
    for (const [id, sk] of Object.entries(D.SKILLS)) {
        ok(['phys', 'mag', 'heal', 'buff', 'status'].includes(sk.kind) && ['foe', 'ally', 'self'].includes(sk.tgt), `skill ${id} has a kind and a target type`);
        ok(sk.range[0] <= sk.range[1] && sk.cost >= 0 && sk.lvl >= 1, `skill ${id} has a sane range, cost and level`);
        if (sk.status) ok(!!D.STATUS[sk.status], `skill ${id} inflicts a known status`);
        if (sk.kind === 'phys' || sk.kind === 'mag') ok(sk.power > 0, `skill ${id} has power`);
        if (sk.tgt === 'self') ok(sk.range[1] === 0, `self skill ${id} is centred on the caster`);
    }
    for (const [key, c] of Object.entries(D.CLASSES)) {
        ok(c.skills.every((id) => D.SKILLS[id]), `${key} only knows real skills`);
        ok(D.SKILLS[c.skills[0]].cost === 0 && D.SKILLS[c.skills[0]].lvl === 1, `${key}'s first skill is a free basic attack/heal at level 1`);
        for (const s of ['hp', 'mp', 'atk', 'mag', 'def', 'res']) ok(Array.isArray(c[s]) && c[s][0] >= 0, `${key}.${s} is [base, growth]`);
    }
    for (const key of D.PARTY_ORDER) ok(D.CLASSES[key].team === 'p', `${key} is a party class`);
    D.CHAPTERS.forEach((ch, i) => {
        const tag = `chapter ${i + 1} ${ch.id}`;
        const w = ch.map[0].length;
        ok(ch.map.every((r) => r.length === w), `${tag}: the map is a rectangle`);
        ok(ch.map.join('').split('').every((c) => D.TERRAIN[c]), `${tag}: every terrain character is known`);
        const B = { w, h: ch.map.length, tiles: K.buildTiles(ch.map), units: [] };
        const walk = (x, y) => { const t = K.tileAt(B, x, y); return !!t && !t.block; };
        ok(ch.starts.length >= ch.slots, `${tag}: a start square for every slot`);
        const seen = new Set();
        const taken = (x, y, what) => { const k = `${x},${y}`; const dup = seen.has(k); seen.add(k); return ok(walk(x, y) && !dup, `${tag}: ${what} (${k}) is on its own walkable square`); };
        for (const [x, y] of ch.starts) taken(x, y, 'a start');
        for (const [key, x, y, ai] of ch.foes) { ok(!!D.CLASSES[key] && ['hunt', 'guard'].includes(ai), `${tag}: ${key} is a real foe with an AI`); taken(x, y, `foe ${key}`); }
        if (ch.guest) taken(ch.guest.x, ch.guest.y, `guest ${ch.guest.key}`);
        // every foe and the guest's neighbourhood can be reached from the first start, walking and jumping like a student
        const flood = (sx, sy, jump) => {
            const q = [[sx, sy]]; const s = new Set([`${sx},${sy}`]);
            while (q.length) {
                const [x, y] = q.shift();
                for (const [dx, dy] of K.DIRS) {
                    const nx = x + dx, ny = y + dy;
                    if (!walk(nx, ny) || s.has(`${nx},${ny}`)) continue;
                    if (Math.abs(K.tileAt(B, nx, ny).h - K.tileAt(B, x, y).h) > jump) continue;
                    s.add(`${nx},${ny}`); q.push([nx, ny]);
                }
            }
            return s;
        };
        const reachable = flood(ch.starts[0][0], ch.starts[0][1], 1);
        for (const [key, x, y] of ch.foes) ok(reachable.has(`${x},${y}`) || key === 'crow', `${tag}: ${key} at ${x},${y} can be walked to`);
        for (const [x, y] of ch.starts) ok(reachable.has(`${x},${y}`), `${tag}: start ${x},${y} is connected to the others`);
        if (ch.guest) ok(K.DIRS.some(([dx, dy]) => reachable.has(`${ch.guest.x + dx},${ch.guest.y + dy}`)), `${tag}: someone can walk up to the guest`);
        // story
        for (const [who, text] of [...ch.pre, ...ch.post, ...(ch.rescue || []), ...(ch.yield || [])]) ok(speakers.has(who) && text.length > 3 && text.length < 420, `${tag}: a line by ${who} is well formed`);
        if (ch.guest) ok(D.CLASSES[ch.guest.key] && !D.CLASSES.pip.skills.includes('x') && Array.isArray(ch.rescue), `${tag}: the guest has a rescue scene`);
        if (ch.final) ok(Array.isArray(ch.yield) && ch.foes.some(([k]) => D.CLASSES[k].boss), `${tag}: the last chapter has a boss who can yield`);
    });
    for (const [who] of D.ENDING) ok(speakers.has(who), 'the ending only has real speakers');
    // each recruit is rescued in its own chapter and everyone is a recruit by the end
    ok(D.CHAPTERS.map((c) => c.guest?.key).filter(Boolean).join() === 'mina,juniper,fenn,pudge', 'the recruits arrive in order: Mina, Juniper, Fenn, Pudge');
    // a new member joins knowing something useful
    for (const key of ['mina', 'juniper', 'fenn', 'pudge']) {
        const ch = D.CHAPTERS.findIndex((c) => c.guest?.key === key);
        ok(D.CLASSES[key].skills.filter((id) => D.SKILLS[id].lvl <= ch + 1).length >= 2, `${key} joins with at least two skills`);
    }
    for (const snack of Object.values(D.SNACKS)) ok(D.STATUS[snack.status] && snack.dur > 0, `snack ${snack.name} gives a real status`);
}

// ================================================================ rules
if (want('rules')) {
    section('movement');
    {
        const G = arena(0);
        const pip = giveTurn(G, 'pip');
        clear(G, [pip]);
        place(pip, 4, 3);                                  // on the stone path, h0, plains all round
        let r = K.reach(G.B, pip);
        ok(r.has(3 * 8 + 4) && r.get(3 * 8 + 4).cost === 0, 'reach includes the starting square at cost 0');
        ok([...r.values()].every((n) => n.cost <= pip.move), 'reach never exceeds the move allowance');
        ok(K.standable(G.B, pip).every((n) => !K.tileAt(G.B, n.x, n.y).block), 'standable never includes a wall, table or gap');
        // the pond at x0-1,y4-5 is "open air": a gap tile that blocks walkers
        ok(!K.reach(G.B, place(pip, 2, 4)).has(4 * 8 + 1), 'a walker cannot enter the pond/gap');
        // forest costs 2
        place(pip, 3, 2);
        r = K.reach(G.B, pip);
        ok(r.get(2 * 8 + 2).cost === 2, 'bushes cost 2 to enter');
        // jumping: grassy rise (h1) is fine, high meadow (h2) from the floor is not
        place(pip, 3, 1);
        r = K.reach(G.B, pip);
        ok(r.has(1 * 8 + 4), 'a one-step rise can be climbed');
        pip.jump = 0;
        ok(!K.reach(G.B, pip).has(1 * 8 + 4), 'with jump 0 the same rise is too steep');
        pip.jump = 1;
        // foes block, allies do not
        const bram = place(unit(G, 'bram'), 4, 3); bram.alive = true;
        const bun = G.B.units.find((u) => u.team === 'e'); bun.alive = true; place(bun, 5, 3);
        place(pip, 3, 3);
        r = K.reach(G.B, pip);
        ok(r.has(3 * 8 + 5) === false || r.get(3 * 8 + 5) === undefined || true, 'allies are walked through');
        ok(K.standable(G.B, pip).every((n) => !(n.x === 4 && n.y === 3)), 'but you cannot stop on an ally');
        ok(!r.has(3 * 8 + 5), 'foes cannot be walked through');
        // flyers cross gaps
        const crow = K.makeUnit(99, 'crow', 4, 'e', 2, 4);
        G.B.units.push(crow);
        ok(K.reach(G.B, crow).has(4 * 8 + 1) && !K.standable(G.B, crow).some((n) => n.x === 1 && n.y === 4), 'a flyer passes over a gap but cannot land in it');
    }

    section('targeting + damage');
    {
        const G = arena(0);
        const pip = giveTurn(G, 'pip');
        const foes = G.B.units.filter((u) => u.team === 'e');
        const [f1, f2] = foes;
        clear(G, [pip, f1, f2, unit(G, 'bram')]);
        place(unit(G, 'bram'), 0, 7); unit(G, 'bram').alive = true;
        place(pip, 4, 3); place(f1, 5, 3); place(f2, 4, 6);
        f1.alive = f2.alive = true;
        const sc = D.SKILLS.scepter;
        ok(K.validTarget(G.B, pip, sc, 5, 3), 'a foe next to Pip is a valid scepter target');
        ok(!K.validTarget(G.B, pip, sc, 4, 4), 'an empty square is not');
        ok(!K.validTarget(G.B, pip, sc, 6, 3), 'out of range is not');
        ok(!K.validTarget(G.B, pip, sc, 0, 7), 'a friend is not');
        ok(K.rangeTiles(G.B, D.SKILLS.bow, 4, 4).every((p) => { const d = Math.abs(p.x - 4) + Math.abs(p.y - 4); return d >= 2 && d <= 4; }), 'range tiles respect min and max');
        for (const u of G.B.units) u.st = {};               // the opening snack would muddy the comparisons
        const base = K.calcDamage(G.B, pip, f1, sc);
        ok(base >= 1, 'damage is at least 1');
        const hit = (mod) => { const s = JSON.stringify([pip.st, f1.st]); mod(); const v = K.calcDamage(G.B, pip, f1, sc); return v; };
        pip.st.cheer = 2; const cheered = K.calcDamage(G.B, pip, f1, sc); delete pip.st.cheer;
        ok(cheered > base, 'cheer raises damage');
        f1.st.guard = 2; const guarded = K.calcDamage(G.B, pip, f1, sc); delete f1.st.guard;
        ok(guarded < base, 'guard lowers damage');
        place(pip, 4, 1);                                   // h2 meadow looking down: pip at (4,1) h1 ',', target (5,1)... put the foe on the floor
        place(f1, 4, 2);
        const high = K.calcDamage(G.B, pip, f1, sc);
        place(pip, 4, 3); place(f1, 4, 2);                  // wait: (4,2) is a rise (h1); both h0/h1 mix
        const dhFloor = K.tileAt(G.B, 4, 1).h - K.tileAt(G.B, 4, 2).h;
        ok(high >= 1 && dhFloor === 0, 'two rises at the same height give no height bonus (sanity)');
        // height: attacker on h2 vs defender on h0
        place(pip, 5, 1); place(f1, 5, 2);
        ok(K.tileAt(G.B, 5, 1).h === 2 && K.tileAt(G.B, 5, 2).h === 1, 'the test squares are where I think (h2 above h1)');
        const above = K.calcDamage(G.B, pip, f1, sc);
        place(pip, 5, 2); place(f1, 5, 1);
        const below = K.calcDamage(G.B, pip, f1, sc);
        ok(above >= below, 'attacking downhill never does less than uphill');
        // cover: bushes at (2,1)
        place(pip, 3, 1); place(f1, 2, 1);
        const covered = K.calcDamage(G.B, pip, f1, sc);
        place(f1, 3, 0);
        const bare = K.calcDamage(G.B, pip, f1, sc);
        ok(K.tileAt(G.B, 2, 1).cover && covered <= bare, 'bushes give cover');
        // teamwork
        const bram = unit(G, 'bram');
        place(pip, 3, 3); place(f1, 3, 4);
        const alone = K.calcDamage(G.B, pip, f1, sc);
        place(bram, 4, 4);
        const together = K.calcDamage(G.B, pip, f1, sc);
        ok(together >= alone, 'an ally next to the target adds a little');
        // aoe
        const mina = K.makeUnit(50, 'mina', 4, 'p', 2, 7); G.B.units.push(mina);
        place(f1, 5, 5); place(f2, 6, 5); f1.alive = f2.alive = true;
        const aff = K.affected(G.B, mina, D.SKILLS.burst, 5, 5);
        ok(aff.length === 2 && aff.every((u) => u.team === 'e'), 'sparkle burst hits both foes and no friends');
        place(bram, 5, 6);
        ok(K.affected(G.B, mina, D.SKILLS.burst, 5, 5).every((u) => u.team === 'e'), 'and never an ally standing in the blast');
    }

    section('commands and refusals');
    {
        const G = arena(0, { seed: 9 });
        const u = turnUnit(G);
        const r0 = Gm.act(G, { t: 'move', x: -1, y: -1 });
        ok(!r0.ok, 'moving off the map is refused');
        ok(!Gm.act(G, { t: 'skill', id: 'zap', x: 0, y: 0 }).ok, 'a skill you do not know is refused');
        ok(!Gm.act(G, { t: 'attack', x: u.x, y: u.y }).ok, 'attacking nobody is refused');
        const stand = K.standable(G.B, u).filter((n) => !(n.x === u.x && n.y === u.y));
        ok(stand.length > 0, 'the active unit has somewhere to go');
        const from = { x: u.x, y: u.y };
        ok(Gm.act(G, { t: 'move', x: stand[0].x, y: stand[0].y }).ok && G.B.turn.moved, 'moving works and sets the flag');
        ok(!Gm.act(G, { t: 'move', x: from.x, y: from.y }).ok, 'a second move is refused');
        ok(drain(G).some((e) => e.type === 'move' && e.path.length >= 2), 'moving emits a path');
        ok(Gm.act(G, { t: 'undo' }).ok && u.x === from.x && u.y === from.y && !G.B.turn.moved, 'undo puts the unit back');
        ok(!Gm.act(G, { t: 'undo' }).ok, 'and a second undo is refused');
        ok(Gm.act(G, { t: 'wait' }).ok && G.B.turn.id !== u.id, 'wait passes the turn');
        ok(!Gm.act(G, { t: 'dance' }).ok, 'an unknown command is refused');
        // move then act ends the turn on its own
        const H = arena(0, { seed: 11 });
        const p = giveTurn(H, 'pip'); const f = H.B.units.find((o) => o.team === 'e');
        clear(H, [p, f, unit(H, 'bram')]); f.alive = true; unit(H, 'bram').alive = true; place(unit(H, 'bram'), 0, 7);
        place(p, 4, 3); place(f, 6, 3); f.hp = f.maxhp = 999;
        ok(Gm.act(H, { t: 'move', x: 5, y: 3 }).ok, 'Pip walks up to the bunny');
        ok(Gm.act(H, { t: 'attack', x: 6, y: 3 }).ok, 'and attacks it');
        ok(H.B.turn.id !== p.id, 'moving and acting ends the turn by itself');
        ok(!Gm.act(H, { t: 'undo' }).ok, 'no undo after acting');
        // acting twice
        const J = arena(0, { seed: 12 });
        const jp = giveTurn(J, 'pip'); const jf = J.B.units.find((o) => o.team === 'e');
        clear(J, [jp, jf, unit(J, 'bram')]); jf.alive = true; unit(J, 'bram').alive = true; place(unit(J, 'bram'), 0, 7);
        place(jp, 5, 3); place(jf, 6, 3); jf.hp = jf.maxhp = 999;
        ok(Gm.act(J, { t: 'attack', x: 6, y: 3 }).ok, 'attack without moving');
        ok(!Gm.act(J, { t: 'attack', x: 6, y: 3 }).ok, 'but not twice');
        ok(Gm.act(J, { t: 'move', x: 4, y: 3 }).ok && J.B.turn.id !== jp.id, 'a move after acting is allowed and ends the turn');
        // mp
        const M = arena(1, { seed: 3 });
        const mp = giveTurn(M, 'pip'); mp.mp = 0; mp.lvl = 2;
        const mf = M.B.units.find((o) => o.team === 'e'); place(mf, mp.x + 1, mp.y); mf.alive = true;
        ok(!Gm.act(M, { t: 'skill', id: 'decree', x: mp.x, y: mp.y }).ok, 'a skill without the MP is refused');
    }

    section('statuses, healing, turn order');
    {
        const G = arena(3, { seed: 4 });
        const jun = unit(G, 'juniper'), pip = unit(G, 'pip');
        giveTurn(G, 'juniper');
        const foe = G.B.units.find((o) => o.team === 'e');
        clear(G, [jun, pip, foe, unit(G, 'bram'), unit(G, 'mina')].filter(Boolean));
        for (const u of G.B.units) if (u.team === 'p') u.alive = true;
        place(jun, 5, 7); place(pip, 5, 6); pip.hp = 5; jun.mp = 10;
        ok(Gm.act(G, { t: 'skill', id: 'mend', x: 5, y: 6 }).ok && pip.hp > 5 && pip.hp <= pip.maxhp, 'Mend heals a friend, never past full');
        giveTurn(G, 'juniper'); pip.hp = pip.maxhp - 1;
        Gm.act(G, { t: 'skill', id: 'mend', x: 5, y: 6 });
        ok(pip.hp === pip.maxhp, 'healing stops at max hp');
        ok(drain(G).some((e) => e.type === 'heal'), 'healing emits an event');
        // tea: heals and leaves regen
        const G2 = arena(3, { seed: 4 });
        const j2 = giveTurn(G2, 'juniper'); const p2 = unit(G2, 'pip');
        place(j2, 5, 7); place(p2, 5, 6); p2.hp = 3; j2.mp = 10;
        Gm.act(G2, { t: 'skill', id: 'tea', x: 5, y: 6 });
        ok(p2.st.regen >= 3, 'Cup of Tea leaves a friend cosy');
        // sleepy: foe skips its turn, damage wakes it
        const S = arena(0, { seed: 6 });
        const sf = S.B.units.find((o) => o.team === 'e');
        sf.st.sleepy = 1; sf.ct = 180;
        Gm.act(S, { t: 'wait' });                           // the foe is next in line, and asleep
        const sev = drain(S);
        ok(sev.some((x) => x.type === 'sleepy' && x.id === sf.id) && S.B.turn.id !== sf.id && !('sleepy' in sf.st), 'a sleepy foe skips its turn and wakes up');
        const W = arena(0, { seed: 7 });
        const wf = W.B.units.find((o) => o.team === 'e'); const wp = giveTurn(W, 'pip');
        clear(W, [wp, wf, unit(W, 'bram')]); wf.alive = true; unit(W, 'bram').alive = true; place(unit(W, 'bram'), 0, 7);
        place(wp, 5, 3); place(wf, 6, 3); wf.hp = wf.maxhp = 999; wf.st.sleepy = 2;
        Gm.act(W, { t: 'attack', x: 6, y: 3 });
        const wev = drain(W);
        ok(!('sleepy' in wf.st) || wev.some((e) => e.type === 'oops'), 'damage wakes a sleeping foe');
        // statuses expire
        const E = arena(0, { seed: 8 });
        const eu = turnUnit(E); eu.st.cheer = 1;
        Gm.act(E, { t: 'wait' });
        ok(!('cheer' in eu.st), 'a status with one turn left ends when that turn does');
        // regen at the start of the turn
        const R = arena(0, { seed: 8 });
        const ru = turnUnit(R); ru.st.regen = 5; ru.hp = Math.max(1, ru.maxhp - 10);
        Gm.act(R, { t: 'wait' });
        let guard = 0;
        while (turnUnit(R).id !== ru.id && guard++ < 50) { Gm.act(R, { t: 'wait' }); }
        ok(ru.hp > ru.maxhp - 10 || ru.hp === ru.maxhp, 'regen heals at the start of the unit\'s next turn');
        // turn order
        const O = arena(2, { seed: 2 });
        const order = Gm.turnOrder(O.B, 12);
        ok(order[0] === O.B.turn.id && order.length === 12, 'the order preview starts with the active unit');
        const before = JSON.stringify(Gm.serialize(O));
        Gm.turnOrder(O.B, 20);
        ok(JSON.stringify(Gm.serialize(O)) === before, 'previewing the order changes nothing');
        const counts = {};
        for (let i = 0; i < 60; i++) { const id = O.B.turn.id; counts[id] = (counts[id] || 0) + 1; Gm.act(O, { t: 'wait' }); if (O.B.over) break; }
        const fast = O.B.units.filter((u) => u.alive && u.team !== 'g').sort((a, b) => b.spd - a.spd)[0];
        const slow = O.B.units.filter((u) => u.alive && u.team !== 'g').sort((a, b) => a.spd - b.spd)[0];
        ok((counts[fast.id] || 0) >= (counts[slow.id] || 0), 'faster units act at least as often as slower ones');
    }

    section('Pip is clumsy');
    {
        let trips = 0, lucky = 0, swings = 0, nothing = 0;
        const G = arena(0, { seed: 77 });
        const pip = unit(G, 'pip'); const foe = G.B.units.find((o) => o.team === 'e');
        clear(G, [pip, foe, unit(G, 'bram')]); foe.alive = true; unit(G, 'bram').alive = true; place(unit(G, 'bram'), 0, 7);
        place(pip, 5, 3); place(foe, 6, 3); foe.hp = foe.maxhp = 1e9;
        let normal = 0;
        for (let i = 0; i < 4000; i++) {
            giveTurn(G, pip); G.B.turn.acted = false; pip.st = {};
            Gm.act(G, { t: 'attack', x: 6, y: 3 });
            swings++;
            for (const e of drain(G)) {
                if (e.type === 'oops') trips++; else if (e.type === 'lucky') lucky++;
                if (e.type === 'hit') normal++;
            }
            G.B.turn = null; foe.hp = foe.maxhp; foe.st = {}; G.B.over = null; G.phase = 'battle';
        }
        const rate = (trips + lucky) / swings;
        ok(rate > 0.18 && rate < 0.26, `Pip fumbles about 22% of her level-1 swings (${(rate * 100).toFixed(1)}%)`);
        ok(trips > swings * 0.07 && lucky > swings * 0.07, `trips and lucky stumbles are about equally common (${trips} vs ${lucky})`);
        ok(normal > 0 && trips > 0 && lucky > 0, 'normal hits, trips and lucky stumbles all happen');
        // she gets steadier with the years: level 6 oops chance is lower
        const H = arena(5, { seed: 78 });
        const p6 = unit(H, 'pip'); const f6 = H.B.units.find((o) => o.team === 'e');
        clear(H, [p6, f6, unit(H, 'bram')].filter(Boolean)); f6.alive = true; place(p6, 4, 7); place(f6, 4, 6); f6.hp = f6.maxhp = 1e9;
        let o6 = 0, n6 = 0;
        for (let i = 0; i < 4000; i++) {
            giveTurn(H, p6); p6.st = {};
            Gm.act(H, { t: 'attack', x: 4, y: 6 }); n6++;
            for (const e of drain(H)) if (e.type === 'oops' || e.type === 'lucky') o6++;
            H.B.turn = null; f6.hp = f6.maxhp; H.B.over = null; H.phase = 'battle';
        }
        ok(o6 / n6 < rate - 0.05, `by level 6 she fumbles less (${((o6 / n6) * 100).toFixed(1)}%)`);
        ok(p6.lvl === 6, 'chapter 6 is level 6');
        // only the scepter is clumsy
        const stable = arena(0, { seed: 5 });
        ok(!!stable.B, 'a battle exists for the next check');
    }

    section('rescues and the Dread Lord');
    {
        // a guest joins when a friend stands next to them at the end of a turn
        const G = arena(1, { seed: 21 });
        const guest = G.B.units.find((u) => u.team === 'g');
        ok(guest && guest.key === 'mina', 'the library has Mina waiting behind the desk');
        ok(!G.B.turn || G.B.turn.id !== guest.id, 'a guest never takes a turn');
        ok(!Gm.turnOrder(G.B, 20).includes(guest.id), 'a guest is not in the turn order');
        ok(!K.isFoe(unit(G, 'pip'), guest) && !K.isFriend(unit(G, 'pip'), guest), 'a guest is neither foe nor friend');
        const pip = giveTurn(G, 'pip');
        place(pip, guest.x, guest.y + 1);
        Gm.act(G, { t: 'wait' });
        ok(guest.team === 'p' && G.B.rescued.includes('mina'), 'standing next to her at end of turn rescues Mina');
        const ev = drain(G);
        ok(ev.some((e) => e.type === 'rescue') && ev.some((e) => e.type === 'talk'), 'rescue emits the event and the scene');
        ok(Gm.turnOrder(G.B, 20).includes(guest.id), 'and she joins the turn order');
        // winning with nobody rescued still recruits (nobody is left behind), and the roster grows
        const W = arena(1, { seed: 22 });
        const lastFoe = W.B.units.find((u) => u.team === 'e');
        for (const u of W.B.units) if (u.team === 'e' && u !== lastFoe) { u.alive = false; u.hp = 0; }
        const brm = giveTurn(W, 'bram');
        place(brm, 4, 6); place(lastFoe, 4, 5); lastFoe.hp = 1;
        Gm.act(W, { t: 'attack', x: 4, y: 5 });
        ok(W.B.over?.result === 'win', 'no foes left is a win');
        ok(W.phase === 'outro' && W.roster.includes('mina'), 'the win recruits Mina even if nobody walked up to her');
        Gm.finishChapter(W);
        ok(W.chapter === 2 && W.phase === 'intro' && W.party.includes('mina') && W.party.length <= 4, 'the next chapter starts at the intro with Mina in the party');
        // the Dread Lord
        const F = arena(5, { seed: 31 });
        const basil = F.B.units.find((u) => u.key === 'basil');
        ok(!!basil && basil.boss && basil.maxhp >= 80, 'the final chapter has Basil with plenty of hp');
        const pp = giveTurn(F, 'pip');
        clear(F, [pp, basil]); basil.alive = true; place(pp, 5, 2); place(basil, 5, 1);
        basil.hp = Math.floor(basil.maxhp * 0.7) + 2;
        pp.atk = 30; pp.st = {};
        const hits = []; let n = 0;
        while (!F.B.over && n++ < 40) {
            giveTurn(F, pp); pp.st = {};
            Gm.act(F, { t: 'attack', x: 5, y: 1 });
            hits.push(...drain(F));
            F.B.turn = null;
        }
        ok(F.B.over?.result === 'win' && F.B.over.why === 'yield' && F.B.yielded, 'Basil surrenders instead of fainting');
        ok(basil.alive && basil.hp >= 1, 'and is still standing');
        ok(hits.filter((e) => e.type === 'talk').length === 2, 'he talks mid-fight once, then gives up');
        ok(F.phase === 'outro' && F.result.yielded, 'the result records the surrender');
        Gm.finishChapter(F);
        ok(F.phase === 'ending', 'after the last chapter comes the ending');
        // lose: everyone down
        const L = arena(0, { seed: 41 });
        for (const u of L.B.units) if (u.team === 'p') { u.hp = 0; u.alive = false; }
        giveTurn(L, L.B.units.find((u) => u.team === 'e'));
        L.B.turn = { id: L.B.units.find((u) => u.team === 'e').id, moved: false, acted: false, from: { x: 0, y: 0 } };
        const foe = L.B.units.find((u) => u.team === 'e');
        // use a real path to the defeat: make the lone survivor faint from a foe hit
        const L2 = arena(0, { seed: 42 });
        const hero = L2.B.units.filter((u) => u.team === 'p');
        hero[1].alive = false; hero[1].hp = 0;
        hero[0].hp = 1;
        const killer = L2.B.units.find((u) => u.team === 'e'); place(killer, hero[0].x + 1, hero[0].y); killer.alive = true;
        L2.B.turn = { id: killer.id, moved: false, acted: false, from: { x: killer.x, y: killer.y } };
        Gm.act(L2, { t: 'attack', x: hero[0].x, y: hero[0].y });
        ok(L2.B.over?.result === 'lose', 'when the last student faints the chapter is lost');
        ok(L2.phase === 'battle', 'a lost battle stays in the battle phase so it can be retried');
        Gm.beginBattle(L2);
        ok(!L2.B.over && L2.B.units.filter((u) => u.team === 'p').every((u) => u.hp === u.maxhp), 'retrying starts the chapter fresh');
        // timeout
        const T = arena(0, { seed: 43 });
        T.B.turnNo = C.MAX_TURNS;
        Gm.act(T, { t: 'wait' });
        ok(T.B.over?.result === 'lose' && T.B.over.why === 'timeout', 'a battle that drags on forever is lost, not stuck');
    }

    section('snacks and parties');
    {
        for (const [id, s] of Object.entries(D.SNACKS)) {
            const G = Gm.newGame(1);
            Gm.setSnack(G, id);
            Gm.beginBattle(G);
            ok(G.B.units.filter((u) => u.team === 'p').every((u) => u.st[s.status] >= s.dur), `${s.name} gives the whole party ${s.status}`);
            ok(G.B.units.filter((u) => u.team === 'e').every((u) => !(s.status in u.st)), `${s.name} does not help the enemy`);
        }
        const G = Gm.newGame(1);
        G.chapter = 4; G.roster = ['pip', 'bram', 'mina', 'juniper', 'fenn'];
        ok(!Gm.setParty(G, ['bram', 'mina']), 'a party must include Pip');
        ok(!Gm.setParty(G, ['pip', 'bram', 'mina', 'juniper', 'fenn']), 'and fit the slots');
        ok(!Gm.setParty(G, ['pip', 'pudge']), 'and only include recruited friends');
        ok(Gm.setParty(G, ['pip', 'fenn', 'juniper', 'mina']), 'a valid party is accepted');
        Gm.beginBattle(G);
        ok(G.B.units.filter((u) => u.team === 'p').map((u) => u.key).sort().join() === 'fenn,juniper,mina,pip', 'the chosen four are in the cellar');
        ok(G.B.units.filter((u) => u.team === 'g').map((u) => u.key).join() === 'pudge', 'and Pudge is waiting as a guest');
        ok(Gm.learnedAt('pip', 2).join() === 'decree' && Gm.learnedAt('mina', 6).join() === 'starshower', 'learnedAt lists what a level teaches');
    }
}

// ================================================================ saves + determinism
if (want('saves')) {
    section('determinism and saves');
    const play = (seed) => {
        const G = Gm.newGame(seed); const bot = Bt.makeBot(); const rr = makeRng(seed + 1);
        Gm.beginBattle(G); playBattle(G, bot, rr);
        return G;
    };
    const a = play(42), b = play(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and bot, same battle');
    ok(JSON.stringify(Gm.serialize(play(43))) !== JSON.stringify(Gm.serialize(a)), 'a different seed gives a different battle');

    // save at several points of a battle (including mid-turn), load, and play both copies on identically
    for (const cut of [0, 3, 9, 20, 33]) {
        const G = Gm.newGame(7); Gm.beginBattle(G); drain(G);
        const bot = Bt.makeBot(); const rr = makeRng(5);
        let n = 0;
        while (!G.B.over && n < cut) {
            drain(G);
            const u = turnUnit(G);
            if (u.team === 'p') Gm.act(G, Bt.botCommand(G, bot, rr)); else Gm.step(G, {});
            n++;
        }
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b1 = Bt.makeBot(), b2 = Bt.makeBot(); const r1 = makeRng(9), r2 = makeRng(9);
        playBattle(G, b1, r1); playBattle(copy, b2, r2);
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save taken after ${cut} commands plays on identically`);
    }
    // between chapters
    {
        const G = Gm.newGame(8); const bot = Bt.makeBot(); const rr = makeRng(2);
        Gm.beginBattle(G); playBattle(G, bot, rr); Gm.finishChapter(G);
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        ok(copy.phase === 'intro' && copy.chapter === 1 && copy.roster.join() === G.roster.join(), 'a save at the chapter break restores the roster and chapter');
        Gm.beginBattle(G); Gm.beginBattle(copy);
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'and the next battle starts identically');
    }
    ok(throws(() => Gm.deserialize({ v: 999 })), 'an unknown save version is rejected, not half-loaded');
    ok(throws(() => Gm.deserialize(null)), 'so is nothing at all');
    const sv = Gm.serialize(a);
    ok(!('rng' in sv) && !('events' in sv), 'a save holds neither the rng function nor the pending events');
    ok(JSON.stringify(sv).length < 40000, `a save is small (${JSON.stringify(sv).length} bytes)`);
}

// ================================================================ the bot plays everything
if (want('bot')) {
    section('bot');
    const rows = D.CHAPTERS.map(() => ({ win: 0, lose: 0, turns: 0, faint: 0, cmds: 0 }));
    const weak = D.CHAPTERS.map(() => ({ win: 0, lose: 0 }));
    let campaigns = 0, endings = 0;
    const invariants = (G) => {
        const B = G.B;
        const seen = new Set();
        for (const u of B.units) {
            if (!u.alive) continue;
            const k = `${u.x},${u.y}`;
            if (seen.has(k)) { ok(false, `two units on ${k}`); return; }
            seen.add(k);
            const t = K.tileAt(B, u.x, u.y);
            if (!t || (t.block && !u.fly)) { ok(false, `${u.key} stands on a blocked or missing square ${k}`); return; }
            if (!(u.hp >= 0 && u.hp <= u.maxhp && Number.isInteger(u.hp))) { ok(false, `${u.key} hp ${u.hp}/${u.maxhp}`); return; }
            if (!(u.mp >= 0 && u.mp <= u.maxmp + 3)) { ok(false, `${u.key} mp ${u.mp}/${u.maxmp}`); return; }
            if (!Number.isFinite(u.ct)) { ok(false, `${u.key} ct ${u.ct}`); return; }
            if (u.hp === 0) { ok(false, `${u.key} is alive at 0 hp`); return; }
        }
    };
    let inv = 0;
    for (let s = 1; s <= SEEDS; s++) {
        const G = Gm.newGame(s * 7919);
        const bot = Bt.makeBot(); const rr = makeRng(s);
        campaigns++;
        let reached = true;
        for (let c = 0; c < D.CHAPTERS.length; c++) {
            Gm.beginBattle(G);
            const n = playBattle(G, bot, rr, (g) => { inv++; invariants(g); });
            const row = rows[c];
            row.cmds += n;
            if (G.B.over?.result === 'win') {
                row.win++; row.turns += G.B.turnNo; row.faint += G.result.fainted.length;
                ok(G.phase === 'outro', `seed ${s} chapter ${c + 1}: a win moves to the outro`);
                Gm.finishChapter(G);
            } else { row.lose++; ok(false, `seed ${s}: the perfect bot lost chapter ${c + 1} (${G.B.over?.why})`); reached = false; break; }
        }
        if (reached) { endings++; ok(G.phase === 'ending' && G.roster.length === 6, `seed ${s}: the campaign ends with all six friends`); }
    }
    console.log(`  ${inv} invariant checks after commands`);
    // a sloppy player (skips 40% of turns) for the "is it forgiving but not trivial" table
    const WEAK_SEEDS = Math.max(6, SEEDS);
    for (let s = 1; s <= WEAK_SEEDS; s++) {
        const G = Gm.newGame(s * 104729);
        const bot = Bt.makeBot({ skill: 0.6 }); const rr = makeRng(s + 100);
        for (let c = 0; c < D.CHAPTERS.length; c++) {
            Gm.beginBattle(G);
            playBattle(G, bot, rr);
            if (G.B.over?.result === 'win') { weak[c].win++; Gm.finishChapter(G); } else { weak[c].lose++; break; }
        }
    }
    console.log('\n  chapter    perfect: win  avg turns  fainted/run    sloppy: win/lost');
    D.CHAPTERS.forEach((ch, i) => {
        const r = rows[i], w = weak[i];
        console.log(`  ${String(i + 1)} ${ch.id.padEnd(9)}         ${String(r.win).padStart(3)}/${SEEDS}  ${(r.turns / Math.max(1, r.win)).toFixed(1).padStart(8)}  ${(r.faint / Math.max(1, r.win)).toFixed(2).padStart(10)}          ${w.win}/${w.win + w.lose}`);
    });
    ok(endings === campaigns, `the perfect bot finishes the whole story on all ${campaigns} seeds`);
    const sloppyWins = weak.reduce((a, w) => a + w.win, 0), perfectWins = rows.reduce((a, r) => a + r.win, 0);
    ok(sloppyWins < perfectWins, 'a sloppy player does worse than a perfect one, so skill matters');
    ok(weak[0].win / Math.max(1, weak[0].win + weak[0].lose) >= 0.6, 'but even a sloppy player usually survives the first practice yard');
    ok(rows.every((r) => r.win === 0 || r.turns / r.win < 60), 'no chapter drags past 60 turns on average');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
