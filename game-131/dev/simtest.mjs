/**
 * simtest.mjs — headless checks of Fray & the Spiral Isle's simulation. No browser.
 *
 *   node game-131/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-131/dev/simtest.mjs
 *   SEEDS=6 VERBOSE=1 node game-131/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the clock.
 * 2. data: every map is well formed, every tunnel can be solved, every line and card the sim can ask for exists,
 *    and the two riddles (the Tuning Verse, the Weather Rhyme) describe the order the sim wants.
 * 3. rules: walking and walls, items, the healing, tunnels, offerings, chimes, pedestals, portals, saving cards.
 * 4. gates: each gem is necessary as well as sufficient: the highlands cannot be walked to, doors hold until their
 *    flag, and every portal refuses without its gem.
 * 5. scatter: over 50 seeds every zone gets its twelve small things, all reachable.
 * 6. determinism: same seed and inputs give the same game; a save round trip mid-game plays on identically.
 * 7. bot: the bot finishes the story on SEEDS seeds with per-step invariants, and a completionist bot finds every
 *    small thing and reads every inscription.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 4);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const W = await import('../js/sim/world.js');
const Tr = await import('../js/sim/terrain.js');
const { ZONES, TUNNELS } = await import('../js/sim/data/zones.js');
const S = await import('../js/sim/data/story.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, turn: 0, dyaw: 0, a: false, run: false, cmd: null };
const A = { ...NONE, a: true };
const run = (G, inp, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const closeCards = (G) => { for (let i = 0; i < 40 && G.cards.length; i++) Gm.step(G, A, DT); };
/** Put the player next to a thing, facing it, and press the button. */
const use = (G, id) => {
    const { zone, thing: t } = W.findThing(id);
    G.zone = zone;
    const spots = W.standNear(zone, G.flags, t);
    const [x, z] = spots.sort((a, b) => Math.hypot(a[0] - t.x, a[1] - t.z) - Math.hypot(b[0] - t.x, b[1] - t.z))[0];
    G.player.x = x; G.player.z = z; G.player.yaw = Math.atan2(t.x - x, -(t.z - z));
    Gm.step(G, NONE, DT);
    Gm.step(G, A, DT);
};
const fresh = (seed = 1) => { const G = Gm.newGame(seed); closeCards(G); G.events.length = 0; return G; };
const saw = (G, type) => G.events.some((e) => e.type === type);

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(\.\.\/)?(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('data')) {
    section('data');
    let lore = 0;
    for (const id of W.zoneIds()) {
        const Z = W.zone(id);
        for (const t of Z.things) {
            if (t.type === 'lore') { lore++; ok(t.title && t.text && t.text.length > 60, `${id}/${t.id} has a title and a text`); }
            if (t.type === 'portal') { const d = W.zone(t.to).byId[t.at]; ok(!!d, `${id}/${t.id} leads to a real place`); ok(!t.needs || S.GEMS.some((g) => g.id === t.needs), `${t.id} needs a real gem`); }
            if (t.type === 'tunnel') ok(!!TUNNELS[t.tunnel], `${t.id} has a tunnel map`);
            if (t.type === 'offer') ok(S.OTHERS[t.ask] && S.OTHERS[t.done] && S.ITEMS[t.item], `${t.id} has its words and its item`);
            if (t.type !== 'door' || Z.kind === 'field') ok(W.standNear(id, W.ALL_OPEN, t).length > 0 || t.type === 'deco' || t.type === 'item', `${id}/${t.id} can be stood beside`);
            if (t.type === 'item') ok(W.canStand(id, W.ALL_OPEN, t.x, t.z), `${id}/${t.id} lies on open ground`);
        }
        if (Z.def.seq) ok(Z.def.seq.order.every((c) => Z.byId[c]?.type === 'chime') && new Set(Z.def.seq.order).size === 4, `${id}: the chime order names four chimes`);
    }
    console.log(`  ${lore} inscriptions`);
    ok(lore >= 38, 'at least 38 inscriptions');
    // the riddles: compass words → chime ids, compared with the order the sim wants
    const corner = (zid, ns, ew) => { const Z = W.zone(zid), cs = Z.things.filter((t) => t.type === 'chime'); const mz = cs.reduce((a, t) => a + t.z, 0) / 4, mx = cs.reduce((a, t) => a + t.x, 0) / 4; return cs.find((t) => (ns === 'n') === (t.z < mz) && (ew === 'w') === (t.x < mx)).id; };
    ok(JSON.stringify([corner('caves', 's', 'w'), corner('caves', 'n', 'w'), corner('caves', 's', 'e'), corner('caves', 'n', 'e')]) === JSON.stringify(ZONES.caves.seq.order), 'the Tuning Verse (SW, NW, SE, NE) is the order Glimmerdeep wants');
    ok(JSON.stringify([corner('sky', 'n', 'e'), corner('sky', 's', 'e'), corner('sky', 'n', 'w'), corner('sky', 's', 'w')]) === JSON.stringify(ZONES.sky.seq.order), 'the Weather Rhyme (NE, SE, NW, SW) is the order the Aerie wants');
    let baubles = 0;
    for (const id of W.tunnelIds()) {
        const T = W.tunnel(id);
        ok(T.rows.every((r) => r.length === T.w), `tunnel ${id} is rectangular`);
        ok(T.start && T.goal && T.hum[T.start.x + ',' + T.start.y] > 0, `tunnel ${id}: the goal can be reached from the mouth`);
        ok(T.baubles.every((b) => T.hum[b.x + ',' + b.y] !== undefined), `tunnel ${id}: every bauble can be reached`);
        ok(T.start.y === T.h - 1 || T.rows[T.start.y + 1][T.start.x] === '#', `tunnel ${id}: the mouth is at the south end`);
        baubles += T.baubles.length;
    }
    ok(baubles === S.BAUBLES.length, `the tunnels hold ${S.BAUBLES.length} baubles (got ${baubles})`);
    for (const g of S.GEMS) ok(S.CARDS[g.id], `gem ${g.id} has a story card`);
    for (const k of Object.values(S.KINDS)) ok(S.LINES[k.line], `keepsake line ${k.line} exists`);
    for (const id of W.tunnelIds()) ok(TUNNELS[id].found && TUNNELS[id].used, `tunnel ${id} has its found and used lines`);
    const hints = fs.readFileSync(path.join(ROOT, 'js/sim/game.js'), 'utf8').match(/g\((?:G\.zone === '\w+' \? )?'(\w+)'(?: : '(\w+)')?/g) || [];
    for (const m of hints) for (const h of m.match(/'(\w+)'/g).map((q) => q.slice(1, -1)).filter((q) => !W.zoneIds().includes(q))) ok(S.HINTS[h], `hint "${h}" has words`);
}

if (want('rules')) {
    section('rules');
    let G = Gm.newGame(1);
    ok(G.cards.length === 2 && G.cards[0].id === 'intro1', 'a new game opens on the two intro cards');
    const x0 = G.player.x, z0 = G.player.z;
    run(G, { ...NONE, y: -1 }, 0.5);
    ok(G.player.x === x0 && G.player.z === z0, 'nothing moves while a card is up');
    closeCards(G);
    ok(saw(G, 'cardClose') && !G.cards.length, 'the button closes cards one at a time');
    run(G, { ...NONE, y: -1 }, 1);
    ok(Math.abs(Math.hypot(G.player.x - x0, G.player.z - z0) - C.PLAYER.walk) < 0.2 && G.player.z < z0, 'forward walks north at PLAYER.walk');
    const z1 = G.player.z;
    run(G, { ...NONE, y: -1, run: true }, 0.5);
    ok(Math.abs(z1 - G.player.z - C.PLAYER.run / 2) < 0.1, 'the run button runs');
    run(G, { ...NONE, x: 1, y: -1 }, 0.5);
    ok(saw(G, 'footstep'), 'walking makes footsteps');
    G = fresh();
    run(G, { ...NONE, turn: 1 }, 1);
    ok(Math.abs(G.player.yaw - C.PLAYER.turn) < 0.05, 'turning turns at PLAYER.turn');
    Gm.step(G, { ...NONE, dyaw: 0.5 }, DT);
    ok(Math.abs(G.player.yaw - C.PLAYER.turn - 0.5) < 0.05, 'a mouse or finger turn is applied directly');
    G = fresh(); G.player.yaw = Math.PI;                       // face south, into the sea
    run(G, { ...NONE, y: -1, run: true }, 20);
    ok(Tr.heightAt(G.player.x, G.player.z) > C.ISLE.shore - 0.2, 'the sea stops you');
    G = fresh(); G.zone = 'caves'; G.player.x = 4.5; G.player.z = 4.5; G.player.yaw = -Math.PI / 2;
    run(G, { ...NONE, y: -1, run: true }, 5);
    ok(G.player.x >= 3 + C.PLAYER.radius - 1e-6, 'a cave wall stops you');

    // the opening: meet, moonmint, heal
    G = fresh();
    use(G, 'fray');
    ok(G.flags.met && G.cards[0]?.id === 'met', 'kneeling by Fray starts her story');
    closeCards(G); use(G, 'fray');
    ok(G.cards[0]?.k === 'note' && !G.flags.healed, 'she cannot be healed without moonmint');
    closeCards(G);
    for (const m of ['mint1', 'mint2', 'mint3']) { const t = W.zone('isle').byId[m]; G.player.x = t.x; G.player.z = t.z; Gm.step(G, NONE, DT); }
    ok(G.items.moonmint === 3 && saw(G, 'item'), 'walking over moonmint picks it up');
    use(G, 'rootTunnel');
    ok(!G.tun && G.cards[0]?.k === 'note', 'a tunnel is no use before Fray can walk');
    closeCards(G); use(G, 'fray');
    ok(G.flags.healed && G.fray.state === 'follow' && G.items.moonmint === 0 && G.cards[0]?.id === 'healed', 'three sprigs heal her and she follows');
    closeCards(G); G.events.length = 0;
    Gm.step(G, NONE, DT);
    ok(G.events.some((e) => e.type === 'say' && e.line === 'zone-isle'), 'she speaks once the card is closed');
    const far = () => Math.hypot(G.fray.x - G.player.x, G.fray.z - G.player.z);
    G.player.yaw = 0.6; run(G, { ...NONE, y: -1 }, 6);
    ok(far() < 6 && far() > 1, `she follows a few steps behind (${far().toFixed(1)} m)`);

    // the tunnel
    use(G, 'rootTunnel');
    ok(G.tun?.id === 'root' && G.fray.state === 'tunnel', 'the tunnel takes Fray');
    const px = G.player.x;
    run(G, { ...NONE, y: -1 }, 0.5);
    ok(G.player.x === px, 'you wait at the mouth while she is inside');
    G.events.length = 0; Gm.step(G, { ...NONE, cmd: { t: 'go', d: 'e' } }, DT);
    ok(saw(G, 'tunBump') && G.tun.x === 3, 'a wall is a wall');
    for (const d of ['n', 'n']) Gm.step(G, { ...NONE, cmd: { t: 'go', d } }, DT);
    G.events.length = 0; Gm.step(G, { ...NONE, cmd: { t: 'go', d: 'n' } }, DT);
    ok(G.events.some((e) => e.line === 'tun-warm'), 'she says when the hum gets warmer');
    Gm.step(G, { ...NONE, cmd: { t: 'go', d: 'n' } }, DT); G.events.length = 0;
    Gm.step(G, { ...NONE, cmd: { t: 'go', d: 'w' } }, DT);
    ok(G.events.some((e) => e.line === 'tun-cold'), 'and when it gets colder');
    Gm.step(G, { ...NONE, cmd: { t: 'go', d: 'w' } }, DT);
    ok(G.counts.bauble === 1, 'a bauble goes in her pocket');
    for (const d of ['e', 'e']) Gm.step(G, { ...NONE, cmd: { t: 'go', d } }, DT);
    G.events.length = 0; Gm.step(G, { ...NONE, cmd: { t: 'go', d: 'e' } }, DT);
    ok(G.events.some((e) => e.line === 'tun-root-found'), 'she describes the lever when she reaches it');
    Gm.step(G, { ...NONE, cmd: { t: 'feel' } }, DT);
    ok(G.flags.rootDoor && saw(G, 'tunDone'), 'feeling about pulls the lever and opens the door');
    Gm.step(G, { ...NONE, cmd: { t: 'back' } }, DT);
    ok(!G.tun && G.fray.state === 'follow', 'she comes back when called');

    // gems, portals, offerings, chimes
    use(G, 'leafPedestal'); closeCards(G);
    ok(Gm.has(G, 'leaf') && saw(G, 'gem'), 'the pedestal gives the Leaf Gem');
    use(G, 'vineFoot');
    ok(G.player.z < -25 && saw(G, 'travel'), 'the vine carries you up the cliff');
    use(G, 'grandfather'); ok(!G.flags.golemAwake && G.cards[0]?.k === 'note', 'the golem asks for his runes'); closeCards(G);
    G.items.rune = 3; use(G, 'grandfather'); closeCards(G);
    ok(G.flags.golemAwake && Gm.has(G, 'stone') && G.items.rune === 0, 'three runes wake him and he gives the Stone Gem');
    use(G, 'caveMouth'); ok(G.zone === 'caves', 'the Stone Gem opens Glimmerdeep');
    G.flags.crystalGate = true;
    use(G, 'lightPedestal'); ok(!Gm.has(G, 'light'), 'the dark crystal waits for its song'); closeCards(G);
    use(G, 'chime3'); use(G, 'chime1'); use(G, 'chime2');
    ok(G.seq.caves === 0 && saw(G, 'seqReset'), 'a wrong stone starts the song again');
    for (const c of ZONES.caves.seq.order) use(G, c);
    ok(G.flags.cavesSung && saw(G, 'seqDone'), 'the right order wakes the Heart of Glimmerdeep');
    use(G, 'lightPedestal'); closeCards(G); ok(Gm.has(G, 'light'), 'and then it gives the Light Gem');
    use(G, 'cavesA'); ok(G.lore.includes('cavesA') && G.cards[0]?.k === 'lore', 'reading an inscription puts it in the journal'); closeCards(G);
    use(G, 'cavesA'); closeCards(G); ok(G.lore.filter((l) => l === 'cavesA').length === 1, 'only once');
    G.events.length = 0; Gm.step(G, { ...NONE, cmd: { t: 'hint' } }, DT);
    ok(G.events.some((e) => e.type === 'hint' && S.HINTS[e.id]), 'the hint command names the next step');
    // the small things
    const c = G.pickups.caves[0]; G.player.x = c.x; G.player.z = c.z; G.events.length = 0; Gm.step(G, NONE, DT);
    ok(c.g === 1 && G.counts.shard === 1 && saw(G, 'pickup'), 'walking over a glimmer shard collects it');
    for (const o of G.pickups.caves) { G.player.x = o.x; G.player.z = o.z; Gm.step(G, NONE, DT); }
    ok(G.keepsakes.includes('shard') && saw(G, 'keepsake'), 'all twelve earn the keepsake');
    // the ending
    G.gems = ['leaf', 'stone', 'light', 'wind', 'water', 'moon'];
    use(G, 'hearthTunnel'); ok(!G.tun, 'the Listening Dark stays shut until the Hearth is set'); closeCards(G);
    use(G, 'hearth'); ok(G.flags.hearthSet, 'six gems set the Hearth'); closeCards(G);
    use(G, 'hearthTunnel'); ok(G.tun?.id === 'hearth', 'and then the Dark lets Fray in');
    Gm.step(G, { ...NONE, cmd: { t: 'back' } }, DT);
    G.items.heart = 1; use(G, 'hearth');
    ok(G.done && Gm.has(G, 'heart') && G.cards.some((cd) => cd.id === 'end') && saw(G, 'ending'), 'the Heart at the Hearth ends the story');
    closeCards(G); run(G, { ...NONE, y: -1 }, 0.3);
    ok(!G.cards.length, 'and you can walk on afterwards');
}

if (want('gates')) {
    section('gates');
    const isle = W.zone('isle');
    const low = W.distField('isle', {}, [[isle.def.spawn.x, isle.def.spawn.z]]), L = W.lattice('isle');
    const reach = (d, t, zid = 'isle') => W.standNear(zid, W.ALL_OPEN, t).some(([x, z]) => d[W.lattice(zid).index(x, z)] >= 0);
    for (const id of ['fray', 'mint1', 'mint2', 'mint3', 'rootTunnel', 'vineFoot', 'castleGate', 'underStair', 'windPerch', 'tideStairs', 'moonDoor', 'throne', 'fisherHut'])
        ok(reach(low, isle.byId[id]) || low[L.index(isle.byId[id].x, isle.byId[id].z)] >= 0, `${id} can be walked to from the beach`);
    for (const id of ['vineTop', 'grandfather', 'rune1', 'rune2', 'golemTunnel', 'caveMouth', 'highView'])
        ok(!reach(low, isle.byId[id]) && low[L.index(isle.byId[id].x, isle.byId[id].z)] < 0, `${id} cannot be walked to: the cliff holds`);
    ok(!reach(low, isle.byId.leafPedestal), 'the Rootshrine ring is closed until its door opens');
    const lowOpen = W.distField('isle', { rootDoor: true }, [[isle.def.spawn.x, isle.def.spawn.z]]);
    ok(reach(lowOpen, isle.byId.leafPedestal), 'and open once it does');
    const high = W.distField('isle', {}, [[isle.byId.vineTop.x, isle.byId.vineTop.z]]);
    for (const id of ['grandfather', 'rune1', 'rune2', 'golemTunnel', 'caveMouth', 'highView', 'golemSong'])
        ok(reach(high, isle.byId[id]) || high[L.index(isle.byId[id].x, isle.byId[id].z)] >= 0, `${id} can be walked to from the top of the vine`);
    // doors inside
    for (const [zid, door, behind, entry] of [['caves', 'crystalGate', 'lightPedestal', 'caveExit'], ['under', 'underGate', 'organ', 'underExit']]) {
        const Z = W.zone(zid), from = [[Z.byId[entry].x, Z.byId[entry].z]];
        ok(!reach(W.distField(zid, {}, from), Z.byId[behind], zid), `${zid}: ${behind} is shut away behind ${door}`);
        ok(reach(W.distField(zid, { [door]: true }, from), Z.byId[behind], zid), `${zid}: and reachable once it opens`);
    }
    // every other thing in every grid zone is reachable with the doors open
    for (const zid of W.zoneIds().filter((z) => z !== 'isle')) {
        const Z = W.zone(zid), entry = Z.things.find((t) => t.type === 'portal');
        const d = W.distField(zid, W.ALL_OPEN, [[entry.x, entry.z]]);
        for (const t of Z.things) if (t.type !== 'door') ok(reach(d, t, zid) || d[W.lattice(zid).index(t.x, t.z)] >= 0, `${zid}/${t.id} can be reached`);
    }
    // the gems are the keys
    for (const p of isle.things.filter((t) => t.type === 'portal' && t.needs)) {
        const G = fresh(); G.fray.state = 'follow';
        use(G, p.id);
        ok(G.zone === 'isle' && Math.hypot(G.player.x - p.x, G.player.z - p.z) < 6 && (p.deny ? G.cards[0]?.k === 'note' : true), `${p.id} refuses without the ${p.needs} gem`);
        closeCards(G); G.gems.push(p.needs); use(G, p.id);
        ok(G.zone === p.to && (p.to !== 'isle' || Math.hypot(G.player.x - p.x, G.player.z - p.z) > 10), `${p.id} opens with it`);
    }
    const chain = isle.things.filter((t) => t.type === 'portal' && t.needs).map((t) => t.needs);
    ok(new Set(chain).size === 6, 'six gems each open a different way; the seventh is the ending');
}

if (want('scatter')) {
    section('scatter');
    let bad = 0;
    const fields = {};
    for (let s = 1; s <= 50; s++) {
        const G = Gm.newGame(s * 7919);
        for (const zid of W.zoneIds()) {
            const Z = W.zone(zid), want = (Z.def.scatter || []).reduce((a, sc) => a + sc.n, 0);
            if (G.pickups[zid].length !== want) { bad++; console.log(`  seed ${s} ${zid}: ${G.pickups[zid].length}/${want}`); }
            for (const c of G.pickups[zid]) {
                const sc = Z.def.scatter.find((q) => q.kind === c.k), from = sc.from ? Z.byId[sc.from] || Z.def.spawn : Z.things.find((t) => t.type === 'portal');
                const key = zid + sc.kind;
                fields[key] = fields[key] || W.distField(zid, W.ALL_OPEN, [[from.x, from.z], [from.x + 2, from.z], [from.x, from.z + 2], [from.x - 2, from.z], [from.x, from.z - 2]]);
                if (fields[key][W.lattice(zid).index(c.x, c.z)] < 0) { bad++; console.log(`  seed ${s} ${zid}: a ${c.k} at ${c.x},${c.z} cannot be reached`); }
            }
        }
    }
    ok(bad === 0, '50 seeds: every zone has all its small things, each one reachable');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame(seed); const b = Bt.makeBot(); run(G, (g) => Bt.botInput(g, b), secs); G.events.length = 0; return G; };
    const a = play(42, 60), b = play(42, 60);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    ok(JSON.stringify(Gm.newGame(1).pickups) !== JSON.stringify(Gm.newGame(2).pickups), 'a different seed scatters the small things differently');
    for (const secs of [45, 130]) {           // the second lands mid-story, past a tunnel and a portal
        const G = play(7, secs);
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b1 = Bt.makeBot(), b2 = Bt.makeBot();
        run(G, (g) => Bt.botInput(g, b1), 40); run(copy, (g) => Bt.botInput(g, b2), 40);
        G.events.length = 0; copy.events.length = 0;
        ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), `a save round trip at ${secs} s plays on identically`);
    }
    const T = play(7, 44); T.tun = { id: 'root', x: 3, y: 4, seen: ['3,5', '3,4'], hum: 4 }; T.fray.state = 'tunnel';
    const T2 = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(T))));
    Gm.step(T2, { ...NONE, cmd: { t: 'go', d: 'n' } }, DT);
    ok(T2.tun.y === 3, 'a game saved with Fray in a tunnel loads with her still in it');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    const lore = W.zoneIds().reduce((n, z) => n + W.zone(z).things.filter((t) => t.type === 'lore').length, 0);
    for (let s = 1; s <= SEEDS; s++) {
        for (const explore of s <= 2 ? [false, true] : [false]) {
            const G = Gm.newGame(s * 104729), bot = Bt.makeBot({ explore });
            let bad = null;
            const order = [];
            while (!G.done && G.t < 2400 && !bad) {
                Gm.step(G, Bt.botInput(G, bot), DT);
                for (const e of G.events) if (e.type === 'gem') order.push(e.gem);
                G.events.length = 0;
                const p = G.player;
                if (!Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(p.yaw)) bad = 'non-finite position';
                else if (!W.canStand(G.zone, G.flags, p.x, p.z, C.PLAYER.radius - 0.02)) bad = `standing inside something at ${G.zone} ${p.x.toFixed(1)},${p.z.toFixed(1)}`;
            }
            ok(!bad, `seed ${s}${explore ? ' (explorer)' : ''}: ${bad || 'invariants hold'}`);
            ok(G.done, `seed ${s}${explore ? ' (explorer)' : ''}: the story is finished (${G.gems.length}/7 gems at ${G.t | 0} s; next: ${Gm.nextGoal(G).hint})`);
            ok(order.join() === S.GEMS.map((g) => g.id).join(), `seed ${s}: the gems come in the pendant's order`);
            if (explore) {
                closeCards(G);
                while (G.t < 2400) { const i = Bt.botInput(G, bot); if (!bot.target) break; Gm.step(G, i, DT); G.events.length = 0; }
                ok(G.keepsakes.length === Object.keys(S.KINDS).length, `seed ${s} explorer: all ${Object.keys(S.KINDS).length} keepsakes (${G.keepsakes.length})`);
                ok(G.lore.length === lore, `seed ${s} explorer: all ${lore} inscriptions read (${G.lore.length})`);
            }
            rows.push({ seed: s, explore, done: G.done, time: Math.round(G.t), lore: G.lore.length, keepsakes: G.keepsakes.length });
        }
    }
    console.table(rows);
    const story = rows.filter((r) => !r.explore).map((r) => r.time);
    ok(Math.max(...story) < 900, 'a bot that runs everywhere and reads nothing finishes in under 15 minutes of game time');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
