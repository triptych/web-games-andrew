/**
 * simtest.mjs — headless checks of RUNEBORE's simulation. No browser.
 *
 *   node game-073/dev/simtest.mjs            # everything
 *   SEEDS=3 node game-073/dev/simtest.mjs    # more bot playthroughs
 *   ONLY=rules|worlds|bot                    # one section
 *
 * 1. Purity: js/sim and js/rng.js never touch the DOM or three.js and never call Math.random.
 * 2. Worlds (40 seeds): every relic, waystone, artifact and the wreck is placed, reachable from
 *    the surface by a fully upgraded rig, and nothing is sealed in by runestone; the gate row and
 *    the four shards are intact.
 * 3. Rules: drilling, ore and a full hold, falls, bogwind, boulders, magma, heat, running dry and
 *    the rescue fee, selling, upgrades, every item, waystone travel, contracts, chapter flow and
 *    save/load.
 * 4. The bot plays the whole story — every chapter, the Gloamwyrm and the ending — on SEEDS seeds,
 *    with a time limit, and the balance table is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = process.env.ONLY || '';
const SEEDS = +(process.env.SEEDS || 2);

const C = await import('../js/config.js');
const Wd = await import('../js/sim/world.js');
const Gm = await import('../js/sim/game.js');
const St = await import('../js/sim/story.js');
const Bt = await import('../js/sim/bot.js');
const { T, W, H } = C;

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg); return cond; };
const section = (name) => console.log(`\n== ${name}`);
const DT = 1 / 60;
const run = (G, inp, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, inp, DT); };
const drain = (G) => { const e = G.events.slice(); G.events.length = 0; return e; };

// ------------------------------------------------------------------
if (!ONLY || ONLY === 'purity') {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.\/view|from '\.\.\/ui|from '\.\.\/audio/.test(src), `${f} never imports the view`);
    }
    console.log(`  ${files.length} files checked`);
}

// ------------------------------------------------------------------
if (!ONLY || ONLY === 'worlds') {
    section('worlds');
    const maxRig = { drillPower: 7, drillSpeed: 3 };
    let checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
        const w = Wd.generateWorld(seed * 7919);
        ok(w.relicPos.length === 7, `seed ${seed}: 7 relics`);
        for (const p of w.relicPos) ok(Wd.tileAt(w, p.c, p.r) === T.RELIC, `seed ${seed}: relic ${p.id} in place`);
        for (const p of w.artifactPos) ok(Wd.tileAt(w, p.c, p.r) === T.ARTIFACT, `seed ${seed}: artifact ${p.id} in place (got ${Wd.tileAt(w, p.c, p.r)})`);
        for (const p of w.waystonePos) ok(Wd.tileAt(w, p.c, p.r) === T.WAYSTONE, `seed ${seed}: waystone ${p.id}`);
        ok(Wd.tileAt(w, w.wreckPos.c, w.wreckPos.r) === T.WRECK, `seed ${seed}: wreck`);
        for (let c = 0; c < W; c++) if (Wd.tileAt(w, c, C.GATE_ROW) !== T.GATE) { ok(false, `seed ${seed}: gate gap at ${c}`); break; }
        for (const s of Wd.SHARDS) ok(Wd.tileAt(w, s.c, s.r) === T.SHARD, `seed ${seed}: shard`);
        // Reachability: flood from the surface through anything a max rig could drill (not runestone/boulder/bedrock).
        const seen = new Uint8Array(W * H);
        const q = [];
        for (let c = 0; c < W; c++) { q.push(c); seen[c] = 1; }
        while (q.length) {
            const k = q.pop();
            const c = k % W, r = (k / W) | 0;
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nc = c + dc, nr = r + dr;
                if (nc < 0 || nc >= W || nr < 0 || nr >= H) continue;
                const nk = nr * W + nc;
                if (seen[nk]) continue;
                const t = w.tiles[nk];
                if (t === T.BEDROCK || t === T.RUNESTONE || t === T.BOULDER) continue;
                if (t === T.GATE && nr === C.GATE_ROW) { seen[nk] = 1; continue; }   // gate needs the lance; stop here
                seen[nk] = 1; q.push(nk);
            }
        }
        for (const p of [...w.relicPos, ...w.artifactPos, ...w.waystonePos, w.wreckPos]) ok(seen[p.r * W + p.c], `seed ${seed}: (${p.c},${p.r}) reachable`);
        void maxRig;
        checked++;
    }
    console.log(`  ${checked} worlds checked`);
}

// ------------------------------------------------------------------
if (!ONLY || ONLY === 'rules') {
    section('rules');
    // A flat test site: clear a column so we control what's under the rig.
    const fresh = () => {
        const G = Gm.newGame(4242, 'Tester');
        for (let r = 0; r < 30; r++) for (let c = 14; c < 24; c++) Wd.setTile(G.world, c, r, T.SOIL);
        drain(G);
        return G;
    };

    // drilling down collects ore
    {
        const G = fresh();
        Wd.setTile(G.world, 18, 0, T.ORE, 0);
        run(G, { x: 0, down: true }, 1.5);
        ok(G.cargo[0] === 1, 'drilling down an ore tile puts it in the hold');
        ok(Wd.tileAt(G.world, 18, 0) === T.EMPTY, 'the tile is gone');
        ok(G.rig.y < 0, 'Thimble moved down into the hole');
        const ev = drain(G).map((e) => e.type);
        ok(ev.includes('drill-start') && ev.includes('dug') && ev.includes('ore'), 'drill-start, dug and ore events');
    }
    // sideways drilling needs footing and goes into the wall
    {
        const G = fresh();
        run(G, { x: 0, down: true }, 1.5);     // into row 0
        run(G, { x: 0, down: true }, 1.5);     // into row 1
        const before = G.rig.x;
        run(G, { x: 1 }, 1.6);
        ok(G.rig.x > before + 0.8, 'pushing into a wall bores sideways');
    }
    // a full hold loses ore
    {
        const G = fresh();
        G.cargo[1] = Gm.derived(G).cargo;
        Wd.setTile(G.world, 18, 0, T.ORE, 0);
        run(G, { x: 0, down: true }, 1.2);
        ok(G.cargo[0] === 0 && drain(G).some((e) => e.type === 'ore' && e.lost), 'ore is lost when the hold is full');
    }
    // hardness gate
    {
        const G = fresh();
        G.rig.x = 18.5; G.rig.y = -100 + C.RIG.halfH;   // stand on row 100 (Glimmerdeep, hardness 3)
        Wd.setTile(G.world, 18, 99, T.EMPTY); Wd.setTile(G.world, 18, 100, T.SOIL);
        run(G, { x: 0, down: true }, 1);
        ok(Wd.tileAt(G.world, 18, 100) === T.SOIL, 'a Bronze Auger cannot cut Glimmerdeep rock');
        G.up.drill = 2;
        run(G, { x: 0, down: true }, 3);
        ok(Wd.tileAt(G.world, 18, 100) === T.EMPTY, 'a Steel Spiral can');
    }
    // falling hurts; featherfall doesn't
    {
        const G = fresh();
        for (let r = 0; r < 20; r++) Wd.setTile(G.world, 18, r, T.EMPTY);
        Wd.setTile(G.world, 18, 20, T.SOIL);
        G.rig.hull = 30;
        run(G, { x: 0 }, 3);
        ok(G.rig.hull < 30 && G.rig.hull > 0, `a 20-fathom fall dents the hull (${G.rig.hull.toFixed(1)}/30)`);
        const G2 = fresh();
        for (let r = 0; r < 20; r++) Wd.setTile(G2.world, 18, r, T.EMPTY);
        G2.relics[1] = true;
        run(G2, { x: 0 }, 4);
        ok(G2.rig.hull === 30, 'the Featherfall Sigil prevents fall damage');
    }
    // bogwind
    {
        const G = fresh();
        Wd.setTile(G.world, 18, 0, T.GAS);
        G.up.hull = 3; G.rig.hull = 120;
        run(G, { x: 0, down: true }, 1.5);
        const ev = drain(G);
        ok(ev.some((e) => e.type === 'explode'), 'drilling bogwind explodes');
        ok(G.rig.hull < 120, 'and hurts');
    }
    // boulders fall when undermined and hurt
    {
        const G = fresh();
        G.rig.x = 18.5; G.rig.y = C.RIG.halfH;
        Wd.setTile(G.world, 18, 0, T.SOIL); Wd.setTile(G.world, 19, 0, T.SOIL);
        Wd.setTile(G.world, 19, 1, T.BOULDER);
        Wd.setTile(G.world, 19, 2, T.SOIL);
        // stand in the cell under the boulder's cell: dig row 0 at col 18, row 1 at col 18 then sideways under?
        // simpler: boulder directly above the cell we drill down into
        Wd.setTile(G.world, 18, 3, T.BOULDER);
        Wd.setTile(G.world, 18, 4, T.SOIL);
        for (let r = 0; r < 3; r++) Wd.setTile(G.world, 18, r, T.EMPTY);
        G.rig.y = -3 + C.RIG.halfH;   // standing on the boulder? no — put the rig beside and dig under it
        G.rig.x = 17.5; G.rig.y = -5 + C.RIG.halfH;
        Wd.setTile(G.world, 17, 4, T.EMPTY); Wd.setTile(G.world, 17, 5, T.SOIL); Wd.setTile(G.world, 17, 3, T.SOIL);
        G.rig.vy = 0;
        const ev = [];
        for (let t = 0; t < 3 && !ev.includes('boulder-loose'); t += DT) { Gm.step(G, { x: 1 }, DT); ev.push(...drain(G).map((e) => e.type)); }
        ok(ev.includes('boulder-loose'), 'undermining a boulder looses it');
        run(G, { x: 0 }, 1.5);
        const ev2 = drain(G).map((e) => e.type);
        ok(ev2.includes('boulder-hit') || ev.includes('boulder-hit'), 'and it lands on Thimble');
    }
    // magma and heat
    {
        const G = fresh();
        G.up.drill = 5; G.up.hull = 6; const S = Gm.derived(G); G.rig.hull = S.hull;
        G.rig.x = 18.5; G.rig.y = -250 + C.RIG.halfH;
        Wd.setTile(G.world, 18, 249, T.EMPTY); Wd.setTile(G.world, 18, 250, T.LAVA); Wd.setTile(G.world, 18, 251, T.SOIL);
        run(G, { x: 0, down: true }, 4);
        ok(G.rig.hull < S.hull - 15, `magma burns (${S.hull} → ${G.rig.hull.toFixed(0)})`);
        const h0 = G.rig.hull;
        run(G, { x: 0 }, 5);
        ok(G.rig.hull < h0 - 3, 'the Emberdeep heat cooks an unwarded hull');
        G.relics[4] = true;
        const h1 = G.rig.hull;
        run(G, { x: 0 }, 5);
        ok(Math.abs(G.rig.hull - h1) < 0.01, 'the Salamander Scale stops the heat');
    }
    // running dry → rescue with a fee, cargo lost
    {
        const G = fresh();
        run(G, { x: 0, down: true }, 2);
        G.money = 1000; G.cargo[0] = 3; G.rig.fuel = 0.01;
        run(G, { x: 0 }, 4);
        const ev = drain(G);
        ok(ev.some((e) => e.type === 'down' && e.reason === 'fuel'), 'running dry underground stops Thimble');
        ok(ev.some((e) => e.type === 'rescued'), 'the Guild crane hauls it up');
        ok(G.money === 850 && G.cargo[0] === 0 && G.rig.fuel > 3, `15% fee and the cargo is lost (money ${G.money})`);
        ok(G.stats.rescues === 1, 'rescue counted');
    }
    // selling, buying
    {
        const G = fresh();
        G.cargo[2] = 4; G.pendingArtifacts.push(2);
        const m0 = G.money;
        const res = Gm.sellAll(G);
        ok(res.total === 4 * C.ORES[2].value + C.ARTIFACTS[2].value && G.money === m0 + res.total, 'selling pays ore and artifacts');
        const bit = C.UPGRADES.drill.tiers[1].price;
        G.money = bit + 50;
        ok(Gm.buyUpgrade(G, 'drill').ok && G.up.drill === 1 && G.money === 50, 'buying the Iron Bit');
        ok(!Gm.buyUpgrade(G, 'drill').ok, 'cannot afford the next auger');
        G.rig.fuel = 2; G.money = 100;
        Gm.buyFuel(G);
        ok(G.rig.fuel === Gm.derived(G).tank && G.money === 100 - Math.ceil(10 * C.FUEL_PRICE), 'refuelling');
        G.rig.hull = 10; G.money = 10;
        Gm.repair(G);
        ok(G.rig.hull === 14 && G.money === 0, `partial repair when short of crowns (${G.rig.hull})`);
        G.money = 5000;
        ok(Gm.buyItem(G, 'blast').ok && G.items.blast === 2, 'buying a blast rune');
    }
    // items
    {
        const G = fresh();
        G.rig.x = 18.5; G.rig.y = -10 + C.RIG.halfH;
        for (let r = 6; r < 15; r++) for (let c = 15; c < 22; c++) Wd.setTile(G.world, c, r, T.SOIL);
        Wd.setTile(G.world, 18, 9, T.EMPTY);
        Wd.setTile(G.world, 17, 9, T.RUNESTONE);
        G.items.blast = 1; G.items.great = 1;
        ok(Gm.useItem(G, 'blast'), 'blast rune used');
        ok(Wd.tileAt(G.world, 17, 9) === T.EMPTY && Wd.tileAt(G.world, 19, 10) === T.EMPTY, 'it clears 3×3, runestone too');
        ok(Wd.tileAt(G.world, 20, 9) === T.SOIL, 'but no further');
        G.items.recall = 1; G.cargo[0] = 2;
        ok(Gm.useItem(G, 'recall') && G.rig.y > 0 && G.cargo[0] === 2, 'a recall scroll lifts Thimble and its cargo home');
        G.items.mend = 1; G.rig.hull = 5;
        ok(Gm.useItem(G, 'mend') && G.rig.hull === 5 + 12, 'mending draught: +40%');
        G.items.flask = 1; G.rig.fuel = 1;
        ok(Gm.useItem(G, 'flask') && Math.abs(G.rig.fuel - (1 + 4.8)) < 1e-6, 'aether flask: +40%');
        ok(!Gm.useItem(G, 'flask'), 'none left');
    }
    // waystone: activation on standing, travel both ways
    {
        const G = fresh();
        const p = G.world.waystonePos[0];
        G.up.drill = 4;
        G.rig.x = p.c + 0.5; G.rig.y = -p.r + C.RIG.halfH + 0.3; G.rig.vy = 0;
        run(G, { x: 0 }, 0.5);
        ok(G.waystones[0] && G.at === 'waystone:0', 'standing on a waystone wakes it');
        ok(drain(G).some((e) => e.type === 'scene' && e.id === 'waystone0'), 'with its scene');
        Gm.travel(G, 'surface');
        ok(G.rig.y > 0, 'travel to the surface');
        Gm.travel(G, 0);
        run(G, { x: 0 }, 0.2);
        ok(G.at === 'waystone:0', 'and back down');
    }
    // contracts
    {
        const G = fresh();
        G.story.ch = 1;
        ok(St.availableContracts(G).length === 2, 'two contracts at chapter 1');
        G.cargo[0] = 6;
        const m = G.money;
        ok(St.deliverContract(G, 0).ok && G.money === m + 160 && G.cargo[0] === 0, 'delivering copper for the bell');
        ok(!St.deliverContract(G, 0).ok, 'only once');
    }
    // chapter flow
    {
        const G = Gm.newGame(99, 'Tester');
        run(G, { x: 0 }, 0.2);
        ok(G.story.ready, 'chapter 0 is ready immediately (go to the Guild)');
        ok(St.talk(G, 'orla').scene === 'license' && G.story.ch === 1, 'Orla grants the license');
        ok(St.talk(G, 'orla').line, 'then she just chats');
        G.stats.deepest = 20; G.story.flags.sold = true;
        run(G, { x: 0 }, 0.1);
        ok(G.story.ready && St.hasBusiness(G, 'orla'), 'first delve done → report to Orla');
        ok(St.talk(G, 'orla').scene === 'ch1done' && G.story.ch === 2, 'chapter 2 begins');
    }
    // save / load
    {
        const G = fresh();
        run(G, { x: 0, down: true }, 3);
        G.money = 1234; G.relics[2] = true; G.up.tank = 2; G.items.great = 3; G.story.ch = 4; G.story.flags.ansel4 = true;
        const data = JSON.parse(JSON.stringify(Gm.serialize(G)));
        const G2 = Gm.deserialize(data);
        ok(G2.money === 1234 && G2.relics[2] && G2.up.tank === 2 && G2.items.great === 3, 'save/load: money, relics, upgrades, items');
        ok(G2.story.ch === 4 && G2.story.flags.ansel4, 'save/load: story');
        let same = true;
        for (let i = 0; i < W * H; i++) if (G.world.tiles[i] !== G2.world.tiles[i]) { same = false; break; }
        ok(same, 'save/load: every dug tile');
        ok(Math.abs(G2.rig.y - G.rig.y) < 1e-9, 'save/load: rig position');
    }
}

// ------------------------------------------------------------------
if (!ONLY || ONLY === 'bot') {
    section(`bot playthroughs (${SEEDS} seed${SEEDS > 1 ? 's' : ''})`);
    const rows = [];
    for (let s = 0; s < SEEDS; s++) {
        const seed = 1000 + s * 37;
        const G = Gm.newGame(seed, 'Bot');
        const bot = Bt.makeBot({ god: !!process.env.GOD });
        const limit = +(process.env.LIMIT || 4 * 3600);   // sim seconds
        const marks = [];
        let lastCh = -1, t0 = Date.now(), bossT = null;
        let nan = false;
        while (G.time < limit) {
            const inp = Bt.botInput(G, bot, DT);
            Gm.step(G, inp, DT);
            if (!Number.isFinite(G.rig.x) || !Number.isFinite(G.rig.y)) { nan = true; break; }
            for (const e of G.events) if (e.type === 'boss-start' && bossT === null) bossT = G.time;
            G.events.length = 0;
            if (G.story.ch !== lastCh) { lastCh = G.story.ch; marks.push(`${G.story.ch}@${(G.time / 60).toFixed(0)}m`); }
            if (G.story.ch >= 11) break;
        }
        const done = G.story.ch >= 11;
        ok(!nan, `seed ${seed}: positions stay finite`);
        ok(done, `seed ${seed}: the bot finishes the story (reached chapter ${G.story.ch} "${St.CHAPTERS[G.story.ch]?.title}", deepest ${G.stats.deepest}, relics ${G.relics.filter(Boolean).length}/7, money ${G.money}, up ${JSON.stringify(G.up)})`);
        rows.push({ seed, done, up: Object.values(G.up).join(''), money: G.money, mins: (G.time / 60).toFixed(0), trips: bot.trips, rescues: G.stats.rescues, earned: G.stats.earned, boss: bossT ? ((G.time - bossT) / 60).toFixed(1) + 'm' : '-', marks: marks.join(' '), real: ((Date.now() - t0) / 1000).toFixed(1) + 's' });
    }
    console.table(rows);
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nall passed');
process.exit(fails ? 1 : 0);
