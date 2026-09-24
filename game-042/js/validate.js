// ============================================================
// Reachability, measured with the real player physics.
//
// From every place Pip can stand, run a set of input programs (walks,
// edge jumps, standing jumps of four heights, double jumps, a reactive
// wall-climb, a ground pound) through stepPlayer() on the real tile map,
// and record where Pip lands and every cell Pip's body passes through.
// BFS over landing spots gives the set of cells reachable with a given
// set of gadgets.
//
// Deliberately conservative: bricks are solid (though Pip can break them),
// enemies can't be used as stepping stones, hidden blocks are treated as
// one-way ledges. Lift tracks count as one-way bridges.
// ============================================================

import { TILE, STEP, PHYS } from './config.js';
import { T, K } from './tiles.js';
import { stepPlayer, newPlayerBody } from './physics.js';

function kindFor(t, ab) {
    switch (t) {
        case T.GROUND: case T.BRICK: case T.QBLOCK: case T.USED: case T.HARD: case T.CEIL:
        case T.PIPE_TL: case T.PIPE_TR: case T.PIPE_L: case T.PIPE_R: case T.ICE:
            return K.SOLID;
        case T.RED: return ab.rocket ? K.EMPTY : K.SOLID;
        case T.BUBBLE: return ab.frost ? K.SOLID : K.EMPTY;
        case T.CRACK: case T.HIDDEN: case T.ONEWAY: return K.ONEWAY;
        case T.SPRING: return K.SPRING;
        default: return K.EMPTY;
    }
}

function hazard(t) { return t === T.SPIKE || t === T.LAVA || t === T.LAVA_FILL; }

/**
 * @param level  a generated level
 * @param gadgets  Set or array of gadget names ('boots','frost','mitts','rocket')
 * @returns { visited: Uint8Array(w*h), nodes: number, steps: number }
 */
export function reach(level, gadgets) {
    const gs = new Set(gadgets);
    const ab = { boots: gs.has('boots'), frost: gs.has('frost'), mitts: gs.has('mitts'), rocket: gs.has('rocket') };
    const { w, h, tiles } = level;
    const kinds = new Uint8Array(w * h);
    const haz = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { kinds[i] = kindFor(tiles[i], ab); haz[i] = hazard(tiles[i]) ? 1 : 0; }
    for (const [x, y] of level.liftCells || []) if (x >= 0 && x < w && y >= 0 && y < h && kinds[y * w + x] === K.EMPTY) kinds[y * w + x] = K.ONEWAY;

    let poundMode = false;
    const env = {
        w, h, rects: [],
        kind(tx, ty) {
            const k = kinds[ty * w + tx];
            if (poundMode && tiles[ty * w + tx] === T.CRACK) return K.EMPTY;
            return k;
        },
    };

    const visited = new Uint8Array(w * h);
    const nodeSeen = new Uint8Array(w * h);
    const queue = [];
    let steps = 0;

    const cellOf = p => [Math.floor((p.x + p.w / 2) / TILE), Math.floor((p.y + p.h - 1) / TILE)];
    const addNode = (p) => {
        const [cx, cy] = cellOf(p);
        if (cx < 0 || cx >= w || cy < 0 || cy >= h) return;
        const i = cy * w + cx;
        if (nodeSeen[i]) return;
        nodeSeen[i] = 1;
        queue.push({ x: p.x, y: p.y, cx, cy });
    };
    const standable = (cx, cy) => {
        if (cx < 0 || cx >= w || cy < 0 || cy + 1 >= h) return false;
        const below = kinds[(cy + 1) * w + cx];
        return kinds[cy * w + cx] === K.EMPTY && (below === K.SOLID || below === K.ONEWAY) && !haz[cy * w + cx];
    };

    const inp = { left: false, right: false, up: false, down: false, downPressed: false, jump: false, jumpPressed: false };

    // program: (f, p, st) -> sets inp. st is per-run scratch state.
    function run(node, prog, maxF) {
        const p = newPlayerBody(node.x, node.y);
        p.onGround = true;
        p.vx = prog.vx0 || 0;
        const st = { jumped: false, pressAt: -99, leftGround: false, second: -1 };
        poundMode = false;
        for (let f = 0; f < maxF; f++) {
            inp.left = inp.right = inp.down = inp.downPressed = inp.jump = inp.jumpPressed = false;
            prog.input(f, p, st);
            const fx = stepPlayer(p, inp, STEP, env, ab);
            steps++;
            if (p.pounding) poundMode = true;
            if (p.y > h * TILE) return;
            // cells overlapped
            const x0 = Math.max(0, Math.floor(p.x / TILE)), x1 = Math.min(w - 1, Math.floor((p.x + p.w - 0.01) / TILE));
            const y0 = Math.max(0, Math.floor(p.y / TILE)), y1 = Math.min(h - 1, Math.floor((p.y + p.h - 0.01) / TILE));
            let hurt = false;
            for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
                visited[yy * w + xx] = 1;
                if (haz[yy * w + xx]) hurt = true;
            }
            if (hurt) return;
            if (p.onGround && f > 0) {
                const [cx, cy] = cellOf(p);
                if (!st.leftGround && !fx.landed) {
                    // still walking: a new cell is a new node (walk programs stop there)
                    if (prog.walk && (cx !== node.cx || cy !== node.cy)) { addNode(p); return; }
                    continue;
                }
                addNode(p);
                return;
            }
            if (!p.onGround) st.leftGround = true;
        }
    }

    const programs = [];
    for (const d of [-1, 1]) {
        const steer = (from) => (f, p) => { if (f >= from) { if (d < 0) inp.left = true; else inp.right = true; } };
        // walk
        programs.push({ d, walk: true, max: 60, input: steer(0) });
        // run off the edge and jump at the last moment (coyote time)
        for (const hold of [999, 6]) {
            programs.push({
                d, max: 150, input(f, p, st) {
                    if (d < 0) inp.left = true; else inp.right = true;
                    if (!st.jumped && !p.onGround && f > 0) { inp.jumpPressed = true; inp.jump = true; st.jumped = true; st.at = f; }
                    else if (st.jumped && f - st.at < hold) inp.jump = true;
                },
            });
            if (ab.boots) for (const t2 of [12, 22]) {
                programs.push({
                    d, max: 170, input(f, p, st) {
                        if (d < 0) inp.left = true; else inp.right = true;
                        if (!st.jumped && !p.onGround && f > 0) { inp.jumpPressed = true; inp.jump = true; st.jumped = true; st.at = f; }
                        else if (st.jumped) {
                            if (f - st.at === t2) inp.jumpPressed = true;
                            if (f - st.at < hold || f - st.at >= t2) inp.jump = true;
                        }
                    },
                });
            }
        }
        // standing / running jumps
        for (const run of [false, true]) {
            const vx0 = run ? d * PHYS.run : 0;
            for (const hold of [3, 8, 14, 999]) {
                programs.push({ d, run, vx0, max: 150, input(f) { steer(0)(f); if (f === 0) inp.jumpPressed = true; if (f < hold) inp.jump = true; } });
            }
            if (!run) {
                for (const from of [10, 22]) programs.push({ d, vx0: 0, max: 150, input(f) { steer(from)(f); if (f === 0) inp.jumpPressed = true; inp.jump = true; } });
            }
            if (ab.boots) {
                for (const t2 of [12, 20, 28]) {
                    programs.push({ d, run, vx0, max: 170, input(f) { steer(0)(f); if (f === 0 || f === t2) inp.jumpPressed = true; inp.jump = true; } });
                }
                if (!run) programs.push({ d, vx0: 0, max: 170, input(f) { steer(20)(f); if (f === 0 || f === 20) inp.jumpPressed = true; inp.jump = true; } });
            }
        }
        if (ab.mitts) {
            // climb with k wall kicks, then stop kicking and land wherever that leaves Pip
            for (const vx0 of [0, d * PHYS.run]) {
                for (const kicks of [2, 5, 8, 12, 99]) {
                    programs.push({
                        d, climb: true, run: vx0 !== 0, vx0, max: 300, input(f, p, st) {
                            const dir = f < 2 ? d : p.facing;
                            if (dir < 0) inp.left = true; else inp.right = true;
                            inp.jump = true;
                            if (f === 0) { inp.jumpPressed = true; st.pressAt = 0; st.kicks = 0; return; }
                            if (st.kicks < kicks && !p.onGround && f - st.pressAt > 3 && (p.wallDir !== 0 || wallNear(p, dir))) {
                                inp.jumpPressed = true; st.pressAt = f; st.kicks++;
                            }
                        },
                    });
                }
            }
        }
    }
    function wallNear(p, dir) {
        const x = dir > 0 ? p.x + p.w + 0.5 : p.x - 0.5;
        const tx = Math.floor(x / TILE);
        if (tx < 0 || tx >= w) return true;
        const ty0 = Math.floor((p.y + 2) / TILE), ty1 = Math.floor((p.y + p.h - 3) / TILE);
        for (let ty = ty0; ty <= ty1; ty++) if (ty >= 0 && ty < h && kinds[ty * w + tx] === K.SOLID) return true;
        return false;
    }
    const pound = { max: 120, input(f) { if (f === 0) inp.jumpPressed = true; if (f < 3) inp.jump = true; if (f === 8) { inp.down = true; inp.downPressed = true; } } };

    // seed
    const s = level.start;
    const sp = newPlayerBody(s.x * TILE + TILE / 2 - PHYS.w / 2, (s.y + 1) * TILE - PHYS.h);
    addNode(sp);

    while (queue.length) {
        const node = queue.shift();
        for (const prog of programs) {
            if (prog.run && !standable(node.cx - prog.d, node.cy)) continue;
            run(node, prog, prog.max);
        }
        // Wall climbs are sensitive to where in the cell they start: also try from the centre.
        const cxp = node.cx * TILE + TILE / 2 - PHYS.w / 2;
        if (ab.mitts && Math.abs(cxp - node.x) > 2 && standable(node.cx, node.cy)) {
            const centred = { x: cxp, y: node.y, cx: node.cx, cy: node.cy };
            for (const prog of programs) if (prog.climb) run(centred, prog, prog.max);
        }
        const below = node.cy + 1 < h ? tiles[(node.cy + 1) * w + node.cx] : 0;
        if (below === T.CRACK) run(node, pound, pound.max);
    }
    return { visited, nodes: nodeSeen.reduce((a, b) => a + b, 0), steps };
}

export function cellReached(level, visited, x, y) {
    return x >= 0 && y >= 0 && x < level.w && y < level.h && visited[y * level.w + x] === 1;
}

/** Is the level's exit reachable? (the flagpole, or the boss arena for a castle) */
export function exitReached(level, visited) {
    if (level.arena) {
        const a = level.arena;
        for (let y = a.top; y < a.floor; y++) if (cellReached(level, visited, a.x0 + 3, y)) return true;
        return false;
    }
    const g = level.entities.find(e => e.t === 'goal');
    if (!g) return false;
    for (let y = g.top; y < g.y; y++) if (cellReached(level, visited, g.x, y)) return true;
    return false;
}

/**
 * The runtime contract: with the world's baseline gadgets the exit is
 * reachable and so is every shard and vault that isn't behind a gated pocket.
 */
export function validateLevel(level, baseline) {
    const r = reach(level, baseline);
    const fails = [];
    if (!exitReached(level, r.visited)) fails.push('exit');
    for (const e of level.entities) {
        if (e.t !== 'shard' && e.t !== 'vault') continue;
        const needs = e.pocket ? POCKET_GADGET[e.pocket] : null;
        if (needs && !baseline.has(needs)) continue;
        if (!cellReached(level, r.visited, e.x, e.y)) fails.push(`${e.t}${e.slot ?? ''}@${e.pocket || 'route'}`);
    }
    return { ok: fails.length === 0, fails, nodes: r.nodes, steps: r.steps };
}

const POCKET_GADGET = { high: 'boots', bubble: 'frost', shaft: 'mitts', red: 'rocket' };
