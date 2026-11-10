// EMBERSPIRE — the battle stage: a 640x360 pixel canvas. Reads G.battle and plays G.events as a queue of short
// animations (a lunge, a flash, a burst of sparks, a number). Never changes G. While the queue is playing,
// `busy` is true and main.js holds the battle AI, so every action is seen before the next one starts.

import { img, ready, ART } from '../assets.js';
import { BIOMES, biomeOf, MONSTERS } from '../sim/data/biomes.js';
import { HERO, STATUS } from '../sim/data/heroes.js';

export const W = 640, H = 360;

const EL_COLOR = {
    phys: ['#ffffff', '#ffe9b0'], fire: ['#ff8a2a', '#ffd25a'], ice: ['#8fe8ff', '#e6fbff'], bolt: ['#ffe65a', '#ffffff'],
    holy: ['#fff2b0', '#ffd86a'], dark: ['#b06cff', '#5a2a9a'], nature: ['#8fe06a', '#3f9a3a'], heal: ['#8ef07c', '#e0ffd0'],
};

// where units stand (bottom-centre of the sprite), by side and count
const ENEMY_SLOTS = {
    1: [[185, 296]],
    2: [[130, 250], [255, 300]],
    3: [[110, 235], [250, 258], [160, 330]],
    4: [[95, 228], [230, 240], [120, 330], [262, 336]],
};
const BIG_SLOTS = [[165, 318], [320, 232], [318, 336]];
const PARTY_SLOTS = [[468, 236], [512, 270], [556, 304], [600, 340]];

export class Stage {
    constructor(canvas, floaters) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.floaters = floaters;
        this.units = new Map();
        this.queue = [];
        this.timer = 0;
        this.time = 0;
        this.parts = [];
        this.slashes = [];
        this.shake = 0;
        this.flashScreen = 0;
        this.speed = 1;
        this.pick = null;          // { uids: [...], cb } while choosing a target
        this.hover = null;
        this.turn = null;
        this.floor = 1;
        this.onBanner = null;
        canvas.addEventListener('pointerdown', (e) => this._onPointer(e));
        canvas.addEventListener('pointermove', (e) => { if (this.pick) this.hover = this._hit(e); });
    }

    get busy() { return this.queue.length > 0 || this.timer > 0; }

    // ------------------------------------------------------------ setup from the sim
    setBattle(G) {
        const B = G.battle;
        this.units.clear();
        this.parts.length = 0;
        this.slashes.length = 0;
        this.floor = B.floor;
        const { biome, cycle } = biomeOf(B.floor);
        this.bg = img(ART.bg(biome.id));
        this.cycle = cycle;
        this.tint = biome.tint;
        const es = B.units.filter((u) => u.side === 'e');
        const big = es[0] && (es[0].rank === 'boss' || es[0].rank === 'mini');
        const slots = big ? BIG_SLOTS : ENEMY_SLOTS[Math.min(4, es.length)] || ENEMY_SLOTS[4];
        for (const u of B.units) {
            const i = u.slot;
            const pos = u.side === 'e' ? slots[i] || [100 + i * 60, 300] : PARTY_SLOTS[i];
            const h = u.side === 'p' ? G.heroes[u.ref] : null;
            this.units.set(u.uid, {
                uid: u.uid, side: u.side, ref: u.ref, x: pos[0], y: pos[1], name: u.name,
                im: img(u.side === 'e' ? ART.mon(u.ref) : ART.hero(u.ref, h.tier >= 2)),
                tier: h ? h.tier : 0, elite: !!u.elite, rank: u.rank || 'hero',
                hp: u.hp, mhp: u.mhp, mp: u.mp, alive: u.alive, alpha: u.alive ? 1 : (u.side === 'p' ? 0.45 : 0),
                flash: 0, lunge: 0, hurt: 0, st: { ...u.st }, enraged: false, intro: u.side === 'e' ? 1 : 0,
            });
        }
        this.turn = null;
        this.queue.length = 0;
        this.timer = 0;
    }

    /** Keep display values in step with the sim when nothing is animating (after a load, say). */
    sync(G) {
        const B = G.battle;
        if (!B || this.busy) return;
        for (const u of B.units) {
            const v = this.units.get(u.uid);
            if (!v) continue;
            v.hp = u.hp; v.mhp = u.mhp; v.mp = u.mp; v.st = { ...u.st };
            if (v.alive !== u.alive) { v.alive = u.alive; v.alpha = u.alive ? 1 : (u.side === 'p' ? 0.45 : 0); }
        }
        this.turn = B.turn;
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'battle') { this.setBattle(G); this.queue.push({ type: 'intro', rank: e.rank }); continue; }
            if (['turn', 'act', 'hit', 'heal', 'status', 'dot', 'down', 'revive', 'stunned', 'enrage', 'mp', 'miss', 'steal', 'won', 'lost', 'fled', 'flee-fail'].includes(e.type)) this.queue.push(e);
        }
    }

    // ------------------------------------------------------------ the queue
    _run(e) {
        const sp = this.speed;
        const u = e.uid ? this.units.get(e.uid) : null;
        switch (e.type) {
            case 'intro': {
                const boss = [...this.units.values()].find((x) => x.rank === 'boss' || x.rank === 'mini');
                if (boss && this.onBanner) this.onBanner((boss.rank === 'boss' ? 'BOSS: ' : 'Mini Boss: ') + boss.name);
                return boss ? 1.1 : 0.45;
            }
            case 'turn': this.turn = e.uid; return 0.05;
            case 'act': {
                if (!u) return 0.1;
                if (e.kind !== 'defend' && e.kind !== 'flee') u.lunge = 1;
                this.lastAct = e;
                if (e.kind === 'defend') this.float(u, 'Guard', 'small');
                else if (e.name && e.name !== 'Attack') this.banner(u, e.name);
                const tg = (e.tgts || []).map((id) => this.units.get(id)).filter(Boolean);
                const color = e.kind === 'heal' || e.kind === 'revive' ? 'heal' : e.el || 'phys';
                for (const t of tg) {
                    if (e.kind === 'phys' || e.kind === 'item' && color !== 'heal') this.slash(t, color);
                    this.burst(t, color, e.kind === 'mag' ? 26 : 12);
                }
                return e.kind === 'defend' ? 0.3 : 0.38;
            }
            case 'hit': {
                if (!u) return 0.05;
                u.hp = e.hp; u.flash = 1; u.hurt = 1;
                this.burst(u, e.el || 'phys', e.crit ? 22 : 10);
                this.float(u, (e.crit ? 'Critical! ' : '') + e.dmg, e.crit ? 'crit' : e.weak ? 'weak' : e.resist ? 'resist' : '');
                if (e.weak) this.float(u, 'Weak!', 'small', -22);
                if (e.crit || (u.side === 'p' && e.dmg > u.mhp * 0.3)) this.shake = 0.25;
                this.hitSound?.(e);
                return 0.16;
            }
            case 'dot': if (u) { u.hp = e.hp; u.flash = 0.6; this.float(u, e.dmg, 'weak'); this.burst(u, e.id === 'burn' ? 'fire' : 'nature', 8); } return 0.32;
            case 'heal': if (u) { u.hp = e.hp; if (e.amt > 0) { this.float(u, '+' + e.amt, 'heal'); this.burst(u, 'heal', e.regen ? 6 : 14, true); } } return e.regen ? 0.18 : 0.14;
            case 'mp': if (u) u.mp = e.mp; return 0;
            case 'status':
                if (u) {
                    if (e.on) { u.st[e.id] = 1; this.float(u, STATUS[e.id].icon + ' ' + STATUS[e.id].name, 'small', -28); }
                    else delete u.st[e.id];
                }
                return e.on ? 0.12 : 0.02;
            case 'miss': if (u) this.float(u, 'Resisted', 'small', -28); return 0.08;
            case 'stunned': if (u) this.float(u, '💫 Stunned', 'small', -30); return 0.45;
            case 'down': if (u) { u.alive = false; u.dying = 1; u.hp = 0; u.st = {}; } return u?.side === 'e' ? 0.4 : 0.5;
            case 'revive': if (u) { u.alive = true; u.alpha = 1; u.dying = 0; u.hp = e.hp; this.burst(u, 'holy', 24, true); this.float(u, e.auto ? 'Rise!' : 'Revived', 'heal', -26); } return 0.45;
            case 'enrage': if (u) { u.enraged = true; this.float(u, 'ENRAGED!', 'crit', -40); this.shake = 0.4; this.flashScreen = 0.4; } return 0.7;
            case 'steal': if (u) this.float(u, `+${e.gold} gold`, 'small', -30); return 0.15;
            case 'flee-fail': this.floatAt(W / 2, H / 2, 'Couldn\'t escape!', 'small'); return 0.5;
            case 'won': this.turn = null; return 0.35;
            case 'lost': this.turn = null; this.flashScreen = 0.3; return 0.5;
            case 'fled': this.turn = null; return 0.35;
        }
        return 0;
    }

    update(dt) {
        this.time += dt;
        const sdt = dt * this.speed;
        this.timer -= sdt;
        while (this.timer <= 0 && this.queue.length) this.timer += this._run(this.queue.shift());
        if (this.timer < 0 && !this.queue.length) this.timer = 0;
        for (const u of this.units.values()) {
            u.flash = Math.max(0, u.flash - sdt * 5);
            u.hurt = Math.max(0, u.hurt - sdt * 4);
            u.lunge = Math.max(0, u.lunge - sdt * 3.2);
            u.intro = Math.max(0, u.intro - sdt * 2.5);
            if (u.dying) { u.dying = Math.max(0, u.dying - sdt * 2.2); u.alpha = u.side === 'e' ? u.dying : 0.45 + 0.55 * u.dying; }
        }
        this.shake = Math.max(0, this.shake - dt);
        this.flashScreen = Math.max(0, this.flashScreen - dt);
        for (const p of this.parts) { p.x += p.vx * sdt; p.y += p.vy * sdt; p.vy += p.g * sdt; p.life -= sdt; }
        this.parts = this.parts.filter((p) => p.life > 0);
        for (const s of this.slashes) s.life -= sdt * 3;
        this.slashes = this.slashes.filter((s) => s.life > 0);
        // ascended heroes shed a few golden motes
        for (const u of this.units.values()) if (u.tier >= 3 && u.alive && Math.random() < dt * 6) this.parts.push({ x: u.x + (Math.random() - 0.5) * 40, y: u.y - Math.random() * 70, vx: 0, vy: -18, g: 0, life: 0.9, max: 0.9, c: '#ffd86a', s: 2 });
    }

    // ------------------------------------------------------------ effects
    burst(u, el, n, up = false) {
        const [c1, c2] = EL_COLOR[el] || EL_COLOR.phys;
        const { cx, cy } = this.center(u);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 110;
            this.parts.push({ x: cx + (Math.random() - 0.5) * 16, y: cy + (Math.random() - 0.5) * 20, vx: Math.cos(a) * v, vy: up ? -30 - Math.random() * 60 : Math.sin(a) * v - 30, g: up ? -20 : 160, life: 0.5 + Math.random() * 0.3, max: 0.8, c: Math.random() < 0.5 ? c1 : c2, s: 2 + (Math.random() < 0.3 ? 1 : 0) });
        }
    }
    slash(u, el) {
        const { cx, cy } = this.center(u);
        this.slashes.push({ x: cx, y: cy, life: 1, c: (EL_COLOR[el] || EL_COLOR.phys)[0], a: -0.7 + Math.random() * 0.3 });
    }
    center(u) {
        const h = this.sizeOf(u)[1];
        return { cx: u.x, cy: u.y - h * 0.5 };
    }
    sizeOf(u) {
        if (!ready(u.im)) return [48, 64];
        return [u.im.naturalWidth, u.im.naturalHeight];
    }
    /** Screen-space float label (DOM, so text stays crisp). */
    float(u, text, cls = '', dy = 0) {
        const h = this.sizeOf(u)[1];
        this.floatAt(u.x + (Math.random() - 0.5) * 14, u.y - h * 0.75 + dy, text, cls);
    }
    floatAt(x, y, text, cls) {
        const el = document.createElement('div');
        el.className = 'float ' + cls;
        el.textContent = text;
        el.style.left = (x / W * 100) + '%';
        el.style.top = (y / H * 100) + '%';
        this.floaters.appendChild(el);
        setTimeout(() => el.remove(), 1200);
    }
    banner(u, name) { this.floatAt(u.x, Math.max(26, u.y - this.sizeOf(u)[1] - 10), name, 'small'); }

    // ------------------------------------------------------------ picking targets
    setPick(uids, cb) { this.pick = uids ? { uids, cb } : null; this.hover = null; }
    _hit(e) {
        const r = this.canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
        let best = null, bd = Infinity;
        for (const uid of this.pick?.uids || []) {
            const u = this.units.get(uid);
            if (!u) continue;
            const [w, h] = this.sizeOf(u);
            const pad = 10;
            if (x > u.x - w / 2 - pad && x < u.x + w / 2 + pad && y > u.y - h - pad && y < u.y + pad) {
                const d = Math.abs(y - (u.y - h / 2)) + Math.abs(x - u.x);
                if (d < bd) { bd = d; best = uid; }
            }
        }
        return best;
    }
    _onPointer(e) {
        if (!this.pick) return;
        const uid = this._hit(e);
        if (uid) { e.preventDefault(); this.pick.cb(uid); }
    }

    // ------------------------------------------------------------ drawing
    draw() {
        const { ctx } = this;
        ctx.save();
        if (this.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 6 * this.shake * 4), Math.round((Math.random() - 0.5) * 4 * this.shake * 4));
        ctx.fillStyle = '#05060f';
        ctx.fillRect(-10, -10, W + 20, H + 20);
        if (ready(this.bg)) {
            if (this.cycle > 0) ctx.filter = `hue-rotate(${this.cycle * 70}deg) saturate(1.2)`;
            ctx.drawImage(this.bg, 0, 0, W, H);
            ctx.filter = 'none';
        }
        // a soft floor shade so sprites sit on the ground
        const grd = ctx.createLinearGradient(0, H * 0.55, 0, H);
        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, H * 0.55, W, H * 0.45);

        const list = [...this.units.values()].sort((a, b) => a.y - b.y);
        for (const u of list) this.drawUnit(u);
        // slashes
        for (const s of this.slashes) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, s.life * 1.5);
            ctx.strokeStyle = s.c;
            ctx.lineWidth = 3;
            ctx.beginPath();
            const len = 46 * (1.2 - s.life * 0.4);
            ctx.moveTo(s.x - len * Math.cos(s.a), s.y - len * Math.sin(s.a));
            ctx.lineTo(s.x + len * Math.cos(s.a), s.y + len * Math.sin(s.a));
            ctx.stroke();
            ctx.restore();
        }
        for (const p of this.parts) {
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.4));
            ctx.fillStyle = p.c;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
        }
        ctx.globalAlpha = 1;
        if (this.flashScreen > 0) { ctx.fillStyle = `rgba(255,80,40,${this.flashScreen * 0.5})`; ctx.fillRect(0, 0, W, H); }
        ctx.restore();
    }

    drawUnit(u) {
        const { ctx } = this;
        if (u.alpha <= 0.01) return;
        const [w, h] = this.sizeOf(u);
        const dir = u.side === 'e' ? 1 : -1;
        const lunge = Math.sin(Math.min(1, u.lunge) * Math.PI) * 22 * dir;
        const recoil = u.hurt * 5 * -dir;
        const bob = u.alive ? Math.round(Math.sin(this.time * 2.2 + u.x * 0.05) * (u.side === 'e' && ['dusk_bat', 'shard_wisp', 'living_tome', 'star_jelly', 'void_eye', 'sentinel_orb', 'nebula_moth', 'ice_wraith', 'wax_wraith', 'celestine'].includes(u.ref) ? 3 : 1.2)) : 0;
        const intro = u.intro * 60 * -dir;
        const x = Math.round(u.x - w / 2 + lunge + recoil + intro), y = Math.round(u.y - h + bob);
        // shadow
        ctx.globalAlpha = 0.35 * u.alpha;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(u.x + lunge, u.y - 2, w * 0.36, Math.max(4, w * 0.08), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = u.alpha;
        if (!ready(u.im)) { ctx.fillStyle = u.side === 'e' ? '#7a3a5a' : '#3a5a9a'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; return; }
        // aura for ascended heroes and enraged bosses
        if (u.alive && (u.tier >= 3 || u.enraged)) {
            ctx.save();
            ctx.globalAlpha = 0.35 + 0.15 * Math.sin(this.time * 4);
            ctx.filter = `blur(6px) ${u.enraged ? 'sepia(1) saturate(6) hue-rotate(-40deg)' : 'sepia(1) saturate(4) brightness(1.4)'}`;
            ctx.drawImage(u.im, x - 3, y - 3, w + 6, h + 6);
            ctx.restore();
        }
        let filter = '';
        if (u.side === 'e' && u.elite) filter += 'hue-rotate(160deg) saturate(1.4) ';
        if (u.side === 'e' && this.cycle > 0 && !u.elite) filter += `hue-rotate(${this.cycle * 70}deg) `;
        if (!u.alive && u.side === 'p') filter += 'grayscale(1) brightness(0.7) ';
        const picking = this.pick && this.pick.uids.includes(u.uid);
        if (picking) filter += `drop-shadow(0 0 2px ${this.hover === u.uid ? '#ffffff' : '#ff7a3c'}) `;
        ctx.filter = filter || 'none';
        ctx.drawImage(u.im, x, y, w, h);
        ctx.filter = 'none';
        if (u.flash > 0) {
            ctx.save();
            ctx.globalAlpha = u.flash * u.alpha;
            ctx.filter = 'brightness(0) invert(1)';
            ctx.drawImage(u.im, x, y, w, h);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        // enemy health bar under its feet
        if (u.side === 'e' && u.alive) {
            const bw = Math.max(36, Math.min(90, w * 0.7)), bx = Math.round(u.x - bw / 2), by = Math.round(u.y + 3);
            ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
            ctx.fillStyle = '#5a1010'; ctx.fillRect(bx, by, bw, 3);
            ctx.fillStyle = u.elite ? '#ff9a3a' : '#e84a4a'; ctx.fillRect(bx, by, Math.round(bw * Math.max(0, u.hp / u.mhp)), 3);
        }
        // statuses
        const sts = Object.keys(u.st);
        if (u.alive && sts.length) {
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(sts.map((s) => STATUS[s].icon).join(''), u.x, y - 3);
        }
        // whose turn it is
        if (this.turn === u.uid && u.alive) {
            const ty = y - 10 + Math.round(Math.sin(this.time * 6) * 2);
            ctx.fillStyle = u.side === 'p' ? '#ffd34a' : '#ff5a5a';
            ctx.beginPath(); ctx.moveTo(u.x - 6, ty - 8); ctx.lineTo(u.x + 6, ty - 8); ctx.lineTo(u.x, ty); ctx.fill();
            ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
        }
    }
}

export { BIOMES, MONSTERS, HERO };
