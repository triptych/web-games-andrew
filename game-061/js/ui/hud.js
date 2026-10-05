// The in-flight HUD: status bars, wallet, speed/throttle, contextual prompt, target card,
// quest tracker, toasts, banners, the 2D marker overlay and the Elite-style 3D scanner.

import { $, h, fmt, fmtDist, itemName } from './dom.js';
import { ITEMS, ROCK_TYPES, PLANET_TYPES, ENEMIES, standingBand } from '../config.js';
import { vdist } from '../sim/vec.js';
import { leadPoint } from '../sim/ai.js';
import { questNav, questTypeName } from '../sim/quests.js';
import { storyNav } from '../sim/story.js';

const CTX_TEXT = {
    dock: (c) => `Dock at ${c.name}`, scan: (c) => (c.rescan ? `Hold: re-scan ${c.name}` : `Hold: survey ${c.name}`), derelict: (c) => `Hold: salvage ${c.name}`,
    anomaly: (c) => `Hold: study ${c.name}`, cache: () => 'Hold: crack resource cache', beacon: () => 'Hold: decode nav beacon', wreck: () => 'Hold: recover flight recorder',
    precursor: () => 'Hold: recover the Precursor Shard', lattice: () => 'Hold: activate the Lattice',
};
const KIND_LABEL = { hearth: 'YOUR BASE', hub: 'TRADE HUB', outpost: 'OUTPOST', shipyard: 'SHIPYARD', refinery: 'REFINERY', embassy: 'EMBASSY', planet: 'PLANET', belt: 'ASTEROID BELT', derelict: 'DERELICT', anomaly: 'ANOMALY', cache: 'CACHE', beacon: 'NAV BEACON', wreck: 'MISSION · WRECK', precursor: 'PRECURSOR SITE', lattice: 'THE LATTICE', hoard: "WARLORD'S HOARD", nest: 'MISSION · NEST', bountyZone: 'MISSION · BOUNTY' };

export class HUD {
    constructor(view, input) {
        this.view = view;
        this.input = input;
        this.el = $('hud');
        this.ov = $('overlay');
        this.og = this.ov.getContext('2d');
        this.sc = $('scanner');
        this.sg = this.sc.getContext('2d');
        this.toasts = $('toasts');
        this.trT = 0;
        this.bannerT = 0;
        this.alertT = 0;
        this.tipKey = '';
        this.cache = {};
        this.onTrack = null;
        this.bars = {};
        for (const id of ['shield', 'hull', 'energy', 'cargo']) { const b = $(`b-${id}`); this.bars[id] = { el: b, fill: b.querySelector('b'), txt: b.querySelector('span') }; }
        $('ctx').addEventListener('pointerdown', (e) => { e.preventDefault(); this.input.edges.add('interact'); this.input.touch.buttons.add('interact'); });
        $('ctx').addEventListener('pointerup', () => this.input.touch.buttons.delete('interact'));
        $('ctx').addEventListener('pointerleave', () => this.input.touch.buttons.delete('interact'));
    }

    show(on) { this.el.classList.toggle('hidden', !on); if (!on) this.og.clearRect(0, 0, this.ov.width, this.ov.height); }

    set(id, text) { if (this.cache[id] !== text) { this.cache[id] = text; $(id).textContent = text; } }

    toast(text, kind = 'info') {
        const el = h(`div.toast.${kind}`, text);
        this.toasts.prepend(el);
        while (this.toasts.children.length > 6) this.toasts.lastChild.remove();
        setTimeout(() => el.classList.add('out'), kind === 'bad' || kind === 'warn' ? 4200 : 3200);
        setTimeout(() => el.remove(), 4800);
    }
    banner(t1, t2 = '', kind = '', dur = 3) {
        const b = $('banner');
        b.className = kind;
        b.querySelector('.b1').textContent = t1;
        b.querySelector('.b2').textContent = t2;
        b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
        this.bannerT = dur;
    }
    alert(text, dur = 3) { const a = $('h-alert'); a.textContent = text; a.classList.remove('hidden'); this.alertT = dur; }
    tip(html) {
        const t = $('tip');
        if (!html) { t.classList.add('hidden'); this.tipKey = ''; return; }
        if (this.tipKey !== html) { t.innerHTML = html; this.tipKey = html; }
        t.classList.remove('hidden');
    }

    update(world, game, dt, nav) {
        const p = world.player;
        const st = game.stats();
        const sh = game.s.ship;
        const B = this.bars;
        const setBar = (b, v, max, label) => { b.fill.style.width = `${Math.max(0, Math.min(1, v / max)) * 100}%`; const t = label ?? `${Math.ceil(v)}/${Math.round(max)}`; if (b.txt.textContent !== t) b.txt.textContent = t; };
        setBar(B.shield, p.shield, st.shield);
        setBar(B.hull, sh.hp, st.hullMax);
        B.hull.el.classList.toggle('low', sh.hp < st.hullMax * 0.3);
        setBar(B.energy, p.energy, st.energyMax, `${Math.round(p.energy)}%`);
        const used = game.cargoUsed();
        setBar(B.cargo, used, st.cargo);
        B.cargo.el.classList.toggle('full', used >= st.cargo);
        const fuelKey = `${sh.fuel}/${st.fuelMax}`;
        if (this.cache.fuel !== fuelKey) {
            this.cache.fuel = fuelKey;
            const cells = $('h-fuel').querySelector('.cells');
            cells.replaceChildren(...Array.from({ length: st.fuelMax }, (_, i) => h(`i${i < sh.fuel ? '.on' : ''}`)));
        }
        this.set('h-shipname', `${sh.name.toUpperCase()} · ${st.hullName.toUpperCase()}`);
        this.set('h-credits', fmt(game.s.credits));
        this.set('h-data', fmt(game.s.data));
        const meta = game.sysMeta;
        this.set('h-sys', meta.name.toUpperCase());
        const owner = meta.owner >= 0 ? game.galaxy.species[meta.owner].gov : meta.pirate ? 'Reaver haven' : 'Unclaimed';
        this.set('h-sub', `${owner} · danger ${'●'.repeat(meta.danger)}${'○'.repeat(5 - meta.danger)}`);
        // speed & mode
        const sv = Math.round(p.speed);
        if (this.cache.spd !== sv) { this.cache.spd = sv; $('h-speed').innerHTML = `<b>${sv}</b><small>u/s</small>`; }
        $('h-throttle').querySelector('b').style.width = `${p.throttle * 100}%`;
        const cr = p.cruise.state;
        const mode = world.warp ? 'WARP CHARGING' : cr === 'on' ? (world.target ? 'CRUISE · AUTOPILOT' : 'CRUISE') : cr === 'charge' ? 'CRUISE CHARGING' : p.boosting ? 'BOOST' : p.scooping === 'fuel' ? 'FUEL SCOOPING' : p.scooping === 'gas' ? 'GAS SKIMMING' : p.mining ? 'MINING' : '';
        this.set('h-mode', mode);
        $('h-mode').classList.toggle('cruise', cr !== 'off' || !!world.warp);
        const heat = $('h-heat');
        heat.classList.toggle('hidden', p.heat < 1 && !p.mining);
        heat.classList.toggle('over', p.overheated);
        heat.querySelector('b').style.width = `${p.heat}%`;
        // context prompt
        const ctx = world.ctx;
        const ce = $('ctx');
        if (ctx && !p.dead) {
            ce.classList.remove('hidden');
            ce.classList.toggle('bad', !ctx.ok);
            const txt = ctx.ok ? CTX_TEXT[ctx.kind]?.(ctx) || ctx.name : ctx.why || ctx.name;
            this.set('ctx-text', txt);
            ce.querySelector('kbd').textContent = this.input.isTouch ? 'ACT' : 'E';
            const prog = $('ctx-prog');
            prog.classList.toggle('hidden', !ctx.hold);
            prog.querySelector('b').style.width = `${(ctx.progress || 0) * 100}%`;
        } else ce.classList.add('hidden');
        $('tb-act')?.classList.toggle('ready', !!ctx && ctx.ok);
        // mouse steering vector
        const mv = $('mouse-vec');
        if (this.input.mouseSteering && !world.docked) {
            mv.classList.add('on');
            const m = this.input.mouse;
            mv.style.transform = `translate(${m.x - innerWidth / 2}px, ${m.y - innerHeight / 2}px)`;
        } else mv.classList.remove('on');
        // timers
        if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('banner').classList.add('hidden'); else $('banner').classList.remove('hidden'); }
        if (this.alertT > 0) { this.alertT -= dt; if (this.alertT <= 0) $('h-alert').classList.add('hidden'); }
        this.updateTarget(world, game);
        this.trT -= dt;
        if (this.trT <= 0) { this.trT = 0.5; this.updateTracker(world, game, nav); }
        this.drawOverlay(world, game, nav);
        this.drawScanner(world, game);
    }

    updateTarget(world, game) {
        const card = $('hud-br');
        const o = world.findNav(world.target);
        if (!o) { card.classList.add('hidden'); return; }
        card.classList.remove('hidden');
        const d = vdist(o.pos, world.player.pos);
        const isEnemy = typeof o.id === 'number';
        card.classList.toggle('hostile', isEnemy);
        const key = `${o.id}|${Math.round(d / 10)}|${isEnemy ? Math.round(o.hp) + '|' + Math.round(o.shield) : ''}`;
        if (this.cache.tkey === key) return;
        this.cache.tkey = key;
        let kind = isEnemy ? `HOSTILE · ${ENEMIES[o.type].faction.toUpperCase()}` : KIND_LABEL[o.kind] || o.kind?.toUpperCase() || '';
        if (o.kind === 'planet') kind = `PLANET · ${PLANET_TYPES[o.type].name.toUpperCase()}`;
        this.set('t-kind', kind);
        this.set('t-name', o.name);
        const eta = world.player.cruise.state === 'on' ? '' : d > 2500 ? ' · press C to cruise' : '';
        this.set('t-dist', fmtDist(d) + eta);
        const info = $('t-info');
        const bars = $('t-bars');
        info.replaceChildren();
        bars.replaceChildren();
        if (isEnemy) {
            const mk = (lbl, v, m, c) => h('div.bar', h('label', lbl), h('i', h('b', { style: { width: `${Math.max(0, v / m) * 100}%`, background: c } })));
            if (o.maxShield > 0) bars.append(mk('SHD', o.shield, o.maxShield, '#5ef0ff'));
            bars.append(mk('HULL', o.hp, o.maxHp, '#ff5470'));
        } else if (o.kind === 'planet') {
            const sc = game.s.scanned[o.id];
            info.append(...[h('div', sc ? h('span.ok', '✓ Surveyed') : `Unsurveyed · worth ~${o.scanValue} data`), PLANET_TYPES[o.type].giant ? h('div.muted', game.stats().scoopGas ? 'Skim the upper atmosphere slowly for Helium-3' : 'Gas giant: a Mk II Scoop can skim Helium-3') : null].filter(Boolean));
        } else if (o.kind === 'belt') {
            if (game.stats().scanComp) info.append(h('div.comp', Object.entries(o.comp).sort((a, b) => b[1] - a[1]).map(([k]) => h('span', { style: { color: ROCK_TYPES[k].glow || ROCK_TYPES[k].color, borderColor: ROCK_TYPES[k].glow || ROCK_TYPES[k].color } }, ROCK_TYPES[k].name))));
            else info.append(h('div.muted', 'Composition unknown (Scanner Mk II)'));
        } else if (o.species != null && o.species >= 0) {
            const sp = game.galaxy.species[o.species];
            const band = standingBand(game.standing(sp.id));
            info.append(h('div', sp.gov), h('div', { style: { color: band.color } }, `${band.name} (${Math.round(game.standing(sp.id))})`));
        } else if (o.kind === 'hearth') info.append(h('div.muted', 'Home. Unload, build, upgrade.'));
    }

    updateTracker(world, game, nav) {
        const tr = $('tracker');
        const items = [];
        const stage = game.stage();
        const sysName = (id) => game.galaxy.systems[id]?.name;
        if (stage) {
            const goals = stage.goals(game);
            const sn = storyNav(game);
            items.push(h(`div.trk.story${nav?.kind === 'story' ? '.on' : ''}`, { onclick: () => this.onTrack?.({ kind: 'story' }) },
                h('h4', `◈ ${stage.title.toUpperCase()}`),
                goals.map(([t, v, m]) => h(`p${v >= m ? '.done' : ''}`, `${t}${m > 1 ? `  ${Math.floor(v)}/${m}` : ''}`)),
                sn && sn.system !== game.s.location.system ? h('div.where', `→ ${sysName(sn.system)} (open the Galaxy Map)`) : null));
        }
        for (const q of game.s.quests.slice(0, 4)) {
            const qn = questNav(game, q);
            const here = qn.system === game.s.location.system;
            items.push(h(`div.trk${nav?.kind === 'quest' && nav.id === q.id ? '.on' : ''}`, { onclick: () => this.onTrack?.({ kind: 'quest', id: q.id }) },
                h('h4', questTypeName(q.type).toUpperCase()),
                h('p', q.title + (q.need > 1 && q.type !== 'procure' && q.type !== 'mining' ? `  ${q.progress}/${q.need}` : q.type === 'procure' || q.type === 'mining' ? `  ${game.cargoOf(q.target.item)}/${q.need}` : '')),
                !here ? h('div.where', `→ ${sysName(qn.system)}`) : null));
        }
        const key = items.map((e) => e.textContent).join('|') + (nav ? nav.kind + nav.id : '');
        if (this.cache.tracker !== key) { this.cache.tracker = key; tr.replaceChildren(...items); }
    }

    // ---------------------------------------------------------------- overlay markers
    drawOverlay(world, game, nav) {
        const dpr = Math.min(2, devicePixelRatio || 1);
        const W = innerWidth, H = innerHeight;
        if (this.ov.width !== Math.round(W * dpr) || this.ov.height !== Math.round(H * dpr)) { this.ov.width = Math.round(W * dpr); this.ov.height = Math.round(H * dpr); }
        const g = this.og;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        if (world.docked || world.player.dead) return;
        const p = world.player;
        const view = this.view;
        const st = game.stats();
        const t = performance.now() / 1000;
        g.font = '600 12px Rajdhani, sans-serif';
        g.textAlign = 'center';
        const navId = nav?.here ? nav.id : null;
        const edge = (sp, color, label, d) => {
            // Off-screen arrow on the screen edge.
            let x = sp.x - W / 2, y = sp.y - H / 2;
            if (sp.behind) { x = -x; y = -y; if (Math.abs(x) < 1 && Math.abs(y) < 1) y = 1; }
            const m = 46;
            const k = Math.min((W / 2 - m) / Math.abs(x || 1e-6), (H / 2 - m) / Math.abs(y || 1e-6));
            const ex = W / 2 + x * k, ey = H / 2 + y * k;
            const a = Math.atan2(y, x);
            g.save(); g.translate(ex, ey); g.rotate(a);
            g.fillStyle = color;
            g.beginPath(); g.moveTo(12, 0); g.lineTo(-6, -8); g.lineTo(-2, 0); g.lineTo(-6, 8); g.closePath(); g.fill();
            g.restore();
            if (label) { g.fillStyle = color; g.fillText(label, ex - Math.cos(a) * 22, ey - Math.sin(a) * 22 - 4); g.fillText(fmtDist(d), ex - Math.cos(a) * 22, ey - Math.sin(a) * 22 + 9); }
        };
        const onScreen = (sp) => !sp.behind && sp.x > 0 && sp.x < W && sp.y > 0 && sp.y < H;
        const brackets = (x, y, r, color, lw = 1.5) => {
            g.strokeStyle = color; g.lineWidth = lw;
            const c = r * 0.45;
            g.beginPath();
            g.moveTo(x - r, y - r + c); g.lineTo(x - r, y - r); g.lineTo(x - r + c, y - r);
            g.moveTo(x + r - c, y - r); g.lineTo(x + r, y - r); g.lineTo(x + r, y - r + c);
            g.moveTo(x + r, y + r - c); g.lineTo(x + r, y + r); g.lineTo(x + r - c, y + r);
            g.moveTo(x - r + c, y + r); g.lineTo(x - r, y + r); g.lineTo(x - r, y + r - c);
            g.stroke();
        };
        // Bodies
        for (const o of world.navables()) {
            const d = vdist(o.pos, p.pos);
            const isTarget = o.id === world.target;
            const isNav = o.id === navId;
            const sp = view.project(o.pos, W, H);
            const color = isNav ? '#b48cff' : o.kind === 'planet' ? '#7ab8ff' : o.kind === 'belt' ? '#c8b89a' : o.kind === 'hearth' ? '#ffb547' : o.species != null ? '#6bffb0' : o.kind === 'nest' || o.kind === 'bountyZone' || o.kind === 'hoard' ? '#ff5470' : '#5ef0ff';
            if (!onScreen(sp)) { if (isTarget || isNav) edge(sp, isNav ? '#b48cff' : '#ffb547', o.name, d); continue; }
            if (o.kind === 'belt' && d < 2600 && !isTarget && !isNav) continue;
            if (d > st.scanRange * 3 && o.kind !== 'planet' && o.species == null && o.kind !== 'hearth' && o.kind !== 'belt' && !isTarget && !isNav) continue;
            const r = isTarget ? 16 + Math.sin(t * 5) * 1.5 : 7;
            g.globalAlpha = isTarget || isNav ? 1 : 0.75;
            if (o.kind === 'planet') { g.strokeStyle = color; g.lineWidth = 1.2; g.beginPath(); g.arc(sp.x, sp.y, r, 0, Math.PI * 2); g.stroke(); }
            else if (o.kind === 'belt') { g.strokeStyle = color; g.setLineDash([3, 3]); g.beginPath(); g.arc(sp.x, sp.y, r + 2, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
            else { g.save(); g.translate(sp.x, sp.y); g.rotate(Math.PI / 4); g.strokeStyle = color; g.lineWidth = 1.5; g.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); g.restore(); }
            if (isTarget) brackets(sp.x, sp.y, r + 6, '#ffb547');
            if (isNav) { g.fillStyle = '#b48cff'; g.fillText('OBJECTIVE', sp.x, sp.y - r - 18); }
            g.fillStyle = color;
            if (isTarget || isNav || d < 9000 || o.kind === 'planet' || o.kind === 'hearth' || o.species != null) {
                g.fillText(o.name, sp.x, sp.y - r - 5);
                g.fillStyle = 'rgba(200,220,255,0.75)';
                g.fillText(fmtDist(d), sp.x, sp.y + r + 13);
            }
            g.globalAlpha = 1;
        }
        // Loot
        for (const l of world.loot) {
            const sp = view.project(l.pos, W, H);
            if (!onScreen(sp)) continue;
            g.save(); g.translate(sp.x, sp.y); g.rotate(Math.PI / 4); g.strokeStyle = l.special ? '#b48cff' : '#6bffb0'; g.lineWidth = 1.5; g.strokeRect(-5, -5, 10, 10); g.restore();
        }
        // Enemies: brackets, bars, lead pip
        for (const e of world.enemies) {
            const d = vdist(e.pos, p.pos);
            const sp = view.project(e.pos, W, H);
            const isT = e.id === world.target;
            if (!onScreen(sp)) { if (d < 2500) edge(sp, '#ff5470', isT ? e.name : null, d); continue; }
            const r = Math.max(10, Math.min(40, 2200 / Math.max(40, d) * e.def.size));
            brackets(sp.x, sp.y, r, isT ? '#ffb547' : '#ff5470', isT ? 2 : 1.4);
            const bw = r * 2;
            if (e.maxShield > 0) { g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(sp.x - r, sp.y - r - 9, bw, 3); g.fillStyle = '#5ef0ff'; g.fillRect(sp.x - r, sp.y - r - 9, bw * Math.max(0, e.shield / e.maxShield), 3); }
            g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(sp.x - r, sp.y - r - 5, bw, 3);
            g.fillStyle = '#ff5470'; g.fillRect(sp.x - r, sp.y - r - 5, bw * Math.max(0, e.hp / e.maxHp), 3);
            if (e.boss || isT) { g.fillStyle = '#ffd0d8'; g.fillText(e.name, sp.x, sp.y + r + 13); }
            if (d < 1200) {
                const lp = leadPoint(p.pos, e.pos, { x: e.vel.x - p.vel.x, y: e.vel.y - p.vel.y, z: e.vel.z - p.vel.z }, 950);
                const ls = view.project(lp, W, H);
                if (onScreen(ls)) { g.strokeStyle = 'rgba(255,181,71,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.arc(ls.x, ls.y, 5, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(sp.x, sp.y); g.lineTo(ls.x, ls.y); g.globalAlpha = 0.3; g.stroke(); g.globalAlpha = 1; }
            }
        }
        // The rock under the beam / near the crosshair.
        const rid = p.mining;
        let rock = rid ? world.rockById(rid) : null;
        if (!rock) {
            let best = null, bs = 0.97;
            const f = { x: Math.sin(p.yaw) * Math.cos(p.pitch), y: Math.sin(p.pitch), z: Math.cos(p.yaw) * Math.cos(p.pitch) };
            for (const r of world.rocks()) {
                const dx = r.pos.x - p.pos.x, dy = r.pos.y - p.pos.y, dz = r.pos.z - p.pos.z;
                const L = Math.hypot(dx, dy, dz);
                if (L > st.mineRange * 2.2) continue;
                const dot = (dx * f.x + dy * f.y + dz * f.z) / L;
                if (dot > bs) { bs = dot; best = r; }
            }
            rock = best;
        }
        if (rock) {
            const sp = view.project(rock.pos, W, H);
            if (onScreen(sp)) {
                const d = vdist(rock.pos, p.pos) - rock.radius;
                const T = ROCK_TYPES[rock.type];
                const ok = rock.hard <= st.mineHard;
                const inR = d < st.mineRange;
                g.strokeStyle = !ok ? '#ff5470' : inR ? '#6bffb0' : 'rgba(200,220,255,0.6)';
                g.lineWidth = 1.2;
                g.setLineDash([4, 4]);
                g.beginPath(); g.arc(sp.x, sp.y, 18, t * 2, t * 2 + Math.PI * 1.6); g.stroke();
                g.setLineDash([]);
                g.textAlign = 'left';
                g.fillStyle = g.strokeStyle;
                const label = st.scanComp ? `${T.name} · ${Object.keys(T.mix).map((k) => ITEMS[k].name).join(' / ')}` : `${T.name} rock`;
                g.fillText(label, sp.x + 24, sp.y - 2);
                g.fillStyle = 'rgba(200,220,255,0.8)';
                g.fillText(`${Math.ceil(rock.ore)} ore · ${ok ? (inR ? 'in range' : fmtDist(d)) : `needs laser Mk ${rock.hard}`}`, sp.x + 24, sp.y + 12);
                g.textAlign = 'center';
                g.fillStyle = '#6bffb0';
                g.fillRect(sp.x - 18, sp.y + 22, 36 * rock.ore / rock.maxOre, 2);
            }
        }
        // Velocity vector pip
        if (p.speed > 5 && p.cruise.state !== 'on') {
            const vp = view.project({ x: p.pos.x + p.vel.x * 3, y: p.pos.y + p.vel.y * 3, z: p.pos.z + p.vel.z * 3 }, W, H);
            if (onScreen(vp)) { g.strokeStyle = 'rgba(94,240,255,0.6)'; g.lineWidth = 1; g.beginPath(); g.arc(vp.x, vp.y, 4, 0, Math.PI * 2); g.moveTo(vp.x - 8, vp.y); g.lineTo(vp.x - 4, vp.y); g.moveTo(vp.x + 4, vp.y); g.lineTo(vp.x + 8, vp.y); g.stroke(); }
        }
        // Warp charge ring
        if (world.warp) {
            const k = Math.min(1, world.warp.t / 3.2);
            g.strokeStyle = '#b48cff'; g.lineWidth = 3;
            g.beginPath(); g.arc(W / 2, H / 2, 60, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
            g.fillStyle = '#b48cff'; g.font = '700 13px Orbitron, sans-serif'; g.fillText('WARP CHARGING', W / 2, H / 2 + 86);
        }
        if (p.cruise.state === 'charge') {
            const k = Math.min(1, p.cruise.t / 1.5);
            g.strokeStyle = '#ffb547'; g.lineWidth = 2;
            g.beginPath(); g.arc(W / 2, H / 2, 46, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
        }
    }

    // ---------------------------------------------------------------- scanner
    drawScanner(world, game) {
        const c = this.sc, g = this.sg;
        const dpr = Math.min(2, devicePixelRatio || 1);
        const cw = c.clientWidth || 260, ch = c.clientHeight || 170;
        if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, cw, ch);
        const p = world.player;
        const R = Math.min(4000, game.stats().scanRange);
        const cx = cw / 2, cy = ch * 0.56, rx = cw * 0.46, ry = ch * 0.32;
        g.strokeStyle = 'rgba(94,240,255,0.35)';
        g.lineWidth = 1;
        for (const k of [1, 0.66, 0.33]) { g.beginPath(); g.ellipse(cx, cy, rx * k, ry * k, 0, 0, Math.PI * 2); g.stroke(); }
        g.beginPath(); g.moveTo(cx - rx, cy); g.lineTo(cx + rx, cy); g.moveTo(cx, cy - ry); g.lineTo(cx, cy + ry); g.stroke();
        g.fillStyle = 'rgba(94,240,255,0.06)';
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - rx * 0.7, cy - ry); g.lineTo(cx + rx * 0.7, cy - ry); g.closePath(); g.fill();
        const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
        const rxv = -Math.cos(p.yaw), rzv = Math.sin(p.yaw);
        const blip = (pos, color, size = 2.5, square = false) => {
            const dx = pos.x - p.pos.x, dy = pos.y - p.pos.y, dz = pos.z - p.pos.z;
            const d = Math.hypot(dx, dz);
            if (d > R) return;
            const lx = dx * rxv + dz * rzv, lz = dx * fx + dz * fz;
            const x = cx + (lx / R) * rx, y = cy - (lz / R) * ry;
            const hy = Math.max(-ry * 1.4, Math.min(ry * 1.4, -(dy / R) * ry * 2.2));
            g.strokeStyle = color; g.globalAlpha = 0.6;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + hy); g.stroke();
            g.globalAlpha = 1; g.fillStyle = color;
            if (square) g.fillRect(x - size, y + hy - size, size * 2, size * 2);
            else { g.beginPath(); g.arc(x, y + hy, size, 0, Math.PI * 2); g.fill(); }
        };
        for (const r of world.rocks()) blip(r.pos, 'rgba(170,160,150,0.7)', 1.2);
        for (const n of world.traffic) blip(n.pos, '#e0e8ff', 2);
        for (const s of world.sys.stations) blip(s.pos, s.kind === 'hearth' ? '#ffb547' : '#6bffb0', 3.5, true);
        for (const pl of world.sys.planets) blip(pl.pos, '#7ab8ff', 4);
        for (const o of [...world.visiblePois(), ...world.extra]) blip(o.pos, '#b48cff', 3, true);
        for (const l of world.loot) blip(l.pos, '#ffe36b', 2);
        for (const e of world.enemies) blip(e.pos, '#ff5470', 3.2);
        g.fillStyle = '#fff';
        g.beginPath(); g.moveTo(cx, cy - 5); g.lineTo(cx - 4, cy + 4); g.lineTo(cx + 4, cy + 4); g.closePath(); g.fill();
        g.fillStyle = 'rgba(138,160,196,0.9)';
        g.font = '600 9px Orbitron, sans-serif';
        g.textAlign = 'left';
        g.fillText(`SCAN ${fmtDist(R)}`, 6, 12);
    }
}
