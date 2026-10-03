/**
 * hud.js — the in-game overlay: vitals, the Warden's helmet portrait, ammo,
 * keys, weapon slots, powerup timers, boss bar, messages, VESPER's comms,
 * damage-direction arcs, hit markers, the use prompt and the automap.
 *
 * All DOM (crisp text at any resolution, no GPU cost). Values are written
 * only when they change.
 */
import { WEAPONS, WEAPON_BY_ID, AMMO, POWER_INFO, CELL, KEY_ORDER } from '../config.js';

const $ = (id) => document.getElementById(id);

export class HUD {
    constructor() {
        this.el = $('hud');
        this.health = $('hud-health'); this.healthBar = $('hud-health-bar');
        this.armor = $('hud-armor'); this.armorBar = $('hud-armor-bar');
        this.ammo = $('hud-ammo'); this.ammoName = $('hud-ammo-name'); this.weaponName = $('hud-weapon');
        this.ammoTable = $('hud-ammo-table');
        this.slots = $('hud-slots');
        this.keys = $('hud-keys');
        this.powers = $('hud-powers');
        this.msgs = $('hud-msgs');
        this.comms = $('comms'); this.commsText = $('comms-text');
        this.boss = $('boss'); this.bossFill = $('boss-fill'); this.bossLag = $('boss-lag'); this.bossName = $('boss-name');
        this.prompt = $('use-prompt');
        this.cross = $('crosshair'); this.hit = $('hitmarker');
        this.dmg = $('dmg-dir').getContext('2d');
        this.face = $('face').getContext('2d');
        this.levelTag = $('hud-level');
        this.fps = $('fps');
        this.cache = {};
        this.hurts = [];
        this.msgList = [];
        this.commsQueue = [];
        this.commsT = 0;
        this.faceState = { look: 0, lookT: 0, pain: 0, grin: 0 };
        this.bossLagV = 1;
        this._buildSlots();
        this._buildAmmoTable();
    }

    _buildSlots() {
        this.slots.innerHTML = '';
        this.slotEls = {};
        for (const w of WEAPONS) {
            const d = document.createElement('div');
            d.className = 'slot';
            d.textContent = w.slot;
            d.title = w.name;
            this.slots.appendChild(d);
            this.slotEls[w.id] = d;
        }
    }
    _buildAmmoTable() {
        this.ammoTable.innerHTML = '';
        this.ammoEls = {};
        for (const [k, a] of Object.entries(AMMO)) {
            const row = document.createElement('div');
            row.className = 'arow';
            row.innerHTML = `<span class="aico" style="color:${a.color}">${a.icon}</span><span class="aname">${a.name}</span><span class="aval">0</span><span class="amax">/ ${a.max}</span>`;
            this.ammoTable.appendChild(row);
            this.ammoEls[k] = { row, val: row.querySelector('.aval'), max: row.querySelector('.amax') };
        }
    }

    show(on) { this.el.hidden = !on; }

    set(key, el, value, prop = 'textContent') {
        if (this.cache[key] === value) return;
        this.cache[key] = value;
        el[prop] = value;
    }

    update(dt, S) {
        const P = S.player;
        const W = S.weapons;
        const hp = Math.max(0, Math.ceil(P.health));
        this.set('hp', this.health, String(hp));
        this.set('hpw', this.healthBar.style, `${Math.min(100, hp / 2)}%`, 'width');
        this.set('hpc', this.health, hp <= 25 ? 'low' : hp > 100 ? 'over' : '', 'className');
        const ar = Math.ceil(P.armor);
        this.set('ar', this.armor, String(ar));
        this.set('arw', this.armorBar.style, `${Math.min(100, ar / 2)}%`, 'width');
        this.set('arc', this.armorBar, P.armorClass >= 0.5 ? 'fill blue' : 'fill', 'className');
        const w = WEAPON_BY_ID[W.pending ?? W.current];
        this.set('wn', this.weaponName, w.name);
        if (w.ammo) {
            this.set('am', this.ammo, String(P.ammo[w.ammo]));
            this.set('amn', this.ammoName, AMMO[w.ammo].name);
            this.set('amc', this.ammo, P.ammo[w.ammo] < w.use * 5 ? 'low' : '', 'className');
        } else {
            this.set('am', this.ammo, '∞');
            this.set('amn', this.ammoName, w.kind === 'melee' ? 'Melee' : 'Self-charging');
            this.set('amc', this.ammo, '', 'className');
        }
        for (const [k, e] of Object.entries(this.ammoEls)) {
            this.set('a_' + k, e.val, String(P.ammo[k]));
            this.set('am_' + k, e.max, `/ ${P.maxAmmo[k]}`);
            this.set('ac_' + k, e.row, w.ammo === k ? 'arow cur' : 'arow', 'className');
        }
        for (const ww of WEAPONS) {
            const cls = 'slot' + (P.weapons.has(ww.id) ? ' have' : '') + ((W.pending ?? W.current) === ww.id ? ' cur' : '') + (P.weapons.has(ww.id) && !W.hasAmmo(ww.id) ? ' empty' : '');
            this.set('s_' + ww.id, this.slotEls[ww.id], cls, 'className');
        }
        const keys = KEY_ORDER.filter((k) => P.keys.has(k)).map((k) => `<span class="key ${k}"></span>`).join('');
        this.set('keys', this.keys, keys, 'innerHTML');
        const pw = Object.entries(P.powers).filter(([, t]) => t > 0).map(([k, t]) => `<div class="pw" style="--c:${POWER_INFO[k].color}"><b>${POWER_INFO[k].label}</b><span>${Math.ceil(t)}</span><i style="width:${Math.min(100, (t / 40) * 100)}%"></i></div>`).join('');
        this.set('pw', this.powers, pw, 'innerHTML');

        // boss
        const B = S.boss;
        if (B && B.awake && (B.alive || B.stateT < 3)) {
            this.boss.hidden = false;
            this.set('bn', this.bossName, B.A.title ?? B.sp.name);
            const f = Math.max(0, B.hp / B.maxHp);
            this.bossFill.style.width = `${f * 100}%`;
            this.bossLagV += (f - this.bossLagV) * Math.min(1, dt * 2);
            if (this.bossLagV < f) this.bossLagV = f;
            this.bossLag.style.width = `${this.bossLagV * 100}%`;
            this.boss.classList.toggle('shielded', !!B.shielded);
        } else this.boss.hidden = true;

        // use prompt
        const pr = S.usePrompt;
        this.set('pr', this.prompt, pr ? `<kbd>${S.touch ? 'USE' : 'E'}</kbd> ${pr}` : '', 'innerHTML');
        this.prompt.hidden = !pr;
        this.cross.classList.toggle('hidden', !P.alive);
        this.cross.classList.toggle('target', !!W.onTarget);

        // messages
        for (const m of this.msgList) m.t -= dt;
        while (this.msgList.length && this.msgList[0].t <= 0) { this.msgList[0].el.remove(); this.msgList.shift(); }
        for (const m of this.msgList) m.el.style.opacity = Math.min(1, m.t / 0.6);

        // comms typewriter
        if (this.commsCur) {
            this.commsCur.shown = Math.min(this.commsCur.text.length, this.commsCur.shown + dt * 55);
            this.commsText.textContent = this.commsCur.text.slice(0, Math.floor(this.commsCur.shown));
            this.commsCur.t -= dt;
            if (this.commsCur.t <= 0) { this.commsCur = null; this.comms.classList.remove('on'); }
        } else if (this.commsQueue.length) {
            const text = this.commsQueue.shift();
            this.commsCur = { text, shown: 0, t: 3.2 + text.length * 0.045 };
            this.comms.classList.add('on');
        }

        // hit marker
        this.hitT = Math.max(0, (this.hitT ?? 0) - dt);
        this.hit.style.opacity = this.hitT > 0 ? Math.min(1, this.hitT * 6) : 0;

        this._drawDamage(dt, P);
        this._drawFace(dt, S);
    }

    message(text, color) {
        const el = document.createElement('div');
        el.className = 'msg';
        el.style.color = color;
        el.textContent = text;
        this.msgs.appendChild(el);
        this.msgList.push({ el, t: 4 });
        while (this.msgList.length > 5) { this.msgList[0].el.remove(); this.msgList.shift(); }
    }

    say(text) {
        if (this.commsQueue.includes(text) || this.commsCur?.text === text) return;
        this.commsQueue.push(text);
        if (this.commsQueue.length > 3) this.commsQueue.shift();
    }

    clearComms() { this.commsQueue = []; this.commsCur = null; this.comms.classList.remove('on'); }

    hitMarker(k) { this.hitT = 0.18; this.hit.classList.toggle('kill', k >= 2); }

    hurtFrom(sx, sz, P, amount) {
        const a = Math.atan2(sx - P.x, -(sz - P.z)) - P.yaw;
        this.hurts.push({ a, t: 1, k: Math.min(1, 0.3 + amount / 30) });
        this.faceState.pain = 0.6;
        const rel = Math.sin(a);
        this.faceState.look = rel > 0.4 ? 1 : rel < -0.4 ? -1 : 0;
        this.faceState.lookT = 0.8;
    }

    grin() { this.faceState.grin = 1.5; }

    _drawDamage(dt, P) {
        const c = this.dmg, cv = c.canvas;
        const w = cv.width, h = cv.height;
        c.clearRect(0, 0, w, h);
        if (!this.hurts.length) return;
        const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.32;
        for (const d of this.hurts) {
            d.t -= dt * 1.2;
            c.save();
            c.translate(cx, cy);
            c.rotate(d.a);
            const g = c.createLinearGradient(0, -r - 20, 0, -r + 20);
            g.addColorStop(0, 'rgba(255,40,20,0)');
            g.addColorStop(0.5, `rgba(255,40,20,${Math.max(0, d.t) * 0.85 * d.k})`);
            g.addColorStop(1, 'rgba(255,40,20,0)');
            c.strokeStyle = g;
            c.lineWidth = 16;
            c.beginPath();
            c.arc(0, 0, r, -Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35);
            c.stroke();
            c.restore();
        }
        this.hurts = this.hurts.filter((d) => d.t > 0);
    }

    /** The Warden's helmet: visor colour, eyes, cracks and blood follow your state. */
    _drawFace(dt, S) {
        const P = S.player;
        const F = this.faceState;
        F.pain = Math.max(0, F.pain - dt);
        F.grin = Math.max(0, F.grin - dt);
        F.lookT -= dt;
        if (F.lookT <= 0) { F.lookT = 1.5 + Math.random() * 2; F.look = Math.random() < 0.5 ? 0 : Math.random() < 0.5 ? -1 : 1; }
        const hp = P.health;
        const state = !P.alive ? 'dead' : P.powers.invuln > 0 ? 'god' : F.pain > 0 ? 'pain' : F.grin > 0 ? 'grin' : 'idle';
        const tier = hp > 80 ? 0 : hp > 60 ? 1 : hp > 40 ? 2 : hp > 20 ? 3 : 4;
        const key = `${state}|${F.look}|${tier}|${P.powers.berserk > 0}|${Math.floor(S.time * 4) % 2}`;
        if (key === this._faceKey) return;
        this._faceKey = key;
        const c = this.face, W = c.canvas.width, H = c.canvas.height;
        c.clearRect(0, 0, W, H);
        const cx = W / 2, cy = H / 2 + 2;
        // helmet shell
        const shell = c.createLinearGradient(0, 0, 0, H);
        shell.addColorStop(0, '#6b7d5e'); shell.addColorStop(1, '#2b3326');
        c.fillStyle = shell;
        c.beginPath(); c.ellipse(cx, cy, W * 0.42, H * 0.46, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#20261c';
        c.fillRect(cx - W * 0.42, cy + H * 0.12, W * 0.84, H * 0.08);
        // visor
        const vis = { idle: ['#1fd0ff', '#0a3a52'], pain: ['#ff4a3a', '#4a0a08'], grin: ['#7dff8a', '#0a4a18'], god: ['#d8ff6a', '#4a5a08'], dead: ['#111', '#000'] }[state];
        const vg = c.createLinearGradient(0, cy - H * 0.2, 0, cy + H * 0.1);
        vg.addColorStop(0, vis[0]); vg.addColorStop(1, vis[1]);
        c.fillStyle = vg;
        c.beginPath();
        c.moveTo(cx - W * 0.34, cy - H * 0.16);
        c.quadraticCurveTo(cx, cy - H * 0.3, cx + W * 0.34, cy - H * 0.16);
        c.lineTo(cx + W * 0.28, cy + H * 0.08);
        c.quadraticCurveTo(cx, cy + H * 0.16, cx - W * 0.28, cy + H * 0.08);
        c.closePath(); c.fill();
        // eyes
        const ex = F.look * W * 0.07;
        c.fillStyle = state === 'dead' ? '#000' : 'rgba(255,255,255,0.9)';
        if (state === 'grin') {
            c.strokeStyle = '#fff'; c.lineWidth = 2.5;
            for (const s of [-1, 1]) { c.beginPath(); c.arc(cx + s * W * 0.12 + ex, cy - H * 0.04, W * 0.06, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
        } else if (state === 'dead') {
            c.strokeStyle = '#a00'; c.lineWidth = 3;
            for (const s of [-1, 1]) { const x = cx + s * W * 0.12, y = cy - H * 0.04; c.beginPath(); c.moveTo(x - 5, y - 5); c.lineTo(x + 5, y + 5); c.moveTo(x + 5, y - 5); c.lineTo(x - 5, y + 5); c.stroke(); }
        } else {
            const eh = state === 'pain' ? H * 0.03 : H * 0.06;
            for (const s of [-1, 1]) { c.beginPath(); c.ellipse(cx + s * W * 0.12 + ex, cy - H * 0.04, W * 0.05, eh, 0, 0, Math.PI * 2); c.fill(); }
            if (P.powers.berserk > 0) { c.fillStyle = 'rgba(255,40,30,0.8)'; for (const s of [-1, 1]) { c.beginPath(); c.arc(cx + s * W * 0.12 + ex, cy - H * 0.04, W * 0.025, 0, Math.PI * 2); c.fill(); } }
        }
        // visor glare
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.beginPath(); c.ellipse(cx - W * 0.14, cy - H * 0.16, W * 0.12, H * 0.03, -0.2, 0, Math.PI * 2); c.fill();
        // wear and blood by health tier
        c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.2;
        const cracks = [[[0.1, -0.15], [0.2, 0.0], [0.15, 0.05]], [[-0.2, -0.1], [-0.1, 0.02]], [[0.0, -0.2], [-0.05, -0.05], [0.05, 0.05]], [[0.25, -0.05], [0.12, 0.08]]];
        for (let k = 0; k < Math.min(tier, cracks.length); k++) {
            c.beginPath();
            cracks[k].forEach(([x, y], i) => (i ? c.lineTo(cx + x * W, cy + y * H) : c.moveTo(cx + x * W, cy + y * H)));
            c.stroke();
        }
        if (tier >= 2) {
            c.fillStyle = `rgba(150,10,5,${0.25 + tier * 0.15})`;
            c.beginPath(); c.ellipse(cx + W * 0.25, cy + H * 0.25, W * 0.08 * tier * 0.5, H * 0.05 * tier * 0.5, 0.5, 0, Math.PI * 2); c.fill();
            c.fillRect(cx + W * 0.23, cy + H * 0.2, 2, H * 0.06 * tier);
        }
        if (tier >= 4 && Math.floor(S.time * 4) % 2) { c.fillStyle = 'rgba(255,0,0,0.25)'; c.fillRect(0, 0, W, H); }
    }

    // ------------------------------------------------------------------ automap

    drawMap(canvas, S) {
        const c = canvas.getContext('2d');
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        c.clearRect(0, 0, w, h);
        c.fillStyle = 'rgba(4,6,8,0.82)';
        c.fillRect(0, 0, w, h);
        const L = S.L, Wd = L.W, seen = S.seen, all = S.revealAll;
        let x0 = Wd, y0 = L.H, x1 = 0, y1 = 0;
        for (let i = 0; i < L.open.length; i++) if (L.open[i]) { const x = i % Wd, y = (i / Wd) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        const pad = 30 * dpr;
        const sc = Math.min((w - pad * 2) / (x1 - x0 + 3), (h - pad * 2) / (y1 - y0 + 3));
        const ox = (w - (x1 - x0 + 1) * sc) / 2 - x0 * sc, oy = (h - (y1 - y0 + 1) * sc) / 2 - y0 * sc;
        const X = (x) => ox + x * sc, Y = (y) => oy + y * sc;
        const vis = (i) => seen[i] || all;
        // floors
        for (let i = 0; i < L.open.length; i++) {
            if (!L.open[i] || !vis(i)) continue;
            const x = i % Wd, y = (i / Wd) | 0;
            c.fillStyle = L.liquid[i] ? 'rgba(255,110,40,0.35)' : seen[i] ? 'rgba(90,120,140,0.16)' : 'rgba(255,230,100,0.06)';
            c.fillRect(X(x), Y(y), sc + 0.5, sc + 0.5);
        }
        // edges
        c.lineCap = 'round';
        const edge = (x, y, dx, dy, color, wid) => {
            c.strokeStyle = color; c.lineWidth = wid * dpr;
            c.beginPath();
            if (dx === 1) { c.moveTo(X(x + 1), Y(y)); c.lineTo(X(x + 1), Y(y + 1)); }
            if (dx === -1) { c.moveTo(X(x), Y(y)); c.lineTo(X(x), Y(y + 1)); }
            if (dy === 1) { c.moveTo(X(x), Y(y + 1)); c.lineTo(X(x + 1), Y(y + 1)); }
            if (dy === -1) { c.moveTo(X(x), Y(y)); c.lineTo(X(x + 1), Y(y)); }
            c.stroke();
        };
        for (let i = 0; i < L.open.length; i++) {
            if (!L.open[i] || !vis(i)) continue;
            const x = i % Wd, y = (i / Wd) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const j = i + dx + dy * Wd;
                if (!L.open[j]) {
                    const exit = L.exit.wall === j;
                    edge(x, y, dx, dy, exit ? '#6bff7a' : seen[i] ? '#d8dcd0' : '#a89a5a', exit ? 3 : 1.5);
                } else if (Math.abs(L.floor[j] - L.floor[i]) > 0.3 && L.floor[j] < L.floor[i]) {
                    edge(x, y, dx, dy, 'rgba(160,140,110,0.6)', 1);
                }
            }
            const d = L.door[i];
            if (d >= 0) {
                const door = L.doors[d];
                if (door.secret && !door.found) continue;
                const col = door.secret ? '#c070ff' : door.key ? { blue: '#4a9bff', yellow: '#ffd23a', red: '#ff4a4a' }[door.key] : '#ffcc55';
                c.fillStyle = col;
                c.fillRect(X(x) + sc * 0.2, Y(y) + sc * 0.2, sc * 0.6, sc * 0.6);
            }
        }
        // keys and pickups you have seen
        for (const p of S.pickups) {
            if (p.taken) continue;
            const ci = S.world.cellAt(p.x, p.z);
            if (!vis(ci)) continue;
            if (p.id.startsWith('key_')) {
                c.fillStyle = { key_blue: '#4a9bff', key_yellow: '#ffd23a', key_red: '#ff4a4a' }[p.id];
                c.fillRect(X(p.x / CELL) - 4 * dpr, Y(p.z / CELL) - 4 * dpr, 8 * dpr, 8 * dpr);
            }
        }
        // terminals
        for (const t of S.terminals) if (vis(t.cell)) { c.fillStyle = t.read ? '#3a8a5a' : '#6bffb0'; c.fillRect(X(t.x) - 3 * dpr, Y(t.z) - 3 * dpr, 6 * dpr, 6 * dpr); }
        // monsters (only with the survey drone)
        if (all) for (const m of S.monsters) if (m.alive) { c.fillStyle = m.boss ? '#ff3a3a' : 'rgba(255,90,60,0.85)'; c.beginPath(); c.arc(X(m.x / CELL), Y(m.z / CELL), (m.boss ? 5 : 2.5) * dpr, 0, Math.PI * 2); c.fill(); }
        // player arrow
        const P = S.player;
        const px = X(P.x / CELL), py = Y(P.z / CELL);
        c.save(); c.translate(px, py); c.rotate(P.yaw);
        c.fillStyle = '#7dff8a';
        c.beginPath(); c.moveTo(0, -9 * dpr); c.lineTo(6 * dpr, 7 * dpr); c.lineTo(0, 3 * dpr); c.lineTo(-6 * dpr, 7 * dpr); c.closePath(); c.fill();
        c.restore();
        // legend
        c.fillStyle = '#9aa'; c.font = `${12 * dpr}px "Share Tech Mono", monospace`;
        c.textAlign = 'center';
        c.fillText(`${S.spec.id} — ${S.spec.name}`, w / 2, h - 46 * dpr);
        c.fillText(`Kills ${S.stats.kills}/${S.stats.monsters}   Items ${S.stats.items}/${S.stats.totalItems}   Secrets ${S.stats.secrets}/${S.stats.totalSecrets}   ${S.revealAll ? '· Survey Drone' : ''}`, w / 2, h - 28 * dpr);
        c.textAlign = 'left';
    }
}
