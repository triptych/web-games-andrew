// DOM screens and the HUD. main.js owns the flow; this module draws.

import { CAST, OPS } from './sim/campaign.js';
import { BRANCHES, SKILLS, SKILL_BY_ID, canBuy, rankOf, computeLoadout } from './sim/skills.js';
import { DIFFICULTY } from './sim/config.js';
import { makeTerrain, WATER, LAVA } from './sim/terrain.js';
import { bossHealth } from './sim/bosses.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString('en-US');

const ICONS = {
    barrel: '⦀', feed: '⇈', fan: '⋔', wide: '⩚', pierce: '➶', crit: '✶', ion: 'ϟ', missile: '➹', missiles: '⇶', rocket: '⇡',
    cluster: '⁂', drone: '⌖', eye: '◉', arc: '↯', armor: '⬢', speed: '»', repair: '✚', slim: '◊', shield: '◈', graze: '≋',
    phoenix: '♨', bomb: '✺', magnet: '⊃', od: '⚡', broker: '¤', clock: '◷', clap: '✹', storm: '☈',
};

// ---------------------------------------------------------------- portraits

export function drawPortrait(cv, who, t = 0, crowned = false) {
    const c = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    c.save();
    c.scale(W / 96, H / 96);
    const bg = { overwatch: ['#0d2a3a', '#06121a'], sparks: ['#3a2a0a', '#140c02'], ash: ['#3a1a0a', '#120804'], meridian: ['#3a0610', '#0a0103'] }[who] || ['#222', '#000'];
    const g = c.createRadialGradient(48, 40, 4, 48, 48, 70);
    g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
    c.fillStyle = g; c.fillRect(0, 0, 96, 96);
    const skin = { overwatch: '#7a4a32', sparks: '#4a2e1e', ash: '#d9a988' }[who];
    if (who === 'meridian') {
        for (let r = 44; r > 6; r -= 6) {
            c.beginPath(); c.arc(48, 48, r, 0, Math.PI * 2);
            c.strokeStyle = `rgba(255,${40 + r},${60 + r},${0.15 + (44 - r) / 60})`; c.lineWidth = 2; c.stroke();
        }
        const pulse = 0.7 + 0.3 * Math.sin(t * 3);
        const eg = c.createRadialGradient(48, 48, 0, 48, 48, 18);
        eg.addColorStop(0, '#fff'); eg.addColorStop(0.3, `rgba(255,90,120,${pulse})`); eg.addColorStop(1, 'rgba(255,0,40,0)');
        c.fillStyle = eg; c.beginPath(); c.arc(48, 48, 18, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#100006'; c.beginPath(); c.ellipse(48, 48, 2.5, 10, 0, 0, Math.PI * 2); c.fill();
    } else {
        // shoulders
        c.fillStyle = who === 'sparks' ? '#5a4a2a' : who === 'ash' ? '#3e4a36' : '#1e3448';
        c.beginPath(); c.moveTo(8, 96); c.quadraticCurveTo(14, 70, 48, 68); c.quadraticCurveTo(82, 70, 88, 96); c.fill();
        if (who === 'overwatch') { c.fillStyle = '#c9a44a'; c.fillRect(22, 80, 10, 3); c.fillRect(64, 80, 10, 3); }
        // neck + head
        c.fillStyle = skin; c.fillRect(41, 58, 14, 14);
        c.beginPath(); c.ellipse(48, 44, 17, 21, 0, 0, Math.PI * 2); c.fill();
        // shading
        const sh = c.createLinearGradient(30, 0, 66, 0);
        sh.addColorStop(0, 'rgba(255,255,255,0.12)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
        c.fillStyle = sh; c.beginPath(); c.ellipse(48, 44, 17, 21, 0, 0, Math.PI * 2); c.fill();
        // eyes
        c.fillStyle = '#111';
        c.beginPath(); c.ellipse(41, 43, 2.2, 1.5, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(55, 43, 2.2, 1.5, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(37, 38.5); c.lineTo(45, 39.5); c.moveTo(51, 39.5); c.lineTo(59, 38.5); c.stroke();
        c.beginPath(); c.moveTo(43, 55); c.quadraticCurveTo(48, who === 'sparks' ? 58 : 56.5, 53, 55); c.stroke();
        if (who === 'overwatch') {
            c.fillStyle = '#b8bcc0'; c.beginPath(); c.ellipse(48, 28, 18, 9, 0, Math.PI, 0); c.fill();
            c.fillRect(30, 26, 4, 14); c.fillRect(62, 26, 4, 14);
            c.fillStyle = '#1b2a36'; c.beginPath(); c.ellipse(48, 25, 21, 6, 0, 0, Math.PI * 2); c.fill();
            c.fillRect(30, 18, 36, 8);
            c.fillStyle = '#c9a44a'; c.fillRect(45, 19, 6, 5);
        } else if (who === 'sparks') {
            c.fillStyle = '#1a1410'; c.beginPath(); c.ellipse(48, 56, 15, 10, 0, 0, Math.PI); c.fill();
            c.fillStyle = '#c0392b'; c.beginPath(); c.ellipse(48, 27, 19, 10, 0, Math.PI, 0); c.fill(); c.fillRect(29, 26, 38, 4);
            c.fillStyle = '#334'; c.fillRect(33, 30, 30, 6);
            c.fillStyle = 'rgba(120,200,255,0.6)'; c.fillRect(35, 31, 11, 4); c.fillRect(50, 31, 11, 4);
        } else if (who === 'ash') {
            c.fillStyle = '#7a3a1e'; c.beginPath(); c.ellipse(48, 30, 19, 13, 0, Math.PI, 0); c.fill();
            c.fillStyle = '#d8d4c8'; c.beginPath(); c.ellipse(48, 30, 22, 17, 0, Math.PI * 1.02, -0.02); c.fill();
            c.fillStyle = '#ff9a62'; c.fillRect(27, 27, 42, 3);
            c.fillStyle = 'rgba(40,40,40,0.9)'; c.fillRect(25, 34, 6, 14); c.fillRect(65, 34, 6, 14);
            if (crowned) {
                c.strokeStyle = '#ff3b5c'; c.lineWidth = 2; c.beginPath(); c.ellipse(48, 22, 20, 5, 0, 0, Math.PI * 2); c.stroke();
                c.fillStyle = 'rgba(255,40,70,0.6)'; c.fillRect(39, 41, 6, 3); c.fillRect(52, 41, 6, 3);
            }
        }
        // headset mic
        c.strokeStyle = '#222'; c.lineWidth = 2; c.beginPath(); c.moveTo(31, 48); c.quadraticCurveTo(32, 60, 42, 60); c.stroke();
    }
    // scanlines
    c.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < 96; y += 3) c.fillRect(0, y, 96, 1);
    c.restore();
}

// ---------------------------------------------------------------- screens

export class UI {
    constructor(audio) {
        this.audio = audio;
        this.cur = null;
        this.stack = [];
        this.commsQ = [];
        this.commsT = 0;
        this.hudCache = {};
        this.portraitT = 0;
        document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { this.audio.ui('click'); this.back(); }));
        document.addEventListener('pointerover', (e) => { if (e.target.closest && e.target.closest('.screen button')) this.audio.ui('hover'); });
    }

    show(id, push = false) {
        if (push && this.cur) this.stack.push(this.cur);
        else this.stack = [];
        for (const s of document.querySelectorAll('.screen.show')) s.classList.remove('show');
        this.cur = id;
        if (id) {
            const el = $(id);
            el.classList.add('show');
            const f = el.querySelector('button.primary:not(:disabled), button:not(:disabled)');
            if (f && !matchMedia('(pointer: coarse)').matches) f.focus({ preventScroll: true });
        }
        if (this.onShow) this.onShow(id);
    }

    back() {
        const prev = this.stack.pop();
        if (this.onBack && this.onBack(this.cur, prev)) return;
        this.show(prev || 'title');
    }

    toast(msg, ms = 1800) {
        const t = $('toast');
        t.textContent = msg; t.hidden = false;
        clearTimeout(this.toastT);
        this.toastT = setTimeout(() => { t.hidden = true; }, ms);
    }

    // ------------------------------------------------------------ title & ops

    title(profile, version) {
        $('btn-continue').hidden = !(profile.nextOp > 0 || profile.prologueSeen);
        $('btn-continue').textContent = profile.nextOp >= OPS.length ? 'Replay finale' : `Continue · Op ${Math.min(profile.nextOp, OPS.length - 1) + 1}`;
        $('btn-new').classList.toggle('primary', $('btn-continue').hidden);
        $('btn-continue').classList.toggle('primary', !$('btn-continue').hidden);
        const endlessOpen = profile.cleared.length >= 2;
        $('btn-endless').disabled = !endlessOpen;
        $('btn-endless').innerHTML = endlessOpen ? `Stormfront <small>endless${profile.endlessBest ? ' · best ' + fmt(profile.endlessBest) : ''}</small>` : 'Stormfront <small>clear op 2</small>';
        $('btn-ops').disabled = profile.cleared.length === 0;
        $('title-salv').innerHTML = profile.salvage ? `⚙ ${fmt(profile.salvage)} salvage` : '';
        $('title-ver').textContent = 'v' + version;
    }

    opsList(profile, onPick) {
        const list = $('ops-list');
        list.innerHTML = '';
        OPS.forEach((op, i) => {
            const open = i <= profile.nextOp && i < OPS.length;
            const b = document.createElement('button');
            b.className = 'op-card' + (open ? '' : ' locked');
            b.disabled = !open;
            const best = profile.best[op.id];
            b.innerHTML = `<span class="n">OP ${i + 1} · ${op.biome.toUpperCase()}</span><span class="t">${op.name.replace('Operation ', '')}</span><span class="p">${op.place}</span>` +
                (best ? `<span class="best">BEST ${fmt(best.score)} · RANK ${best.rank}</span>` : '');
            b.addEventListener('click', () => { this.audio.ui('click'); onPick(i); });
            list.appendChild(b);
        });
    }

    prologue(lines, onDone) {
        const cr = $('crawl');
        cr.innerHTML = '';
        lines.forEach((l, i) => {
            const p = document.createElement('p');
            p.textContent = l;
            p.style.animationDelay = (0.3 + i * 1.7) + 's';
            cr.appendChild(p);
        });
        const btn = $('prologue-skip');
        btn.onclick = () => { this.audio.ui('click'); onDone(); };
    }

    // ------------------------------------------------------------ briefing

    briefing(op, idx, profile, onDiff) {
        $('b-num').textContent = 'OP ' + (idx + 1);
        $('b-name').textContent = op.name;
        $('b-place').textContent = `${op.place} · ${op.time}`;
        $('b-obj').textContent = op.objective;
        $('b-boss').textContent = `${op.bossName} — ${op.bossClass}`;
        const lines = $('b-lines');
        lines.innerHTML = '';
        op.briefing.forEach(([who, text], i) => {
            const d = document.createElement('div');
            d.className = 'line';
            d.style.animationDelay = (0.2 + i * 0.45) + 's';
            const cv = document.createElement('canvas'); cv.width = cv.height = 88;
            drawPortrait(cv, who, 0, false);
            const body = document.createElement('div');
            body.innerHTML = `<div class="who" style="color:${CAST[who].color}">${CAST[who].name} · ${CAST[who].full}</div><div class="say"></div>`;
            body.querySelector('.say').textContent = text;
            d.append(cv, body);
            lines.appendChild(d);
        });
        const diff = $('b-diff');
        diff.innerHTML = '';
        for (const k of Object.keys(DIFFICULTY)) {
            const D = DIFFICULTY[k];
            const b = document.createElement('button');
            b.setAttribute('role', 'radio');
            b.setAttribute('aria-checked', String(profile.difficulty === k));
            b.innerHTML = `<b>${D.name}</b><span>${D.blurb}</span>`;
            b.addEventListener('click', () => {
                this.audio.ui('click');
                diff.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', 'false'));
                b.setAttribute('aria-checked', 'true');
                onDiff(k);
            });
            diff.appendChild(b);
        }
        this.drawMap(op);
    }

    drawMap(op) {
        const cv = $('b-map');
        const c = cv.getContext('2d');
        const w = 90, h = 150;
        const img = c.createImageData(w, h);
        const t = makeTerrain(op.biome, 1000 + OPS.indexOf(op) * 97, { platformY: op.biome === 'volcano' ? op.length * op.scroll : Infinity });
        const len = 900; // the insertion zone, at the canvas's own aspect ratio
        const pal = {
            coast: [[40, 120, 60], [20, 70, 120]], jungle: [[20, 80, 30], [70, 80, 50]], desert: [[200, 160, 100], [40, 120, 130]],
            arctic: [[220, 230, 240], [20, 50, 70]], city: [[50, 50, 70], [10, 20, 40]], volcano: [[50, 40, 40], [255, 90, 20]],
        }[op.biome];
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
            const x = i / w * 540, y = (1 - j / h) * len;
            const k = t.kind(x, y);
            const col = k === 0 ? pal[0] : pal[1];
            const n = ((i * 7 + j * 13) % 5) * 4;
            const o = (j * w + i) * 4;
            img.data[o] = col[0] * 0.55 + n; img.data[o + 1] = col[1] * 0.75 + n; img.data[o + 2] = col[2] * 0.55 + n; img.data[o + 3] = 255;
            if (k !== 0 && op.biome !== 'volcano') { img.data[o] *= 0.6; img.data[o + 1] *= 0.8; }
        }
        const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
        tmp.getContext('2d').putImageData(img, 0, 0);
        c.imageSmoothingEnabled = false;
        c.drawImage(tmp, 0, 0, cv.width, cv.height);
        c.fillStyle = 'rgba(0,255,120,0.12)';
        for (let y = 0; y < cv.height; y += 3) c.fillRect(0, y, cv.width, 1);
        c.strokeStyle = 'rgba(120,255,160,0.25)'; c.lineWidth = 1;
        for (let x = 0; x < cv.width; x += 30) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, cv.height); c.stroke(); }
        for (let y = 0; y < cv.height; y += 30) { c.beginPath(); c.moveTo(0, y); c.lineTo(cv.width, y); c.stroke(); }
        // route + markers
        c.strokeStyle = '#ffcf5a'; c.setLineDash([4, 4]); c.lineWidth = 2;
        c.beginPath(); c.moveTo(cv.width / 2, cv.height - 10); c.lineTo(cv.width / 2, 22); c.stroke(); c.setLineDash([]);
        c.fillStyle = '#ff3b5c'; c.beginPath(); c.arc(cv.width / 2, 18, 7, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff'; c.font = 'bold 10px monospace'; c.textAlign = 'center'; c.fillText('!', cv.width / 2, 22);
        c.fillStyle = '#5fd6ff'; c.beginPath(); c.moveTo(cv.width / 2, cv.height - 18); c.lineTo(cv.width / 2 - 6, cv.height - 6); c.lineTo(cv.width / 2 + 6, cv.height - 6); c.fill();
    }

    // ------------------------------------------------------------ hangar

    hangar(profile, atlas, handlers) {
        this.hangarState = { profile, atlas, handlers, sel: this.hangarState?.sel || null };
        this.renderTree();
        this.startHeliPreview();
    }

    renderTree() {
        const { profile, handlers } = this.hangarState;
        $('h-salv').textContent = fmt(profile.salvage);
        const tree = $('tree');
        tree.innerHTML = '';
        for (const br of BRANCHES) {
            const col = document.createElement('div');
            col.className = 'branch';
            col.style.setProperty('--bc', br.color);
            col.innerHTML = `<h4 style="color:${br.color}">${br.name}</h4><div class="bl">${br.blurb}</div>`;
            const nodes = document.createElement('div');
            nodes.className = 'nodes';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            nodes.appendChild(svg);
            const skills = SKILLS.filter((s) => s.b === br.id);
            const pos = (s) => ({ x: 50 + s.col * 30, y: s.row * 60 + 4 });
            for (const s of skills) {
                for (const q of s.req || []) {
                    const a = pos(SKILL_BY_ID[q]), b = pos(s);
                    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    l.setAttribute('x1', a.x + '%'); l.setAttribute('y1', a.y + 24);
                    l.setAttribute('x2', b.x + '%'); l.setAttribute('y2', b.y + 24);
                    const on = rankOf(profile.owned, q) > 0;
                    l.setAttribute('stroke', on ? br.color : 'rgba(140,200,220,0.25)');
                    l.setAttribute('stroke-width', on ? 3 : 2);
                    svg.appendChild(l);
                }
            }
            for (const s of skills) {
                const r = rankOf(profile.owned, s.id);
                const cb = canBuy(profile.owned, s.id, profile.salvage);
                const reqOk = (s.req || []).every((q) => rankOf(profile.owned, q) > 0);
                const b = document.createElement('button');
                b.className = 'node' + (r > 0 ? ' owned' : '') + (r >= s.ranks ? ' max' : '') + (!reqOk ? ' locked' : '') + (cb.ok ? ' can afford' : '') + (this.hangarState.sel === s.id ? ' sel' : '');
                b.style.setProperty('--bc', br.color);
                const p = pos(s);
                b.style.left = p.x + '%'; b.style.top = p.y + 'px';
                b.innerHTML = `${ICONS[s.icon] || '•'}<span class="rk">${r}/${s.ranks}</span>`;
                b.setAttribute('aria-label', `${s.name}, rank ${r} of ${s.ranks}`);
                b.addEventListener('click', () => { this.audio.ui('click'); this.hangarState.sel = s.id; this.renderTree(); });
                nodes.appendChild(b);
            }
            col.appendChild(nodes);
            tree.appendChild(col);
        }
        // detail
        const det = $('h-detail');
        const sel = this.hangarState.sel && SKILL_BY_ID[this.hangarState.sel];
        if (!sel) det.innerHTML = '<div class="d-empty">Tap a system to inspect it. Refunds are free.</div>';
        else {
            const r = rankOf(profile.owned, sel.id);
            const cb = canBuy(profile.owned, sel.id, profile.salvage);
            const br = BRANCHES.find((x) => x.id === sel.b);
            det.innerHTML = `<div class="d-body"><div class="d-name" style="color:${br.color}">${ICONS[sel.icon] || ''} ${sel.name}</div><div class="d-rank">RANK ${r}/${sel.ranks}${r < sel.ranks ? ' · NEXT ' + fmt(sel.cost[r]) + ' SALVAGE' : ' · MAXED'}</div><div class="d-desc"></div></div>`;
            det.querySelector('.d-desc').textContent = sel.desc + ((sel.req || []).length ? ' Requires ' + sel.req.map((q) => SKILL_BY_ID[q].name).join(' + ') + '.' : '');
            const buy = document.createElement('button');
            buy.className = 'primary';
            buy.textContent = r >= sel.ranks ? 'Maxed' : cb.ok ? `Install · ${fmt(cb.cost)}` : cb.why;
            buy.disabled = !cb.ok;
            buy.addEventListener('click', () => this.hangarState.handlers.buy(sel.id));
            det.appendChild(buy);
        }
        // stats
        const L = computeLoadout(profile.owned);
        const st = [
            ['Armour', L.maxArmor], ['Gun streams', L.streams], ['Gun damage', '×' + L.dmgMul.toFixed(2)], ['Fire rate', '×' + L.rofMul.toFixed(2)],
            ['Missile pairs', L.missiles], ['Drones', L.drones], ['EMP charges', L.bombs], ['Overdrive', L.odDur + ' s'], ['Salvage', '×' + L.salvageMul.toFixed(2)],
        ];
        $('h-stats').innerHTML = st.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
    }

    startHeliPreview() {
        const cv = $('h-heli');
        const ctx = cv.getContext('2d');
        const { atlas } = this.hangarState;
        if (!atlas) return;
        const draw = (name, x, y, rot, sc, alpha = 1) => {
            const s = atlas.sprites[name];
            if (!s) return;
            const A = atlas.canvas;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(x, y); ctx.rotate(rot);
            const w = s.w * sc, h = s.h * sc;
            ctx.drawImage(A, s.u0 * A.width, s.v0 * A.height, (s.u1 - s.u0) * A.width, (s.v1 - s.v0) * A.height, -w / 2, -h / 2, w, h);
            ctx.restore();
        };
        cancelAnimationFrame(this.heliRAF);
        const loop = (now) => {
            if (this.cur !== 'hangar') return;
            const t = now / 1000;
            const L = computeLoadout(this.hangarState.profile.owned);
            ctx.clearRect(0, 0, cv.width, cv.height);
            const cx = cv.width / 2, cy = cv.height / 2 + 6, sc = 2.6;
            ctx.save(); ctx.globalAlpha = 0.35; ctx.filter = 'brightness(0)';
            draw('heli', cx + 12, cy + 16, 0, sc);
            ctx.restore();
            if (L.missiles) for (const s of [-1, 1]) draw('pod_msl', cx + s * (L.rockets ? 17 : 14) * sc, cy - 1 * sc, 0, sc);
            if (L.rockets) for (const s of [-1, 1]) draw('pod_rkt', cx + s * (L.missiles ? 10.5 : 14) * sc, cy - 1 * sc, 0, sc);
            draw('heli', cx, cy, 0, sc);
            draw('rotor', cx, cy - 7 * sc, t * 30, sc, 0.75);
            draw('tailrotor', cx + 1.5 * sc, cy + 30 * sc, t * 50, sc);
            for (let i = 0; i < L.drones; i++) {
                const s = i ? 1 : -1;
                draw('drone', cx + s * 70, cy + 40 + Math.sin(t * 2 + i) * 4, 0, 1.8);
            }
            this.heliRAF = requestAnimationFrame(loop);
        };
        this.heliRAF = requestAnimationFrame(loop);
    }

    // ------------------------------------------------------------ HUD

    hudReset(world) {
        this.hudCache = {};
        this.commsQ = [];
        this.commsT = 0;
        $('comms').hidden = true;
        $('boss').hidden = true;
        $('banner').hidden = true;
        $('warning').hidden = true;
        $('hud').classList.remove('boss-on');
        $('progress').hidden = !!world.endless;
    }

    hud(world, dt) {
        const c = this.hudCache;
        const p = world.player;
        const set = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
        set('armor', p.armor + '/' + p.maxArmor, () => {
            const a = $('armor');
            a.innerHTML = '';
            for (let i = 0; i < p.maxArmor; i++) { const e = document.createElement('i'); if (i >= p.armor) e.className = 'off'; a.appendChild(e); }
            a.classList.toggle('low', p.armor <= 1);
        });
        set('shield', p.shield, (v) => { $('shield-ico').hidden = !v; });
        set('score', world.score, (v) => { $('score').textContent = fmt(v); });
        const m = world.mult.toFixed(1);
        set('mult', m, (v) => { $('mult-v').textContent = '×' + v; $('mult').classList.toggle('hot', world.mult >= 2); });
        set('chain', world.chain, (v) => { $('chain').textContent = v >= 5 ? v + ' chain' : ''; });
        set('salv', Math.floor(world.salvage), (v) => { $('salv-v').textContent = fmt(v); });
        set('bombs', p.bombs, (v) => {
            $('bombs').innerHTML = '<i></i>'.repeat(Math.min(v, 9));
            $('t-bomb-n').textContent = v;
        });
        const odv = p.odT > 0 ? p.odT / world.L.odDur : p.od;
        set('od', Math.round(odv * 100), (v) => { $('od-fill').style.width = v + '%'; });
        const ods = p.odT > 0 ? 'active' : p.od >= 1 ? 'ready' : '';
        set('ods', ods, (v) => {
            $('od').className = v;
            $('t-od').classList.toggle('ready', v === 'ready');
            $('od-label').textContent = v === 'ready' ? 'OVERDRIVE READY' : 'OVERDRIVE';
        });
        if (!world.endless) {
            const prog = Math.min(1, world.director.t / world.director.bossAt);
            set('prog', Math.round(prog * 200), (v) => { $('progress-fill').style.height = (v / 2) + '%'; });
        }
        const b = world.boss;
        const showBoss = !!(b && b.alive && !b.entering);
        set('bossOn', showBoss, (v) => { $('boss').hidden = !v; $('hud').classList.toggle('boss-on', v); });
        if (showBoss) {
            const hp = bossHealth(b);
            set('bossHp', Math.round(hp * 500), (v) => { $('boss-fill').style.width = (v / 5) + '%'; $('boss-lag').style.width = (v / 5) + '%'; });
            set('bossName', b.name + b.phaseIdx, () => {
                $('boss-name').textContent = b.name;
                $('boss-phase').textContent = b.phaseIdx >= 0 ? `PHASE ${b.phaseIdx + 1}/${b.phaseCount}` : '';
                $('boss-fill').classList.toggle('time', !!(b.phase && b.phase.gate === 'time'));
            });
            set('spell', b.spell || '', (v) => { const s = $('boss-spell'); s.textContent = v; s.classList.remove('new'); void s.offsetWidth; s.classList.add('new'); });
        }
        // comms queue
        this.portraitT += dt;
        if (this.commsT > 0) {
            this.commsT -= dt;
            const el = $('comms-text');
            const full = el.dataset.full || '';
            const shown = Math.min(full.length, Math.floor((this.commsDur - this.commsT) * 55));
            if (el.textContent.length !== shown) el.textContent = full.slice(0, shown);
            if (this.commsWho === 'meridian' && Math.random() < 0.3) drawPortrait($('comms-face'), 'meridian', this.portraitT);
            if (this.commsT <= 0) {
                if (this.commsQ.length) this.nextComms();
                else { $('comms').classList.add('out'); setTimeout(() => { if (this.commsT <= 0) $('comms').hidden = true; }, 300); }
            }
        } else if (this.commsQ.length) this.nextComms();
    }

    comms(who, text, bark = false, crowned = false) {
        if (bark && (this.commsT > 0 || this.commsQ.length)) return;
        this.commsQ.push({ who, text, crowned });
        if (this.commsQ.length > 4) this.commsQ.shift();
    }

    nextComms() {
        const { who, text, crowned } = this.commsQ.shift();
        const el = $('comms');
        el.hidden = false;
        el.classList.remove('out');
        void el.offsetWidth;
        el.style.setProperty('--cc', CAST[who].color);
        $('comms-name').textContent = CAST[who].name;
        const t = $('comms-text');
        t.dataset.full = text;
        t.textContent = '';
        drawPortrait($('comms-face'), who, this.portraitT, crowned);
        this.commsWho = who;
        this.commsDur = this.commsT = 2.6 + text.length * 0.045;
        this.audio.ui('comms');
    }

    banner(text, sub = '') {
        const b = $('banner');
        $('banner-text').textContent = text;
        $('banner-sub').textContent = sub;
        b.hidden = false;
        b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
        clearTimeout(this.bannerT);
        this.bannerT = setTimeout(() => { b.hidden = true; }, 3200);
    }

    warning(name) {
        const w = $('warning');
        $('warning-sub').textContent = name ? name + ' APPROACHING' : '';
        w.hidden = false;
        w.style.animation = 'none'; void w.offsetWidth; w.style.animation = '';
        clearTimeout(this.warnT);
        this.warnT = setTimeout(() => { w.hidden = true; }, 3400);
    }

    // ------------------------------------------------------------ results

    debrief(r) {
        $('d-op').textContent = r.opLabel;
        $('d-title').textContent = r.title;
        const rows = r.rows.map(([k, v], i) => `<tr style="animation-delay:${0.2 + i * 0.18}s"><td>${k}</td><td data-v="${v}">${v}</td></tr>`).join('');
        $('d-tally').innerHTML = rows + `<tr class="total" style="animation-delay:${0.2 + r.rows.length * 0.18}s"><td>Salvage earned</td><td>⚙ ${fmt(r.salvage)}</td></tr>`;
        const rk = $('d-rank');
        rk.textContent = r.rank;
        rk.classList.remove('go');
        setTimeout(() => { rk.classList.add('go'); this.audio.explosion(270, 's'); }, 400 + r.rows.length * 180);
        $('d-story').innerHTML = r.story ? `<p></p>` : '';
        if (r.story) $('d-story').querySelector('p').textContent = r.story;
        $('d-next').textContent = r.nextLabel;
        $('d-next').hidden = !r.nextLabel;
    }

    ending(paragraphs, credits, onDone) {
        const t = $('end-text');
        t.innerHTML = '';
        paragraphs.forEach((l, i) => {
            const p = document.createElement('p');
            p.textContent = l;
            p.style.animationDelay = (0.5 + i * 2.6) + 's';
            t.appendChild(p);
        });
        const cr = $('end-credits');
        cr.innerHTML = credits;
        cr.style.opacity = 0;
        setTimeout(() => { cr.style.transition = 'opacity 2s'; cr.style.opacity = 1; }, (0.5 + paragraphs.length * 2.6) * 1000);
        $('end-skip').onclick = () => { this.audio.ui('click'); onDone(); };
    }

    // ------------------------------------------------------------ options

    options(settings, onChange) {
        const o = $('opts');
        o.innerHTML = '';
        const row = (label, el) => { const l = document.createElement('label'); l.textContent = label; o.append(l, el); };
        const range = (key, min, max, step) => {
            const i = document.createElement('input');
            i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = settings[key];
            i.addEventListener('input', () => { settings[key] = +i.value; onChange(key); });
            return i;
        };
        const tog = (key) => {
            const b = document.createElement('button');
            b.className = 'tog';
            const upd = () => { b.setAttribute('aria-pressed', String(!!settings[key])); b.textContent = settings[key] ? 'On' : 'Off'; };
            upd();
            b.addEventListener('click', () => { settings[key] = !settings[key]; upd(); this.audio.ui('click'); onChange(key); });
            return b;
        };
        row('Music volume', range('music', 0, 1, 0.05));
        row('Effects volume', range('sfx', 0, 1, 0.05));
        row('Screen shake', range('shake', 0, 1.5, 0.1));
        row('Touch sensitivity', range('sens', 0.6, 2.4, 0.1));
        const q = document.createElement('select');
        for (const [v, l] of [['auto', 'Auto'], ['low', 'Low'], ['med', 'Medium'], ['high', 'High']]) { const op = document.createElement('option'); op.value = v; op.textContent = l; if (settings.quality === v) op.selected = true; q.appendChild(op); }
        q.addEventListener('change', () => { settings.quality = q.value; onChange('quality'); });
        row('Graphics quality', q);
        row('Auto-fire', tog('autofire'));
        row('Always show hitbox', tog('hitbox'));
        row('Reduce flashing', tog('reduceFlash'));
        row('Scanlines', tog('scan'));
        row('Show FPS', tog('fps'));
    }
}

export { fmt, ICONS };
