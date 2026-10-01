/**
 * hub.js — the carrier Meridian: Deploy (campaign, threat, Sim Ladder), Frame
 * (systems), Modules, Pilot (skill trees), Contracts and Facilities.
 */

import { $, el, toast } from './dom.js';
import { btn, modCard } from './screens.js';
import { SYSTEMS, SYSTEM_ORDER, canUpgrade, doUpgrade, upgradeCost } from '../sim/mech.js';
import { SKILLS, SKILL_IDS, BRANCHES, canLearn, learn, respecCost, respec } from '../sim/skills.js';
import { RARITIES, modUpgradeCost, modSalvage } from '../sim/mods.js';
import { SYMBOLS } from '../sim/symbols.js';
import { deriveLoadout } from '../sim/loadout.js';
import { CHAPTER_INFO } from '../sim/story.js';
import { questText } from '../sim/quests.js';
import * as P from '../sim/profile.js';
import { fmt, fmtTime } from '../sim/format.js';
import { iconURL } from '../view/art.js';
import { sound } from '../audio.js';

export const TABS = [
    { id: 'deploy', name: 'Deploy', icon: 'deploy' },
    { id: 'frame', name: 'Frame', icon: 'mech' },
    { id: 'modules', name: 'Modules', icon: 'chassis' },
    { id: 'pilot', name: 'Pilot', icon: 'pilot' },
    { id: 'contracts', name: 'Contracts', icon: 'quest' },
    { id: 'facilities', name: 'Facilities', icon: 'refinery' },
];

let H = null;   // { profile, save, tab, onDeploy, onContinue, onLadder, onFx, onTab }

export function initHub(ctx) { H = ctx; }

export function renderHub(tab = H.tab) {
    H.tab = tab;
    const p = H.profile;
    $('#hub-cs').textContent = p.callsign;
    $('#hub-lv').textContent = `Cadet · Pilot level ${p.pilot.level}${p.pilot.sp ? ` · ${p.pilot.sp} skill point${p.pilot.sp > 1 ? 's' : ''}` : ''}${p.campaign.graduated ? ' · GRADUATE' : ''}`;
    $('#hub-xp').style.width = `${(100 * p.pilot.xp) / P.xpNeed(p.pilot.level)}%`;
    $('#hub-scrap').textContent = fmt(p.scrap);
    $('#hub-cores').textContent = fmt(p.cores);
    const tabs = $('#hub-tabs');
    tabs.innerHTML = '';
    for (const t of TABS) {
        const dot = (t.id === 'pilot' && p.pilot.sp > 0) || (t.id === 'contracts' && p.quests.active.some((q) => q.done)) || (t.id === 'facilities' && p.facilities.bank >= 1);
        tabs.append(el('button', { class: `tab ${t.id === tab ? 'on' : ''}`, 'data-tab': t.id, onclick: () => { sound.click(); renderHub(t.id); H.onTab?.(t.id); } },
            el('img', { src: iconURL(t.icon, t.id === tab ? '#45f3ff' : '#8f9bc4', 36), alt: '' }), t.name, dot ? el('span', { class: 'dot' }) : null));
    }
    const body = $('#hub-body');
    body.innerHTML = '';
    body.classList.toggle('with-mech', tab === 'frame' && window.innerWidth > 900);
    ({ deploy, frame, modules, pilot, contracts, facilities })[tab](body, p);
}

function refresh() { H.save(); renderHub(H.tab); }

// ------------------------------------------------------------------ deploy

function deploy(body, p) {
    if (p.sector) {
        const s = p.sector;
        body.append(el('div', { class: 'bank-row', style: { background: 'linear-gradient(90deg, rgba(10,60,80,0.7), rgba(4,16,24,0.6))', borderColor: '#45f3ff66' } },
            el('div', {}, el('div', { class: 'sec-h' }, 'Sortie in progress'), el('div', {}, `Chapter ${s.chapter} · ${CHAPTER_INFO[s.chapter].name}${s.threat ? ` · Threat ${s.threat}` : ''} — hull ${fmt(s.hp)}`)),
            btn('Resume sortie', () => H.onContinue(), 'menu-btn primary')));
    }
    body.append(el('div', { class: 'sec-h' }, 'Campaign — The Graduating Class', el('span', {}, `${Math.min(7, p.campaign.best)}/7 chapters cleared`)));
    const grid = el('div', { class: 'chapters' });
    const threat = H.threat ?? 0;
    CHAPTER_INFO.forEach((c, i) => {
        const open = P.chapterAvailable(p, i);
        const cleared = i < p.campaign.best;
        const b = el('button', { class: 'chap', disabled: !open || !!p.sector, onclick: () => { sound.click(); H.onDeploy(i, threat); } },
            el('div', { class: 'stripe', style: { background: `hsl(${c.neb},90%,60%)` } }),
            el('div', { class: 'n' }, `Chapter ${i}`),
            el('div', { class: 't' }, c.name),
            el('div', { class: 'p' }, c.place),
            cleared ? el('span', { class: 'badge' }, threat ? `T${threat}` : 'CLEARED') : open ? el('span', { class: 'badge next' }, 'NEXT') : null);
        grid.append(b);
    });
    body.append(grid);
    if (p.campaign.maxThreat > 0) {
        const seg = el('div', { class: 'seg' });
        for (let t = 0; t <= p.campaign.maxThreat; t++) seg.append(el('button', { class: threat === t ? 'on' : '', onclick: () => { H.threat = t; sound.click(); renderHub('deploy'); } }, t === 0 ? 'Normal' : `Threat ${t}`));
        body.append(el('div', { class: 'threat' }, el('b', {}, 'Threat level'), seg, el('span', { class: 'dim', style: { fontSize: '12px' } }, 'Higher threat: far tougher Null units, far richer salvage. Clear chapter 6 at your top threat to unlock the next.')));
    }
    body.append(el('div', { class: 'sec-h', style: { marginTop: '18px' } }, 'Sim Ladder — endless', el('span', {}, `best floor ${p.ladder.best}`)));
    const ladderOpen = p.campaign.best >= 1;
    body.append(el('div', { class: 'row' },
        el('img', { class: 'ic', src: iconURL('ladder', '#ffd36a', 64), alt: '' }),
        el('div', { class: 'grow' },
            el('div', { class: 'nm' }, p.ladder.run ? `Climb in progress — floor ${p.ladder.run.floor}` : 'Climb the Sim Ladder'),
            el('div', { class: 'ds' }, ladderOpen ? 'Floor after floor of simulated Null units, each harder than the last. Hull carries over (15% repaired per floor). Every 10th floor pays Cores. Leave whenever you like.' : 'Unlocks after Chapter 0.')),
        btn(p.ladder.run ? 'Resume' : 'Climb', () => H.onLadder(), 'buy green', { disabled: !ladderOpen || !!p.sector })));
    const st = p.stats;
    body.append(el('div', { class: 'sec-h', style: { marginTop: '18px' } }, 'Service record'));
    body.append(el('div', { class: 'machine-summary' },
        stat('Fights won', fmt(st.wins)), stat('Units destroyed', fmt(st.kills)), stat('Best spin', fmt(st.bestSpin)), stat('Longest chain', `×${st.bestChain}`), stat('Overdrives', fmt(st.overdrives)), stat('Jackpots', fmt(st.jackpots))));
}

const stat = (k, v) => el('div', { class: 'stat' }, el('div', { class: 'k' }, k), el('div', { class: 'v' }, v));

// ------------------------------------------------------------------ frame

const GROUPS = [['machine', 'The Machine', 'These change the slot machine itself.'], ['weapon', 'Hardpoints', 'Each weapon symbol\'s power — and new symbols on your strips.'], ['frame', 'Frame', 'Hull, shields and repairs.']];

function frame(body, p) {
    const L = deriveLoadout(p);
    body.append(el('div', { class: 'sec-h' }, 'Probability Engine', el('span', {}, 'what your frame does to the reels')));
    body.append(el('div', { class: 'machine-summary' },
        stat('Reels', `${L.cols} × ${L.rows}`), stat('Paylines', L.lines.length), stat('Energy', `${L.maxEnergy} (+${L.regen}/turn)`),
        stat('Free nudges', L.freeNudges), stat('Hull', fmt(L.maxHp)), stat('Crit', `${Math.round(L.crit * 100)}%`)));
    const strip = el('div', { class: 'strip' });
    for (const id in L.weights) {
        if (!L.weights[id]) continue;
        const s = SYMBOLS[id];
        strip.append(el('img', { src: iconURL(s.glyph, s.color, 48), alt: s.name, title: `${s.name}: ${L.weights[id]} per strip` }), el('span', { class: 'cnt' }, `×${L.weights[id]}`));
    }
    body.append(el('div', { class: 'ds dim', style: { fontSize: '12px' } }, 'Every reel strip holds:'), strip);
    for (const [g, name, blurb] of GROUPS) {
        body.append(el('div', { class: 'sec-h' }, name, el('span', {}, blurb)));
        for (const id of SYSTEM_ORDER) {
            const s = SYSTEMS[id];
            if (s.group !== g) continue;
            body.append(systemRow(p, id));
        }
    }
}

function systemRow(p, id) {
    const s = SYSTEMS[id];
    const lv = p.mech[id];
    const r = canUpgrade(p, id);
    const cost = upgradeCost(p.mech, id);
    const max = lv >= s.max;
    const iconName = SYMBOLS[s.icon] ? SYMBOLS[s.icon].glyph : s.icon;
    const color = SYMBOLS[s.icon]?.color ?? '#45f3ff';
    const label = max ? 'MAX' : r.why && r.why.startsWith('Clear') ? r.why : `${fmt(cost.scrap)}${cost.cores ? ` +${cost.cores}◆` : ''}`;
    const b = el('button', { class: 'buy', disabled: !r.ok, title: r.ok ? 'Install' : r.why === 'scrap' ? 'Not enough scrap' : r.why === 'cores' ? 'Not enough cores' : r.why },
        lv === 0 && s.install !== undefined && r.why !== label ? `Install ${label}` : label);
    b.onclick = () => {
        if (!doUpgrade(p, id)) { sound.deny(); return; }
        sound.upgrade();
        H.onFx?.('upgrade', id);
        if (['reels', 'matrix', 'missile', 'arc', 'chassis'].includes(id)) toast(`<b>${s.name}</b> → ${s.text(p.mech[id])}`, 'good');
        refresh();
        document.querySelector(`[data-sys="${id}"]`)?.classList.add('flash');
    };
    return el('div', { class: 'row', 'data-sys': id },
        el('img', { class: 'ic', src: iconURL(iconName, color, 64), alt: '' }),
        el('div', { class: 'grow' },
            el('div', { class: 'nm' }, s.name, el('span', { class: 'lv' }, lv ? `Lv ${lv}${s.max < 40 ? `/${s.max}` : ''}` : '')),
            el('div', { class: 'ds' }, s.desc),
            el('div', { class: 'fx', html: `${s.text(lv)}${max ? '' : ` <span class="arrow">→</span> ${s.text(lv + 1)}`}` })),
        b);
}

// ------------------------------------------------------------------ modules

function modules(body, p) {
    const slots = p.mech.chassis + 1;
    const eq = p.equipped.map((u) => p.mods.find((m) => m.uid === u)).filter(Boolean);
    body.append(el('div', { class: 'sec-h' }, 'Equipped', el('span', {}, `${eq.length}/${slots} slots · more with Chassis upgrades`)));
    const sl = el('div', { class: 'slots' });
    for (let i = 0; i < slots; i++) {
        const m = eq[i];
        sl.append(el('div', { class: `slot ${m ? 'full' : ''}`, title: m ? m.id : 'Empty slot' }, m ? el('img', { src: iconURL(modIcon(m), RARITIES[m.rar].color, 48), alt: '' }) : ''));
    }
    body.append(sl);
    if (!p.mods.length) {
        body.append(el('p', { class: 'dim' }, 'No modules yet. Elites, bosses, salvage, depots and contracts drop them. Each one rewrites a rule of the slot machine.'));
        return;
    }
    body.append(el('div', { class: 'sec-h' }, 'Inventory', el('span', {}, 'equipped first')));
    const grid = el('div', { class: 'mods' });
    const sorted = p.mods.slice().sort((a, b) => (p.equipped.includes(b.uid) - p.equipped.includes(a.uid)) || b.rar - a.rar || b.lv - a.lv);
    for (const m of sorted) {
        const on = p.equipped.includes(m.uid);
        const up = modUpgradeCost(m);
        grid.append(modCard(m, {
            equipped: on,
            actions: [
                btn(on ? 'Unequip' : 'Equip', () => { if (!P.toggleEquip(p, m.uid)) { sound.deny(); toast('All module slots are full.'); return; } H.onFx?.('equip'); refresh(); }, 'small-btn' + (on ? ' on' : ''), { disabled: !on && p.equipped.length >= slots }),
                up === null ? el('button', { class: 'small-btn', disabled: true }, 'MAX') : btn(`Lv↑ ${fmt(up)}`, () => { if (!P.upgradeMod(p, m.uid)) { sound.deny(); return; } sound.upgrade(); H.onFx?.('upgrade'); refresh(); }, 'buy', { disabled: p.scrap < up }),
                btn(`Scrap +${fmt(modSalvage(m))}`, () => { P.salvageMod(p, m.uid); sound.coins(6); refresh(); }, 'small-btn'),
            ],
        }));
    }
    body.append(grid);
}

const modIcon = (m) => ({ cascade: 'cascade', expand: 'expand', sticky: 'sticky', mirror: 'mirror', conductor: 'arc', claw: 'scrap', eater: 'glitch', twin: 'blade', splitter: 'missile', overheat: 'energy', magnet: 'core', cluster: 'cluster', seventh: 'seven', echo: 'echo', leech: 'repair', thorns: 'shield', daemon: 'crit', capacitor: 'reactor' }[m.id]);

// ------------------------------------------------------------------ pilot

function pilot(body, p) {
    body.append(el('div', { class: 'sec-h' }, `Skill points: ${p.pilot.sp}`, el('span', {}, 'one per pilot level · tap a skill to read it, tap again to learn')));
    const detail = el('div', { class: 'sk-detail dim' }, 'Select a skill.');
    const trees = el('div', { class: 'trees' });
    for (const b in BRANCHES) {
        const B = BRANCHES[b];
        const ids = SKILL_IDS.filter((k) => SKILLS[k].branch === b);
        const rows = Math.max(...ids.map((k) => SKILLS[k].row)) + 1;
        const grid = el('div', { class: 'tree-grid', style: { gridTemplateRows: `repeat(${rows}, 64px)` } });
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 300 ${rows * 74}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        for (const k of ids) {
            const s = SKILLS[k];
            if (!s.req) continue;
            const r = SKILLS[s.req];
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', 50 + r.col * 100); line.setAttribute('y1', 32 + r.row * 74);
            line.setAttribute('x2', 50 + s.col * 100); line.setAttribute('y2', 32 + s.row * 74);
            line.setAttribute('stroke', (p.pilot.skills[s.req] ?? 0) > 0 ? B.color : '#2a3560');
            line.setAttribute('stroke-width', '3');
            svg.append(line);
        }
        grid.append(svg);
        for (const k of ids) {
            const s = SKILLS[k];
            const r = p.pilot.skills[k] ?? 0;
            const c = canLearn(p, k);
            const locked = s.req && !(p.pilot.skills[s.req] > 0);
            const node = el('button', {
                class: `sk ${r ? 'has' : ''} ${c.ok ? 'can' : ''} ${locked ? 'locked' : ''} ${s.cap ? 'cap' : ''}`,
                style: { gridRow: s.row + 1, gridColumn: s.col + 1, color: B.color },
                onclick: () => {
                    if (detail.dataset.sel === k && c.ok) {
                        learn(p, k);
                        sound.levelUp();
                        H.onFx?.('skill');
                        refresh();
                        return;
                    }
                    sound.click();
                    detail.dataset.sel = k;
                    detail.classList.remove('dim');
                    detail.innerHTML = `<b style="color:${B.color}">${s.name}</b> <span class="dim">(${r}/${s.max})</span><br>${s.desc(Math.max(1, r))}${r < s.max ? `${r ? `<br><span class="dim">Next rank: ${s.desc(r + 1)}</span>` : ''}<br>${c.ok ? '<span style="color:var(--green)">Tap again to learn.</span>' : `<span style="color:var(--red)">${c.why}</span>`}` : '<br><span style="color:var(--green)">Mastered.</span>'}`;
                },
            }, el('span', { style: { color: '#fff' } }, s.name), el('span', { class: 'r' }, `${r}/${s.max}`));
            grid.append(node);
        }
        trees.append(el('div', { class: 'tree', style: { borderColor: B.color + '55' } }, el('h3', { style: { color: B.color } }, B.name), el('div', { class: 'bl' }, B.blurb), grid));
    }
    body.append(trees, detail);
    const rc = respecCost(p);
    body.append(el('div', { style: { marginTop: '12px', textAlign: 'right' } }, btn(`Respec · ${fmt(rc)} scrap`, () => { if (respec(p)) { sound.upgrade(); refresh(); } else sound.deny(); }, 'small-btn', { disabled: p.scrap < rc || !Object.keys(p.pilot.skills).length })));
}

// ------------------------------------------------------------------ contracts

function contracts(body, p) {
    body.append(el('div', { class: 'sec-h' }, 'Contract board', el('span', {}, 'progress counts from every fight — campaign, ladder and threat')));
    for (const q of p.quests.active) {
        const pct = Math.min(100, (100 * q.progress) / q.target);
        const rw = [`${fmt(q.reward.scrap)} scrap`, `${fmt(q.reward.xp)} XP`];
        if (q.reward.cores) rw.push(`${q.reward.cores} core${q.reward.cores > 1 ? 's' : ''}`);
        if (q.reward.mod) rw.push('a module');
        const rc = P.rerollCost(p);
        body.append(el('div', { class: `quest ${q.done ? 'done' : ''}` },
            el('img', { src: iconURL('quest', q.done ? '#46ff9a' : '#ff4dff', 56), alt: '', style: { width: '36px' } }),
            el('div', { class: 'q' },
                el('div', { class: 'giver' }, q.giver),
                el('div', { class: 'txt' }, questText(q)),
                el('div', { class: 'pbar' }, el('div', { style: { width: `${pct}%` } })),
                el('div', { class: 'rw' }, `${fmt(Math.floor(q.progress))}/${fmt(q.target)} · Reward: ${rw.join(' · ')}`)),
            q.done
                ? btn('Claim', () => {
                    const r = P.claimQuest(p, q.uid);
                    if (!r) return;
                    sound.quest();
                    H.onFx?.('claim');
                    toast(`<b>Contract complete.</b> +${fmt(q.reward.scrap)} scrap${q.reward.cores ? `, +${q.reward.cores} cores` : ''}${r.mod ? ', and a module' : ''}`, 'quest');
                    for (const lv of r.levels) toast(`Pilot level ${lv}! +1 skill point`, 'gold');
                    refresh();
                }, 'buy green')
                : btn(`Reroll ${fmt(rc)}`, () => { if (P.rerollQuest(p, q.uid)) { sound.click(); refresh(); } else sound.deny(); }, 'small-btn', { disabled: p.scrap < rc })));
    }
    body.append(el('p', { class: 'dim', style: { fontSize: '12px' } }, `Contracts completed: ${p.quests.claimed}`));
}

// ------------------------------------------------------------------ facilities

function facilities(body, p) {
    const f = p.facilities;
    const rate = P.refineryRate(f.refinery);
    const bankV = el('span', { class: 'bank', id: 'fac-bank' }, fmt(Math.floor(f.bank)));
    const cap = rate * P.BANK_HOURS * 3600;
    body.append(el('div', { class: 'bank-row' },
        el('div', {},
            el('div', { class: 'sec-h', style: { margin: 0 } }, 'Refinery output'),
            el('div', {}, bankV, el('span', { class: 'dim' }, ` / ${fmt(cap)} scrap`)),
            el('div', { class: 'dim', style: { fontSize: '12px' } }, rate ? `${fmt(rate * 3600)} per hour · fills in ${fmtTime(cap / rate)}${f.forge ? ` · Core vat: ${f.coreBank.toFixed(2)}` : ''}` : 'Build the Refinery to start producing scrap.')),
        btn('Collect', () => {
            const r = P.collectFacilities(p);
            if (r.scrap <= 0 && r.cores <= 0) { sound.deny(); return; }
            sound.coins(10);
            H.onFx?.('collect', r.scrap);
            toast(`Collected <b>${fmt(r.scrap)}</b> scrap${r.cores ? ` and <b>${r.cores}</b> cores` : ''}.`, 'gold');
            refresh();
        }, 'buy green', { disabled: f.bank < 1 && f.coreBank < 1 })));
    for (const id in P.FACILITIES) {
        const F = P.FACILITIES[id];
        const lv = f[id];
        const c = P.facilityCost(p, id);
        const gated = p.campaign.best < F.gate;
        body.append(el('div', { class: 'fac' },
            el('img', { src: iconURL(F.icon, '#ffd36a', 64), alt: '' }),
            el('div', { class: 'grow', style: { flex: 1 } },
                el('div', { class: 'nm', style: { fontWeight: 800 } }, F.name, el('span', { style: { color: 'var(--cyan)', fontSize: '12px', marginLeft: '6px' } }, `Lv ${lv}`)),
                el('div', { class: 'ds dim', style: { fontSize: '12px' } }, F.desc),
                el('div', { style: { fontSize: '12px' }, html: `${lv ? F.effect(lv) : 'Not built'}${lv < F.max ? ` <span style="color:var(--green)">→</span> ${F.effect(lv + 1)}` : ''}` })),
            gated ? el('button', { class: 'buy', disabled: true }, `Clear ch. ${F.gate}`)
                : c === null ? el('button', { class: 'buy', disabled: true }, 'MAX')
                    : btn(fmt(c), () => { if (P.upgradeFacility(p, id)) { sound.upgrade(); H.onFx?.('upgrade'); refresh(); } else sound.deny(); }, 'buy', { disabled: p.scrap < c })));
    }
}

/** Live-tick the refinery counter while the Facilities tab is open. */
export function tickHub() {
    if (!H || H.tab !== 'facilities') return;
    const n = document.getElementById('fac-bank');
    if (n) n.textContent = fmt(Math.floor(H.profile.facilities.bank));
}
