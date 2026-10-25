/**
 * simtest.mjs — headless checks of FABLECART's simulation. No browser.
 *
 *   node game-099/dev/simtest.mjs            # everything
 *   ONLY=purity,blocks node game-099/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-099/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, storage, Math.random or the
 *    clock, and never import the view, UI or audio.
 * 2. stickers: every built-in has 12×12 palette art, known blocks, known stickers and tags, and
 *    survives the import sanitiser unchanged; every block in the catalogue runs.
 * 3. rules: one scenario per block: touching, hurting, i-frames, shooting, dying, becoming,
 *    items, scenes, win and lose, shouts, variables, loops and the runaway guards.
 * 4. carts: hostile JSON is rebuilt safely; share codes round trip; the starter is stable.
 * 5. determinism: same seed, same game; a save round trip mid-game plays on identically.
 * 6. room: walking into each machine of the console asks for the right screen.
 * 7. bot: the bot plays the starter cart at three skill levels with per-step invariants and the
 *    balance table is printed.
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
const Bl = await import('../js/sim/blocks.js');
const St = await import('../js/sim/stickers.js');
const Ct = await import('../js/sim/cart.js');
const W = await import('../js/sim/world.js');
const Bt = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const IDLE = { x: 0, y: 0, a: false, b: false, ah: false, bh: false, tap: null };
const run = (G, inp, secs) => {
    for (let t = 0; t < secs && G.status === 'play'; t += DT) W.step(G, typeof inp === 'function' ? inp(G) : inp, DT);
};
const drain = (G) => G.events.splice(0);

/** A cart with one scene, custom stickers, and items placed at the given spots. */
function mini(items, stickers = {}, bg = 'meadow') {
    const cart = Ct.newCart('Test');
    for (const [id, d] of Object.entries(stickers)) {
        cart.stickers[id] = { id, name: id, cat: 'mine', tags: [], size: 1, solid: false, hp: 3, speed: 2, art: Ct.blankArt(), rules: [], ...d };
    }
    cart.scenes[0] = { name: 'S', bg, items: items.map(([sid, x, y]) => ({ sid, x, y })) };
    return cart;
}
const find = (G, sid) => G.insts.filter((o) => o.sid === sid && W.alive(o));
const R = (hat, ...body) => ({ hat, body });

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|\bnew Date\b/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('stickers')) {
    section('stickers and the block catalogue');
    const known = new Set([...Bl.TAGS, 'solid', 'station', 'treasure', ...St.BUILTIN_IDS]);
    for (const d of St.BUILTIN) {
        ok(d.art.length === C.ART && d.art.every((r) => r.length === C.ART && /^[.0-9a-f]+$/.test(r)), `${d.id}: 12×12 palette art`);
        ok(d.art.some((r) => /[^.]/.test(r)), `${d.id}: art is not blank`);
        const pub = Bl.sanitizeRules(d.rules);
        if (!d.hidden) ok(JSON.stringify(pub) === JSON.stringify(d.rules), `${d.id}: rules survive the sanitiser unchanged`);
        // every sticker, tag and block it names exists
        const probs = [];
        const checkTag = (t) => { if (!known.has(t)) probs.push(`unknown tag ${t}`); };
        for (const r of d.rules) {
            if (r.hat.tag) checkTag(r.hat.tag);
            Bl.walkRules([r], (b) => {
                if (!Bl.ACTS[b.t]) probs.push(`unknown block ${b.t}`);
                if (b.sid && !St.byId[b.sid]) probs.push(`unknown sticker ${b.sid}`);
                if (b.tag) checkTag(b.tag);
                if (b.who?.tag && b.who.m !== 'me' && b.who.m !== 'it') checkTag(b.who.tag);
                if (b.c?.tag) checkTag(b.c.tag);
            });
        }
        ok(!probs.length, `${d.id}: refers only to things that exist ${probs.join(', ')}`);
    }
    for (const [t, spec] of Object.entries(Bl.ACTS)) {
        const toks = spec.label.filter((x) => x.startsWith('$')).map((x) => x.slice(1));
        ok(toks.every((k) => k === 'c' || spec.params[k]), `block ${t}: every $ in its label is a parameter`);
        const b = Bl.makeAct(t);
        const clean = Bl.sanitizeRules([{ hat: Bl.makeHat('always'), body: [b] }], {});
        ok(spec.hidden ? clean[0].body.length === 0 : JSON.stringify(clean[0].body[0]) === JSON.stringify(b), `block ${t}: a fresh one is valid${spec.hidden ? ' (hidden: stripped from imports)' : ''}`);
    }
    for (const t of Object.keys(Bl.HATS)) ok(Bl.sanitizeRules([{ hat: Bl.makeHat(t), body: [] }]).length === 1, `event ${t}: a fresh one is valid`);
    for (const t of Object.keys(Bl.CONDS)) {
        const b = { ...Bl.makeAct('if'), c: Bl.makeCond(t) };
        ok(JSON.stringify(Bl.sanitizeRules([{ hat: Bl.makeHat('always'), body: [b] }])[0].body[0]) === JSON.stringify(b), `condition ${t}: a fresh one is valid`);
    }
    console.log(`  ${St.BUILTIN.length} stickers, ${Object.keys(Bl.ACTS).length} blocks, ${Object.keys(Bl.HATS).length} events, ${Object.keys(Bl.CONDS).length} conditions`);
}

if (want('rules')) {
    section('rules');
    // ---- touch, hurt, i-frames
    let G = W.newWorld(mini([['princess', 5, 7], ['goblin', 5.6, 7]], { goblin: { hp: 3, speed: 0, tags: ['monster'], rules: [R({ t: 'touch', tag: 'hero' }, { t: 'hurt', who: { m: 'it', tag: 'x', r: 2 }, n: 1 })] } }), 0, 1);
    // (princess is built in; goblin overridden to stand still)
    const hp0 = find(G, 'princess')[0].hp;
    run(G, IDLE, 0.1);
    ok(find(G, 'princess')[0].hp === hp0 - 1, 'touching a foe hurts the hero');
    run(G, IDLE, 0.5);
    ok(find(G, 'princess')[0].hp === hp0 - 1, 'and the hero is invulnerable for a moment');
    run(G, IDLE, 1.2);
    ok(find(G, 'princess')[0].hp <= hp0 - 2, 'but is hurt again when the touch goes on');

    // ---- shooting: button A makes a sparkle in front; it hurts and removes itself
    G = W.newWorld(mini([['princess', 3, 7], ['slime', 7, 7]], { slime: { hp: 2, speed: 0, tags: ['monster'], rules: [] } }), 0, 2);
    W.step(G, { ...IDLE, x: 1, y: 0 }, DT);
    run(G, { ...IDLE, a: true }, DT * 2);
    ok(find(G, 'sparkle').length === 1, 'button A shoots a sparkle');
    run(G, IDLE, 1.0);
    ok(!find(G, 'slime').length || find(G, 'slime')[0].hp <= 0, 'the sparkle reached and hurt the slime');
    ok(find(G, 'sparkle').length === 0, 'and the sparkle is gone');
    G.events.length = 0;

    // ---- die hat spawns, heal, take/give, become
    G = W.newWorld(mini([['princess', 2, 2], ['x', 8, 8]], {
        x: { hp: 1, speed: 0, tags: ['monster'], rules: [
            R({ t: 'die' }, { t: 'spawn', n: 2, sid: 'coin', where: 'here' }, { t: 'give', n: 3, item: 'gem' }),
            R({ t: 'every', sec: 0.5 }, { t: 'hurt', who: { m: 'me', tag: 'x', r: 2 }, n: 5 })] },
    }), 0, 3);
    run(G, IDLE, 1);
    ok(find(G, 'x').length === 0 && find(G, 'coin').length === 2, 'a defeated sticker runs its last rule and spawns');
    ok(G.inv.gem === 3, 'give adds to the inventory');
    ok(G.events.some((e) => e.type === 'die'), 'and a die event is sent');

    G = W.newWorld(mini([['princess', 2, 2], ['chest', 2.6, 2]]), 0, 4);
    run(G, IDLE, 0.2);
    ok(find(G, 'chestopen').length === 1 && !find(G, 'chest').length, 'a chest becomes an open chest');
    ok(G.inv.coin === 5 && G.score >= 20, 'and pays out');
    run(G, IDLE, 2);
    ok(G.inv.coin === 5, 'an open chest pays nothing more');

    // ---- healing is capped at full health, and never lowers a sticker above it
    G = W.newWorld(mini([['princess', 5, 7], ['heart', 5.5, 7]]), 0, 4);
    find(G, 'princess')[0].hp = 99;
    run(G, IDLE, 0.2);
    ok(find(G, 'princess')[0].hp === 99, 'a heart does not lower health above the maximum');
    G = W.newWorld(mini([['princess', 5, 7], ['heart', 5.5, 7]]), 0, 4);
    find(G, 'princess')[0].hp = 5;
    run(G, IDLE, 0.2);
    ok(find(G, 'princess')[0].hp === 6, 'and tops up to the maximum');

    // ---- solids block movers
    G = W.newWorld(mini([['princess', 5, 7], ['tree', 6.2, 7]]), 0, 5);
    run(G, { ...IDLE, x: 1 }, 1.0);
    ok(find(G, 'princess')[0].x < 6.2 - 0.5, 'a hero cannot walk through a tree');
    ok(find(G, 'princess')[0].x > 5.2, 'but can walk up to it');
    G = W.newWorld(mini([['princess', 1, 1]]), 0, 5);
    run(G, { ...IDLE, x: -1, y: -1 }, 2);
    ok(find(G, 'princess')[0].x >= 0.37 && find(G, 'princess')[0].y >= 0.37, 'the edge of the scene holds');

    // ---- if / chance / count / vars / repeat / shout / message
    G = W.newWorld(mini([['princess', 5, 7], ['a', 9, 9]], {
        a: { hp: 9, speed: 0, rules: [
            R({ t: 'start' }, { t: 'repeat', n: 4, body: [{ t: 'addvar', v: 'A', n: 2 }] }, { t: 'shout', msg: 'cheer' }),
            R({ t: 'message', msg: 'cheer' }, { t: 'give', n: 1, item: 'star' }),
            R({ t: 'always' }, { t: 'if', c: { ...Bl.makeCond('var'), v: 'A', op: '>=', n: 8 }, then: [{ t: 'setvar', v: 'B', n: 7 }], else: [] }),
        ] },
    }), 0, 6);
    run(G, IDLE, 0.2);
    ok(G.vars.A === 8, 'repeat runs its body that many times');
    ok(G.inv.star === 1, 'a shout is heard on the next step');
    ok(G.vars.B === 7, 'if runs its then-branch when the condition holds');

    G = W.newWorld(mini([['princess', 5, 7], ['a', 9, 9]], {
        a: { hp: 9, speed: 0, rules: [R({ t: 'always' }, { t: 'if', c: { ...Bl.makeCond('count'), tag: 'princess', op: '==', n: 0 }, then: [{ t: 'setvar', v: 'C', n: 1 }], else: [{ t: 'setvar', v: 'C', n: 2 }] })] },
    }), 0, 6);
    run(G, IDLE, 0.1);
    ok(G.vars.C === 2, 'a sticker id is a tag: count princess ≥ 1, so else runs');

    // ---- runaway guards
    G = W.newWorld(mini([['princess', 5, 7], ['a', 9, 9]], {
        a: { hp: 9, speed: 0, rules: [R({ t: 'always' }, { t: 'repeat', n: 10, body: [{ t: 'spawn', n: 5, sid: 'a', where: 'around' }] })] },
    }), 0, 7);
    run(G, IDLE, 3);
    ok(G.insts.length <= C.LIMITS.maxInst, `a breeding sticker stops at ${C.LIMITS.maxInst} (got ${G.insts.length})`);
    ok(G.events.some((e) => e.type === 'full') || G.insts.length === C.LIMITS.maxInst, 'and says so');

    // ---- win, lose, scenes
    G = W.newWorld(Ct.starterCart(), 0, 8);
    const pr = find(G, 'princess')[0];
    pr.hp = 2; G.inv.coin = 4;
    const door = find(G, 'door_next')[0];
    pr.x = door.x - 0.6; pr.y = door.y;
    run(G, IDLE, 0.2);
    ok(G.scene === 1, 'touching a door goes to the next scene');
    const pr2 = find(G, 'princess')[0];
    ok(pr2 && pr2.hp === 2 && G.inv.coin === 4, 'the hero keeps health and the bag across scenes');
    ok(find(G, 'dragon').length === 1 && !find(G, 'goblin').length, 'and the new scene is loaded');
    ok(pr2.x < 5, 'the hero arrives at the entrance');
    ok(!find(G, 'princess').some((o) => o !== pr2), 'only one hero (the scene has none of its own)');
    const back = find(G, 'door_prev')[0];
    pr2.x = back.x + 0.6; pr2.y = back.y;
    run(G, IDLE, 0.2);
    ok(G.scene === 0 && find(G, 'princess')[0].x > 18, 'the door back returns to the right-hand edge');

    G = W.newWorld(Ct.starterCart(), 0, 9);
    const d0 = find(G, 'door_next')[0], p0 = find(G, 'princess')[0];
    p0.x = d0.x - 0.6; p0.y = d0.y;
    run(G, IDLE, 0.2);
    const hero = find(G, 'princess')[0];
    hero.x = 21; hero.y = 9.8;
    run(G, IDLE, 0.2);
    ok(G.status === 'play', 'the castle stays shut without a key');
    G.inv.key = 1;
    hero.ct = {};
    for (const o of G.insts) o.ct = {};
    hero.x = 20.9; hero.y = 9.8;
    run(G, IDLE, 1);
    ok(G.status === 'won' && G.inv.key === 0, 'with a key the castle is won, and the key is used');
    ok(G.events.some((e) => e.type === 'win'), 'a win event is sent');

    G = W.newWorld(mini([['princess', 5, 7]]), 0, 10);
    find(G, 'princess')[0].hp = 0; find(G, 'princess')[0].dying = true;
    run(G, IDLE, 0.1);
    ok(G.status === 'lost', 'when the last hero falls, the game is lost');
    const before = G.t;
    W.step(G, IDLE, DT);
    ok(G.t === before, 'and nothing steps after that');

    G = W.newWorld(mini([['a', 5, 7]], { a: { rules: [R({ t: 'start' }, { t: 'win' })] } }), 0, 11);
    run(G, IDLE, 0.1);
    ok(G.status === 'play' || G.status === 'won', 'a cart with no hero never auto-loses');

    // ---- tapped, movement blocks
    G = W.newWorld(mini([['princess', 5, 7], ['sign', 10, 7]]), 0, 12);
    W.step(G, { ...IDLE, tap: { x: 10.1, y: 7.1 } }, DT);
    ok(find(G, 'sign')[0].say?.text === 'Beware the dragon!', 'tapping a sticker fires its tapped rule');
    G = W.newWorld(mini([['a', 5, 7], ['b', 12, 7]], {
        a: { speed: 3, rules: [R({ t: 'always' }, { t: 'chase', tag: 'b', secs: 0.3 })] },
        b: { speed: 0, rules: [] },
    }), 0, 13);
    run(G, IDLE, 1);
    ok(find(G, 'a')[0].x > 7.5, 'chase moves toward the nearest tagged sticker');
    G = W.newWorld(mini([['a', 12, 7], ['b', 14, 7]], {
        a: { speed: 3, rules: [R({ t: 'always' }, { t: 'flee', tag: 'b', secs: 0.3 })] },
        b: { speed: 0, rules: [] },
    }), 0, 13);
    run(G, IDLE, 1);
    ok(find(G, 'a')[0].x < 10, 'flee moves away');
    G = W.newWorld(mini([['a', 12, 7]], { a: { speed: 2, rules: [R({ t: 'always' }, { t: 'walk', dir: 'down', secs: 0.3 })] } }), 0, 13);
    run(G, IDLE, 1);
    ok(find(G, 'a')[0].y > 8.8, 'walk goes the way it says');
}

if (want('carts')) {
    section('carts and sharing');
    const starter = Ct.starterCart();
    ok(JSON.stringify(Ct.sanitizeCart(JSON.parse(JSON.stringify(starter)))) === JSON.stringify(starter), 'the starter cart is stable under the sanitiser');
    const code = Ct.encodeCart(starter);
    ok(code.startsWith('FC1:') && JSON.stringify(Ct.decodeCart(code)) === JSON.stringify(starter), 'a share code round trips');
    for (const bad of ['', 'hello', 'FC1:!!!', 'FC1:' + btoa('not json'), 'FC1:' + btoa('{"v":9}')]) {
        let threw = false;
        try { Ct.decodeCart(bad); } catch { threw = true; }
        ok(threw, `a bad code is refused: ${JSON.stringify(bad.slice(0, 14))}`);
    }
    let threw = false;
    try { Ct.decodeCart('FC1:' + 'A'.repeat(C.LIMITS.importBytes + 1)); } catch { threw = true; }
    ok(threw, 'an oversized code is refused');

    const evil = {
        v: 1, name: '<img src=x onerror=alert(1)>'.repeat(5), goal: 7,
        __proto__: { polluted: true },
        stickers: {
            '__proto__': { art: Ct.blankArt() },
            'constructor': { art: Ct.blankArt() },
            'bad id!': { art: Ct.blankArt() },
            u1: {
                name: 'x'.repeat(100), hp: 1e9, speed: -5, size: 7, tags: ['ok', '<b>', 'x'.repeat(40), 5],
                art: Ct.blankArt(),
                rules: [
                    { hat: { t: 'always' }, body: [{ t: 'console', open: 'play' }, { t: 'hurt', who: { m: 'zzz', tag: '<x>', r: 1e9 }, n: 1e9 }, { t: 'nope' }, { t: 'say', text: '<script>alert(1)</script>' }] },
                    { hat: { t: 'evil' }, body: [] },
                    { hat: { t: 'every', sec: -9 }, body: Array.from({ length: 200 }, () => ({ t: 'fx', kind: 'smoke' })) },
                ],
            },
            u2: { art: ['too short'] },
        },
        scenes: [{ name: 'a', bg: 'lava', items: [{ sid: 'u1', x: 1e9, y: -4 }, { sid: 'nonexistent', x: 1, y: 1 }, { sid: 'tv', x: 2, y: 2 }, ...Array.from({ length: 300 }, () => ({ sid: 'tree', x: 3, y: 3 }))] }],
    };
    const clean = Ct.sanitizeCart(evil);
    ok({}.polluted === undefined, 'no prototype pollution');
    ok(Object.keys(clean.stickers).join() === 'u1', 'only well-formed stickers with safe ids are kept');
    const u1 = clean.stickers.u1;
    ok(u1.hp === 99 && u1.speed === 0 && u1.size === 1, 'numbers are clamped and sizes forced');
    ok(u1.tags.join() === 'ok', 'tags are filtered');
    ok(u1.rules.length === 2 && u1.rules[0].body.length === 2 && u1.rules[0].body[1].t === 'say', 'unknown events and blocks are dropped, and the hidden console block too');
    ok(u1.rules[0].body[0].who.m === 'it' && u1.rules[0].body[0].who.r === 12 && u1.rules[0].body[0].n === 20, 'parameters are clamped and defaulted');
    ok(!/[<>]/.test(JSON.stringify(clean)), 'markup characters are gone from every text');
    ok(u1.rules[1].body.length <= C.LIMITS.blocks, `a rule holds at most ${C.LIMITS.blocks} blocks`);
    ok(clean.scenes[0].bg === 'meadow' && clean.scenes[0].items.length <= C.LIMITS.items, 'bad backgrounds fall back and scenes are capped');
    ok(clean.scenes[0].items.every((i) => i.sid !== 'tv' && i.sid !== 'nonexistent' && i.x <= C.COLS && i.y >= 0), 'unknown and console-only stickers are not placeable');
    ok(clean.name.length <= C.LIMITS.name && clean.goal === '', 'names are cut to length and non-strings emptied');
    const G = W.newWorld(clean, 0, 1);
    run(G, IDLE, 2);
    ok(Number.isFinite(G.t), 'and the cleaned cart runs');
    ok(Ct.snap(3.2, 4.9, 1).x === 3.5 && Ct.snap(3.2, 4.9, 2).x === 3, 'stickers snap to the grid by size');
}

if (want('determinism')) {
    section('determinism and saving');
    const play = (seed) => { const G = W.newWorld(Ct.starterCart(), 0, seed); const b = Bt.makeBot({ seed }); run(G, (g) => Bt.botInput(g, b), 20); return G; };
    const a = play(42), b = play(42);
    ok(JSON.stringify(W.serialize(a)) === JSON.stringify(W.serialize(b)), 'same seed and inputs, same game');
    ok(JSON.stringify(W.serialize(play(43))) !== JSON.stringify(W.serialize(a)), 'a different seed plays differently');

    const cart = Ct.starterCart();
    const G = W.newWorld(cart, 0, 7);
    const bot = Bt.makeBot({ seed: 7 });
    run(G, (g) => Bt.botInput(g, bot), 12);
    ok(G.insts.length > 5 && G.t > 11, 'a game is under way to save');
    const snap = JSON.parse(JSON.stringify(W.serialize(G)));
    const c2 = W.deserialize(JSON.parse(JSON.stringify(snap)), cart);
    ok(JSON.stringify(W.serialize(c2)) === JSON.stringify(snap), 'a save round trip changes nothing');
    const x = W.deserialize(JSON.parse(JSON.stringify(snap)), cart), y = W.deserialize(JSON.parse(JSON.stringify(snap)), cart);
    const bx = Bt.makeBot({ seed: 3 }), by = Bt.makeBot({ seed: 3 });
    run(x, (g) => Bt.botInput(g, bx), 8);
    run(y, (g) => Bt.botInput(g, by), 8);
    ok(JSON.stringify(W.serialize(x)) === JSON.stringify(W.serialize(y)), 'two copies of one save play on identically');
    let threw = false;
    try { W.deserialize({ v: 999 }, cart); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

if (want('room')) {
    section('the console room');
    const stations = { shelf: 3, stage: 9, press: 15, play: 21 };
    const want_ = { shelf: 'shelf', stage: 'stage', press: 'press', play: 'play' };
    ok(Ct.roomCart().scenes[0].items.filter((i) => St.byId[i.sid]?.tags.includes('station')).length === 4, 'the room has four machines');
    for (const [name, x] of Object.entries(stations)) {
        const G = W.newWorld(Ct.roomCart({ x, y: 7.5 }), 0, 1);
        const seen = [];
        for (let t = 0; t < 3 && !seen.length; t += DT) {
            W.step(G, { ...IDLE, y: -1 }, DT);
            seen.push(...drain(G).filter((e) => e.type === 'console'));
        }
        ok(seen[0]?.open === want_[name], `walking up into the ${name} machine opens ${want_[name]}`);
    }
    const G = W.newWorld(Ct.roomCart(), 0, 1);
    run(G, { ...IDLE, y: 1 }, 5);
    ok(G.status === 'play' && drain(G).filter((e) => e.type === 'console').length === 0, 'walking about the room opens nothing by itself');
    const g2 = W.newWorld(Ct.roomCart(), 0, 1);
    W.step(g2, { ...IDLE, tap: { x: 21, y: 3 } }, DT);
    ok(drain(g2).some((e) => e.type === 'console' && e.open === 'play'), 'tapping a machine opens it too');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    const levels = [1, 0.5, 0.2];
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of levels) {
            const G = W.newWorld(Ct.starterCart(), 0, s * 101);
            const bot = Bt.makeBot({ skill, seed: s });
            let bad = null, t = 0;
            while (G.status === 'play' && t < 180) {
                W.step(G, Bt.botInput(G, bot), DT);
                G.events.length = 0;
                t += DT;
                for (const o of G.insts) {
                    if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) bad = 'non-finite position';
                    else if (o.x < -1.1 || o.y < -1.1 || o.x > C.COLS + 1.1 || o.y > C.ROWS + 1.1) bad = 'outside the scene';
                    else if (!Number.isFinite(o.hp)) bad = 'non-finite health';
                }
                if (G.insts.length > C.LIMITS.maxInst) bad = 'too many stickers';
                if (bad) break;
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            rows.push({ seed: s, skill, won: G.status === 'won', t, score: G.score });
        }
    }
    const rate = (k) => rows.filter((r) => r.skill === k && r.won).length / SEEDS;
    const secs = (k) => { const w = rows.filter((r) => r.skill === k && r.won); return w.length ? Math.round(w.reduce((a, r) => a + r.t, 0) / w.length) : 0; };
    for (const k of levels) console.log(`  skill ${k}: wins ${Math.round(rate(k) * 100)}%  average win ${secs(k)} s`);
    ok(rate(1) >= 0.7, `the starter cart can be won (skill 1 wins ${Math.round(rate(1) * 100)}%)`);
    ok(rate(1) > rate(0.2) + 0.2, 'and skill matters (a clumsy bot wins much less)');
    ok(rate(0.2) < 0.5, 'the cart is not a walkover');
    ok(secs(1) > 8, 'a win takes more than a few seconds');
    let idleWins = 0;
    for (let s = 1; s <= 4; s++) { const G = W.newWorld(Ct.starterCart(), 0, s); run(G, IDLE, 120); if (G.status === 'won') idleWins++; }
    ok(idleWins === 0, 'standing still never wins');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
