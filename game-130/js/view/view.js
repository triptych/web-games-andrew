// Starbase Spooky — the Canvas 2D view. Draws the game at 640x360 game pixels (the canvas's own size; CSS scales
// it with nearest-neighbour), reads G every frame and answers its events with effects. Never changes G.
//
// Every frame it also builds `targets`: the things that can be tapped or chosen with the keys right now (spots in
// the room, Orby, puzzle pieces, the rooms on the map), each with the command it sends. main.js maps pointers and
// keys onto them, so the mouse, a finger, the arrow keys and the tests all go through the same list.

import { W, H } from '../config.js';
import { ROOMS, MAP_SPOTS, MAP_ROOMS, neighbor, wayTo } from '../sim/data/rooms.js';
import { CAST } from '../sim/data/cast.js';
import { DAYS } from '../sim/data/story.js';
import { front, roomSpots, objective, clueReady } from '../sim/game.js';
import { PLANETS, PLANET_NAMES, WIRE_COLORS, FUSE_COLORS, ROUNDS, batterySum } from '../sim/puzzles.js';
import { ART, ready, drawIcon, PLANET_CELL } from './assets.js';

const PIX = (n) => `${n}px "Press Start 2P", "Courier New", monospace`;
const COLOR = { red: '#ff4d5a', blue: '#3fa9ff', yellow: '#ffd23f', green: '#52e07a', purple: '#c58bff' };
const FUSE = FUSE_COLORS.map((c) => COLOR[c]);
const STARS = ['#ffd23f', '#9ff0ff', '#ff9ad5', '#b6f28a', '#c9a8ff'];
const VISITOR_X = 392;
const KIT_FACE_RIGHT = 1;            // the sprite was painted facing right

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.targets = [];
        this.fx = [];                 // short effects: sparkles, ghosts, flickers
        this.dim = 0;                 // a flicker's darkness
        this.flash = 0;
        this.wispAt = null;           // where Wisp floats once found
        this.reduced = !!window.A11Y?.reducedMotion;
        this.bob = 0;
        this.walkT = 0;
    }

    // ------------------------------------------------------------------------------------------ events
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'spook') {
                if (e.kind === 'flicker') this.fx.push({ kind: 'flicker', t: 0, life: 1.4 });
                else this.fx.push({ kind: 'ghost', t: 0, life: e.kind === 'ghost' ? 4.5 : 2.6, y: e.y, dir: e.dir, peek: e.kind === 'moan' });
            } else if (e.type === 'clue' || e.type === 'fixed' || e.type === 'item') {
                this.burst(G.kit.x, (ROOMS[G.room]?.floor || 300) - 70, '#ffd23f', 18);
            } else if (e.type === 'right') {
                this.flash = 0.35;
            } else if (e.type === 'pz' && (e.what === 'zap' || e.what === 'toomuch')) {
                this.burst(320, 160, '#ffe36b', 10);
            } else if (e.type === 'signal') {
                this.fx.push({ kind: 'signal', t: 0, life: 3 });
            } else if (e.type === 'wisp') {
                this.fx.push({ kind: 'appear', t: 0, life: 1.6 });
            }
        }
    }

    burst(x, y, color, n) {
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            this.fx.push({ kind: 'spark', t: 0, life: 0.7 + (i % 3) * 0.1, x, y, vx: Math.cos(a) * (40 + (i % 4) * 15), vy: Math.sin(a) * (40 + (i % 5) * 12) - 30, color });
        }
    }

    // ------------------------------------------------------------------------------------------ frame
    /** ui = { mode: 'play' | 'map' | 'title', hover: target|null, focus: target|null, pointer: {x,y}|null } */
    frame(G, ui, dt, time) {
        const ctx = this.ctx;
        this.targets = [];
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#05061a';
        ctx.fillRect(0, 0, W, H);
        if (!G || ui.mode === 'title') return;
        if (ui.mode === 'map') this.drawMap(G, ui, time);
        else this.drawRoom(G, ui, dt, time);
        this.drawFx(G, dt, time);
        if (G.puzzle && ui.mode !== 'map') this.drawPuzzle(G, ui, time);
        // highlight what the pointer or the keys are on
        const t = ui.focus || ui.hover;
        if (t && this.targets.some((x) => x.key === t.key)) this.bracket(t, time);
        if (this.flash > 0) {
            ctx.fillStyle = `rgba(255,240,170,${this.flash * 0.5})`;
            ctx.fillRect(0, 0, W, H);
            this.flash = Math.max(0, this.flash - dt);
        }
    }

    sprite(id, cx, feetY, { flip = false, alpha = 1, scale = 1 } = {}) {
        const img = ART.spr[id];
        if (!ready(img)) return null;
        const w = img.width * scale, h = img.height * scale;
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(Math.round(cx), Math.round(feetY));
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(img, Math.round(-w / 2), Math.round(-h), Math.round(w), Math.round(h));
        ctx.restore();
        return { x: cx - w / 2, y: feetY - h, w, h };
    }

    shadow(x, y, w) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(Math.round(x), Math.round(y), w, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawRoom(G, ui, dt, time) {
        const ctx = this.ctx;
        const room = ROOMS[G.room];
        const bg = ART.bg[G.room];
        if (ready(bg)) ctx.drawImage(bg, 0, 0, W, H);
        const free = !front(G);
        const floor = room.floor;

        // things that belong to the room
        if (G.room === 'deck') this.drawDeck(G, time);
        this.drawClues(G, time);
        this.drawBroken(G, time);

        // the visitor
        if (G.room === 'dock') {
            const who = DAYS[G.day - 1]?.visitor;
            if (who) {
                const floats = who === 'gloobella';
                const bob = floats ? Math.sin(time * 2) * 4 - 10 : Math.abs(Math.sin(time * 2.2)) * -2;
                if (!floats) this.shadow(VISITOR_X, floor - 1, 26);
                this.sprite(who, VISITOR_X, floor + bob, { flip: true });
            }
        }
        // Wisp: in the nest until found, then she follows Kit until she goes home
        if (G.flags.wispFound && !G.flags.wispHome) {
            const wx = G.room === 'vents' && !G.queue.length ? 490 : G.kit.x - 70 * (G.kit.face || 1);
            const tx = G.room === 'vents' && G.queue.length ? 470 : wx;
            this.wispAt = this.wispAt ? this.wispAt + (tx - this.wispAt) * Math.min(1, dt * 3) : tx;
            this.sprite('wisp', this.wispAt, floor - 70 + Math.sin(time * 3) * 5, { alpha: 0.95, scale: 0.8 });
        }

        // Kit and Orby
        const k = G.kit;
        const walking = k.tx !== null && free;
        if (walking) this.walkT += dt; else this.walkT = 0;
        const step = walking ? Math.abs(Math.sin(this.walkT * 10)) * 3 : 0;
        this.shadow(k.x, floor - 1, 18);
        const flip = (k.face || -1) !== KIT_FACE_RIGHT;
        this.sprite('kit', k.x, floor - step, { flip });
        // Orby floats just behind Kit, and stays on the screen at the edges of the room
        let ox = k.x - (k.face || -1) * 34;
        if (ox > 616 || ox < 24) ox = k.x + (k.face || -1) * 34;
        const oy = floor - 92 + Math.sin(time * 2.5) * 4;
        const orb = this.sprite('orby', ox, oy, { flip });
        if (orb && free && ui.mode === 'play') this.targets.push({ key: 'orby', x: orb.x - 4, y: orb.y - 4, w: orb.w + 8, h: orb.h + 8, cmd: { t: 'hint' }, label: 'Orby (hint)' });

        // what can be tapped
        if (free && ui.mode === 'play') {
            for (const s of roomSpots(G)) this.targets.push({ key: 'spot:' + s.id, x: s.x, y: s.y, w: s.w, h: s.h, cmd: { t: 'tap', spot: s.id }, label: spotLabel(G, s) });
        }
        // the doors at the sides of the room: a tap walks Kit out to the next room; the one toward the next job glows
        if (ui.mode === 'play') {
            const o = objective(G);
            const goal = o && !(o.id === 'find' && G.room === 'vents') ? o.room : null;
            const way = wayTo(G.room, goal);
            for (const dir of [-1, 1]) {
                const to = neighbor(G.room, dir);
                if (!to) continue;
                const x = dir < 0 ? 2 : W - 30, y = floor - 78;
                const hot = way === dir;
                const pulse = hot ? 0.5 + 0.5 * Math.sin(time * 5) : 0;
                ctx.globalAlpha = free ? 0.92 : 0.45;
                this.plate(x, y, 28, 40, hot ? '#3b2a00' : '#13183f', hot ? `rgb(255,${190 + 40 * pulse},63)` : '#9ff0ff');
                ctx.fillStyle = hot ? '#ffd23f' : '#9ff0ff';
                ctx.beginPath();
                const cx = x + 14 + dir * Math.round(pulse * 2), cy = y + 20;
                ctx.moveTo(cx + dir * 8, cy); ctx.lineTo(cx - dir * 6, cy - 11); ctx.lineTo(cx - dir * 6, cy + 11);
                ctx.fill();
                ctx.globalAlpha = 1;
                if (free) this.targets.push({ key: 'exit:' + dir, x: x - 2, y: y - 6, w: 34, h: 54, cmd: { t: 'exit', dir }, label: `To the ${ROOMS[to].name}` });
            }
        }
        // the job marker: a little bouncing star over the spot Orby would point at
        if (free && ui.mode === 'play' && ui.marker) {
            const o = objective(G);
            const sp = o && (o.room === G.room || (o.id === 'find' && G.room === 'vents')) ? room.spots.find((s) => s.id === (G.room === 'vents' ? 'nest' : o.spot)) : null;
            if (sp) this.star(sp.x + sp.w / 2, sp.y - 6 + Math.sin(time * 4) * 3, 5, '#ffd23f');
        }
        // the garden in the dark: everything outside a pool of light around Kit
        if (G.broken.garden && G.room === 'garden') {
            ctx.save();
            const g = ctx.createRadialGradient(k.x, floor - 50, 30, k.x, floor - 50, 170);
            g.addColorStop(0, 'rgba(5,8,30,0.15)');
            g.addColorStop(1, 'rgba(5,8,30,0.82)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }
    }

    drawDeck(G, time) {
        const ctx = this.ctx;
        // the comms screen glows when there's something to hear
        const calling = clueReady(G, 'hum') || (G.done.find && !G.done.home);
        if (calling) {
            ctx.fillStyle = `rgba(120,255,170,${0.25 + 0.2 * Math.sin(time * 5)})`;
            ctx.beginPath(); ctx.arc(102, 170, 34, 0, Math.PI * 2); ctx.fill();
        }
        // Captain Ada on the comms screen while she talks
        const f = front(G);
        if (f?.say && f.say.startsWith('ada.')) {
            const img = ART.spr.ada;
            ctx.save();
            ctx.beginPath(); ctx.arc(102, 170, 31, 0, Math.PI * 2); ctx.clip();
            ctx.fillStyle = '#0d3b2a'; ctx.fillRect(60, 130, 90, 90);
            if (ready(img)) ctx.drawImage(img, 70, 140 + Math.round(Math.sin(time * 6) * 0.6), 64, Math.round((64 * img.height) / img.width));
            ctx.fillStyle = 'rgba(120,255,170,0.12)';
            for (let y = 140; y < 205; y += 3) ctx.fillRect(60, y, 90, 1);
            ctx.restore();
        }
        // Mama Glimmer outside the big window
        if (G.flags.mama) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(226, 90, 284, 135);
            ctx.clip();
            const img = ART.spr.mama;
            if (ready(img)) {
                const s = 0.52;
                const x = 368 + Math.sin(time * 0.6) * 10, y = 160 + Math.sin(time * 0.9) * 4;
                ctx.globalAlpha = 0.95;
                ctx.drawImage(img, Math.round(x - (img.width * s) / 2), Math.round(y - (img.height * s) / 2), Math.round(img.width * s), Math.round(img.height * s));
            }
            ctx.restore();
        }
    }

    drawClues(G, time) {
        const ctx = this.ctx;
        const tw = (x, y, k = 0) => { const a = 0.5 + 0.5 * Math.sin(time * 4 + k); this.star(x, y, 2 + a * 2, `rgba(255,255,220,${0.4 + a * 0.6})`); };
        if (G.room === 'garden' && clueReady(G, 'goo') && !G.broken.garden) {
            ctx.fillStyle = `rgba(150,240,255,${0.6 + 0.2 * Math.sin(time * 3)})`;
            ctx.beginPath(); ctx.ellipse(442, 320, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(230,255,255,0.9)';
            ctx.beginPath(); ctx.ellipse(436, 318, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
            tw(452, 310, 1); tw(430, 312, 2);
        }
        if (G.room === 'galley' && clueReady(G, 'crumbs')) { tw(486, 160); tw(470, 195, 2); }
        if (G.room === 'engine' && clueReady(G, 'wire')) { tw(500, 275); tw(540, 282, 1.5); }
        if (G.room === 'observatory' && clueReady(G, 'chart')) { tw(120, 175); tw(150, 230, 2); }
        // glowing footprints with the Glow-o-Meter, from the middle of the room into the vent
        if (G.room === 'quarters' && G.items.includes('meter') && !G.flags.wispHome) {
            for (let i = 0; i < 7; i++) {
                const x = 318 + i * 30, y = 336 - (i % 2) * 8;
                const a = 0.6 + 0.35 * Math.sin(time * 3 - i * 0.7);
                ctx.fillStyle = `rgba(120,240,255,${a * 0.35})`;
                ctx.fillRect(x - 3, y - 7, 16, 14);
                ctx.fillStyle = `rgba(170,250,255,${a})`;
                ctx.fillRect(x, y - 2, 9, 6);                       // the foot
                ctx.fillRect(x + 1, y - 6, 2, 2); ctx.fillRect(x + 4, y - 7, 2, 2); ctx.fillRect(x + 7, y - 6, 2, 2);   // toes
            }
        }
    }

    drawBroken(G, time) {
        const ctx = this.ctx;
        const spark = (x, y) => {
            if ((Math.floor(time * 6) + x) % 5 === 0) for (let i = 0; i < 4; i++) {
                ctx.fillStyle = i % 2 ? '#fff6a0' : '#ffd23f';
                ctx.fillRect(x + ((i * 7 + Math.floor(time * 20)) % 13) - 6, y + ((i * 5 + Math.floor(time * 17)) % 11) - 5, 2, 2);
            }
        };
        if (G.room === 'galley' && G.broken.galley) {
            ctx.fillStyle = `rgba(255,40,60,${0.25 + 0.25 * (Math.sin(time * 6) > 0)})`;
            ctx.beginPath(); ctx.arc(130, 140, 38, 0, Math.PI * 2); ctx.fill();
            spark(130, 140);
        }
        if (G.room === 'observatory' && G.broken.observatory) spark(320, 170);
        if (G.room === 'engine' && G.broken.engine) { spark(70, 175); spark(140, 175); }
        if (G.room === 'garden' && G.broken.garden) spark(570, 190);
    }

    star(x, y, r, color) {
        const ctx = this.ctx;
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
            ctx.lineTo(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr));
        }
        ctx.fill();
    }

    drawFx(G, dt, time) {
        const ctx = this.ctx;
        this.dim = 0;
        for (const f of this.fx) {
            f.t += dt;
            const k = f.t / f.life;
            if (f.kind === 'spark') {
                f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 120 * dt;
                ctx.fillStyle = f.color;
                ctx.globalAlpha = 1 - k;
                ctx.fillRect(Math.round(f.x), Math.round(f.y), 3, 3);
                ctx.globalAlpha = 1;
            } else if (f.kind === 'ghost') {
                if (f.peek) {
                    // a quick peek in from the edge of the room
                    const a = Math.sin(k * Math.PI);
                    this.sprite('ghost', 600 - a * 40, f.y + 70, { alpha: 0.55 * a, scale: 0.7 });
                } else {
                    const x = f.dir > 0 ? -50 + k * 740 : 690 - k * 740;
                    this.sprite('ghost', x, f.y + 80 + Math.sin(f.t * 3) * 10, { alpha: 0.5 * Math.sin(k * Math.PI), scale: 0.8, flip: f.dir < 0 });
                }
            } else if (f.kind === 'flicker') {
                // two dim blinks, never more than two a second (one for prefers-reduced-motion)
                const on = this.reduced ? f.t < 0.5 : (f.t % 0.6) < 0.2;
                if (on) this.dim = Math.max(this.dim, 0.45);
            } else if (f.kind === 'signal') {
                for (let i = 0; i < 3; i++) {
                    const r = ((f.t * 90 + i * 40) % 160);
                    ctx.strokeStyle = `rgba(150,240,255,${1 - r / 160})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(102, 170, r, 0, Math.PI * 2); ctx.stroke();
                }
            } else if (f.kind === 'appear') {
                ctx.fillStyle = `rgba(180,230,255,${0.5 * (1 - k)})`;
                ctx.beginPath(); ctx.arc(490, 220, 20 + k * 80, 0, Math.PI * 2); ctx.fill();
            }
        }
        this.fx = this.fx.filter((f) => f.t < f.life);
        if (this.dim > 0) { ctx.fillStyle = `rgba(0,0,20,${this.dim})`; ctx.fillRect(0, 0, W, H); }
    }

    bracket(t, time) {
        const ctx = this.ctx;
        const p = 2 + Math.round(Math.sin(time * 6));
        const x = t.x - p, y = t.y - p, w = t.w + p * 2, h = t.h + p * 2, L = Math.min(12, w / 3, h / 3);
        ctx.fillStyle = '#ffd23f';
        for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
            ctx.fillRect(sx > 0 ? cx : cx - L, sy > 0 ? cy : cy - 3, L, 3);
            ctx.fillRect(sx > 0 ? cx : cx - 3, sy > 0 ? cy : cy - L, 3, L);
        }
    }

    text(str, x, y, { size = 8, color = '#fff', align = 'center', shadow = '#000' } = {}) {
        const ctx = this.ctx;
        ctx.font = PIX(size);
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        if (shadow) { ctx.fillStyle = shadow; ctx.fillText(str, Math.round(x) + 1, Math.round(y) + 1); }
        ctx.fillStyle = color;
        ctx.fillText(str, Math.round(x), Math.round(y));
    }

    plate(x, y, w, h, fill = '#1d2150', edge = '#8fa6ff') {
        const ctx = this.ctx;
        ctx.fillStyle = edge;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = fill;
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    }

    // ------------------------------------------------------------------------------------------ the map
    drawMap(G, ui, time) {
        const ctx = this.ctx;
        const bg = ART.bg.station;
        if (ready(bg)) ctx.drawImage(bg, 0, 0, W, H);
        ctx.fillStyle = 'rgba(0,0,20,0.25)';
        ctx.fillRect(0, 0, W, H);
        this.text('STATION MAP', 320, 14, { size: 10, color: '#ffd23f' });
        const o = objective(G);
        for (const id of MAP_ROOMS) {
            const r = MAP_SPOTS[id];
            const name = ROOMS[id].name;
            ctx.font = PIX(7);
            const tw = ctx.measureText(name).width + 10;
            const lx = Math.round(r.x + r.w / 2 - tw / 2), ly = r.y + r.h - 6;
            this.plate(lx, ly, tw, 15, id === G.room ? '#3b2a00' : '#1d2150', id === G.room ? '#ffd23f' : '#8fa6ff');
            this.text(name, r.x + r.w / 2, ly + 8, { size: 7, color: id === G.room ? '#ffd23f' : '#fff', shadow: null });
            if (id === G.room) this.text('YOU', r.x + r.w / 2, r.y + 8, { size: 7, color: '#ffd23f' });
            if (o && o.room === id && id !== G.room) this.star(r.x + r.w / 2, r.y - 2 + Math.sin(time * 4) * 3, 7, '#ffd23f');
            this.targets.push({ key: 'map:' + id, x: r.x, y: r.y, w: r.w, h: r.h, cmd: { t: 'go', room: id }, label: name });
        }
        this.plate(560, 6, 74, 22, '#3a1430', '#ff6fae');
        this.text('CLOSE', 597, 17, { size: 7, shadow: null });
        this.targets.push({ key: 'map:close', x: 560, y: 6, w: 74, h: 22, cmd: { t: 'closemap' }, label: 'Close the map' });
    }

    // ------------------------------------------------------------------------------------------ puzzles
    drawPuzzle(G, ui, time) {
        const p = G.puzzle;
        const ctx = this.ctx;
        const busy = !!front(G)?.say;           // Orby is talking before or in the middle of the puzzle
        ctx.fillStyle = 'rgba(5,6,20,0.55)';
        ctx.fillRect(0, 0, W, H);
        this.plate(28, 26, 584, 262, '#141838', '#8fa6ff');
        const add = (key, x, y, w, h, cmd, label) => { if (!busy) this.targets.push({ key, x, y, w, h, cmd, label }); };
        const title = { wires: 'FIX THE LIGHTS', battery: 'POWER THE SNACK-O-TRON', planets: 'PUT THE PLANETS IN ORDER', sequence: 'FIX THE FUSES', song: "MAMA'S SONG" }[p.kind];
        this.text(title, 320, 42, { size: 10, color: '#ffd23f' });

        if (p.kind === 'wires') {
            const ys = [88, 140, 192, 244];
            // finished wires
            for (let i = 0; i < 4; i++) {
                if (p.links[i] === null) continue;
                this.wire(150, ys[i], 490, ys[p.links[i]], COLOR[p.left[i]]);
            }
            if (p.sel !== null && ui.pointer) this.wire(150, ys[p.sel], ui.pointer.x, ui.pointer.y, COLOR[p.left[p.sel]], 0.7);
            for (let i = 0; i < 4; i++) {
                this.plug(130, ys[i], COLOR[p.left[i]], p.sel === i, p.links[i] !== null);
                this.plug(510, ys[i], COLOR[p.right[i]], false, p.links.includes(i), true);
                add('wl' + i, 100, ys[i] - 22, 70, 44, { t: 'pick', side: 'l', i }, p.left[i] + ' wire');
                add('wr' + i, 470, ys[i] - 22, 70, 44, { t: 'pick', side: 'r', i }, p.right[i] + ' plug');
            }
        } else if (p.kind === 'battery') {
            const sum = batterySum(p);
            this.plate(214, 56, 212, 58, '#06130c', '#52e07a');
            this.text('POWER', 320, 70, { size: 7, color: '#9ff0b8', shadow: null });
            this.text(String(p.target), 290, 94, { size: 20, color: '#b6f28a', shadow: '#0a3a1a' });
            this.text(`NOW ${sum}`, 380, 94, { size: 9, color: sum > p.target ? '#ff8a8a' : '#ffd23f', shadow: null });
            // the bar fills toward the target
            ctx.fillStyle = '#25305e'; ctx.fillRect(170, 124, 300, 10);
            ctx.fillStyle = sum > p.target ? '#ff4d5a' : '#52e07a';
            ctx.fillRect(170, 124, Math.min(300, (300 * sum) / p.target), 10);
            for (let i = 0; i < p.cells.length; i++) {
                const x = 64 + i * 88, y = p.on[i] ? 150 : 176;
                if (p.on[i]) { ctx.fillStyle = 'rgba(82,224,122,0.35)'; ctx.fillRect(x - 6, y - 6, 76, 100); }
                drawIcon(ctx, 'items', 11, x, y, 64);
                this.plate(x + 14, y + 62, 36, 28, '#fff8e2', '#2a1b00');
                this.text(String(p.cells[i]), x + 32, y + 77, { size: 14, color: '#2a1b00', shadow: null });
                add('b' + i, x - 6, y - 6, 76, 100, { t: 'pick', i }, `battery ${p.cells[i]}`);
            }
        } else if (p.kind === 'planets') {
            drawIcon(ctx, 'planets', PLANET_CELL.sun, 34, 62, 84);
            this.text('SUN', 76, 156, { size: 7, color: '#ffd23f' });
            for (let i = 0; i < PLANETS.length; i++) {
                const x = 130 + i * 58, y = 86;
                ctx.strokeStyle = 'rgba(160,190,255,0.5)';
                ctx.strokeRect(x + 0.5, y + 0.5, 46, 46);
                if (i < p.placed) drawIcon(ctx, 'planets', PLANET_CELL[PLANETS[i]], x + 1, y + 1, 45);
                else if (i === p.placed) { ctx.fillStyle = `rgba(255,210,63,${0.25 + 0.2 * Math.sin(time * 5)})`; ctx.fillRect(x + 1, y + 1, 45, 45); this.text('?', x + 23, y + 24, { size: 12, color: '#ffd23f' }); }
                this.text(String(i + 1), x + 23, y + 58, { size: 7, color: '#a9b2da', shadow: null });
            }
            for (let i = 0; i < p.tray.length; i++) {
                const id = p.tray[i];
                const x = 60 + i * 66, y = 180;
                if (!id) continue;
                drawIcon(ctx, 'planets', PLANET_CELL[id], x, y + Math.sin(time * 2 + i) * 2, 52);
                this.text(PLANET_NAMES[id].toUpperCase(), x + 26, y + 64, { size: 6, color: '#fff' });
                add('p' + i, x - 4, y - 4, 60, 76, { t: 'pick', i }, PLANET_NAMES[id]);
            }
        } else {
            const song = p.kind === 'song';
            const n = p.colors;
            const watching = !!p.show;
            this.text(watching ? 'WATCH!' : 'YOUR TURN!', 320, 64, { size: 9, color: watching ? '#9ff0ff' : '#b6f28a' });
            for (let r = 0; r < ROUNDS.length; r++) {
                ctx.fillStyle = r < p.round ? '#52e07a' : r === p.round ? '#ffd23f' : '#3a4380';
                ctx.fillRect(282 + r * 28, 78, 20, 8);
            }
            if (song) this.sprite('wisp', 320, 140 + Math.sin(time * 3) * 4, { scale: 0.75 });
            for (let i = 0; i < n; i++) {
                const lit = p.lit === i || (this.pressed && this.pressed.i === i && this.pressed.t > 0);
                let x, y, r;
                if (song) { x = 112 + i * 104; y = 215 - Math.sin((i / (n - 1)) * Math.PI) * 36; r = 28; }
                else { x = 140 + i * 120; y = 190; r = 40; }
                const col = song ? STARS[i] : FUSE[i];
                if (lit) { ctx.fillStyle = col; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x, y, r + 14, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
                if (song) this.star(x, y, lit ? r + 4 : r, lit ? '#ffffff' : col);
                else {
                    ctx.fillStyle = '#0b0d1e'; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = col; ctx.globalAlpha = lit ? 1 : 0.45; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
                    if (lit) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x - r / 3, y - r / 3, r / 4, 0, Math.PI * 2); ctx.fill(); }
                }
                if (!watching) add('n' + i, x - r - 6, y - r - 6, r * 2 + 12, r * 2 + 12, { t: 'pick', i }, song ? `star ${i + 1}` : `${FUSE_COLORS[i]} fuse`);
            }
            // how far through this round
            const len = ROUNDS[Math.min(p.round, ROUNDS.length - 1)];
            for (let i = 0; i < len; i++) { ctx.fillStyle = i < p.input.length ? '#ffd23f' : '#3a4380'; ctx.fillRect(320 - len * 9 + i * 18, 262, 12, 12); }
        }
        if (this.pressed) this.pressed.t -= 1 / 60;
    }

    wire(x1, y1, x2, y2, color, alpha = 1) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.lineCap = 'round';
        for (const [w, c] of [[9, '#0b0d1e'], [5, color]]) {
            ctx.strokeStyle = c; ctx.lineWidth = w;
            ctx.beginPath(); ctx.moveTo(x1, y1);
            ctx.bezierCurveTo((x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2);
            ctx.stroke();
        }
        ctx.restore();
    }

    plug(x, y, color, sel, done, socket = false) {
        const ctx = this.ctx;
        if (sel) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - 24, y - 20, 48, 40); }
        ctx.fillStyle = '#0b0d1e'; ctx.fillRect(x - 18, y - 14, 36, 28);
        ctx.fillStyle = color; ctx.fillRect(x - 15, y - 11, 30, 22);
        ctx.fillStyle = socket ? '#0b0d1e' : 'rgba(255,255,255,0.5)';
        if (socket) { ctx.fillRect(x - 7, y - 4, 4, 8); ctx.fillRect(x + 3, y - 4, 4, 8); } else ctx.fillRect(x - 11, y - 8, 8, 4);
        if (done) this.star(x, y - 22, 5, '#ffd23f');
    }

    /** A tap on a puzzle piece flashes it (the sim doesn't know about pointers). */
    press(i) { this.pressed = { i, t: 0.18 }; }
}

function spotLabel(G, s) {
    if (s.visitor) return CAST[DAYS[G.day - 1].visitor].name;
    if (s.fix && G.broken[s.fix]) return s.name + ' (broken!)';
    return s.name;
}
