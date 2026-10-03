/**
 * simtest.mjs — headless checks on the real simulation (no browser).
 *
 *   node game-056/dev/simtest.mjs              # everything, 2 campaign seeds
 *   SEEDS=5 node game-056/dev/simtest.mjs      # more campaign seeds
 *   WAVES=30 node game-056/dev/simtest.mjs     # shorter campaign
 *   BALANCE=1 node game-056/dev/simtest.mjs    # per-wave balance table
 *
 * Checks: js/sim purity; species, waves and relics for many seeds; every
 * tick's invariants (finite numbers, monsters in bounds, HP ≤ max, gold ≥ 0);
 * determinism; save round-trip; rekindle maths; every boss fought; and a bot
 * campaign through the whole game with retries.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SIM = path.join(HERE, '..', 'js', 'sim');
const cfg = await import('../js/config.js');
const W = await import('../js/sim/world.js');
const { genBestiary } = await import('../js/sim/species.js');
const { genWave } = await import('../js/sim/waves.js');
const { genRelicChoices, aggregateMods, relicLines } = await import('../js/sim/relics.js');
const { botSpend, botTick, botRelic, botChooseRelic } = await import('../js/sim/bot.js');
const meta = await import('../js/sim/meta.js');

let fails = 0, oks = 0;
const check = (cond, msg) => { if (cond) oks++; else { fails++; console.log('  FAIL', msg); } };
const section = (s) => console.log(`\n== ${s}`);

// ------------------------------------------------------------------ purity
section('purity');
for (const f of fs.readdirSync(SIM)) {
    const src = fs.readFileSync(path.join(SIM, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    check(!/from ['"]three/.test(src), `${f} imports three`);
    check(!/\b(document|window|localStorage|requestAnimationFrame)\b/.test(src), `${f} touches the DOM`);
    check(!/Math\.random/.test(src), `${f} calls Math.random`);
}
console.log('  sim files are pure');

// ------------------------------------------------------------------ species
section('species');
for (let s = 1; s <= 25; s++) {
    const b = genBestiary(s * 7919);
    check(b.length === cfg.REGIONS.length, 'one roster per region');
    b.forEach((byArch, ri) => {
        for (const [arch] of cfg.REGIONS[ri].roster) {
            const sp = byArch[arch];
            check(sp && sp.name && sp.plan && sp.params, `seed ${s} region ${ri} ${arch} species`);
            for (const [k, v] of Object.entries(sp.params)) if (typeof v === 'number') check(Number.isFinite(v), `param ${k} finite`);
        }
        check(byArch.treasure && byArch.treasure.params.backpack === 'chest', 'treasure carrier');
    });
}
const b1 = genBestiary(123), b2 = genBestiary(123), b3 = genBestiary(124);
check(JSON.stringify(b1) === JSON.stringify(b2), 'species deterministic');
check(JSON.stringify(b1) !== JSON.stringify(b3), 'species vary by seed');
console.log('  e.g.', b1.map((r) => r.grunt.name + ' / ' + r.brute.name).join(' · '));

// ------------------------------------------------------------------ waves
section('waves');
for (let wave = 1; wave <= 75; wave++) {
    const d = genWave(99, wave);
    check(d.entries.length > 0, `wave ${wave} has monsters`);
    check(d.entries.every((e, i) => i === 0 || e.t >= d.entries[i - 1].t), `wave ${wave} sorted`);
    check(d.entries.every((e) => d.lanes.includes(e.lane) || e.arch === 'treasure' || e.boss), `wave ${wave} lanes`);
    check(d.entries.every((e) => e.arch === 'boss' || e.arch === 'treasure' || cfg.REGIONS[d.regionIdx].roster.some(([a]) => a === e.arch)), `wave ${wave} roster`);
    check(!!d.boss === cfg.isBossWave(wave), `wave ${wave} boss flag`);
    if (d.boss) check(d.entries.some((e) => e.arch === 'boss'), `wave ${wave} spawns its boss`);
}
console.log('  waves 1–75 generate; wave 1:', genWave(99, 1).entries.length, 'monsters; wave 30:', genWave(99, 30).entries.length);

// ------------------------------------------------------------------ relics
section('relics');
const allUnits = cfg.UNIT_ORDER;
let rel = [];
for (let wv = 1; wv <= 60; wv++) rel.push(...genRelicChoices(5, wv, allUnits, 4, wv % 10 === 0));
check(rel.every((r) => r.name && r.affixes.length >= 1 && relicLines(r).every((l) => typeof l === 'string' && !l.includes('undefined'))), 'relics have names and lines');
check(rel.some((r) => r.unique), 'legendaries appear');
const m = aggregateMods(rel, { hymns: 3 });
check(Object.values(m).every((v) => typeof v !== 'number' || Number.isFinite(v)), 'mods finite');
console.log('  e.g.', rel.slice(0, 4).map((r) => `${r.name} [${cfg.RARITIES[r.rarity].name}]: ${relicLines(r).join('; ')}`).join(' | '));

// ------------------------------------------------------------------ invariants helper
function invariants(w, tag) {
    const bad = (v) => typeof v !== 'number' || !Number.isFinite(v);
    if (bad(w.gold) || w.gold < 0) return `${tag}: gold ${w.gold}`;
    if (bad(w.wallHp) || w.wallHp > w.wallMax + 1e-6) return `${tag}: wall ${w.wallHp}/${w.wallMax}`;
    for (const e of w.enemies) {
        if (bad(e.x) || bad(e.z) || bad(e.hp) || bad(e.y)) return `${tag}: enemy NaN ${e.arch}`;
        if (e.hp > e.maxHp + 1e-6) return `${tag}: enemy over max hp ${e.arch}`;
        if (e.x < -0.5 || e.x > cfg.SPAWN_X + 1) return `${tag}: enemy out of bounds ${e.arch} x=${e.x}`;
        if (e.lane < 0 || e.lane >= cfg.LANES) return `${tag}: enemy lane ${e.lane}`;
    }
    for (const u of w.units) {
        if (bad(u.hp) || u.hp > u.maxHp + 1e-6) return `${tag}: unit hp ${u.type} ${u.hp}/${u.maxHp}`;
    }
    for (const p of w.projectiles) if (bad(p.x) || bad(p.y) || bad(p.z)) return `${tag}: projectile NaN ${p.kind}`;
    if (w.kf < 0 || w.kf > 100 || bad(w.kf)) return `${tag}: keepfire ${w.kf}`;
    return null;
}

/** Play one wave with the bot. Returns 'cleared' | 'lost' | 'timeout'. */
function playWave(w, opts = {}) {
    botSpend(w);
    W.startWave(w);
    const dt = cfg.SIM_DT;
    let t = 0, think = 0, err = null;
    while (w.phase === 'wave' && t < 600) {
        W.step(w, dt);
        t += dt; think += dt;
        if (think >= 0.25) { think = 0; botTick(w, { noSpend: opts.noSpend }); }
        if (!err) { err = invariants(w, `wave ${w.wave} t=${t.toFixed(1)}`); if (err) check(false, err); }
        for (const e of W.drainEvents(w)) if (e.type === 'unitDie') w._lostUnits = (w._lostUnits ?? 0) + 1;
    }
    return w.phase === 'wave' ? 'timeout' : w.phase;
}

// ------------------------------------------------------------------ determinism & saves
section('determinism and saves');
function runTo(seed, waves) {
    const w = W.createWorld({ seed });
    for (let i = 0; i < waves; i++) {
        const r = playWave(w);
        if (r !== 'cleared') break;
        botChooseRelic(w);
    }
    return w;
}
const h = (w) => JSON.stringify(W.serializeRun(w));
const a1 = runTo(777, 6), a2 = runTo(777, 6);
check(h(a1) === h(a2), 'same seed and actions → same run');
const snap = W.serializeRun(a1);
const back = W.restoreRun(JSON.parse(JSON.stringify(snap)));
check(JSON.stringify(W.serializeRun(back)) === JSON.stringify(snap), 'save round-trip');
console.log(`  6 waves deterministic; wave ${a1.wave}, gold ${a1.gold}, units ${a1.units.length}`);

// ------------------------------------------------------------------ actions
section('actions');
{
    const w = W.createWorld({ seed: 5 });
    check(W.canPlace(w, 'knight', { kind: 'field', lane: 2, col: 0 }) === 'locked', 'knight locked at wave 1');
    check(W.canPlace(w, 'archer', { kind: 'wall', lane: 2, tier: 0 }) === 'occupied', 'starting archer occupies the centre tower');
    check(W.canPlace(w, 'archer', { kind: 'wall', lane: 1, tier: 0 }) === 'no tower', 'no tower in lane 1');
    check(W.canPlace(w, 'archer', { kind: 'field', lane: 2, col: 3 }) === 'beyond the bailey', 'bailey limit');
    check(W.placeUnit(w, 'archer', { kind: 'field', lane: 2, col: 0 }) === null, 'place archer in the field');
    const u = w.units[w.units.length - 1];
    check(W.sellValue(w, u) === cfg.UNITS.archer.cost, 'full refund for a unit placed this prep');
    w.gold = 1e6;
    for (let i = 0; i < 12; i++) W.upgradeUnit(w, u.id);
    check(u.level === cfg.UNIT_MAX_LEVEL, 'upgrade to max level');
    check(W.buyTower(w, 0) === null && w.castle.towers[0] === 1, 'buy a tower');
    for (const k of cfg.CASTLE_ORDER) check(W.buyCastle(w, k) === null, `buy castle ${k}`);
    W.startWave(w);
    check(W.placeUnit(w, 'archer', { kind: 'field', lane: 1, col: 0 }) === null && W.canPlace(w, 'archer', { kind: 'field', lane: 3, col: 0 }) === 'recharging', 'card recharges mid-wave');
    w.powers.push({ power: 'meteor', rarity: 2 }, { power: 'nova', rarity: 0 });
    check(W.usePower(w, 0) === 'target', 'meteor needs a target');
    check(W.usePower(w, 0, { x: 5, lane: 2 }) === null, 'meteor fires');
    check(W.usePower(w, 0) === null, 'nova fires');
    w.kf = 100;
    check(W.fireKeepfire(w, 2) === null, 'keepfire fires');
}

// ------------------------------------------------------------------ every boss
section('bosses');
for (let r = 0; r < cfg.REGIONS.length; r++) {
    const wave = (r + 1) * 10;
    // A modest party and an unbreakable wall: we want to watch the boss work.
    const w = W.createWorld({ seed: 31 + r, wave, gold: Math.round(2500 * Math.pow(1.13, wave)) });
    for (let i = 0; i < 40; i++) botSpend(w);
    w.gold = 0;
    w.god = true;
    const seenActs = new Set();
    W.startWave(w);
    let t = 0, killed = false, err = null;
    while (w.phase === 'wave' && t < 900) {
        W.step(w, cfg.SIM_DT); t += cfg.SIM_DT;
        if (Math.round(t * 60) % 15 === 0) botTick(w, { noSpend: true });
        for (const e of W.drainEvents(w)) { if (e.type === 'bossAct') seenActs.add(e.act); if (e.type === 'bossDown') killed = true; }
        if (!err) { err = invariants(w, `boss ${r}`); if (err) check(false, err); }
    }
    check(killed, `${cfg.REGIONS[r].boss.name} can be killed (bot party, unbreakable wall)`);
    check(seenActs.size >= 2, `${cfg.REGIONS[r].boss.name} uses its abilities (${[...seenActs].join(', ')})`);
    console.log(`  ${cfg.REGIONS[r].boss.name}: ${killed ? 'down' : 'ALIVE'} at ${t.toFixed(0)}s, acts: ${[...seenActs].join(', ')}`);
}

// ------------------------------------------------------------------ meta
section('meta');
{
    const mm = meta.newMeta();
    check(meta.rekindleGain({ best: 10 }) === 0, 'no rekindle before wave 15');
    const g = meta.rekindle(mm, { best: 30 });
    check(g === cfg.embersFor(30) && mm.embers === g, 'rekindle pays embers');
    check(meta.buyRank(mm, 'warmth') && mm.tree.warmth === 1, 'buy an ember rank');
    const w = W.createWorld({ seed: 3, ember: { camp: 2, masonry: 2, warmth: 3 } });
    check(w.wave === 11 && w.castle.towers.filter((t) => t > 0).length === 3, 'forward camp + masonry');
    check(meta.offlineGold({ wave: 10, castle: { treasury: 3 } }, 3600) > 0, 'offline treasury gold');
    const n = meta.normalizeSave({ meta: { embers: 5 } });
    check(n.meta.embers === 5 && n.meta.settings.sound === true && n.meta.tree.hymns === 0, 'normalize partial save');
}

// ------------------------------------------------------------------ campaign
section('bot campaign');
const SEEDS = +(process.env.SEEDS ?? 2);
const WAVES = +(process.env.WAVES ?? cfg.FINAL_WAVE);
const rows = [];
for (let s = 0; s < SEEDS; s++) {
    const seed = 1000 + s * 17;
    let w = W.createWorld({ seed });
    let snapW = W.serializeRun(w);
    let retries = 0, totalRetries = 0, gaveUp = false;
    const t0 = Date.now();
    while (w.wave <= WAVES) {
        snapW = W.serializeRun(w);
        const r = playWave(w);
        if (r === 'timeout') { check(false, `seed ${seed} wave ${w.wave} timed out`); gaveUp = true; break; }
        if (r === 'lost') {
            retries++; totalRetries++;
            rows.push({ seed, wave: w.wave, result: 'lost', wall: 0, gold: w.gold });
            if (retries > 12) { gaveUp = true; break; }
            const earned = W.waveIncome(w);
            w = W.retryFrom(snapW, earned);
            continue;
        }
        rows.push({ seed, wave: w.wave, result: 'clear', wall: w.lastClear.wallLeft, gold: w.gold, units: w.units.length, retries, lostU: w._lostUnits ?? 0, forge: w.castle.forge, lv: Math.round(w.units.reduce((a, u) => a + u.level, 0) / w.units.length * 10) / 10 });
        w._lostUnits = 0;
        retries = 0;
        botChooseRelic(w);
    }
    const reached = gaveUp ? w.wave : w.wave - 1;
    console.log(`  seed ${seed}: cleared through wave ${reached}${gaveUp ? ' (stuck)' : ''}, ${totalRetries} retries, ${((Date.now() - t0) / 1000).toFixed(1)}s, ${w.units.length} units, forge ${w.castle.forge}, walls ${w.castle.walls}`);
    check(reached >= Math.min(WAVES, 40), `seed ${seed}: the bot gets deep into the campaign (reached ${reached})`);
}
if (process.env.BALANCE) {
    console.log('\n  wave | clears | losses | min wall left | avg gold | units lost | forge | avg lv');
    for (let wv = 1; wv <= WAVES; wv++) {
        const r = rows.filter((x) => x.wave === wv);
        if (!r.length) continue;
        const c = r.filter((x) => x.result === 'clear');
        const l = r.filter((x) => x.result === 'lost');
        const minWall = c.length ? Math.min(...c.map((x) => x.wall)) : 0;
        const avgGold = c.length ? Math.round(c.reduce((a, x) => a + x.gold, 0) / c.length) : 0;
        const lostU = c.reduce((a, x) => a + x.lostU, 0);
        console.log(`  ${String(wv).padStart(4)} | ${String(c.length).padStart(6)} | ${String(l.length).padStart(6)} | ${(minWall * 100).toFixed(0).padStart(12)}% | ${String(avgGold).padStart(8)} | ${String(lostU).padStart(10)} | ${String(c[0]?.forge ?? '').padStart(5)} | ${c[0]?.lv ?? ''}`);
    }
}

console.log(`\n${oks} ok, ${fails} failed`);
process.exit(fails ? 1 : 0);
