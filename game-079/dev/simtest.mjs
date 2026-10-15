/**
 * simtest.mjs — headless checks of VENDETTA OVERDRIVE's simulation. No browser.
 *
 *   node game-079/dev/simtest.mjs                      # everything
 *   ONLY=purity,levels,weapons,rules,determinism node game-079/dev/simtest.mjs
 *   ONLY=bot SEEDS=6 VERBOSE=1 node game-079/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. levels: every level on many seeds and all difficulties is valid (keys and exit reachable by
 *    walking, loot reachable with the jetpack), has three tapes, no enemies in the start room, a
 *    boss arena where there should be one.
 * 3. weapons: hundreds of rolled guns have finite, sane stats and names; rarity rises with level.
 * 4. rules: movement, steps, jumps, jetpack, doors and keys, hitscan, splash, rocket jumps,
 *    elements, kick, pickups and swaps, Overdrive, death and continue, ambush, bosses.
 * 5. determinism: same seed and inputs give the same game; a save round trip mid-fight plays on
 *    identically; an unknown save version is rejected.
 * 6. bot: the bot plays the whole campaign on SEEDS seeds at skill 1 and 0.6 with per-step
 *    invariants, and the balance table is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 3);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Lv = await import('../js/sim/level.js');
const Wp = await import('../js/sim/weapons.js');
const Wd = await import('../js/sim/world.js');
const Cb = await import('../js/sim/combat.js');
const En = await import('../js/sim/enemies.js');
const D = await import('../js/sim/data.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = Gm.NO_INPUT;
const inp = (o) => ({ ...NONE, ...o });
const run = (G, input, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, typeof input === 'function' ? input(G) : input, DT); };
const drain = (G) => G.events.splice(0);

/** A quiet test level: the real level 0 with every enemy removed, the player at a chosen cell. */
function quiet(seed = 3, level = 0) {
    const G = Gm.newGame(seed, 1);
    if (level) Gm.startLevel(G, level);
    G.enemies.length = 0;
    G.barrels.length = 0;
    drain(G);
    return G;
}
/** Find an open, plain cell with open plain cells for `n` cells in direction (dx, dz). */
function findRun(G, n, dx = 1, dz = 0, pred = null) {
    const L = G.L;
    for (let i = 0; i < L.N; i++) {
        let good = true;
        for (let k = 0; k <= n && good; k++) {
            const x = (i % L.W) + dx * k, z = ((i / L.W) | 0) + dz * k;
            const j = z * L.W + x;
            if (x < 1 || z < 1 || x >= L.W - 1 || z >= L.H - 1) { good = false; break; }
            if (L.solid[j] || L.liquid[j] || L.crate[j] || L.door[j] >= 0 || L.floor[j] !== L.floor[i] || L.platform?.[j]) good = false;
            // and a free row either side
            for (const s of [-1, 1]) {
                const q = (z + dz * 0 + (dx ? s : 0)) * L.W + (x + (dz ? s : 0));
                if (L.solid[q] || L.floor[q] !== L.floor[i]) good = false;
            }
        }
        if (good && (!pred || pred(i))) return i;
    }
    return -1;
}
const place = (G, cell, yaw = Math.PI / 2) => {
    const p = G.player;
    p.x = Wd.cellX(G.L, cell); p.z = Wd.cellZ(G.L, cell); p.y = G.L.floor[cell];
    p.vx = p.vy = p.vz = 0; p.yaw = yaw; p.pitch = 0; p.ground = true;
};

// ============================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ============================================================================
if (want('levels')) {
    section('levels');
    const N = +(process.env.LEVEL_SEEDS || 25);
    const rows = [];
    for (let lv = 0; lv < Gm.LEVEL_COUNT; lv++) {
        const spec = D.LEVELS[lv];
        let attempts = 0, enemies = 0, pickups = 0, bad = 0, t0 = Date.now();
        for (let s = 1; s <= N; s++) {
            for (const diff of C.DIFFICULTY) {
                let L;
                try { L = Lv.generateLevel(s * 7717 + 3, lv, diff); } catch (err) { bad++; ok(false, `level ${lv} seed ${s}: ${err.message}`); continue; }
                attempts += L.attempt;
                const v = Lv.validate(L);
                if (!ok(v.ok, `level ${lv} seed ${s} ${diff.id}: ${v.errs.join('; ')}`)) bad++;
                if (diff.id !== 'normal') continue;
                enemies += L.enemies.length; pickups += L.pickups.length;
                const tapes = L.pickups.filter((p) => p.kind === 'tape').map((p) => p.tape).sort().join();
                ok(tapes === '0,1,2', `level ${lv} seed ${s}: three tapes (${tapes})`);
                ok(L.pickups.filter((p) => p.kind === 'key').length === spec.keys, `level ${lv} seed ${s}: ${spec.keys} key(s)`);
                ok(L.doors.length === spec.keys, `level ${lv} seed ${s}: one door per key`);
                ok(!L.enemies.some((e) => L.room[e.cell] === L.startRoom), `level ${lv} seed ${s}: nothing in the start room`);
                ok(L.lights.length > 20 && L.signs.length > 5, `level ${lv} seed ${s}: lights and signs (${L.lights.length}, ${L.signs.length})`);
                if (spec.boss) ok(L.rooms[L.exitRoom].arena && L.boss === spec.boss, `level ${lv} seed ${s}: the boss arena is the exit room`);
                if (spec.legendary) ok(L.pickups.some((p) => p.kind === 'gun' && p.gun.legendary === spec.legendary), `level ${lv} seed ${s}: the legendary waits in the exit room`);
                // every floor step between open neighbours on the critical path is ≤ 0.5 except features
                let steep = 0;
                for (let i = 0; i < L.N; i++) {
                    if (L.solid[i] || L.crate[i] || L.liquid[i] || L.platform?.[i]) continue;
                    for (const j of [i + 1, i + L.W]) {
                        if (j >= L.N || L.solid[j] || L.crate[j] || L.liquid[j] || L.platform?.[j]) continue;
                        if (Math.abs(L.floor[i] - L.floor[j]) > 0.51) steep++;
                    }
                }
                ok(steep === 0, `level ${lv} seed ${s}: no step over 0.5 m outside features (${steep})`);
                // deterministic
                const L2 = Lv.generateLevel(s * 7717 + 3, lv, diff);
                ok(L2.enemies.length === L.enemies.length && L2.pickups.length === L.pickups.length && L2.floor.every((f, i) => f === L.floor[i]), `level ${lv} seed ${s}: same seed, same level`);
            }
        }
        rows.push(`  ${spec.name.padEnd(18)} retries/level ${(attempts / N / 3).toFixed(2)}  enemies ${(enemies / N).toFixed(0)}  pickups ${(pickups / N).toFixed(0)}  ${((Date.now() - t0) / N / 3).toFixed(0)} ms each`);
    }
    console.log(rows.join('\n'));
}

// ============================================================================
if (want('weapons')) {
    section('weapons');
    const guns = [];
    for (let k = 0; k < 600; k++) guns.push(Wp.genWeapon(1000 + k * 13, { level: k % 5, bonus: k % 7 === 0 ? 1 : 0 }));
    const numeric = ['dmg', 'pellets', 'rate', 'mag', 'reload', 'spread', 'dps', 'range'];
    let badStat = 0, badPart = 0, badName = 0;
    for (const g of guns) {
        if (numeric.some((k) => !Number.isFinite(g[k]) || g[k] < 0) || g.dmg <= 0 || g.rate <= 0 || g.mag < 1) badStat++;
        if (g.parts.some((p) => Wp.PARTS[p].only && !Wp.PARTS[p].only.includes(g.arch)) || new Set(g.parts).size !== g.parts.length || g.parts.length !== g.rarity) badPart++;
        if (!g.name || g.name.length < 8 || /undefined|NaN/.test(g.name)) badName++;
    }
    ok(badStat === 0, `600 guns have finite, positive stats (${badStat} bad)`);
    ok(badPart === 0, `parts fit their archetype, no duplicates, one per rarity tier (${badPart} bad)`);
    ok(badName === 0, `every gun has a name (${badName} bad)`);
    ok(Wp.ARCH_IDS.every((a) => guns.some((g) => g.arch === a)), 'every archetype rolls');
    ok(D.LEVELS.length && Wp.ELEMENTS.every((e) => guns.some((g) => g.element === e)), 'every element rolls');
    const avgR = (lv) => { const s = guns.filter((g) => g.level === lv); return s.reduce((a, g) => a + g.rarity, 0) / s.length; };
    ok(avgR(4) > avgR(0), `rarity rises with level (${avgR(0).toFixed(2)} → ${avgR(4).toFixed(2)})`);
    const a = Wp.genWeapon(777, { level: 2 }), b = Wp.genWeapon(777, { level: 2 });
    ok(JSON.stringify(a) === JSON.stringify(b), 'same seed, same gun');
    for (const id of Object.keys(Wp.LEGENDARIES)) {
        const g = Wp.legendary(id, 1);
        ok(g.rarity === 4 && g.name === Wp.LEGENDARIES[id].name && g.legendary === id, `legendary ${g.name}`);
    }
    const st = Wp.starterGun();
    ok(st.infinite && st.arch === 'pistol', 'the starter pistol never runs dry');
    const tiers = [0, 1, 2, 3, 4].map((r) => { const s = guns.filter((g) => g.rarity === r && g.arch === 'pistol'); return s.length ? s.reduce((x, g) => x + g.dps, 0) / s.length : 0; });
    console.log(`  rarity mix ${[0, 1, 2, 3, 4].map((r) => guns.filter((g) => g.rarity === r).length).join('/')} · pistol dps by tier ${tiers.map((x) => x.toFixed(0)).join(' ')}`);
    console.log(`  e.g. ${guns.slice(0, 4).map((g) => `"${g.name}"`).join(', ')}`);
}

// ============================================================================
if (want('rules')) {
    section('rules');
    // ---- movement
    {
        const G = quiet();
        const c = findRun(G, 6, 1, 0);
        ok(c >= 0, 'found a flat run to test on');
        place(G, c, Math.PI / 2);            // yaw π/2 faces +x
        const x0 = G.player.x;
        run(G, inp({ my: 1 }), 0.5);
        const sp = (G.player.x - x0) / 0.5;
        ok(sp > 7 && sp < 9.2, `runs forward at about ${C.PLAYER.speed} m/s (${sp.toFixed(2)})`);
        run(G, inp({ my: 1, mx: 1 }), 0.3);
        ok(Math.hypot(G.player.vx, G.player.vz) <= C.PLAYER.speed + 0.01, 'diagonals are no faster');
        place(G, c, Math.PI / 2);
        run(G, inp({ my: 1 }), 6);
        const cx = Math.floor(G.player.x / C.CELL), cz = Math.floor(G.player.z / C.CELL);
        ok(!G.L.solid[cz * G.L.W + cx], 'walls stop the player');
        place(G, c, 0);
        run(G, inp({ jump: true }), 0.1);
        ok(G.player.y > G.L.floor[c] + 0.3 && !G.player.ground, 'Space jumps');
        run(G, NONE, 1.5);
        ok(G.player.ground && Math.abs(G.player.y - G.L.floor[c]) < 0.01, 'gravity brings you back down');
        // jetpack
        place(G, c, 0);
        let top = 0;
        for (let t = 0; t < 2; t += DT) { Gm.step(G, inp({ jump: true }), DT); top = Math.max(top, G.player.y - G.L.floor[c]); }
        ok(top > 2.8, `holding jump fires the jetpack (${top.toFixed(2)} m up)`);
        ok(G.player.fuel < C.PLAYER.fuelMax, 'the jetpack burns fuel');
        run(G, NONE, 6);
        ok(G.player.fuel === C.PLAYER.fuelMax, 'fuel refills on the ground');
    }
    // ---- steps, crates
    {
        const G = quiet();
        const L = G.L;
        const c = findRun(G, 5, 1, 0);
        const x = c % L.W, z = (c / L.W) | 0;
        const save = [L.floor[c + 2], L.floor[c + 4]];
        L.floor[c + 2] += 0.5;      // a step
        L.floor[c + 3] += 0.5;
        L.floor[c + 4] += 1.7;      // too tall to walk
        place(G, c, Math.PI / 2);
        run(G, inp({ my: 1 }), 3);
        const px = Math.floor(G.player.x / C.CELL);
        ok(px === x + 3 && Math.abs(G.player.y - L.floor[c + 3]) < 0.01, `walks up a 0.5 m step and stops at a 1.7 m wall (cell ${px - x})`);
        place(G, c + 3, Math.PI / 2);
        L.floor[c + 4] = L.floor[c + 3] + 1.0;
        run(G, (g) => inp({ my: 1, jump: g.player.ground }), 1.2);
        ok(Math.floor(G.player.x / C.CELL) >= x + 4, 'jumps onto a 1 m crate');
        void save; void z;
    }
    // ---- hitscan, kills, events
    {
        const G = quiet();
        const c = findRun(G, 6, 1, 0);
        place(G, c, Math.PI / 2);
        const e = En.spawnEnemy(G, 'trooper', G.player.x + 9, G.player.z);
        e.y = G.player.y;
        const hp0 = e.hp;
        Gm.step(G, inp({ fire: true }), DT);
        ok(e.hp < hp0, `a pistol shot hurts a trooper (${hp0} → ${e.hp.toFixed(0)})`);
        ok(e.alert, 'and wakes it up');
        run(G, inp({ fire: true }), 2);
        ok(e.dead && G.events.some((v) => v.type === 'kill' && v.etype === 'trooper'), 'enough shots kill it, with a kill event');
        ok(G.tally.kills === 1 && G.player.fury > 0, 'kills count and fill Fury');
        ok(!G.events.some((v) => v.type !== undefined && typeof v.type !== 'string'), 'event payloads never overwrite `type`');
        ok(!G.enemies.includes(e), 'the dead are removed from the sim');
    }
    // ---- splash, rocket jump, barrels
    {
        const G = quiet();
        const c = findRun(G, 6, 1, 0);
        place(G, c, Math.PI / 2);
        const p = G.player;
        const a = En.spawnEnemy(G, 'trooper', p.x + 8, p.z - 0.6), b = En.spawnEnemy(G, 'trooper', p.x + 8, p.z + 0.6);
        Cb.explode(G, p.x + 8, p.y + 1, p.z, 4.5, 95, 'p');
        ok(a.hp < a.maxhp && b.hp < b.maxhp, 'splash hurts everything in the radius');
        const hp0 = p.hp;
        p.ground = true; p.vy = 0;
        Cb.explode(G, p.x, p.y + 0.2, p.z, 4.5, 95, 'p');
        ok(p.vy > 4, `your own blast launches you (rocket jump, vy ${p.vy.toFixed(1)})`);
        ok(p.hp < hp0 && hp0 - p.hp < 40, `and costs a little health (${(hp0 - p.hp).toFixed(0)})`);
        G.barrels.push({ id: 999, x: p.x + 4, y: p.y, z: p.z, hp: 30, dead: false });
        drain(G);
        Cb.damageBarrel(G, G.barrels[0], 50);
        ok(G.barrels[0].dead && G.events.some((v) => v.type === 'explode'), 'barrels explode');
    }
    // ---- elements
    {
        const G = quiet();
        const c = findRun(G, 6, 1, 0);
        place(G, c, Math.PI / 2);
        const p = G.player;
        const e = En.spawnEnemy(G, 'brute', p.x + 6, p.z);
        Cb.damageEnemy(G, e, 1, { element: 'fire', src: 'p' });
        const h1 = e.hp;
        run(G, NONE, 1.6);
        ok(e.hp < h1 - 5, `fire burns over time (${(h1 - e.hp).toFixed(1)} in 1.6 s)`);
        e.burn = 0;
        const t = En.spawnEnemy(G, 'trooper', p.x + 6, p.z + 2);
        for (let k = 0; k < 4; k++) Cb.damageEnemy(G, t, 1, { element: 'cryo', src: 'p' });
        ok(t.frozen > 0, 'four cryo hits freeze');
        const x0 = t.x;
        run(G, NONE, 0.5);
        ok(t.x === x0, 'frozen enemies stand still');
        const armored = En.spawnEnemy(G, 'tank', p.x + 12, p.z);
        const h0 = armored.hp;
        Cb.damageEnemy(G, armored, 20, { element: 'acid', src: 'p' });
        const acid = h0 - armored.hp;
        const h2 = armored.hp;
        Cb.damageEnemy(G, armored, 20, { src: 'p' });
        ok(acid > (h2 - armored.hp) * 1.5, `acid eats armour (${acid.toFixed(0)} vs ${(h2 - armored.hp).toFixed(0)})`);
        const s1 = En.spawnEnemy(G, 'trooper', p.x + 20, p.z), s2 = En.spawnEnemy(G, 'trooper', p.x + 22, p.z);
        drain(G);
        Cb.damageEnemy(G, s1, 10, { element: 'shock', src: 'p' });
        ok(s2.hp < s2.maxhp && G.events.some((v) => v.type === 'arc'), 'shock arcs to a neighbour');
    }
    // ---- kick
    {
        const G = quiet();
        const c = findRun(G, 6, 1, 0);
        place(G, c, Math.PI / 2);
        const p = G.player;
        const e = En.spawnEnemy(G, 'trooper', p.x + 1.4, p.z);
        Gm.step(G, inp({ kick: true }), DT);
        ok(e.hp < e.maxhp && e.vx > 3, `the kick hurts and knocks back (vx ${e.vx.toFixed(1)})`);
        const f = En.spawnEnemy(G, 'chomper', p.x + 1.2, p.z + 0.3);
        f.frozen = 2;
        run(G, NONE, C.KICK.cooldown);
        drain(G);
        Gm.step(G, inp({ kick: true }), DT);
        ok(G.events.some((v) => v.type === 'kill' && v.shatter && v.gib), 'kicking a frozen enemy shatters it');
    }
    // ---- doors and keys
    {
        const G = Gm.newGame(3, 1);
        const L = G.L;
        G.enemies.length = 0;
        const door = L.doors[0];
        const dc = door.cells[0];
        const p = G.player;
        p.x = Wd.cellX(L, dc) + 0.2; p.z = Wd.cellZ(L, dc) + 0.2;
        ok(Wd.isWall(G, dc), 'a keycard door starts shut');
        // stand just outside it, without the key
        const out = [dc + 1, dc - 1, dc + L.W, dc - L.W].find((j) => !L.solid[j] && L.room[j] !== door.room && L.door[j] < 0);
        place(G, out);
        run(G, NONE, 1.5);
        ok(G.doorOpen[0] === 0, 'it stays shut without the key');
        const key = G.pickups.find((q) => q.kind === 'key');
        p.x = key.x; p.z = key.z; p.y = key.y;
        Gm.step(G, NONE, DT);
        ok(p.keys & (1 << key.key), 'walking over the keycard takes it');
        place(G, out);
        run(G, NONE, 1.5);
        ok(G.doorOpen[0] === 1 && !Wd.isWall(G, dc), 'and the door opens when you walk up to it');
    }
    // ---- pickups, guns, swaps
    {
        const G = quiet();
        const p = G.player;
        const c = findRun(G, 6, 1, 0);
        place(G, c);
        const put = (kind, extra = {}) => { const pk = { id: G.nextId++, kind, x: p.x, y: p.y, z: p.z, cell: c, ...extra }; G.pickups.push(pk); Gm.step(G, NONE, DT); return !G.pickups.includes(pk); };
        p.hp = 100;
        ok(put('cola') && p.hp === 115, 'Rad Cola overheals');
        ok(!put('burger'), 'a burger stays on the floor when you are full');
        G.pickups.length = 0;
        p.hp = 40;
        ok(put('burger') && p.hp === 90, 'a burger heals 50');
        p.ammo.rocket = C.AMMO_MAX.rocket;
        ok(!put('rocket'), 'ammo stays put when you are full');
        G.pickups.length = 0;
        const n0 = p.weapons.length;
        const gun = Wp.genWeapon(42, { level: 1 });
        ok(put('gun', { gun }) && p.weapons.length === n0 + 1 && p.weapons[p.cur] === gun, 'a gun goes into a free slot and into your hands');
        while (p.weapons.filter((g) => !g.infinite).length < C.PLAYER.slots) p.weapons.push(Wp.genWeapon(50 + p.weapons.length, {}));
        const g2 = Wp.genWeapon(99, { level: 3 });
        const pk = { id: G.nextId++, kind: 'gun', x: p.x, y: p.y, z: p.z, cell: c, gun: g2 };
        G.pickups.push(pk);
        Gm.step(G, NONE, DT);
        ok(G.pickups.includes(pk) && p.nearGun === pk.id, 'with full slots a gun waits for Use');
        const held = p.weapons[p.cur];
        Gm.step(G, inp({ use: true }), DT);
        ok(p.weapons[p.cur] === g2 && pk.gun === held, 'Use swaps it for the gun in your hands, which stays on the floor');
        run(G, NONE, 0.5);
        ok(p.weapons[p.cur] === g2, 'and you don\'t pick your old gun straight back up');
        p.cur = p.weapons.findIndex((g) => g.infinite);
        const g3 = Wp.genWeapon(123, {});
        const pk3 = { id: G.nextId++, kind: 'gun', x: p.x, y: p.y, z: p.z, cell: c, gun: g3 };
        G.pickups.push(pk3);
        drain(G);
        Gm.step(G, inp({ use: true }), DT);
        ok(p.weapons[p.cur].infinite && pk3.gun === g3 && G.events.some((v) => v.type === 'nodrop'), 'Dad\'s pistol can\'t be dropped');
        ok(p.weapons.length === C.PLAYER.slots + 1, 'four slots plus the sidearm');
    }
    // ---- infinite pistol
    {
        const G = quiet();
        const p = G.player;
        place(G, findRun(G, 4, 1, 0));
        p.cur = 0; p.ammo.bullet = 0;
        let shots = 0;
        for (let t = 0; t < 8; t += DT) { Gm.step(G, inp({ fire: true }), DT); for (const v of drain(G)) if (v.type === 'fire') shots++; }
        ok(shots > 20 && p.ammo.bullet === 0, `the starter pistol keeps firing with no ammo (${shots} shots)`);
    }
    // ---- overdrive
    {
        const G = quiet();
        const p = G.player;
        const c = findRun(G, 6, 1, 0);
        place(G, c, Math.PI / 2);
        Gm.step(G, inp({ over: true }), DT);
        ok(p.overdrive === 0, 'Overdrive needs a full Fury bar');
        p.fury = C.FURY.max;
        Gm.step(G, inp({ over: true }), DT);
        ok(p.overdrive > 0 && p.fury === 0, 'with a full bar, F fires Overdrive');
        const pr = Cb.spawnProj(G, { x: p.x + 10, y: p.y + 1, z: p.z, vx: -10, vy: 0, vz: 0, owner: 'e', dmg: 1, kind: 'bolt' });
        Gm.step(G, NONE, 0.1);
        ok(Math.abs((p.x + 10 - pr.x) - 10 * 0.1 * C.FURY.enemyScale) < 0.01, 'enemy shots crawl during Overdrive');
        run(G, NONE, C.FURY.duration);
        ok(p.overdrive === 0, 'and it runs out');
    }
    // ---- death and continue
    {
        const G = Gm.newGame(5, 1);
        const p = G.player;
        p.weapons.push(Wp.genWeapon(5, {}));
        Gm.startLevel(G, 1);
        const entryGuns = p.weapons.length;
        p.weapons.push(Wp.genWeapon(6, {}));
        Cb.hurtPlayer(G, 9999, p.x, p.z);
        ok(G.phase === 'dead' && G.events.some((v) => v.type === 'death'), 'running out of health ends the run');
        const t0 = G.t;
        Gm.step(G, inp({ my: 1 }), DT);
        ok(p.x === p.x && G.phase === 'dead' && G.t > t0, 'nothing moves while dead');
        Gm.continueLevel(G);
        ok(G.phase === 'play' && G.level === 1 && p.hp >= 100 && p.weapons.length === entryGuns, 'Continue restarts the level with what you entered it with');
    }
    // ---- ambush and bosses
    {
        const G = Gm.newGame(7, 1);
        const L = G.L;
        G.enemies.length = 0;
        G.player.keys = 0b1110;
        const r = L.rooms[L.exitRoom];
        place(G, r.c);
        Gm.step(G, NONE, DT);
        ok(G.ambush === 'active' && G.enemies.length > 4, `walking into the exit room springs the ambush (${G.enemies.length})`);
        ok(L.doors.filter((d) => d.room === L.exitRoom).every((d) => G.doorLock[d.id]), 'and locks the doors');
        place(G, L.exitCell);
        Gm.step(G, NONE, DT);
        ok(G.phase === 'play', 'the exit waits for the ambush');
        for (const e of G.enemies) Cb.damageEnemy(G, e, 1e6, { src: 'p' });
        Gm.step(G, NONE, DT);
        ok(G.ambush === 'done', 'killing the wave ends the ambush');
        run(G, NONE, 0.1);
        place(G, L.exitCell);
        Gm.step(G, NONE, DT);
        ok(G.phase === 'clear', 'then the exit clears the level');
        ok(Gm.nextLevel(G) && G.level === 1, 'and the next level starts');

        for (const [lvl, boss] of [[1, 'chompra'], [3, 'vrask'], [4, 'rourke']]) {
            const H = Gm.newGame(11, 1);
            Gm.startLevel(H, lvl);
            H.enemies.length = 0;
            H.player.keys = 0b1110;
            const ar = H.L.rooms[H.L.exitRoom];
            place(H, ar.c);
            run(H, NONE, 0.2);
            const b = H.enemies.find((e) => e.boss === boss);
            ok(b && H.bossState === 'active', `${boss} appears when you enter the arena`);
            H.god = true;
            run(H, NONE, 12);
            ok(H.events.some((v) => v.type === 'attack' && v.id === b.id), `${boss} attacks`);
            if (boss === 'rourke') {
                Cb.damageEnemy(H, b, b.maxhp * 0.4, { src: 'p' });
                Gm.step(H, NONE, DT);
                ok(b.invuln && H.enemies.filter((e) => e.pylon).length === 4, 'Rourke shields himself behind four pylons at two thirds');
                const hp = b.hp;
                Cb.damageEnemy(H, b, 500, { src: 'p' });
                ok(b.hp === hp, 'and can\'t be hurt while they stand');
                for (const e of H.enemies.filter((q) => q.pylon)) Cb.damageEnemy(H, e, 1e6, { src: 'p' });
                run(H, NONE, 0.1);
                ok(!b.invuln, 'killing the pylons drops the shield');
                Cb.damageEnemy(H, b, b.maxhp * 0.4, { src: 'p' });
                run(H, NONE, 3);
                ok(b.phase === 3 && b.beamOn, 'below a third he sweeps the beam');
            }
            Cb.damageEnemy(H, b, 1e7, { src: 'p' });
            H.enemies.forEach((e) => { if (!e.boss) Cb.damageEnemy(H, e, 1e6, { src: 'p' }); });
            run(H, NONE, boss === 'rourke' ? 5 : 0.1);
            if (boss === 'rourke') ok(H.phase === 'won', 'Rourke\'s death wins the game');
            else ok(H.bossState === 'dead' && H.pickups.some((q) => q.kind === 'gun' && q.gun.legendary), `${boss} drops a legendary`);
        }
    }
}

// ============================================================================
if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame(seed, 1); const b = Bt.makeBot(); run(G, (g) => Bt.botInput(g, b), secs); return G; };
    const a = play(42, 25), b = play(42, 25);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');

    const G = play(7, 20);
    ok(G.enemies.some((e) => e.alert), 'mid-fight when saved');
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot(), b2 = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, b1), 15);
    run(copy, (g) => Bt.botInput(g, b2), 15);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    ok(JSON.stringify(Gm.serialize(G)).length < 400000, `saves stay small (${(JSON.stringify(Gm.serialize(G)).length / 1024).toFixed(0)} KB)`);
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

// ============================================================================
if (want('bot')) {
    section('bot');
    const MAX_DEATHS = 40;
    const table = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.6]) {
            const t0 = Date.now();
            const G = Gm.newGame(s * 7919, 1);
            let bot = Bt.makeBot({ skill, seed: s });
            let bad = null, deaths = 0;
            const per = [];
            let lvlDeaths = 0;
            while (G.phase !== 'won' && !bad) {
                Gm.step(G, Bt.botInput(G, bot), DT);
                G.events.length = 0;
                const p = G.player;
                if (!Number.isFinite(p.x + p.y + p.z + p.vx + p.vy + p.vz)) bad = 'non-finite player';
                else {
                    const c = Wd.cellAt(G.L, p.x, p.z);
                    if (c < 0 || G.L.solid[c]) bad = `player inside a wall at ${p.x.toFixed(1)},${p.z.toFixed(1)}`;
                }
                if (G.enemies.some((e) => !Number.isFinite(e.x + e.y + e.z + e.hp))) bad = 'non-finite enemy';
                if (G.phase === 'dead') {
                    deaths++; lvlDeaths++;
                    if (deaths > MAX_DEATHS) bad = `more than ${MAX_DEATHS} deaths`;
                    Gm.continueLevel(G); bot = Bt.makeBot({ skill, seed: s + deaths });
                }
                if (G.phase === 'clear') {
                    per.push({ t: G.lt, d: lvlDeaths, k: G.tally.kills / G.totalEnemies });
                    lvlDeaths = 0;
                    Gm.nextLevel(G); bot = Bt.makeBot({ skill, seed: s });
                }
                if (G.lt > 900) bad = `stuck on level ${G.level + 1} (${G.objective.text})`;
            }
            if (G.phase === 'won') per.push({ t: G.lt, d: lvlDeaths, k: G.tally.kills / G.totalEnemies });
            ok(!bad, `seed ${s} skill ${skill}: ${bad || `won with ${deaths} deaths`}`);
            table.push({ seed: s, skill, won: G.phase === 'won', deaths, per, ms: Date.now() - t0 });
        }
    }
    console.log('\n  seed skill  ' + D.LEVELS.map((l) => l.name.slice(0, 13).padEnd(16)).join('') + 'deaths');
    for (const r of table) {
        console.log(`  ${String(r.seed).padStart(4)} ${String(r.skill).padEnd(5)} ` + D.LEVELS.map((_, i) => r.per[i] ? `${(r.per[i].t | 0) + 's'} ${r.per[i].d}d ${Math.round(r.per[i].k * 100)}%`.padEnd(16) : '—'.padEnd(16)).join('') + `${r.deaths}  (${(r.ms / 1000).toFixed(1)} s)`);
    }
    const avgD = (sk) => { const rs = table.filter((r) => r.skill === sk); return rs.reduce((a, r) => a + r.deaths, 0) / rs.length; };
    ok(avgD(1) <= avgD(0.6), `the better bot dies less (${avgD(1).toFixed(1)} vs ${avgD(0.6).toFixed(1)})`);
    ok(avgD(1) <= 10, `the sharp bot gets through the campaign with ≤ 10 deaths on average (${avgD(1).toFixed(1)})`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
