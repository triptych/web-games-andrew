// VESTA-8 runtime: the console itself. A cartridge (plain JSON) is prepared once (sprites decoded,
// scripts compiled), then a run steps at a fixed 60 frames a second:
//
//   const P = V.prepare(cart);          // { errors, types, … }
//   const R = V.newRun(P, { seed });
//   V.stepRun(R, buttons);              // buttons: bitmask of V.BTN
//   V.drawRun(R);                       // fills R.fb with palette indices
//   R.events                            // sfx, win, lose, say, error… for the host to drain
//
// Pure: no DOM, no clock, no Math.random. A seed replays exactly, so a bot can prove a cart is
// winnable in Node.

export function core(V) {
    const TS = 8;
    const BTN = { left: 1, right: 2, up: 4, down: 8, a: 16, b: 32 };
    V.BTN = BTN;
    const FLAG = { solid: 1, hazard: 2, ladder: 4, oneway: 8 };
    V.FLAG = FLAG;
    V.FLAG_NAMES = ['solid', 'hazard', 'ladder', 'oneway'];
    V.MAX_LEVELS = 4;
    V.MAX_OBJS = 300;
    // Tile ids in a level string: one character each, '.' is empty.
    V.TILECH = '.123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#@';
    const TILEIDX = {};
    for (let i = 0; i < 64; i++) TILEIDX[V.TILECH[i]] = i;

    V.CONTROLS = {
        none: 'No control (scripts move it)',
        move4: 'Player: walk 4 ways',
        move8: 'Player: fly 8 ways',
        platform: 'Player: run & jump (A or ↑ jumps, climbs ladders)',
        paddle_v: 'Player: paddle up & down',
        paddle_h: 'Player: paddle left & right',
        grid: 'Player: hop one tile per press',
        maze: 'Player: maze runner (keeps going, turns at gaps)',
        chase: 'AI: chase the player through a maze',
        homing: 'AI: fly straight at the player',
        patrol: 'AI: walk and turn at walls',
        wander: 'AI: wander about',
    };
    const PLAYER = new Set(['move4', 'move8', 'platform', 'paddle_v', 'paddle_h', 'grid', 'maze']);
    V.isPlayerControl = (c) => PLAYER.has(c);
    V.EDGES = {
        none: 'can leave the map',
        stop: 'stops at the edge',
        bounce: 'bounces off the edge',
        wrap: 'wraps to the other side',
        destroy: 'is destroyed when it leaves',
    };

    // ------------------------------------------------------------------ carts
    const clampN = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
    V.defaultType = (name) => ({
        name, spr: 1, frames: [], anim: 8, animMove: false, sw: 1, sh: 1, control: 'none', speed: 1, jump: 3.2,
        gravity: 0, bounce: 0, walls: true, solid: false, edge: 'stop', hp: 1, autoflip: true, ledge: false,
        hitbox: 'snug', script: '',
    });
    V.blankLevel = (w = 20, h = 15) => ({ w, h, tiles: '.'.repeat(w * h), objs: [] });
    V.blankCart = () => V.normalize({
        title: 'UNTITLED', author: '', desc: '', bg: 0,
        sprites: [], flags: [], levels: [V.blankLevel()], types: [], script: '',
    });

    /** Fill in defaults and clamp everything, so an old or hand-edited cart still runs. */
    V.normalize = (c) => {
        c = c && typeof c === 'object' ? c : {};
        const out = {
            v: 1,
            title: String(c.title || 'UNTITLED').slice(0, 24),
            author: String(c.author || '').slice(0, 24),
            desc: String(c.desc || '').slice(0, 400),
            bg: clampN(c.bg, 0, 15, 0) | 0,
            sprites: [],
            flags: [],
            levels: [],
            types: [],
            script: typeof c.script === 'string' ? c.script : '',
            sounds: [],
            music: null,
            hud: { score: !!(c.hud && c.hud.score), lives: !!(c.hud && c.hud.lives) },
            camera: { follow: (c.camera && typeof c.camera.follow === 'string') ? c.camera.follow : '' },
            start: { lives: clampN(c.start && c.start.lives, 0, 99, 3) | 0 },
            label: clampN(c.label, 0, 63, 1) | 0,
        };
        for (let i = 0; i < 64; i++) {
            let s = (c.sprites && typeof c.sprites[i] === 'string') ? c.sprites[i].toLowerCase().replace(/[^0-9a-f]/g, '0') : '';
            out.sprites.push((s + '0'.repeat(64)).slice(0, 64));
            out.flags.push(clampN(c.flags && c.flags[i], 0, 15, 0) | 0);
        }
        const lv = Array.isArray(c.levels) && c.levels.length ? c.levels.slice(0, V.MAX_LEVELS) : [V.blankLevel()];
        for (const L of lv) {
            const w = clampN(L && L.w, 4, 128, 20) | 0, h = clampN(L && L.h, 4, 64, 15) | 0;
            let t = (L && typeof L.tiles === 'string') ? L.tiles : '';
            t = [...t].map((ch) => (ch in TILEIDX ? ch : '.')).join('');
            t = (t + '.'.repeat(w * h)).slice(0, w * h);
            const objs = (L && Array.isArray(L.objs) ? L.objs : [])
                .filter((o) => o && typeof o.t === 'string')
                .slice(0, V.MAX_OBJS)
                .map((o) => ({ t: o.t, x: clampN(o.x, -64, w * TS + 64, 0), y: clampN(o.y, -64, h * TS + 64, 0) }));
            out.levels.push({ w, h, tiles: t, objs });
        }
        const seen = new Set();
        for (const T of (Array.isArray(c.types) ? c.types : []).slice(0, 32)) {
            if (!T || typeof T.name !== 'string') continue;
            const name = T.name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16) || 'thing';
            if (seen.has(name)) continue;
            seen.add(name);
            const d = V.defaultType(name);
            const o = { ...d };
            o.spr = clampN(T.spr, 0, 63, d.spr) | 0;
            o.frames = Array.isArray(T.frames) ? T.frames.filter((f) => typeof f === 'number').map((f) => Math.max(0, Math.min(63, f | 0))).slice(0, 8) : [];
            o.anim = clampN(T.anim, 1, 60, d.anim) | 0;
            o.animMove = !!T.animMove;
            o.sw = clampN(T.sw, 1, 4, 1) | 0;
            o.sh = clampN(T.sh, 1, 4, 1) | 0;
            o.control = T.control in V.CONTROLS ? T.control : 'none';
            o.speed = clampN(T.speed, 0, 8, d.speed);
            o.jump = clampN(T.jump, 0, 10, d.jump);
            o.gravity = clampN(T.gravity, 0, 1, d.gravity);
            o.bounce = clampN(T.bounce, 0, 1, d.bounce);
            o.walls = T.walls === undefined ? d.walls : !!T.walls;
            o.solid = !!T.solid;
            o.edge = T.edge in V.EDGES ? T.edge : d.edge;
            o.hp = clampN(T.hp, 1, 99, 1) | 0;
            o.autoflip = T.autoflip === undefined ? d.autoflip : !!T.autoflip;
            o.ledge = !!T.ledge;
            o.hitbox = T.hitbox === 'full' ? 'full' : 'snug';
            o.script = typeof T.script === 'string' ? T.script : '';
            out.types.push(o);
        }
        for (let i = 0; i < 8; i++) {
            const s = (c.sounds && c.sounds[i]) || V.SFX_DEFAULTS[i] || V.SFX_DEFAULTS[0];
            out.sounds.push(V.normalizeSfx(s));
        }
        out.music = V.normalizeMusic(c.music);
        return out;
    };

    V.tileAtLevel = (L, cx, cy) => (cx < 0 || cy < 0 || cx >= L.w || cy >= L.h ? 0 : TILEIDX[L.tiles[cy * L.w + cx]] || 0);
    V.setTileLevel = (L, cx, cy, id) => {
        if (cx < 0 || cy < 0 || cx >= L.w || cy >= L.h) return;
        const i = cy * L.w + cx;
        L.tiles = L.tiles.slice(0, i) + V.TILECH[id & 63] + L.tiles.slice(i + 1);
    };
    V.levelFromRows = (rows, legend) => {
        // rows: strings; legend: char → tile id or { obj: 'type' } or [tile, 'type']
        const h = rows.length, w = Math.max(...rows.map((r) => r.length));
        const L = { w, h, tiles: '', objs: [] };
        const t = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const ch = rows[y][x] || ' ';
            const e = legend[ch];
            let id = 0;
            if (typeof e === 'number') id = e;
            else if (typeof e === 'string') L.objs.push({ t: e, x: x * TS, y: y * TS });
            else if (Array.isArray(e)) { id = e[0]; L.objs.push({ t: e[1], x: x * TS, y: y * TS }); }
            t.push(V.TILECH[id]);
        }
        L.tiles = t.join('');
        return L;
    };

    // ------------------------------------------------------------------ prepare
    V.prepare = (cartIn) => {
        const cart = V.normalize(cartIn);
        const sheet = V.decodeSheet(cart.sprites);
        const bounds = V.spriteBounds(sheet);
        const P = { cart, sheet, bounds, flags: Uint8Array.from(cart.flags), types: [], typeIdx: {}, fns: {}, errors: [], game: null };
        const fnOwner = {};
        const linkErr = (where, prog) => {
            if (prog.error) P.errors.push({ where, line: prog.error.line, msg: prog.error.msg });
            for (const nm in prog.functions) {
                if (P.fns[nm]) P.errors.push({ where, line: prog.functions[nm].line, msg: `${nm}() is also made in ${fnOwner[nm]}` });
                else { P.fns[nm] = prog.functions[nm]; fnOwner[nm] = where === 'game' ? 'the game script' : where; }
            }
        };
        P.game = V.compile(cart.script);
        linkErr('game', P.game);
        cart.types.forEach((T, i) => {
            const prog = V.compile(T.script);
            const frames = T.frames.length ? T.frames : [T.spr];
            let hb = { x: 0, y: 0, w: T.sw * TS, h: T.sh * TS };
            if (T.hitbox === 'snug') {
                let x0 = 8, y0 = 8, x1 = 0, y1 = 0, any = false;
                for (const f of frames.concat([T.spr])) {
                    const b = bounds[f];
                    if (!b) continue;
                    any = true;
                    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
                    x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
                }
                if (any) hb = { x: x0, y: y0, w: (T.sw - 1) * TS + x1 - x0, h: (T.sh - 1) * TS + y1 - y0 };
            }
            const PT = { ...T, i, frames, hb, prog, player: PLAYER.has(T.control), hasHit: !!prog.handlers.hit };
            P.types.push(PT);
            P.typeIdx[T.name] = i;
            linkErr(T.name, prog);
        });
        // calls to functions that don't exist anywhere
        const check = (where, prog) => {
            if (prog.error) return;
            for (const c of prog.calls) {
                if (!P.fns[c.name] && !V.BUILTINS[c.name]) {
                    P.errors.push({ where, line: c.line, msg: `there is no function called ${c.name}()` });
                    break;
                }
            }
        };
        check('game', P.game);
        P.types.forEach((T) => check(T.name, T.prog));
        if (cart.camera.follow && !(cart.camera.follow in P.typeIdx)) cart.camera.follow = '';
        return P;
    };

    // ------------------------------------------------------------------ runs
    function rand(R) {
        let a = (R.rs = (R.rs + 0x6D2B79F5) | 0);
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    V.rand = rand;

    V.newRun = (P, opts = {}) => {
        const cart = P.cart;
        const R = {
            P, seed: (opts.seed | 0) || 1, rs: (opts.seed | 0) || 1, frame: 0, level: 0,
            map: null, objs: [], nid: 1, globals: { score: 0, lives: cart.start.lives, level: 1 }, fns: P.fns,
            cam: { x: 0, y: 0 }, camFixed: false, follow: null, fb: V.makeFB(),
            status: 'run', err: null, msg: null, shake: 0, events: [], btn: 0, prev: 0,
            ops: 0, opLimit: opts.opLimit || 200000, depth: 0, line: 0, who: 'game',
            stats: { maxG: {}, frames: 0, wins: 0, losses: 0, spawned: {}, destroyed: {}, levels: 1, bumps: 0, says: 0 },
            overT: 0, pendingLevel: -1, pendingRestart: false, musicOn: !!cart.music.on, log: [], drawing: null,
        };
        if (P.errors.length) {
            const e = P.errors[0];
            R.status = 'error';
            R.err = { who: e.where, line: e.line, msg: e.msg };
            R.events.push({ type: 'error', ...R.err });
            return R;
        }
        try {
            loadLevel(R, Math.max(0, Math.min(cart.levels.length - 1, opts.level | 0)), true);
            R.who = 'game';
            if (P.game.handlers.init) V.runHandler(R, P.game.handlers.init, null);
            if (P.game.handlers.start) V.runHandler(R, P.game.handlers.start, null);
            for (const o of R.objs.slice()) startObj(R, o);
            afterFrame(R);
        } catch (err) { fail(R, err); }
        if (R.musicOn) R.events.push({ type: 'music', on: true });
        return R;
    };

    V.restartRun = (R) => V.newRun(R.P, { seed: (R.seed * 31 + 7) | 0, opLimit: R.opLimit });

    function loadLevel(R, n, deferStart) {
        const L = R.P.cart.levels[n];
        R.level = n;
        R.globals.level = n + 1;
        R.map = { w: L.w, h: L.h, t: new Uint8Array(L.w * L.h) };
        for (let i = 0; i < L.w * L.h; i++) R.map.t[i] = TILEIDX[L.tiles[i]] || 0;
        R.objs = [];
        R.follow = null;
        R.camFixed = false;
        R.cam.x = 0; R.cam.y = 0;
        const made = [];
        for (const p of L.objs) {
            const ti = R.P.typeIdx[p.t];
            if (ti === undefined) continue;
            made.push(makeObj(R, ti, p.x, p.y));
        }
        if (!deferStart) for (const o of made) startObj(R, o);
        updateCamera(R);
    }

    function makeObj(R, ti, x, y) {
        const T = R.P.types[ti];
        const o = {
            id: R.nid++, type: T.name, ti, T, x, y, vx: 0, vy: 0, spr: T.frames[0], flipx: false, flipy: false,
            hp: T.hp, timer: 0, onground: false, speed: T.speed, visible: true, dead: false, gravity: T.gravity,
            bounce: T.bounce, fx: 1, fy: 0, w: T.hb.w, h: T.hb.h, climbing: false, frame: 0, vars: {},
            sx: x, sy: y, cell: -1, mv: null, dir: 0, want: 0, anim: 0, blink: 0, coyote: 0, wanderT: 0, started: false,
        };
        if (R.objs.length >= V.MAX_OBJS) throw V.VErr(`too many objects (the VESTA-8 holds ${V.MAX_OBJS})`, R.line);
        R.objs.push(o);
        R.stats.spawned[T.name] = (R.stats.spawned[T.name] || 0) + 1;
        o.cell = cellOf(o);
        return o;
    }
    function startObj(R, o) {
        if (o.started || o.dead) return;
        o.started = true;
        const h = o.T.prog.handlers;
        R.who = o.type;
        if (h.init) V.runHandler(R, h.init, o);
        if (h.start && !o.dead) V.runHandler(R, h.start, o);
    }

    function fail(R, err) {
        if (!err || !err.vesta) {
            // a bug in the console itself: report it the same way rather than crashing the host
            err = V.VErr(String((err && err.message) || err), R.line);
        }
        R.status = 'error';
        R.err = { who: R.who, line: err.vline, msg: err.message };
        R.events.push({ type: 'error', ...R.err });
        R.overT = 0;
    }

    function destroy(R, o) {
        if (!o || o.dead) return;
        const h = o.T.prog.handlers.die;
        o.dead = true;
        R.stats.destroyed[o.type] = (R.stats.destroyed[o.type] || 0) + 1;
        if (h) {
            const who = R.who;
            R.who = o.type;
            V.runHandler(R, h, o);
            R.who = who;
        }
        if (R.follow === o) R.follow = null;
    }

    // ------------------------------------------------------------------ tiles & boxes
    const tileAt = (R, cx, cy) => (cx < 0 || cy < 0 || cx >= R.map.w || cy >= R.map.h ? 0 : R.map.t[cy * R.map.w + cx]);
    const flagsAt = (R, cx, cy) => R.P.flags[tileAt(R, cx, cy)];
    const box = (o) => ({ x: o.x + o.T.hb.x, y: o.y + o.T.hb.y, w: o.T.hb.w, h: o.T.hb.h });
    const cellOf = (o) => {
        const b = o.T.hb;
        const cx = Math.floor((o.x + b.x + b.w / 2) / TS), cy = Math.floor((o.y + b.y + b.h / 2) / TS);
        return cy * 4096 + cx;
    };
    function boxFlags(R, x, y, w, h) {
        let f = 0;
        const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 0.001) / TS);
        const y0 = Math.floor(y / TS), y1 = Math.floor((y + h - 0.001) / TS);
        for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) f |= flagsAt(R, cx, cy);
        return f;
    }
    V.boxFlags = boxFlags;

    /** What would block box (x, y, w, h)? dy > 0 with prevBottom lets one-way platforms catch a fall. */
    function blocker(R, o, x, y, w, h, dy, prevBottom) {
        const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 0.001) / TS);
        const y0 = Math.floor(y / TS), y1 = Math.floor((y + h - 0.001) / TS);
        for (let cy = y0; cy <= y1; cy++) {
            for (let cx = x0; cx <= x1; cx++) {
                const t = tileAt(R, cx, cy);
                if (!t) continue;
                const f = R.P.flags[t];
                if (f & FLAG.solid) return { tile: t, tx: cx, ty: cy, l: cx * TS, r: cx * TS + TS, t0: cy * TS, b: cy * TS + TS };
                if ((f & FLAG.oneway) && dy > 0 && !o.climbing && prevBottom <= cy * TS + 0.01) {
                    return { tile: t, tx: cx, ty: cy, l: cx * TS, r: cx * TS + TS, t0: cy * TS, b: cy * TS + TS };
                }
            }
        }
        if (R.hasSolid) {
            for (const s of R.objs) {
                if (s === o || s.dead || !s.T.solid) continue;
                const b = box(s);
                if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) {
                    return { obj: s, l: b.x, r: b.x + b.w, t0: b.y, b: b.y + b.h };
                }
            }
        }
        return null;
    }

    function bumped(R, o, hit) {
        if (hit.obj) {
            R.contacts.push([o, hit.obj]);
            return;
        }
        R.stats.bumps++;
        const h = o.T.prog.handlers.bump;
        if (h) { R.who = o.type; V.runHandler(R, h, o, [hit.tx, hit.ty, hit.tile]); }
    }

    /** Top-down walkers slide round corners: blocked by a wall's edge, step sideways into the gap. */
    function nudge(R, o, axis, step) {
        const c = o.T.control;
        if (c !== 'move4' && c !== 'move8') return false;
        const hb = o.T.hb;
        for (let off = 1; off <= 4; off++) {
            for (const sgn of [-1, 1]) {
                const ox = axis === 'x' ? sgn * off : 0, oy = axis === 'y' ? sgn * off : 0;
                const bx = o.x + hb.x + ox + (axis === 'y' ? step : 0), by = o.y + hb.y + oy + (axis === 'x' ? step : 0);
                if (blocker(R, o, bx, by, hb.w, hb.h, 0, 0)) continue;
                // the gap is beside us: shuffle toward it, but don't move forward yet
                const k = Math.min(Math.max(0.5, Math.abs(step)), off) * sgn;
                const sx = o.x + hb.x + (axis === 'x' ? k : 0), sy = o.y + hb.y + (axis === 'y' ? k : 0);
                if (blocker(R, o, sx, sy, hb.w, hb.h, 0, 0)) continue;
                if (axis === 'x') o.x += k; else o.y += k;
                return off <= Math.abs(k);
            }
        }
        return false;
    }

    function moveObj(R, o, dx, dy) {
        if (!o.T.walls) { o.x += dx; o.y += dy; return; }
        const hb = o.T.hb;
        if (dx) {
            const n = Math.ceil(Math.abs(dx) / 4), sx = dx / n;
            for (let i = 0; i < n; i++) {
                const nx = o.x + sx;
                const hit = blocker(R, o, nx + hb.x, o.y + hb.y, hb.w, hb.h, 0, 0);
                if (!hit) { o.x = nx; continue; }
                if (nudge(R, o, 'y', sx)) { o.x = nx; continue; }
                o.x = sx > 0 ? hit.l - hb.x - hb.w : hit.r - hb.x;
                if (o.T.control === 'patrol') { o.fx = sx > 0 ? -1 : 1; o.vx = o.fx * Math.abs(o.speed); }
                else if (o.bounce > 0) o.vx = (sx > 0 ? -1 : 1) * Math.abs(o.vx) * o.bounce;
                else o.vx = 0;
                if (o.T.control === 'wander') o.wanderT = 0;
                bumped(R, o, hit);
                break;
            }
        }
        if (dy) {
            const n = Math.ceil(Math.abs(dy) / 4), sy = dy / n;
            for (let i = 0; i < n; i++) {
                const ny = o.y + sy;
                const prevBottom = o.y + hb.y + hb.h;
                const hit = blocker(R, o, o.x + hb.x, ny + hb.y, hb.w, hb.h, sy, prevBottom);
                if (!hit) { o.y = ny; continue; }
                if (nudge(R, o, 'x', sy)) { o.y = ny; continue; }
                o.y = sy > 0 ? hit.t0 - hb.y - hb.h : hit.b - hb.y;
                if (sy > 0) {
                    if (!o.onground && o.T.prog.handlers.land) R.landed.push(o);
                    o.onground = true;
                }
                if (o.bounce > 0) o.vy = (sy > 0 ? -1 : 1) * Math.abs(o.vy) * o.bounce;
                else o.vy = 0;
                if (o.T.control === 'wander') o.wanderT = 0;
                bumped(R, o, hit);
                break;
            }
        }
    }
    V.moveObj = moveObj;

    function edges(R, o) {
        const e = o.T.edge;
        if (e === 'none') return;
        const b = box(o), W = R.map.w * TS, H = R.map.h * TS;
        if (e === 'wrap') {
            if (b.x >= W) o.x -= W + b.w; else if (b.x + b.w <= 0) o.x += W + b.w;
            if (b.y >= H) o.y -= H + b.h; else if (b.y + b.h <= 0) o.y += H + b.h;
            return;
        }
        if (e === 'destroy') {
            if (b.x >= W || b.x + b.w <= 0 || b.y >= H || b.y + b.h <= 0) destroy(R, o);
            return;
        }
        const bounce = e === 'bounce';
        if (b.x < 0) { o.x = -o.T.hb.x; o.vx = bounce ? Math.abs(o.vx) : 0; if (o.T.control === 'patrol') o.fx = 1; }
        else if (b.x + b.w > W) { o.x = W - o.T.hb.x - b.w; o.vx = bounce ? -Math.abs(o.vx) : 0; if (o.T.control === 'patrol') o.fx = -1; }
        if (b.y < 0) { o.y = -o.T.hb.y; o.vy = bounce ? Math.abs(o.vy) : 0; }
        else if (b.y + b.h > H) {
            o.y = H - o.T.hb.y - b.h;
            o.vy = bounce ? -Math.abs(o.vy) : 0;
            if (!bounce && o.gravity > 0) o.onground = true;
        }
    }

    // ------------------------------------------------------------------ control presets
    const held = (R, m) => (R.btn & m) !== 0;
    const pressed = (R, m) => (R.btn & m) !== 0 && (R.prev & m) === 0;
    const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

    function cellFree(R, o, cx, cy) {
        if (cx < 0 || cy < 0 || cx >= R.map.w || cy >= R.map.h) return o.T.edge === 'wrap' || o.T.edge === 'none';
        return !(flagsAt(R, cx, cy) & FLAG.solid);
    }
    function heldDir(R) {
        const dx = (held(R, BTN.right) ? 1 : 0) - (held(R, BTN.left) ? 1 : 0);
        const dy = (held(R, BTN.down) ? 1 : 0) - (held(R, BTN.up) ? 1 : 0);
        return [dx, dy];
    }
    function pressedDir(R) {
        if (pressed(R, BTN.left)) return 3; if (pressed(R, BTN.right)) return 1;
        if (pressed(R, BTN.up)) return 4; if (pressed(R, BTN.down)) return 2;
        return 0;
    }
    const dirVec = (d) => (d ? [[1, 0], [0, 1], [-1, 0], [0, -1]][[1, 2, 3, 4].indexOf(d)] : [0, 0]);
    function target(R) {
        if (R.player && !R.player.dead) return R.player;
        R.player = R.objs.find((p) => !p.dead && p.T.player) || null;
        return R.player;
    }

    /** One step along a grid lane: dir 1 right, 2 down, 3 left, 4 up. Lands exactly on grid lines. */
    function laneStep(o, d, speed) {
        const [dx, dy] = dirVec(d);
        if (dx) {
            const nx = dx > 0 ? Math.floor(o.x / TS + 1e-6) * TS + TS : Math.ceil(o.x / TS - 1e-6) * TS - TS;
            const dist = Math.abs(nx - o.x);
            o.vx = dx * Math.min(speed, dist); o.vy = 0;
        } else if (dy) {
            const ny = dy > 0 ? Math.floor(o.y / TS + 1e-6) * TS + TS : Math.ceil(o.y / TS - 1e-6) * TS - TS;
            const dist = Math.abs(ny - o.y);
            o.vy = dy * Math.min(speed, dist); o.vx = 0;
        } else { o.vx = 0; o.vy = 0; }
    }
    const aligned = (o) => Math.abs(o.x - Math.round(o.x / TS) * TS) < 0.01 && Math.abs(o.y - Math.round(o.y / TS) * TS) < 0.01;

    function control(R, o) {
        const T = o.T, sp = o.speed;
        switch (T.control) {
            case 'move4': {
                let [dx, dy] = heldDir(R);
                if (dx && dy) { if (o.fy) dx = 0; else dy = 0; }
                o.vx = dx * sp; o.vy = dy * sp;
                if (dx || dy) { o.fx = dx; o.fy = dy; }
                break;
            }
            case 'move8': {
                const [dx, dy] = heldDir(R);
                const k = dx && dy ? Math.SQRT1_2 : 1;
                o.vx = dx * sp * k; o.vy = dy * sp * k;
                if (dx || dy) { o.fx = dx; o.fy = dy; }
                break;
            }
            case 'paddle_v': { const [, dy] = heldDir(R); o.vy = dy * sp; if (dy) { o.fy = dy; o.fx = 0; } break; }
            case 'paddle_h': { const [dx] = heldDir(R); o.vx = dx * sp; if (dx) { o.fx = dx; o.fy = 0; } break; }
            case 'platform': {
                const [dx, dy] = heldDir(R);
                const hb = T.hb;
                const cx = o.x + hb.x + hb.w / 2;
                const ladderHere = boxFlags(R, cx - 1, o.y + hb.y, 2, hb.h) & FLAG.ladder;
                const ladderBelow = boxFlags(R, cx - 1, o.y + hb.y + hb.h, 2, 2) & FLAG.ladder;
                const jumpPressed = pressed(R, BTN.a) || (pressed(R, BTN.up) && !ladderHere && !ladderBelow);
                if (o.climbing) {
                    if (!ladderHere && !(dy > 0 && ladderBelow)) o.climbing = false;
                    else if (jumpPressed && dx) { o.climbing = false; o.vy = -T.jump * 0.8; jumped(R, o); }
                    else {
                        o.vy = dy * Math.max(0.5, sp * 0.75);
                        o.vx = 0;
                        if (!dy && dx && o.onground) o.climbing = false;
                    }
                }
                if (!o.climbing) {
                    o.vx = dx * sp;
                    if (dx) o.fx = dx;
                    if ((dy < 0 && ladderHere) || (dy > 0 && ladderBelow && o.onground)) {
                        o.climbing = true;
                        const col = Math.floor(cx / TS);
                        o.x = col * TS + (TS - hb.w) / 2 - hb.x;
                        o.vx = 0;
                        o.vy = dy * Math.max(0.5, sp * 0.75);
                    } else {
                        if (o.onground) o.coyote = 6; else if (o.coyote > 0) o.coyote--;
                        if (jumpPressed && o.coyote > 0) { o.vy = -T.jump; o.coyote = 0; o.onground = false; jumped(R, o); }
                        if (o.vy < 0 && !held(R, BTN.a) && !held(R, BTN.up)) o.vy += o.gravity;   // short hop on release
                    }
                }
                break;
            }
            case 'grid': {
                if (!o.mv) {
                    let [dx, dy] = heldDir(R);
                    if (dx && dy) dy = 0;
                    if (dx || dy) {
                        o.fx = dx; o.fy = dy;
                        const hb = T.hb;
                        // a hop lines the frog up with the row or column it lands in
                        if (dx) {
                            const c = Math.round((o.x) / TS) + dx;
                            const cy = Math.floor((o.y + hb.y + hb.h / 2) / TS);
                            if (!T.walls || cellFree(R, o, c, cy)) { o.mv = { ax: 'x', to: c * TS, fix: cy * TS }; }
                        } else {
                            const c = Math.round(o.y / TS) + dy;
                            const cx = Math.floor((o.x + hb.x + hb.w / 2) / TS);
                            if (!T.walls || cellFree(R, o, cx, c)) { o.mv = { ax: 'y', to: c * TS, fix: cx * TS }; }
                        }
                        if (o.mv) hopped(R, o);
                    }
                }
                o.vx = 0; o.vy = 0;
                if (o.mv) {
                    // mid-hop, the other axis stays on its row or column (a log can't drag it into a wall)
                    if (o.mv.ax === 'x') o.y = o.mv.fix; else o.x = o.mv.fix;
                    const k = o.mv.ax, d = o.mv.to - o[k];
                    const s = Math.max(0.5, sp);
                    if (Math.abs(d) <= s) { o[k] = o.mv.to; o.mv = null; }
                    else if (k === 'x') o.vx = Math.sign(d) * s; else o.vy = Math.sign(d) * s;
                }
                break;
            }
            case 'maze': case 'chase': {
                if (T.control === 'maze') {
                    const pd = pressedDir(R);
                    if (pd) o.want = pd;
                    else {
                        const [dx, dy] = heldDir(R);
                        if (dx > 0) o.want = 1; else if (dx < 0) o.want = 3; else if (dy > 0) o.want = 2; else if (dy < 0) o.want = 4;
                    }
                }
                if (aligned(o)) {
                    o.x = Math.round(o.x / TS) * TS; o.y = Math.round(o.y / TS) * TS;
                    const cx = Math.round(o.x / TS), cy = Math.round(o.y / TS);
                    const free = (d) => { const [dx, dy] = dirVec(d); return cellFree(R, o, cx + dx, cy + dy); };
                    if (T.control === 'chase') {
                        const tg = target(R);
                        const back = o.dir ? ((o.dir + 1) % 4) + 1 : 0;
                        const opts = [1, 2, 3, 4].filter((d) => d !== back && free(d));
                        if (!opts.length && back && free(back)) opts.push(back);
                        if (opts.length) {
                            if (tg && rand(R) > 0.2) {
                                let best = opts[0], bd = Infinity;
                                for (const d of opts) {
                                    const [dx, dy] = dirVec(d);
                                    const dd = ((cx + dx) * TS - tg.x) ** 2 + ((cy + dy) * TS - tg.y) ** 2;
                                    if (dd < bd) { bd = dd; best = d; }
                                }
                                o.dir = best;
                            } else o.dir = opts[Math.floor(rand(R) * opts.length)];
                        } else o.dir = 0;
                    } else {
                        if (o.want && free(o.want)) o.dir = o.want;
                        if (o.dir && !free(o.dir)) o.dir = 0;
                    }
                } else if (T.control === 'maze' && o.want && o.dir && ((o.want + 1) % 4) + 1 === o.dir) {
                    o.dir = o.want;    // reverse at any time
                }
                if (o.dir) { const [dx, dy] = dirVec(o.dir); o.fx = dx; o.fy = dy; }
                laneStep(o, o.dir, sp);
                break;
            }
            case 'homing': {
                const tg = target(R);
                if (tg) {
                    const dx = tg.x - o.x, dy = tg.y - o.y, d = Math.hypot(dx, dy) || 1;
                    o.vx = (dx / d) * sp; o.vy = (dy / d) * sp;
                    o.fx = Math.sign(dx);
                }
                break;
            }
            case 'patrol': {
                if (!o.fx) o.fx = 1;
                if (T.ledge && o.onground) {
                    const hb = T.hb;
                    const ax = o.fx > 0 ? o.x + hb.x + hb.w + 1 : o.x + hb.x - 1;
                    const below = boxFlags(R, ax, o.y + hb.y + hb.h + 1, 1, 2);
                    if (!(below & (FLAG.solid | FLAG.oneway))) o.fx = -o.fx;
                }
                o.vx = o.fx * sp;
                break;
            }
            case 'wander': {
                if (--o.wanderT <= 0) {
                    o.wanderT = 40 + Math.floor(rand(R) * 80);
                    const d = Math.floor(rand(R) * 5);
                    const [dx, dy] = d < 4 ? DIRS[d] : [0, 0];
                    o.vx = dx * sp; o.vy = dy * sp;
                    if (dx || dy) { o.fx = dx; o.fy = dy; }
                }
                break;
            }
        }
    }
    function jumped(R, o) { R.events.push({ type: 'jump', id: o.id }); }
    function hopped(R, o) { R.events.push({ type: 'hop', id: o.id }); }

    // ------------------------------------------------------------------ the frame
    V.stepRun = (R, btn) => {
        R.prev = R.btn;
        R.btn = btn | 0;
        R.frame++;
        R.ops = 0;
        if (R.msg && --R.msg.t <= 0) R.msg = null;
        if (R.shake > 0) R.shake--;
        if (R.status !== 'run') { R.overT++; return; }
        R.stats.frames++;
        R.contacts = [];
        R.landed = [];
        R.hasSolid = R.objs.some((o) => o.T.solid && !o.dead);
        try {
            const G = R.P.game.handlers;
            R.who = 'game';
            if (G.update) V.runHandler(R, G.update, null);
            // button presses: `on press a` in the game script and in every object
            const nowPressed = [];
            for (const k in BTN) if (pressed(R, BTN[k])) nowPressed.push(k);
            if (nowPressed.length) {
                if (G.press) for (const h of G.press) if (nowPressed.includes(h.arg)) { R.who = 'game'; V.runHandler(R, h, null); }
                for (const o of R.objs.slice()) {
                    const hs = o.T.prog.handlers.press;
                    if (!hs || o.dead) continue;
                    for (const h of hs) if (!o.dead && nowPressed.includes(h.arg)) { R.who = o.type; V.runHandler(R, h, o); }
                }
            }
            for (const o of R.objs.slice()) {
                if (o.dead || R.pendingLevel >= 0 || R.pendingRestart || R.status !== 'run') continue;
                updateObj(R, o);
            }
            if (R.status === 'run') collide(R);
            for (const o of R.landed) if (!o.dead && R.status === 'run') { R.who = o.type; V.runHandler(R, o.T.prog.handlers.land, o); }
            R.objs = R.objs.filter((o) => !o.dead);
            if (R.player && R.player.dead) R.player = null;
            if (R.pendingRestart) {
                R.pendingRestart = false;
                const fresh = V.restartRun(R);
                Object.assign(R, fresh, { events: R.events.concat(fresh.events), stats: R.stats });
                return;
            }
            if (R.pendingLevel >= 0 && R.status === 'run') {
                const n = R.pendingLevel;
                R.pendingLevel = -1;
                R.stats.levels = Math.max(R.stats.levels, n + 1);
                loadLevel(R, n, false);
                R.events.push({ type: 'level', n });
            }
            afterFrame(R);
        } catch (err) { fail(R, err); }
    };

    function afterFrame(R) {
        updateCamera(R);
        const m = R.stats.maxG;
        for (const k in R.globals) {
            const v = R.globals[k];
            if (typeof v === 'number' && !(m[k] >= v)) m[k] = v;
        }
    }

    function updateObj(R, o) {
        const T = o.T, h = T.prog.handlers;
        o.timer++;
        if (o.blink > 0) o.blink--;
        control(R, o);
        if (h.update) { R.who = o.type; V.runHandler(R, h.update, o); if (o.dead) return; }
        if (o.gravity && !o.climbing) o.vy = Math.min(o.vy + o.gravity, 5);
        const wasGround = o.onground;
        if (o.gravity) o.onground = false;
        moveObj(R, o, o.vx, o.vy);
        if (o.dead) return;
        if (o.gravity && !o.onground && wasGround && o.vy >= 0) {
            // stepping off a ledge, or standing still: check the floor directly under the feet
            const hb = T.hb;
            if (blocker(R, o, o.x + hb.x, o.y + hb.y + 0.5, hb.w, hb.h, 0.5, o.y + hb.y + hb.h)) o.onground = true;
        }
        edges(R, o);
        if (o.dead) return;
        // animation and facing
        if (T.frames.length > 1) {
            const moving = Math.abs(o.vx) + Math.abs(o.vy) > 0.01;
            if (!T.animMove || moving) {
                if (++o.anim >= T.anim) { o.anim = 0; o.frame = (o.frame + 1) % T.frames.length; }
            } else { o.frame = 0; o.anim = 0; }
            o.spr = T.frames[Math.min(o.frame, T.frames.length - 1) | 0];
        }
        if (T.autoflip && o.fx) o.flipx = o.fx < 0;
        // tiles under it
        const cell = cellOf(o);
        if (cell !== o.cell) {
            o.cell = cell;
            if (h.enter) {
                const cy = Math.floor(cell / 4096), cx = cell - cy * 4096;
                R.who = o.type;
                V.runHandler(R, h.enter, o, [cx, cy, tileAt(R, cx, cy)]);
                if (o.dead) return;
            }
        }
        if (h.hazard) {
            const b = box(o);
            if (boxFlags(R, b.x + 1, b.y + 1, Math.max(1, b.w - 2), Math.max(1, b.h - 2)) & FLAG.hazard) {
                R.who = o.type;
                V.runHandler(R, h.hazard, o);
            }
        }
    }

    function overlap(a, b) {
        const ha = a.T.hb, hb = b.T.hb;
        const ax = a.x + ha.x, ay = a.y + ha.y, bx = b.x + hb.x, by = b.y + hb.y;
        return ax < bx + hb.w && ax + ha.w > bx && ay < by + hb.h && ay + ha.h > by;
    }
    V.overlap = overlap;

    function fireHit(R, a, b) {
        const hs = a.T.prog.handlers.hit;
        if (!hs) return;
        for (const h of hs) {
            if (a.dead || b.dead || R.status !== 'run' || R.pendingLevel >= 0 || R.pendingRestart) return;
            if (h.arg && h.arg !== b.type) continue;
            R.who = a.type;
            V.runHandler(R, h, a, [b]);
        }
    }

    function collide(R) {
        const list = R.objs.filter((o) => !o.dead);
        const done = new Set();
        const n = list.length;
        for (let i = 0; i < n; i++) {
            const a = list[i];
            for (let j = i + 1; j < n; j++) {
                const b = list[j];
                if (!a.T.hasHit && !b.T.hasHit) continue;
                if (a.dead) break;
                if (b.dead || !overlap(a, b)) continue;
                done.add(Math.min(a.id, b.id) * 100000 + Math.max(a.id, b.id));
                fireHit(R, a, b);
                fireHit(R, b, a);
                if (R.status !== 'run' || R.pendingLevel >= 0 || R.pendingRestart) return;
            }
        }
        for (const [a, b] of R.contacts) {
            const k = Math.min(a.id, b.id) * 100000 + Math.max(a.id, b.id);
            if (done.has(k) || a.dead || b.dead) continue;
            done.add(k);
            fireHit(R, a, b);
            fireHit(R, b, a);
            if (R.status !== 'run' || R.pendingLevel >= 0 || R.pendingRestart) return;
        }
    }

    function updateCamera(R) {
        const cart = R.P.cart;
        const MW = R.map.w * TS, MH = R.map.h * TS;
        let f = R.follow;
        if (!f && !R.camFixed && cart.camera.follow) {
            f = R.objs.find((o) => !o.dead && o.type === cart.camera.follow) || null;
        }
        if (f) {
            const b = box(f);
            R.cam.x = Math.round(b.x + b.w / 2 - V.W / 2);
            R.cam.y = Math.round(b.y + b.h / 2 - V.H / 2);
        }
        R.cam.x = Math.max(0, Math.min(MW - V.W, R.cam.x));
        R.cam.y = Math.max(0, Math.min(MH - V.H, R.cam.y));
        if (MW < V.W) R.cam.x = -Math.floor((V.W - MW) / 2);
        if (MH < V.H) R.cam.y = -Math.floor((V.H - MH) / 2);
    }

    /** A copy of a run that can be stepped without touching the original: for bots that look ahead. */
    V.cloneRun = (R) => {
        const m = new Map();
        const objs = R.objs.map((o) => { const c = { ...o, vars: { ...o.vars }, mv: o.mv ? { ...o.mv } : null }; m.set(o, c); return c; });
        const remap = (v) => (v && typeof v === 'object' && m.has(v) ? m.get(v) : v);
        for (const c of objs) for (const k in c.vars) c.vars[k] = remap(c.vars[k]);
        const globals = {};
        for (const k in R.globals) globals[k] = remap(R.globals[k]);
        const st = R.stats;
        return {
            ...R, objs, globals, map: { ...R.map, t: R.map.t.slice() }, cam: { ...R.cam }, events: [], log: [],
            msg: R.msg ? { ...R.msg } : null, player: R.player ? remap(R.player) : null, follow: R.follow ? remap(R.follow) : null,
            stats: { ...st, maxG: { ...st.maxG }, spawned: { ...st.spawned }, destroyed: { ...st.destroyed } },
        };
    };

    // ------------------------------------------------------------------ drawing
    function shakeOffset(R) {
        if (R.shake <= 0) return [0, 0];
        const h = Math.imul(R.frame, 2654435761) >>> 0;
        const k = Math.min(3, 1 + (R.shake >> 3));
        return [((h & 7) % (2 * k + 1)) - k, (((h >> 3) & 7) % (2 * k + 1)) - k];
    }

    V.drawMap = (fb, sheet, map, camx, camy, bg) => {
        const x0 = Math.floor(camx / TS), y0 = Math.floor(camy / TS);
        for (let cy = y0; cy <= y0 + V.H / TS + 1; cy++) {
            if (cy < 0 || cy >= map.h) continue;
            for (let cx = x0; cx <= x0 + V.W / TS + 1; cx++) {
                if (cx < 0 || cx >= map.w) continue;
                const t = map.t[cy * map.w + cx];
                if (t) V.spr(fb, sheet, t, cx * TS - camx, cy * TS - camy, false, false);
            }
        }
        void bg;
    };

    function drawObj(R, o, ox, oy) {
        if (!o.visible || (o.blink > 0 && (o.blink >> 2) % 2 === 0)) return;
        const T = o.T, fb = R.fb, sheet = R.P.sheet;
        const x = Math.floor(o.x - ox), y = Math.floor(o.y - oy);
        if (x > V.W || y > V.H || x + T.sw * TS < 0 || y + T.sh * TS < 0) return;
        for (let j = 0; j < T.sh; j++) for (let i = 0; i < T.sw; i++) {
            const ii = o.flipx ? T.sw - 1 - i : i, jj = o.flipy ? T.sh - 1 - j : j;
            V.spr(fb, sheet, o.spr, x + ii * TS, y + jj * TS, o.flipx, o.flipy);
        }
    }

    function wrapText(s, maxChars) {
        const words = String(s).split(/\s+/), lines = [];
        let cur = '';
        for (const w of words) {
            if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; }
            else cur = (cur + ' ' + w).trim();
        }
        if (cur) lines.push(cur);
        return lines;
    }
    V.wrapText = wrapText;

    function banner(fb, lines, c1, c2, y) {
        const w = Math.max(...lines.map((l) => V.textWidth(l))) + 12;
        const h = lines.length * 7 + 8;
        const x = Math.floor((V.W - w) / 2);
        y = y === undefined ? Math.floor((V.H - h) / 2) : y;
        V.rectfill(fb, x, y, w, h, 0);
        V.rect(fb, x, y, w, h, c1);
        lines.forEach((l, i) => V.text(fb, l, Math.floor((V.W - V.textWidth(l)) / 2), y + 5 + i * 7, i === 0 ? c1 : c2));
    }

    V.drawRun = (R) => {
        const fb = R.fb, P = R.P, cart = P.cart;
        V.resetClip();
        V.cls(fb, cart.bg);
        if (!R.map) { drawOverlay(R); return; }
        const [sx, sy] = shakeOffset(R);
        const ox = R.cam.x + sx, oy = R.cam.y + sy;
        V.drawMap(fb, P.sheet, R.map, ox, oy, cart.bg);
        const order = R.objs.slice().sort((a, b) => a.ti - b.ti || a.id - b.id);
        for (const o of order) {
            if (o.dead) continue;
            drawObj(R, o, ox, oy);
            const h = o.T.prog.handlers.draw;
            if (h && R.status !== 'error') {
                R.drawing = { ox, oy };
                try { R.who = o.type; R.ops = 0; V.runHandler(R, h, o); } catch (err) { fail(R, err); }
                R.drawing = null;
            }
        }
        const G = P.game.handlers;
        if (G.draw && R.status !== 'error') {
            R.drawing = { ox: 0, oy: 0 };
            try { R.who = 'game'; R.ops = 0; V.runHandler(R, G.draw, null); } catch (err) { fail(R, err); }
            R.drawing = null;
        }
        if (cart.hud.score) V.textOutlined(fb, 'SCORE ' + Math.floor(V.num(R.globals.score) || 0), 3, 3, 3, 0);
        if (cart.hud.lives) {
            const n = Math.max(0, Math.min(12, Math.floor(V.num(R.globals.lives) || 0)));
            for (let i = 0; i < n; i++) V.textOutlined(fb, '♥', V.W - 7 - i * 6, 3, 4, 0);
        }
        drawOverlay(R);
    };

    function drawOverlay(R) {
        const fb = R.fb;
        if (R.msg) {
            const lines = wrapText(R.msg.text, 36).slice(0, 4);
            const h = lines.length * 7 + 6;
            V.rectfill(fb, 4, V.H - h - 4, V.W - 8, h, 1);
            V.rect(fb, 4, V.H - h - 4, V.W - 8, h, 3);
            lines.forEach((l, i) => V.text(fb, l, 8, V.H - h + i * 7, 3));
        }
        if (R.status === 'win') banner(fb, ['YOU WIN!', 'SCORE ' + Math.floor(V.num(R.globals.score) || 0), R.overT > 40 ? 'PRESS A' : ''], 6, 3);
        else if (R.status === 'lose') banner(fb, ['GAME OVER', 'SCORE ' + Math.floor(V.num(R.globals.score) || 0), R.overT > 40 ? 'PRESS A' : ''], 4, 3);
        else if (R.status === 'error' && R.err) {
            const e = R.err;
            const lines = ['SCRIPT ERROR', (e.who === 'game' ? 'GAME SCRIPT' : e.who.toUpperCase()) + (e.line ? ' LINE ' + e.line : '')]
                .concat(wrapText(e.msg, 34).slice(0, 6));
            V.rectfill(fb, 0, 0, V.W, V.H, 1);
            lines.forEach((l, i) => V.text(fb, l, 6, 8 + i * 8, i === 0 ? 4 : 3));
        }
    }

    /** A still frame of a level as placed, without running any script: for editor previews. */
    V.previewFrame = (P, li, camx = 0, camy = 0, fb) => {
        fb = fb || V.makeFB();
        const L = P.cart.levels[li] || P.cart.levels[0];
        const map = { w: L.w, h: L.h, t: new Uint8Array(L.w * L.h) };
        for (let i = 0; i < L.w * L.h; i++) map.t[i] = TILEIDX[L.tiles[i]] || 0;
        V.resetClip();
        V.cls(fb, P.cart.bg);
        V.drawMap(fb, P.sheet, map, camx, camy);
        for (const p of L.objs) {
            const ti = P.typeIdx[p.t];
            if (ti === undefined) continue;
            const T = P.types[ti];
            for (let j = 0; j < T.sh; j++) for (let i = 0; i < T.sw; i++) V.spr(fb, P.sheet, T.frames[0], p.x - camx + i * TS, p.y - camy + j * TS);
        }
        return fb;
    };

    // ------------------------------------------------------------------ built-in functions
    // Each takes (F, ...args): F.R is the run, F.me the object running the script (null in the game script).
    const need = (F, what) => {
        if (!F.me) throw V.VErr(`${what} needs an object — use it in an object's script, or pass one`, F.R.line);
        return F.me;
    };
    const objArg = (F, o, what) => {
        if (o === undefined) return need(F, what);
        if (o == null || typeof o !== 'object') throw V.VErr(`${what} needs an object but got ${V.str(o)}`, F.R.line);
        return o;
    };
    const typeArg = (F, t, what) => {
        if (typeof t !== 'string') throw V.VErr(`${what} needs a type name in quotes, like "enemy"`, F.R.line);
        if (!(t in F.R.P.typeIdx)) throw V.VErr(`there is no object type called "${t}"`, F.R.line);
        return t;
    };
    const drawing = (F, what) => {
        if (!F.R.drawing) throw V.VErr(`${what}() only works inside "on draw"`, F.R.line);
        return F.R.drawing;
    };
    const N = (v) => V.num(v, 0);
    const col = (c, d) => (c === undefined ? d : Math.floor(N(c)) & 15);
    const deg = Math.PI / 180;
    const btnMask = (F, name) => {
        const m = BTN[String(name).toLowerCase()];
        if (!m) throw V.VErr(`"${name}" is not a button: use left, right, up, down, a or b`, F.R.line);
        return m;
    };

    V.BUILTINS = {
        // input
        btn: (F, b) => held(F.R, btnMask(F, b)),
        btnp: (F, b) => pressed(F.R, btnMask(F, b)),
        // objects
        spawn: (F, t, x, y) => {
            const R = F.R;
            typeArg(F, t, 'spawn()');
            const me = F.me;
            const o = makeObj(R, R.P.typeIdx[t], x === undefined && me ? me.x : N(x), y === undefined && me ? me.y : N(y));
            if (me) { o.fx = me.fx; o.fy = me.fy; }
            const who = R.who;
            startObj(R, o);
            R.who = who;
            return o;
        },
        destroy: (F, o) => { destroy(F.R, objArg(F, o, 'destroy()')); return null; },
        count: (F, t) => { typeArg(F, t, 'count()'); let n = 0; for (const o of F.R.objs) if (!o.dead && o.type === t) n++; return n; },
        all: (F, t) => { typeArg(F, t, 'all()'); return F.R.objs.filter((o) => !o.dead && o.type === t); },
        first: (F, t) => { typeArg(F, t, 'first()'); return F.R.objs.find((o) => !o.dead && o.type === t) || null; },
        nearest: (F, t) => {
            typeArg(F, t, 'nearest()');
            const me = need(F, 'nearest()');
            let best = null, bd = Infinity;
            for (const o of F.R.objs) {
                if (o.dead || o === me || o.type !== t) continue;
                const d = (o.x - me.x) ** 2 + (o.y - me.y) ** 2;
                if (d < bd) { bd = d; best = o; }
            }
            return best;
        },
        touching: (F, t) => {
            typeArg(F, t, 'touching()');
            const me = need(F, 'touching()');
            for (const o of F.R.objs) if (!o.dead && o !== me && o.type === t && overlap(me, o)) return o;
            return null;
        },
        dist: (F, a, b, c, d) => {
            if (typeof a === 'object' && a) {
                const o2 = b === undefined ? need(F, 'dist()') : objArg(F, b, 'dist()');
                return Math.hypot(a.x - o2.x, a.y - o2.y);
            }
            return Math.hypot(N(c) - N(a), N(d) - N(b));
        },
        move: (F, dx, dy) => { const me = need(F, 'move()'); moveObj(F.R, me, N(dx), N(dy)); return null; },
        stop: (F, o) => { const me = objArg(F, o, 'stop()'); me.vx = 0; me.vy = 0; me.mv = null; me.dir = 0; return null; },
        home: (F, o) => { const me = objArg(F, o, 'home()'); me.x = me.sx; me.y = me.sy; me.vx = me.vy = 0; me.mv = null; me.dir = 0; me.climbing = false; return null; },
        towards: (F, o, sp) => {
            const me = need(F, 'towards()');
            if (!o) return null;
            const dx = o.x - me.x, dy = o.y - me.y, d = Math.hypot(dx, dy) || 1, s = sp === undefined ? me.speed : N(sp);
            me.vx = (dx / d) * s; me.vy = (dy / d) * s;
            return null;
        },
        aim: (F, o) => { const me = need(F, 'aim()'); if (!o) return 0; return Math.atan2(o.y - me.y, o.x - me.x) / deg; },
        vel: (F, a, sp) => { const me = need(F, 'vel()'); const s = sp === undefined ? me.speed : N(sp); me.vx = Math.cos(N(a) * deg) * s; me.vy = Math.sin(N(a) * deg) * s; return null; },
        hurt: (F, n, o) => {
            const me = objArg(F, o, 'hurt()');
            me.hp -= n === undefined ? 1 : N(n);
            if (me.hp <= 0) destroy(F.R, me);
            return me.hp;
        },
        blink: (F, n, o) => { const me = objArg(F, o, 'blink()'); me.blink = Math.max(0, Math.floor(N(n === undefined ? 60 : n))); return null; },
        blinking: (F, o) => objArg(F, o, 'blinking()').blink > 0,
        // tiles
        tile: (F, cx, cy) => tileAt(F.R, Math.floor(N(cx)), Math.floor(N(cy))),
        tileat: (F, x, y) => tileAt(F.R, Math.floor(N(x) / TS), Math.floor(N(y) / TS)),
        settile: (F, cx, cy, id) => {
            const R = F.R, x = Math.floor(N(cx)), y = Math.floor(N(cy));
            if (x < 0 || y < 0 || x >= R.map.w || y >= R.map.h) return null;
            R.map.t[y * R.map.w + x] = Math.floor(N(id)) & 63;
            return null;
        },
        counttiles: (F, id) => { const t = Math.floor(N(id)); let n = 0; for (const v of F.R.map.t) if (v === t) n++; return n; },
        fget: (F, id, name) => {
            const bit = FLAG[String(name).toLowerCase()];
            if (!bit) throw V.VErr(`"${name}" is not a flag: use solid, hazard, ladder or oneway`, F.R.line);
            return (F.R.P.flags[Math.floor(N(id)) & 63] & bit) !== 0;
        },
        cell: (F, v) => Math.floor(N(v) / TS),
        // flow
        win: (F) => { const R = F.R; if (R.status === 'run') { R.status = 'win'; R.overT = 0; R.stats.wins++; R.events.push({ type: 'win' }); } return null; },
        lose: (F) => { const R = F.R; if (R.status === 'run') { R.status = 'lose'; R.overT = 0; R.stats.losses++; R.events.push({ type: 'lose' }); } return null; },
        restart: (F) => { F.R.pendingRestart = true; return null; },
        nextlevel: (F) => {
            const R = F.R;
            if (R.level + 1 >= R.P.cart.levels.length) return V.BUILTINS.win(F);
            R.pendingLevel = R.level + 1;
            return null;
        },
        gotolevel: (F, n) => {
            const R = F.R, i = Math.floor(N(n)) - 1;
            if (i < 0 || i >= R.P.cart.levels.length) throw V.VErr(`there is no level ${N(n)}`, R.line);
            R.pendingLevel = i;
            return null;
        },
        say: (F, s, frames) => {
            const R = F.R;
            R.msg = { text: V.str(s), t: frames === undefined ? 150 : Math.max(1, Math.floor(N(frames))) };
            R.stats.says++;
            R.events.push({ type: 'say', text: R.msg.text });
            return null;
        },
        // sound
        sfx: (F, n) => { F.R.events.push({ type: 'sfx', n: Math.floor(N(n)) & 7 }); return null; },
        music: (F, on) => { F.R.musicOn = on === undefined ? true : V.truthy(on); F.R.events.push({ type: 'music', on: F.R.musicOn }); return null; },
        shake: (F, n) => { F.R.shake = Math.max(F.R.shake, Math.floor(N(n === undefined ? 12 : n))); return null; },
        // camera
        camera: (F, x, y) => { const R = F.R; R.camFixed = true; R.follow = null; R.cam.x = Math.floor(N(x)); R.cam.y = Math.floor(N(y)); return null; },
        follow: (F, o) => { const R = F.R; R.follow = objArg(F, o, 'follow()'); R.camFixed = false; return null; },
        camx: (F) => F.R.cam.x,
        camy: (F) => F.R.cam.y,
        // drawing (inside on draw)
        text: (F, s, x, y, c) => { const d = drawing(F, 'text'); return V.text(F.R.fb, V.str(s), N(x) - d.ox, N(y) - d.oy, col(c, 3)); },
        rect: (F, x, y, w, h, c) => { const d = drawing(F, 'rect'); V.rect(F.R.fb, N(x) - d.ox, N(y) - d.oy, N(w), N(h), col(c, 3)); return null; },
        rectfill: (F, x, y, w, h, c) => { const d = drawing(F, 'rectfill'); V.rectfill(F.R.fb, N(x) - d.ox, N(y) - d.oy, N(w), N(h), col(c, 3)); return null; },
        circ: (F, x, y, r, c) => { const d = drawing(F, 'circ'); V.circ(F.R.fb, N(x) - d.ox, N(y) - d.oy, N(r), col(c, 3), false); return null; },
        circfill: (F, x, y, r, c) => { const d = drawing(F, 'circfill'); V.circ(F.R.fb, N(x) - d.ox, N(y) - d.oy, N(r), col(c, 3), true); return null; },
        line: (F, x1, y1, x2, y2, c) => { const d = drawing(F, 'line'); V.line(F.R.fb, N(x1) - d.ox, N(y1) - d.oy, N(x2) - d.ox, N(y2) - d.oy, col(c, 3)); return null; },
        pset: (F, x, y, c) => { const d = drawing(F, 'pset'); V.pset(F.R.fb, N(x) - d.ox, N(y) - d.oy, col(c, 3)); return null; },
        sprite: (F, n, x, y, fx) => { const d = drawing(F, 'sprite'); V.spr(F.R.fb, F.R.P.sheet, Math.floor(N(n)), N(x) - d.ox, N(y) - d.oy, V.truthy(fx), false); return null; },
        // maths
        rnd: (F, n) => rand(F.R) * (n === undefined ? 1 : N(n)),
        rndi: (F, a, b) => { const lo = Math.ceil(N(a)), hi = Math.floor(N(b)); return lo + Math.floor(rand(F.R) * (hi - lo + 1)); },
        chance: (F, p) => rand(F.R) < N(p),
        choose: (F, ...xs) => (xs.length ? xs[Math.floor(rand(F.R) * xs.length)] : null),
        flr: (F, v) => Math.floor(N(v)),
        ceil: (F, v) => Math.ceil(N(v)),
        round: (F, v) => Math.round(N(v)),
        abs: (F, v) => Math.abs(N(v)),
        min: (F, a, b) => Math.min(N(a), N(b)),
        max: (F, a, b) => Math.max(N(a), N(b)),
        clamp: (F, v, a, b) => Math.max(N(a), Math.min(N(b), N(v))),
        sign: (F, v) => Math.sign(N(v)),
        sqrt: (F, v) => Math.sqrt(Math.max(0, N(v))),
        sin: (F, a) => Math.sin(N(a) * deg),
        cos: (F, a) => Math.cos(N(a) * deg),
        atan2: (F, y, x) => Math.atan2(N(y), N(x)) / deg,
        time: (F) => F.R.stats.frames / 60,
        frames: (F) => F.R.stats.frames,
        str: (F, v) => V.str(v),
        len: (F, s) => V.str(s).length,
        print: (F, ...xs) => { const R = F.R; R.log.push(`[${R.who}:${R.line}] ` + xs.map(V.str).join(' ')); if (R.log.length > 50) R.log.shift(); return null; },
    };
    // A short description of every built-in, for the Codex and the editor's snippet list.
    V.BUILTIN_DOCS = [
        ['Input', [
            ['btn("left")', 'true while a button is held: left right up down a b'],
            ['btnp("a")', 'true only on the frame a button goes down'],
        ]],
        ['Objects', [
            ['spawn("bullet", x, y)', 'make a new object; returns it'],
            ['destroy(other)', 'remove an object (yourself if you leave it out)'],
            ['count("enemy")', 'how many there are'],
            ['all("enemy")', 'a list for "for e in all(…) do"'],
            ['first("hero")', 'the first one, or nil'],
            ['nearest("coin")', 'the closest one to me, or nil'],
            ['touching("ladder")', 'one I overlap right now, or nil'],
            ['dist(a, b)', 'distance between two objects'],
            ['move(dx, dy)', 'move me, stopping at walls'],
            ['stop()', 'zero my speed'],
            ['home()', 'back to where I started this level'],
            ['towards(o, speed)', 'aim my velocity at o'],
            ['aim(o)', 'the angle from me to o, in degrees'],
            ['vel(angle, speed)', 'set my velocity from an angle'],
            ['hurt(1)', 'lose hp; destroyed at 0. Returns hp left'],
            ['blink(60)', 'flicker for a number of frames'],
            ['blinking()', 'true while I flicker (handy for mercy time)'],
        ]],
        ['Tiles', [
            ['tile(cx, cy)', 'the sprite number at a map cell'],
            ['tileat(x, y)', 'the tile under a pixel position'],
            ['settile(cx, cy, n)', 'change a map cell (0 clears it)'],
            ['counttiles(n)', 'how many cells hold sprite n'],
            ['fget(n, "solid")', 'is a flag set on sprite n'],
            ['cell(x)', 'pixels → map cell: flr(x / 8)'],
        ]],
        ['Game', [
            ['win()', 'you win!'],
            ['lose()', 'game over'],
            ['restart()', 'start the whole game again'],
            ['nextlevel()', 'go to the next level (or win after the last)'],
            ['gotolevel(2)', 'jump to a level'],
            ['say("Hello!")', 'show a message box for a while'],
            ['sfx(0)', 'play sound 0 to 7'],
            ['music(true)', 'start or stop the music'],
            ['shake(12)', 'shake the screen'],
            ['camera(x, y)', 'fix the camera'],
            ['follow(me)', 'make the camera follow an object'],
        ]],
        ['Drawing (on draw)', [
            ['text("HI", x, y, 3)', 'write text in colour 3'],
            ['rect(x, y, w, h, c)', 'a box outline'],
            ['rectfill(x, y, w, h, c)', 'a filled box'],
            ['circ(x, y, r, c)', 'a circle; circfill fills it'],
            ['line(x1, y1, x2, y2, c)', 'a line'],
            ['pset(x, y, c)', 'one pixel'],
            ['sprite(n, x, y)', 'draw a sprite'],
        ]],
        ['Maths', [
            ['rnd(10)', 'a random number from 0 up to 10'],
            ['rndi(1, 6)', 'a random whole number, both ends included'],
            ['chance(0.1)', 'true one time in ten'],
            ['choose(-1, 1)', 'one of the values, at random'],
            ['flr(v) ceil(v) round(v)', 'rounding'],
            ['abs min max clamp sign sqrt', 'the usual'],
            ['sin(a) cos(a) atan2(y, x)', 'angles in degrees'],
            ['time()', 'seconds since the game started'],
            ['print(v)', 'write to the console under the code editor'],
        ]],
    ];
}
