/**
 * simtest.mjs — the simulation, headless, in Node. No browser.
 *
 *   node game-075/dev/simtest.mjs            # everything
 *   ONLY=purity|realms|rules|bot|balance node game-075/dev/simtest.mjs
 *   SEEDS=20 node game-075/dev/simtest.mjs   # REMIX seeds to check
 *
 * 1. purity   js/sim imports nothing from the view, touches no DOM, never calls Math.random
 * 2. realms   every realm builds, every room's exits are joined, the planner solves it
 *             in ARCADE and in SEEDS REMIX shuffles
 * 3. rules    carrying, swapping, dropping, gates, magnet, bridge, charge, grey pixel,
 *             bite, sword, bat, NULL, boss phases, scoring and extra lives
 * 4. bot      a god-mode bot clears every realm (ARCADE and REMIX), then the ending
 * 5. balance  a mortal bot on NOVICE and EXPERT: deaths and time per realm (a table, not a gate)
 *
 * purity, realms and rules take seconds; bot about a minute; balance a few minutes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { World, newSession } from '../js/sim/world.js';
import { Bot } from '../js/sim/bot.js';
import { solve, flood } from '../js/sim/plan.js';
import { buildRealm } from '../js/sim/build.js';
import { REALMS } from '../js/sim/realms.js';
import { SIM_DT, T, RW, RH, FLOOR, GATE, CHASM, CRACK } from '../js/config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONLY = process.env.ONLY || '';
const SEEDS = +(process.env.SEEDS || 12);
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('  FAIL', msg); } };
const section = (name) => { console.log(`\n== ${name}`); };
const run = (name) => !ONLY || ONLY.split(',').includes(name);
const cx = (e) => e.x + e.w / 2, cy = (e) => e.y + e.h / 2;

function play(w, bot, maxT = 900) {
    let t = 0;
    while (!w.cleared && !w.over && t < maxT) {
        w.step(SIM_DT, bot ? bot.think(SIM_DT) : {});
        t += SIM_DT;
        for (const p of [w.player, ...w.dragons]) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error(`NaN position in realm ${w.realmIndex + 1}`);
        if (w.events.length > 200) w.events.length = 0;
    }
    return t;
}

// ------------------------------------------------------------------ 1. purity
if (run('purity')) {
    section('purity');
    const dir = path.join(HERE, '../js/sim');
    for (const f of fs.readdirSync(dir)) {
        const code = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        ok(!/from\s+['"]\.\.\/view/.test(code), `${f} imports the view`);
        ok(!/\bdocument\.|\bwindow\.|localStorage|requestAnimationFrame/.test(code), `${f} touches the DOM`);
        ok(!/Math\.random\(/.test(code), `${f} calls Math.random`);
    }
    console.log(`  ${fs.readdirSync(dir).length} sim modules checked`);
}

// ------------------------------------------------------------------ 2. realms
if (run('realms')) {
    section('realms');
    for (let i = 0; i < REALMS.length; i++) {
        const M = buildRealm(i);
        // every link between rooms is open on both sides, and every room is one piece
        let rooms = 0;
        for (const room of M.rooms) {
            if (!room) continue;
            rooms++;
            const exits = Object.entries(room.exits).filter(([, v]) => v);
            ok(exits.length > 0, `${M.realm.name} room ${room.c},${room.r} has no exits`);
            // flood fill inside the room from its first open floor tile; every exit tile must be reached
            const seen = new Set();
            const inRoom = (x, y) => x >= room.x0 && y >= room.y0 && x < room.x0 + RW && y < room.y0 + RH;
            const walk = (t) => t === FLOOR || t === GATE || t === CRACK;
            const exitTiles = [];
            if (room.exits.n) exitTiles.push([room.x0 + 19, room.y0 + 1]);
            if (room.exits.s) exitTiles.push([room.x0 + 19, room.y0 + RH - 1]);
            if (room.exits.w) exitTiles.push([room.x0, room.y0 + 12]);
            if (room.exits.e) exitTiles.push([room.x0 + RW - 1, room.y0 + 12]);
            const [sx, sy] = exitTiles[0];
            const q = [[sx, sy]]; seen.add(sy * M.gw + sx);
            while (q.length) {
                const [x, y] = q.pop();
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = x + dx, ny = y + dy, k = ny * M.gw + nx;
                    if (!inRoom(nx, ny) || seen.has(k)) continue;
                    const t = M.at(nx, ny);
                    if (!walk(t) && !(t === CHASM)) continue;
                    seen.add(k); q.push([nx, ny]);
                }
            }
            for (const [x, y] of exitTiles) ok(seen.has(y * M.gw + x) || M.at(x, y) === 8, `${M.realm.name} room ${room.c},${room.r}: exit at ${x - room.x0},${y - room.y0} cut off`);
        }
        // items and pickups on floor
        for (const it of M.items) ok(M.at(Math.floor(cx(it) / T), Math.floor(cy(it) / T)) === FLOOR, `${M.realm.name}: ${it.kind} not on floor`);
        const w = new World(i, newSession());
        const plan = solve(w);
        ok(!!plan, `${M.realm.name} ARCADE is not solvable`);
        console.log(`  ${String(i + 1).padStart(2)} ${M.realm.name.padEnd(20)} ${rooms} rooms  plan: ${plan ? plan.map((s) => s.type + (s.color ? ':' + s.color : '')).join(' > ') : 'NONE'}`);
        // the start can reach the home vault
        const R = flood(w);
        const hv = M.rooms[M.homeVault];
        ok(R[(hv.y0 + 12) * M.gw + hv.x0 + 20], `${M.realm.name}: the home vault can't be reached from the start`);
        // REMIX
        let solved = 0;
        for (let s = 1; s <= SEEDS; s++) {
            const ws = World.create(i, newSession({ mode: 'remix', remix: s * 1013 }));
            if (solve(ws)) solved++;
        }
        ok(solved === SEEDS, `${M.realm.name}: only ${solved}/${SEEDS} REMIX worlds solvable`);
    }
    console.log(`  REMIX: ${SEEDS} seeds per realm, all solvable`);
}

// ------------------------------------------------------------------ 3. rules
if (run('rules')) {
    section('rules');
    const fresh = (ri = 0) => { const s = newSession(); s.lives = 3; return new World(ri, s); };
    const put = (w, e, x, y) => { e.x = x; e.y = y; };
    const tick = (w, n = 1, inp = {}) => { for (let i = 0; i < n; i++) w.step(SIM_DT, inp); };

    // pick up on touch, keeping the offset; swap; drop
    {
        const w = fresh(0);
        const p = w.player;
        const sword = w.items.find((i) => i.kind === 'sword');
        const key = w.items.find((i) => i.kind === 'key');
        put(w, sword, p.x + 6, p.y); tick(w);
        ok(p.held === sword, 'touching the sword picks it up');
        ok(sword.ox === 6 && sword.oy === 0, `the sword keeps its offset (got ${sword.ox},${sword.oy})`);
        tick(w, 30, { ax: 1 });
        ok(Math.abs(sword.x - (p.x + 6)) < 0.01, 'a held item moves with the square');
        put(w, key, p.x - 10, p.y); tick(w);
        ok(p.held === key && !sword.holder, 'touching another item swaps');
        tick(w, 1, { drop: true });
        ok(!p.held && key.noPick, 'B drops it, and it is not picked straight back up');
        tick(w, 1);
        ok(!p.held, 'still not holding while standing on it');
    }
    // a key opens its gate; gates stay open
    {
        const w = fresh(0);
        const g = w.map.gates.find((g) => g.color === 'gold');
        const key = w.items.find((i) => i.kind === 'key' && i.color === 'gold');
        const p = w.player;
        put(w, p, (g.x + 1) * T, (g.y + g.h) * T + 1);
        put(w, key, p.x, p.y + 4); tick(w);
        ok(p.held === key, 'got the gold key');
        tick(w, 30, { ay: -1 });
        ok(g.opening || g.open > 0, 'carrying the key into the portcullis raises it');
        tick(w, 200);
        ok(g.open >= 1 && w.map.at(g.x, g.y) === FLOOR, 'the gate is open and passable');
        ok(w.session.score >= 500, 'opening a gate scores');
    }
    // the magnet pulls loose things in its room
    {
        const w = fresh(1);
        const mag = w.items.find((i) => i.kind === 'magnet');
        const pk = w.pickups.find((p) => p.kind === 'cassette');
        const d0 = Math.hypot(cx(mag) - cx(pk), cy(mag) - cy(pk));
        tick(w, 240);
        const d1 = Math.hypot(cx(mag) - cx(pk), cy(mag) - cy(pk));
        ok(d1 < d0 - 20, `the magnet pulls the sealed cassette out (${d0.toFixed(0)} → ${d1.toFixed(0)})`);
    }
    // the bridge snaps across a river and you can walk over it
    {
        const w = fresh(3);
        const br = w.items.find((i) => i.kind === 'bridge');
        const spot = w.map.bridgeSpots[0];
        const p = w.player;
        put(w, p, spot.x + 4, spot.y - 10);
        put(w, br, p.x - 14, p.y - 2); tick(w);
        ok(p.held === br, 'touching a rail lifts the bridge');
        tick(w, 1, { drop: true });
        ok(br.laid, 'a dropped bridge snaps across the river');
        put(w, p, br.x + 4, br.y - 6);
        const y0 = p.y;
        tick(w, 120 * 2, { ay: 1 });
        ok(p.y > y0 + 40, `the square walks across the bridge (moved ${(p.y - y0).toFixed(0)} px)`);
        ok(!p.held, 'walking down the deck does not lift the bridge');
    }
    // a charge breaks cracked walls
    {
        const w = fresh(4);
        const ch = w.items.find((i) => i.kind === 'charge');
        const grp = w.map.cracks[1] || w.map.cracks[0];
        const k = grp.tiles[Math.floor(grp.tiles.length / 2)];
        const tx = k % w.map.gw, ty = (k / w.map.gw) | 0;
        const before = grp.tiles.filter((t) => w.map.tiles[t] === CRACK).length;
        ch.holder = null; put(w, ch, tx * T - 10, ty * T); ch.fuse = 0.5;
        put(w, w.player, tx * T - 120, ty * T);
        tick(w, 120);
        const after = grp.tiles.filter((t) => w.map.tiles[t] === CRACK).length;
        ok(after < before, `the blast breaks cracked wall (${before} → ${after} tiles)`);
        tick(w, 400);
        ok(w.items.some((i) => i.kind === 'charge'), 'the dispenser makes a new charge');
    }
    // the grey pixel opens the static wall
    {
        const w = fresh(2);
        const px = w.items.find((i) => i.kind === 'pixel');
        const b = w.map.barrier;
        put(w, px, b.x * T + 10, (b.y + b.h) * T);
        tick(w, 2);
        ok(b.broken && w.map.at(b.x, b.y) === FLOOR, 'the grey pixel dissolves the static wall');
    }
    // a dragon bites; the sword kills
    {
        const w = fresh(0);
        const d = w.dragons[0];
        const p = w.player;
        p.inv = 0;
        put(w, d, p.x + 10, p.y - 4);
        tick(w, 120);
        ok(p.dead && p.cause === 'bite', 'a dragon in reach bites and swallows');
        ok(w.session.lives === 2, 'a bite costs a life');
        tick(w, 400);
        ok(!p.dead, 'SQUIRE comes back at the Sunset Keep');
        const w2 = fresh(0);
        const s = w2.items.find((i) => i.kind === 'sword');
        const d2 = w2.dragons[0], p2 = w2.player;
        p2.inv = 5;
        put(w2, s, p2.x + 6, p2.y); tick(w2);
        put(w2, d2, p2.x + 14, p2.y - 4); tick(w2, 2);
        ok(d2.dead, 'the sword kills AURIX (1 HP)');
        ok(w2.pickups.some((pk) => pk.kind === 'biggem' && !pk.taken && Math.abs(pk.x - d2.x) < 20), 'a slain dragon leaves a gem');
    }
    // the bat snatches what you hold
    {
        const w = fresh(1);
        const b = w.bat;
        const p = w.player;
        const s = w.items.find((i) => i.kind === 'sword');
        put(w, s, p.x + 8, p.y); tick(w);
        b.target = s; put(w, b, p.x + 10, p.y);
        tick(w, 3);
        ok(s.holder === 'bat' && !p.held, 'BYTE snatches the item out of your hands');
    }
    // BYTE never strands an item where you can't reach it
    {
        const w = fresh(1);
        const key = w.items.find((i) => i.kind === 'key' && i.color === 'gold');
        const vault = w.roomRect(w.map.rooms.findIndex((r) => r && r.ch === 'v' && r.c === 3));
        const b = w.bat;
        key.holder = 'bat'; b.carry = key;
        put(w, b, vault.x + 150, vault.y + 90);
        w.batDrop();
        const tx = Math.floor(cx(key) / T), ty = Math.floor(cy(key) / T);
        ok(w.reach[ty * w.map.gw + tx] === 1, 'an item BYTE drops inside a locked vault lands where you can reach it');
    }
    // the NULL wakes at par and costs a life
    {
        const w = fresh(0);
        w.t = w.parT + 0.01; w.player.inv = 0;
        tick(w, 1);
        ok(w.nul.active, 'THE NULL wakes at par time');
        w.nul.x = w.player.x; w.nul.y = w.player.y; w.nul.stun = 0;
        tick(w, 2);
        ok(w.player.dead && w.player.cause === 'null', 'its touch costs a life');
    }
    // the boss: phases, dull window, death, chalice, collapse
    {
        const s = newSession(); s.lives = 3;
        const w = new World(5, s);
        w.god = true;
        const b = w.boss;
        const R = w.roomRect(b.room);
        const sw = w.items.find((i) => i.kind === 'sword');
        const p = w.player;
        put(w, p, R.x + 150, R.y + 160);
        sw.holder = 'player'; p.held = sw; sw.ox = 8; sw.oy = 0;
        tick(w, 2);
        ok(b.active, 'entering the arena wakes CHROMAGON');
        const cg = w.map.gates.find((g) => g.color === 'chrome');
        ok(cg.open < 0.7 && w.map.at(cg.x, cg.y) === GATE, 'and the gate is shut behind you');
        // dying mid-fight must not lock you out
        w.god = false; p.inv = 0; w.session.lives = 5;
        b.hp = 15; w.die('boss');
        tick(w, 120 * 3);
        const cg2 = w.map.gates.find((g) => g.color === 'chrome');
        ok(!b.active && b.hp === 15 && cg2.open >= 1, 'dying in the arena reopens the gate; CHROMAGON keeps his wounds');
        put(w, p, R.x + 150, R.y + 160); w.god = true;
        if (p.held) p.held.holder = null;
        sw.holder = 'player'; p.held = sw; sw.ox = 8; sw.oy = 0;
        tick(w, 2);
        ok(b.active, 'and coming back wakes him again');
        let hits = 0, phases = new Set();
        for (let k = 0; k < 120 * 200 && !b.dead; k++) {
            if (b.dull) { put(w, p, b.x + 6, b.y + 30); }
            else put(w, p, R.x + 40, R.y + 170);
            const hp = b.hp;
            w.step(SIM_DT, {});
            if (b.hp < hp) hits++;
            phases.add(b.phase);
        }
        ok(b.dead, `CHROMAGON can be beaten (${hits} hits)`);
        ok(phases.has(2) && phases.has(3), 'he goes through his phases');
        tick(w, 120 * 3);
        const chal = w.items.find((i) => i.kind === 'chalice');
        ok(!!chal && chal.chrome, 'the Chrome Chalice drops');
        put(w, p, chal.x, chal.y); tick(w, 2);
        ok(w.collapseT > 0 && w.nul.active, 'lifting it starts the collapse and wakes THE NULL');
    }
    // extra lives
    {
        const w = fresh(0);
        const l = w.session.lives;
        w.addScore(20000);
        ok(w.session.lives === l + 1, 'an extra life at 20 000');
        w.addScore(40000);
        ok(w.session.lives === l + 2, 'and at 60 000');
    }
    // winning: the chalice in the Sunset Keep's vault
    {
        const w = fresh(0);
        const ch = w.items.find((i) => i.kind === 'chalice');
        const R = w.roomRect(w.map.homeVault);
        put(w, ch, R.x + 150, R.y + 90);
        tick(w, 1);
        ok(w.cleared && w.tally && w.tally.realm === 10000, 'the chalice in the home vault clears the realm');
    }
}

// ------------------------------------------------------------------ 4. bot
if (run('bot')) {
    section('bot (god mode)');
    for (const mode of ['arcade', 'remix']) {
        for (let i = 0; i < REALMS.length; i++) {
            const s = newSession({ mode, remix: 4242 });
            s.lives = 99;
            const w = World.create(i, s);
            w.god = true;
            const t = play(w, new Bot(w), 900);
            ok(w.cleared, `${mode} realm ${i + 1} not cleared by the bot in 900 s`);
            console.log(`  ${mode.padEnd(6)} ${String(i + 1).padStart(2)} ${REALMS[i].name.padEnd(20)} ${w.cleared ? 'clear' : 'FAIL '} in ${t.toFixed(0).padStart(4)} s, score ${s.score}`);
        }
    }
    // the whole run carries one session through to the end
    const s = newSession(); s.lives = 99;
    for (let i = 0; i < REALMS.length; i++) { const w = World.create(i, s); w.god = true; play(w, new Bot(w), 900); ok(w.cleared, `campaign realm ${i + 1}`); }
    console.log(`  full campaign: ${s.score} points, ${s.kills} dragons, ${s.gems} gems`);
}

// ------------------------------------------------------------------ 5. balance
if (run('balance')) {
    section('balance (mortal bot, 2 runs per realm, 10-minute cap)');
    console.log('  realm                 skill    deaths/run  time/run  cleared');
    for (const skill of ['novice', 'expert']) {
        for (let i = 0; i < REALMS.length; i++) {
            let deaths = 0, time = 0, cleared = 0;
            for (let r = 0; r < 2; r++) {
                const s = newSession({ skill }); s.lives = 30;
                const w = new World(i, s);
                w.rng = (await import('../js/rng.js')).makeRng(r * 7777 + i);
                time += play(w, new Bot(w), 600);
                deaths += w.deathsHere; if (w.cleared) cleared++;
            }
            console.log(`  ${(i + 1 + ' ' + REALMS[i].name).padEnd(22)} ${skill.padEnd(8)} ${(deaths / 2).toFixed(1).padStart(6)} ${(time / 2).toFixed(0).padStart(9)} s ${String(cleared).padStart(6)}/2`);
        }
    }
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
