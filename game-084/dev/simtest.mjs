/**
 * simtest.mjs — headless checks of ROMANCER and its VESTA-8 runtime. No browser.
 *
 *   node game-084/dev/simtest.mjs
 *   ONLY=lang,missions node game-084/dev/simtest.mjs
 *   SEEDS=8 VERBOSE=1 node game-084/dev/simtest.mjs
 *
 * purity     the runtime parts and js/meta never touch the DOM, storage, Math.random or the clock
 * export     each runtime part is self-contained: rebuilt from fn.toString() in a fresh JS realm it
 *            still plays a cart; no "</script" or line separators; exportHTML/importCart round trip
 * lang       VESTA SCRIPT: statements, operators, functions, scoping, errors with line numbers,
 *            the runaway-loop guard
 * rules      physics and every control preset, edges, flags, events, levels, restart, camera
 * determinism  a seed and inputs replay exactly; cloneRun copies are independent
 * missions   every cartridge as found is broken, every fix fixes its task, and the bot wins the
 *            repaired cart on SEEDS seeds (prints the balance table); no task fires on a blank cart
 * progress   unlocks, completion, achievements, save round trip, the Studio
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 4);
const want = (name) => !ONLY.length || ONLY.includes(name);

const RT = await import('../js/runtime/index.js');
const { V, PARTS, exportHTML, importCart } = RT;
const { MISSIONS, missionById, taskStates, repair } = await import('../js/meta/missions.js');
const { BOTS, playOut } = await import('../js/meta/bots.js');
const PG = await import('../js/meta/progress.js');
const { makeCart } = await import('../js/meta/carts.js');
const { SCENES } = await import('../js/meta/story.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const B = V.BTN;

/** A one-level cart from rows, with types and scripts. */
function cartOf(rows, legend, types, extra = {}) {
    return makeCart({
        sprites: { 1: Array(8).fill('33333333'), 2: Array(8).fill('22222222'), 3: Array(8).fill('44444444'), 4: Array(8).fill('55555555'), 5: Array(8).fill('66666666'), 6: Array(8).fill('77777777') },
        flags: { 1: ['solid'], 3: ['hazard'], 4: ['ladder'], 5: ['oneway'] },
        levels: [V.levelFromRows(rows, legend)],
        types, ...extra,
    });
}
const runOf = (cart, seed = 1) => V.newRun(V.prepare(cart), { seed });
const steps = (R, n, btn = 0) => { for (let i = 0; i < n; i++) { V.stepRun(R, typeof btn === 'function' ? btn(R, i) : btn); R.events.length = 0; } return R; };
const obj = (R, t) => R.objs.find((o) => o.type === t);
const evalIn = (src, frames = 1) => {
    const c = cartOf(['....'], {}, [], { script: src });
    const R = runOf(c);
    steps(R, frames);
    return R;
};

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/runtime/font.js', 'js/runtime/gfx.js', 'js/runtime/lang.js', 'js/runtime/core.js', 'js/runtime/sound.js', 'js/config.js',
        ...fs.readdirSync(path.join(ROOT, 'js/meta')).map((f) => 'js/meta/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('export')) {
    section('export');
    const LSEP = String.fromCharCode(0x2028), PSEP = String.fromCharCode(0x2029);
    for (const p of PARTS.concat([RT.HOST])) {
        const s = p.toString();
        ok(!/<\/script/i.test(s), `${p.name}: no "</script" in its source`);
        ok(!s.includes(LSEP) && !s.includes(PSEP), `${p.name}: no line separators`);
        ok(!/^\s*(import|export)\s/m.test(s), `${p.name}: no import/export inside`);
    }
    // rebuild the runtime from its own source in a fresh realm, as an exported file does, and play RALLY
    const ctx = vm.createContext({});
    vm.runInContext('var V = {};\n' + PARTS.map((p) => '(' + p.toString() + ')(V);').join('\n'), ctx);
    const V2 = ctx.V;
    ok(typeof V2.newRun === 'function' && V2.BUILTINS && V2.BUILTINS.spawn, 'the stringified parts rebuild a whole VESTA-8');
    const rally = repair(missionById('rally'), missionById('rally').build());
    const R = V2.newRun(V2.prepare(JSON.parse(JSON.stringify(rally))), { seed: 5 });
    const bot = {};
    while (R.status === 'run' && R.stats.frames < 60 * 120) { V2.stepRun(R, BOTS.rally(R, bot)); R.events.length = 0; }
    ok(R.status === 'win', `the rebuilt console plays RALLY to a win (${R.status} after ${R.stats.frames} frames)`);
    V2.drawRun(R);
    ok(R.fb.some((v) => v !== 0), 'and draws it');
    // the exported file
    const evil = JSON.parse(JSON.stringify(rally));
    evil.title = 'A <B> & "C"';
    evil.script += '\n-- </script><script>alert(1)</script> ' + LSEP + '\n';
    const html = exportHTML(evil, { version: 'test' });
    ok(html.startsWith('<!DOCTYPE html>'), 'exported HTML starts with a doctype');
    ok((html.match(/<\/script>/g) || []).length === 2, 'the cart\'s own "</script>" text cannot close a tag');
    ok(html.includes('<title>A &lt;B&gt; &amp; &quot;C&quot;</title>'), 'the title is escaped');
    const back = importCart(html);
    ok(back && back.script === V.normalize(evil).script && back.title === evil.title, 'importCart reads the cart back out of an exported file');
    ok(importCart(JSON.stringify({ format: 'vesta-8 cart', cart: rally })).title === 'RALLY', 'importCart reads a .vesta.json file');
    ok(importCart('not a cart') === null && importCart('{"x":1}') === null, 'importCart refuses anything else');
    console.log(`  exported RALLY is ${(html.length / 1024).toFixed(1)} KB`);
}

// ======================================================================
if (want('lang')) {
    section('lang');
    let R = evalIn(`
        on start
          a = 1 + 2 * 3          -- 7
          b = (1 + 2) * 3        -- 9
          c = 7 % 3              -- 1
          d = -7 % 3             -- 2 (floored)
          e = 5 / 0              -- 0, not infinity
          f = "a" .. 1 .. true
          g = "x" + 2
          h = 1 == 1 and 2 ~= 3 and 2 != 3 and not false
          i = nil == nil
          j = 0
          for k = 1, 10 do j += k end
          for k = 10, 1, -3 do j += 100 end
          local n = 0
          while n < 5 do n += 1 end
          m = n
          repeat n -= 1 until n <= 0
          o = n
          p = fact(5)
          q = 3
          q *= 4
          q /= 6
          r = undefinedthing + 1
          if 1 > 2 then s = 1 elseif 2 > 1 then s = 2 else s = 3 end
          if 0 then t = 1 else t = 2 end
          u = max(3, 9) + min(3, 9) + abs(-2) + flr(2.7) + clamp(50, 0, 10)
        end
        function fact(x)
          if x <= 1 then return 1 end
          return x * fact(x - 1)
        end`);
    const g = R.globals;
    ok(R.status === 'run', 'the test script runs: ' + JSON.stringify(R.err));
    ok(g.a === 7 && g.b === 9 && g.c === 1 && g.d === 2 && g.e === 0, 'arithmetic, precedence, floored %, x/0 = 0');
    ok(g.f === 'a1true' && g.g === 'x2', 'string joining with .. and +');
    ok(g.h === true && g.i === true, 'comparisons and logic');
    ok(g.j === 55 + 400, 'numeric for loops, with a step');
    ok(g.m === 5 && g.o === 0, 'while and repeat … until');
    ok(g.p === 120, 'recursive functions');
    ok(g.q === 2, 'compound assignment');
    ok(g.r === 1, 'an unset global reads as 0');
    ok(g.s === 2 && g.t === 2, 'if / elseif / else; 0 is falsy');
    ok(g.u === 9 + 3 + 2 + 2 + 10, 'built-in maths');

    const err = (src) => V.compile(src).error;
    ok(err('on update\n  if x then\nend')?.line >= 1, 'an unclosed if is an error');
    ok(/unknown event/.test(err('on jump\nend')?.msg || ''), 'an unknown event is named');
    ok(err('on update\n  x = = 1\nend')?.line === 2, 'errors carry the line number');
    ok(/two "on update"/.test(err('on update\nend\non update\nend')?.msg || ''), 'two handlers for one event is an error');
    ok(/press/.test(err('on press q\nend')?.msg || ''), '"on press" needs a real button');
    ok(/already a built-in/.test(err('function spawn()\nend')?.msg || ''), 'a function cannot shadow a built-in');
    const P1 = V.prepare(cartOf(['..'], {}, [], { script: 'on start\n  frobnicate()\nend' }));
    ok(P1.errors.length && /frobnicate/.test(P1.errors[0].msg) && P1.errors[0].line === 2, 'calling a function that exists nowhere is caught before running');
    R = evalIn('on update\n  while true do\n  end\nend', 2);
    ok(R.status === 'error' && /too long/.test(R.err.msg) && R.err.line === 2, 'an endless loop stops the game with an error on its line');
    R = evalIn('on start\n  local o = nil\n  y = o.x\nend');
    ok(R.status === 'error' && /nil/.test(R.err.msg) && R.err.line === 3, 'reading a field of nil is a clear error');
    R = evalIn('on start\n  f(1)\nend\nfunction f(n)\n  f(n + 1)\nend');
    ok(R.status === 'error' && /too many times/.test(R.err.msg), 'runaway recursion is caught');
    // locals don't leak, and object properties are the object's own
    const c = cartOf(['a.........'], { a: 'thing' }, [{ name: 'thing', spr: 1, script: 'on start\n  local secret = 5\n  x = 40\n  me.hp2 = 3\n  shared = me.hp2 + 1\nend' }], { script: 'on update\n  seen = secret\nend' });
    R = runOf(c); steps(R, 1);
        ok(obj(R, 'thing').x === 40 && obj(R, 'thing').vars.hp2 === 3 && R.globals.shared === 4 && R.globals.seen === 0, 'locals stay local; x is the object\'s own; me.name keeps a value; other names are shared');
    ok(V.compile('-- comment\n// also\non start\n  x = 0x10\nend').error === null, 'both comment styles and hex numbers');
}

// ======================================================================
if (want('rules')) {
    section('rules');
    // platform: jump height from jump and gravity, landing, one-way platforms
    let c = cartOf([
        '..........',
        '..........',
        '..........',
        '..........',
        '...555....',
        '..........',
        '..........',
        '...p......',
        '1111111111',
    ], { '1': 1, '5': 5, p: 'hero' }, [{ name: 'hero', spr: 2, control: 'platform', speed: 1, jump: 3.9, gravity: 0.2, edge: 'stop', hitbox: 'full' }]);
    let R = runOf(c);
    steps(R, 10);
    const h = obj(R, 'hero');
    ok(h.onground && h.y === 56, 'a platformer lands on solid ground');
    let top = h.y;
    steps(R, 40, (R2, i) => (i < 30 ? B.a : 0));
    top = Math.min(top, h.y);
    R = runOf(c);
    const h2 = obj(R, 'hero');
    steps(R, 5);
    let minY = h2.y;
    for (let i = 0; i < 40; i++) { V.stepRun(R, B.a); minY = Math.min(minY, h2.y); }
    ok(Math.abs((56 - minY) - (3.9 * 3.9) / (2 * 0.2)) < 4, `holding jump rises about jump²/2g (${(56 - minY).toFixed(1)} px)`);
    ok(h2.y === 24, 'and it lands on the one-way platform above from below');
    R = runOf(c);
    steps(R, 5);
    steps(R, 3, B.a); steps(R, 20, 0);
    ok(obj(R, 'hero').y > 40, 'letting go early makes a shorter hop');
    // ladders
    c = cartOf([
        '..........',
        '.555455...',
        '....4.....',
        '....4.....',
        '....p.....',
        '1111111111',
    ], { '1': 1, '4': 4, '5': 5, p: 'hero' }, [{ name: 'hero', spr: 2, control: 'platform', speed: 1, jump: 2.4, gravity: 0.2, hitbox: 'full' }]);
    c.flags[4] |= V.FLAG.oneway;
    R = runOf(c); steps(R, 4);
    steps(R, 60, B.up); steps(R, 20, 0);
    ok(obj(R, 'hero').y === 0 && obj(R, 'hero').onground, 'climbs a ladder up through a one-way girder and stands on it');
    steps(R, 60, B.down); steps(R, 10);
    ok(obj(R, 'hero').y === 32, 'and climbs back down');
    // walls, bounce and edges
    c = cartOf(['1........1', '1.b......1', '1111111111'], { '1': 1, b: 'ball' }, [{ name: 'ball', spr: 2, bounce: 1, edge: 'none', script: 'on start\n  vx = 3\nend\non bump\n  bumps += 1\nend', hitbox: 'full' }]);
    R = runOf(c); steps(R, 40);
    ok(R.globals.bumps >= 2 && obj(R, 'ball').x >= 8 && obj(R, 'ball').x <= 64, 'a bouncy object bounces between walls and fires on bump');
    for (const [edge, expect] of [['wrap', (o) => o && o.x < 40], ['destroy', (o) => !o], ['stop', (o) => o && o.x === 72], ['bounce', (o) => o && o.vx < 0]]) {
        c = cartOf(['........p.', '..........'], { p: 'thing' }, [{ name: 'thing', spr: 2, walls: false, edge, hitbox: 'full', script: 'on start\n  vx = 2\nend' }]);
        R = runOf(c); steps(R, 12);
        ok(expect(obj(R, 'thing')), `edge "${edge}"`);
    }
    // grid hops line up with tiles; mazes turn at gaps
    c = cartOf(['.....', '..f..', '..1..', '.....'], { '1': 1, f: 'frog' }, [{ name: 'frog', spr: 2, control: 'grid', speed: 1, hitbox: 'full' }]);
    R = runOf(c); steps(R, 1, B.right); steps(R, 10);
    ok(obj(R, 'frog').x === 24 && obj(R, 'frog').y === 8, 'a grid object hops exactly one tile');
    R = runOf(c); steps(R, 1, B.down); steps(R, 10);
    ok(obj(R, 'frog').y === 8, 'and never into a solid tile');
    c = cartOf(['1111111', '1m....1', '1.111.1', '1.....1', '1111111'], { '1': 1, m: 'munch' }, [{ name: 'munch', spr: 2, control: 'maze', speed: 1, hitbox: 'full' }]);
    R = runOf(c); steps(R, 1, B.right); steps(R, 40, 0);
    ok(obj(R, 'munch').x === 40 && obj(R, 'munch').y === 8, 'a maze runner keeps going until a wall');
    steps(R, 1, B.down); steps(R, 40, 0);
    ok(obj(R, 'munch').x === 40 && obj(R, 'munch').y === 24, 'and turns when it can');
    // top-down walkers slide round corners into a gap
    c = cartOf(['111111', '1....1', '1.11.1', '1....1', '111111'], { '1': 1, p: 'hero' }, [{ name: 'hero', spr: 2, control: 'move4', speed: 1, hitbox: 'full' }]);
    c.levels[0].objs.push({ t: 'hero', x: 9, y: 10 });
    R = runOf(c); steps(R, 20, B.down);
    ok(obj(R, 'hero').x === 8 && obj(R, 'hero').y > 12, 'corner nudge: a walker slides into a gap beside it');
    // patrol turns at walls, and at ledges when asked
    c = cartOf(['1.....1', '1.w....1', '1111..11'], { '1': 1, w: 'walker' }, [{ name: 'walker', spr: 2, control: 'patrol', speed: 1, gravity: 0.2, ledge: true, hitbox: 'full' }]);
    R = runOf(c); steps(R, 60);
    ok(obj(R, 'walker') && obj(R, 'walker').y === 8, 'a careful patroller turns at a ledge');
    // events: hit fires once per frame per pair, enter, hazard, spawn, destroy, die
    c = cartOf(['.a3b....'], { a: 'one', b: 'coin', '3': 3 }, [
        { name: 'one', spr: 2, walls: false, hitbox: 'full', script: 'on start\n  vx = 1\nend\non hit coin\n  hits += 1\n  destroy(other)\n  spawn("coin", 56, 0)\nend\non enter\n  enters += 1\nend\non hazard\n  hz += 1\nend' },
        { name: 'coin', spr: 2, walls: false, hitbox: 'full', script: 'on die\n  died += 1\nend' },
    ]);
    R = runOf(c); steps(R, 30);
    ok(R.globals.hits === 1 && R.globals.died === 1 && R.objs.filter((o) => o.type === 'coin').length === 1, 'on hit, destroy, on die and spawn');
    ok(R.globals.enters >= 3, 'on enter fires per tile cell');
    ok(R.globals.hz >= 1 && R.globals.hz <= 20, 'on hazard fires while over a hazard tile');
    // solid objects block movers and still report the hit
    c = cartOf(['1........1', '1.b...w..1', '1111111111'], { '1': 1, b: 'ball', w: 'wall' }, [
        { name: 'ball', spr: 2, bounce: 1, hitbox: 'full', script: 'on start\n  vx = 1\nend\non hit wall\n  hw += 1\nend' },
        { name: 'wall', spr: 2, solid: true, hitbox: 'full' },
    ]);
    R = runOf(c); steps(R, 40);
    ok(R.globals.hw >= 1 && obj(R, 'ball').x < 48, 'a solid object blocks and fires on hit');
    // levels, restart, win and lose
    const lv = makeCart({
        sprites: { 1: Array(8).fill('33333333') },
        levels: [V.levelFromRows(['p.'], { p: 'thing' }), V.levelFromRows(['.p'], { p: 'thing' })],
        types: [{ name: 'thing', spr: 1, script: 'on start\n  starts += 1\nend\non update\n  if timer == 3 then nextlevel() end\nend' }],
    });
    R = runOf(lv); steps(R, 5);
    ok(R.level === 1 && obj(R, 'thing').x === 8 && R.globals.level === 2 && R.globals.starts === 2, 'nextlevel() loads the next level after the frame');
    steps(R, 5);
    ok(R.status === 'win', 'nextlevel() after the last level wins');
    R = evalIn('on update\n  if frames() == 3 then lose() end\nend', 10);
    ok(R.status === 'lose', 'lose()');
    R = evalIn('on start\n  n += 1\nend\non update\n  if frames() == 3 then restart() end\nend', 5);
    ok(R.globals.n === 1 && R.status === 'run' && R.stats.frames < 5, 'restart() starts the game again');
    // the camera follows inside the map
    c = cartOf(['p' + '.'.repeat(59)], { p: 'hero' }, [{ name: 'hero', spr: 1, walls: false, edge: 'stop', script: 'on start\n  vx = 4\nend' }], { camera: { follow: 'hero' } });
    R = runOf(c); steps(R, 40);
    ok(R.cam.x > 0 && R.cam.x <= 60 * 8 - 160, 'the camera follows and stays inside the map');
    // drawing outside "on draw" is an error, inside it draws
    R = evalIn('on update\n  text("HI", 1, 1)\nend', 2);
    ok(R.status === 'error' && /on draw/.test(R.err.msg), 'drawing outside "on draw" explains itself');
    R = evalIn('on draw\n  rectfill(0, 0, 10, 10, 4)\nend', 1);
    V.drawRun(R);
    ok(R.fb[5 * 160 + 5] === 4, 'on draw draws');
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const m = missionById('munch');
    const c = repair(m, m.build());
    const snap = (R) => JSON.stringify([R.globals, R.objs.map((o) => [o.type, o.x, o.y]), [...R.map.t].join('')]);
    const a = playOut(c, 'munch', { seed: 9, frames: 900 });
    const b = playOut(c, 'munch', { seed: 9, frames: 900 });
    ok(snap(a) === snap(b), 'the same seed and inputs give the same game');
    const R = V.newRun(V.prepare(c), { seed: 3 });
    const bot = {};
    for (let i = 0; i < 200; i++) { V.stepRun(R, BOTS.munch(R, bot)); R.events.length = 0; }
    const before = snap(R);
    const C = V.cloneRun(R);
    for (let i = 0; i < 200; i++) V.stepRun(C, B.left);
    ok(snap(R) === before && snap(C) !== before, 'a cloned run steps without touching the original');
}

// ======================================================================
if (want('missions')) {
    section('missions');
    console.log('  cartridge     wins  avg frames to the goal');
    for (const m of MISSIONS) {
        const c0 = m.build();
        const P0 = V.prepare(c0);
        ok(!P0.errors.length, `${m.id}: the cart as found compiles (${JSON.stringify(P0.errors[0] || '')})`);
        const s0 = taskStates(m, c0);
        ok(s0.some((s) => !s.done), `${m.id}: something is broken when it is found`);
        ok(!s0.find((s, i) => m.tasks[i].play).done, `${m.id}: the playtest task starts undone`);
        ok(m.tasks.every((t) => !taskStates(m, V.blankCart()).find((s) => s.id === t.id).done || t.id === 'name' && false), `${m.id}: no task is done on a blank cart`);
        for (const t of m.tasks) {
            if (!t.fix) continue;
            const one = repair(m, c0, t.id);
            ok(taskStates(m, one).find((s) => s.id === t.id).done, `${m.id}: VESTA's repair fixes "${t.id}"`);
        }
        const c = repair(m, c0);
        ok(!V.prepare(c).errors.length, `${m.id}: the repaired cart compiles`);
        ok(taskStates(m, c).every((s, i) => s.done || m.tasks[i].play), `${m.id}: every non-playtest task is done after repairs`);
        let wins = 0, frames = 0, goal = 0;
        for (let s = 1; s <= SEEDS; s++) {
            const R = playOut(c, m.id, { seed: s * 7919, frames: 60 * 300 });
            if (R.status === 'win') { wins++; frames += R.stats.frames; }
            const st = taskStates(m, c, { maxG: R.stats.maxG, wins: R.stats.wins });
            if (st.every((x) => x.done)) goal++;
            ok(R.status !== 'error', `${m.id} seed ${s}: no script error (${JSON.stringify(R.err)})`);
        }
        ok(goal === SEEDS, `${m.id}: the bot completes the playtest task on every seed (${goal}/${SEEDS})`);
        if (m.id !== 'last') ok(wins >= Math.ceil(SEEDS * 0.75), `${m.id}: the bot wins the repaired cart (${wins}/${SEEDS})`);
        console.log(`  ${m.title.padEnd(18)} ${wins}/${SEEDS}  ${wins ? Math.round(frames / wins) : '-'}`);
        ok(SCENES['brief_' + m.id] && (m.final || SCENES['done_' + m.id]), `${m.id}: has its briefing and its memory scene`);
    }
}

// ======================================================================
if (want('progress')) {
    section('progress');
    const P = PG.newProgress('TESTER');
    ok(P.missions.rally.state === 'open' && P.missions.brick.state === 'locked', 'a new expedition opens RALLY only');
    ok(PG.hasFeature(P, 'sprites') && !PG.hasFeature(P, 'map') && PG.paletteSize(P) === 4, 'the console starts with sprites, objects and four colours');
    ok(PG.hasFeature(P, 'map', true), 'Open Archive unlocks everything');
    ok(PG.tryComplete(P, 'rally') === null, 'a cartridge with tasks left is not restored');
    P.missions.rally.cart = repair(missionById('rally'), P.missions.rally.cart);
    PG.recordPlay(P, 'rally', { maxG: { score: 3, rival: 0 }, wins: 1 });
    const done = PG.tryComplete(P, 'rally');
    ok(done && done.next === 'brick' && P.missions.brick.state === 'open', 'restoring RALLY opens BRICKBREAK');
    ok(PG.paletteSize(P) === 8 && PG.hasFeature(P, 'export') && PG.hasFeature(P, 'map'), 'and brings back 8 colours, export and the map editor');
    ok(done.unlocked.some((u) => u.id === 'pal8') && done.unlocked.some((u) => u.id === 'map'), 'the restore reports what came back');
    const got = PG.checkAchievements(P).map((a) => a.id);
    ok(got.includes('first_light') && got.includes('hands_on'), 'First Light and Hands On');
    ok(PG.checkAchievements(P).length === 0, 'a commendation is given once');
    PG.repairTask(P, 'brick', 'bricks');
    ok(P.missions.brick.repaired.includes('bricks') && P.stats.repairs === 1, 'a repair is remembered');
    // play every mission through, in order
    for (const m of MISSIONS) {
        const s = P.missions[m.id];
        if (s.state === 'done') continue;
        ok(s.state === 'open', `${m.id} opens in turn`);
        s.cart = repair(m, s.cart);
        PG.recordPlay(P, m.id, { maxG: { score: 9999, homes: 3 }, wins: 1 });
        ok(PG.tryComplete(P, m.id), `${m.id} restores`);
    }
    ok(P.ended && PG.memory(P) === 100 && !PG.currentMission(P), 'the last cartridge ends the story with 100% memory');
    ok(Object.keys(PG.FEATURES).every((f) => PG.hasFeature(P, f)), 'every feature is back');
    const ach = PG.checkAchievements(P).map((a) => a.id);
    ok(ach.includes('archivist') && ach.includes('romancer') && !P.ach.purist, 'Archivist and Romancer, but not Purist after a repair');
    // the Studio
    const e = PG.addCreative(P, V.blankCart(), 'MINE');
    ok(PG.creativeById(P, e.id).cart.title === 'MINE', 'a Studio cart');
    ok(PG.templates(P).length === 1 + 8 + 1, 'templates: blank, the eight restored, and your own');
    // save round trip
    const d = JSON.parse(JSON.stringify(PG.serializeProgress(P)));
    const Q = PG.deserializeProgress(d);
    ok(JSON.stringify(PG.serializeProgress(Q)) === JSON.stringify(PG.serializeProgress(P)), 'progress survives a save round trip');
    let threw = false;
    try { PG.deserializeProgress({ v: 99 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    const broken = JSON.parse(JSON.stringify(d));
    broken.missions.rally.cart.types[0].control = 'teleport';
    broken.missions.rally.cart.levels[0].tiles = '!!!';
    ok(PG.deserializeProgress(broken).missions.rally.cart.types[0].control === 'none', 'a damaged cart in a save is repaired on load, not trusted');
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
