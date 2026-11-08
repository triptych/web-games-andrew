// The terminals: Holo-table, Hangar, Gene Lab, Research and Archive. Each renders an HTML string from G and the
// panel's own UI state; ui.js morphs it into place so a live refresh never replaces the button under a finger.
// Buttons carry data-cmd (a sim command, JSON) or data-ui (panel state); nothing here changes G.

import { ZONES, SPECIES, SPECIES_BY_ID, TRAITS, RES, RES_INFO, GENS, UPGRADES, RESEARCH, BRANCHES, HARVESTERS, HARV_MAX, COLONY,
    upgradeMax, upgradeCost, harvesterCost, colonyCost, stockCap, canAfford, ENEMIES } from '../sim/data.js';
import { botStats, canWake, edenIndex, deployCheck } from '../sim/game.js';
import { researchState, labSlots, vatSlots, blueprintFor, blendCost, zoneYield, nextDone, logsOpen, canConcord } from '../sim/station.js';
import { sampleNeed, isSequenced, blendTraits, releaseEffect, pairKey, fitOf, terraOf } from '../sim/genetics.js';
import { SCENES, ENDINGS, IRIS_DOG } from '../sim/story.js';
import { YEAR_DAYS, EDEN_WIN, SPEEDS } from '../config.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cmd = (o) => `data-cmd='${JSON.stringify(o)}'`;
const ui = (o) => `data-ui='${JSON.stringify(o)}'`;
export const costHtml = (c, res) => RES.filter((k) => c[k]).map((k) => `<span class="cost ${res && (res[k] || 0) < c[k] ? 'short' : ''}">${RES_INFO[k].icon}${c[k]}</span>`).join(' ');
const bar = (v, max, cls = '') => `<span class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(1)}%"></i></span>`;
const tabs = (st, list) => `<div class="tabs" role="tablist">${list.map(([id, label]) => `<button class="tab ${st.tab === id ? 'on' : ''}" role="tab" aria-selected="${st.tab === id}" ${ui({ tab: id })}>${label}</button>`).join('')}</div>`;
const days = (d) => (d < 1 ? `${Math.max(1, Math.ceil(d * 24))} h` : `${d.toFixed(d < 10 ? 1 : 0)} d`);
const traitBars = (t, cls = '') => `<div class="traits ${cls}">${TRAITS.map((T, i) => `<div class="tr"><b style="color:${T.color}">${T.name.slice(0, 3)}</b>${bar(t[i], 12, 't' + i)}<em>${t[i]}</em></div>`).join('')}</div>`;

export const PANEL_TITLES = { command: 'Holo-table', hangar: 'Bot Hangar', lab: 'Gene Lab', research: 'Research Lab', archive: 'Stasis Archive' };

export function renderPanel(id, G, st) {
    switch (id) {
        case 'command': return command(G, st);
        case 'hangar': return hangar(G, st);
        case 'lab': return lab(G, st);
        case 'research': return research(G, st);
        case 'archive': return archive(G, st);
        default: return '';
    }
}

// ---------------------------------------------------------------- Holo-table
function command(G, st) {
    st.tab ||= 'planet';
    const eden = edenIndex(G), left = YEAR_DAYS - G.day, nd = nextDone(G);
    let h = `<div class="clock"><div><b>Day ${Math.floor(G.day) + 1}</b> of ${YEAR_DAYS}</div><div class="reveille">REVEILLE IN <b>${Math.ceil(left)}</b> DAYS</div>${bar(G.day, YEAR_DAYS, 'year')}</div>`;
    h += `<div class="eden"><span>Eden Index</span><b>${eden.toFixed(1)}</b><span>/ ${EDEN_WIN} needed</span>${bar(eden, 100, eden >= EDEN_WIN ? 'good' : 'eden')}</div>`;
    if (canWake(G)) h += `<button class="btn primary big" ${cmd({ t: 'wake' })}>Wake the colonists now</button>`;
    h += tabs(st, [['planet', 'Planet'], ['idle', 'Harvesters & colonies'], ['time', 'Time']]);
    if (st.tab === 'planet') {
        h += '<div class="zones">';
        ZONES.forEach((Z, i) => {
            const z = G.zones[i];
            const lock = G.bot.gen < Z.req;
            h += `<div class="zone ${z.visited ? '' : 'unseen'}"><div class="zh"><b>${esc(Z.name)}</b><span>${lock ? `needs ${GENS[Z.req].mk}` : z.visited ? `${Math.round(terraOf(z))}% restored` : 'not yet visited'}</span></div>
                <div class="metrics"><span>Toxic</span>${bar(z.toxic, 100, 'bad')}<span>Hostile</span>${bar(z.hostile, 100, 'bad')}<span>Barren</span>${bar(z.barren, 100, 'bad')}</div>
                <div class="zf">${Z.boss ? (z.boss ? (G.final === 'concord' ? '🌸 The Chorus is listening' : '🔥 Purged') : '⚠️ The Rootmother') : ''}${z.colony ? ` 🏠 ${COLONY[z.colony - 1].name}` : ''}${ZONES[i].echo >= 0 && G.echoes.includes(ZONES[i].echo) ? ' 📼 black box found' : ''}</div></div>`;
        });
        h += '</div>';
    } else if (st.tab === 'idle') {
        const any = G.zones.some((z) => RES.some((k) => z.stock[k] >= 1));
        h += `<p class="dim">${G.research.done.a1 ? 'Harvesters fill each zone\'s stock every day; calmer fauna raid them less.' : 'Research <b>Harvester Rigs</b> (Autonomics) to drop automatic harvesters.'} ${G.research.done.a4 ? 'The Supply Shuttle brings the stock up by itself.' : ''}</p>`;
        if (!G.research.done.a4) h += `<button class="btn primary" ${cmd({ t: 'collect' })} ${any ? '' : 'disabled'}>Collect all stock</button>`;
        ZONES.forEach((Z, i) => {
            const z = G.zones[i];
            if (!z.visited) return;
            const y = zoneYield(G, i), cap = stockCap(z.colony);
            h += `<div class="zone"><div class="zh"><b>${esc(Z.name)}</b><span>stock ${RES.map((k) => `${RES_INFO[k].icon}${Math.floor(z.stock[k])}`).join(' ')} / ${cap}</span></div><div class="rigs">`;
            for (const H of HARVESTERS) {
                const lv = z.harv[H.id], c = harvesterCost(i, lv);
                const ok = G.research.done.a1 && lv < HARV_MAX && !(Z.boss && !z.boss);
                h += `<button class="rig" ${cmd({ t: 'harvester', zone: i, kind: H.id })} ${ok ? '' : 'disabled'}><b>${RES_INFO[H.res].icon} ${H.name}</b><span>Lv ${lv}/${HARV_MAX} · +${y[H.res].toFixed(1)}/day</span>${lv < HARV_MAX ? costHtml(c, G.res) : '<span>max</span>'}</button>`;
            }
            h += '</div>';
            if (G.research.done.a5) {
                const s = z.colony;
                if (s < COLONY.length) { const C = COLONY[s], c = colonyCost(i, s); h += `<button class="btn colony" ${cmd({ t: 'colony', zone: i })}>🏠 Found ${C.name} <small>(hostility ≤ ${C.host}) · ${C.does}</small> ${costHtml(c, G.res)}</button>`; }
                else h += '<p class="dim">🏠 A Hive tends this zone.</p>';
            }
            h += '</div>';
        });
    } else {
        h += '<p class="dim">Time on the station runs only while you walk the deck (terminals pause it). Research, vats, harvesters and colonies all run on game days.</p><div class="speeds">';
        SPEEDS.forEach((s, i) => { h += `<button class="btn ${G.speed === i ? 'on' : ''}" ${cmd({ t: 'speed', i })}>${s === 0 ? '❚❚ Stop' : s + '×'}</button>`; });
        h += '</div>';
        h += `<button class="btn primary" ${cmd({ t: 'wait', until: 'next' })} ${nd == null ? 'disabled' : ''}>⏩ Wait until the next thing finishes${nd != null ? ` (${days(nd)})` : ''}</button>`;
        h += `<button class="btn" ${cmd({ t: 'wait', days: 1 })}>Wait one day</button>`;
    }
    return h;
}

// ---------------------------------------------------------------- Hangar
function hangar(G, st) {
    st.tab ||= 'drop';
    const S = botStats(G), gen = G.bot.gen, next = gen + 1;
    let h = `<div class="botcard"><canvas class="sprite" data-sprite="bot${gen}" width="40" height="44"></canvas><div><b>${GENS[gen].mk} ${GENS[gen].name}</b><p class="dim">${esc(GENS[gen].blurb)}</p>
        <div class="stats"><span>🛡 ${S.hpMax}</span><span>🔋 ${S.enMax}s</span><span>📦 ${S.cargo}</span><span>⚔ ${S.dmg.toFixed(0)}</span>${S.shot ? `<span>✦ ${S.shot.toFixed(0)}</span>` : ''}<span>⛏ ${S.gather.toFixed(2)}×</span></div>
        ${G.bot.busy > 0 ? `<p class="warn">In the fabricator: ${days(G.bot.busy)} left.</p>` : ''}</div></div>`;
    h += tabs(st, [['drop', 'Drop'], ['up', 'Upgrades'], ['gen', 'Next generation']]);
    if (st.tab === 'drop') {
        h += '<div class="drops">';
        ZONES.forEach((Z, i) => {
            const why = deployCheck(G, i), z = G.zones[i];
            const fauna = Object.keys(Z.counts.enemies).map((t) => ENEMIES[t].name).join(', ');
            h += `<button class="drop" ${cmd({ t: 'deploy', zone: i })} ${why ? 'disabled' : ''} title="${esc(why || '')}"><b>${esc(Z.name)}</b><span>${esc(Z.intro)}</span>
                <span class="dim">${GENS[Z.req].mk}+ · ${Z.hazard === 'none' ? 'no hazards' : esc(Z.hazardName)} · ${esc(fauna)}${Z.boss && !z.boss ? ' · THE ROOTMOTHER' : ''}</span>${why && Z.req > gen ? `<em>${esc(why)}</em>` : ''}</button>`;
        });
        h += '</div><p class="dim">A drop costs half a day; time on the surface costs a day every 30 seconds.</p>';
    } else if (st.tab === 'up') {
        h += `<p class="dim">A ${GENS[gen].mk} takes each part up to level ${upgradeMax(gen)}. Parts carry over to the next generation.</p><div class="ups">`;
        for (const U of UPGRADES) {
            const lv = G.bot.lv[U.id], c = upgradeCost(U.id, lv), max = lv >= upgradeMax(gen);
            h += `<button class="up" ${cmd({ t: 'upgrade', id: U.id })} ${max ? 'disabled' : ''}><b>${U.name}</b><span>${U.does}</span>${bar(lv, upgradeMax(5))}<span>Lv ${lv}${max ? ' (max)' : ''}</span>${max ? '' : costHtml(c, G.res)}</button>`;
        }
        h += '</div>';
    } else {
        if (next >= GENS.length) h += '<p>The Gardener is the last body we know how to build.</p>';
        else {
            const bp = blueprintFor(next), have = G.research.done[bp.id];
            h += `<div class="botcard"><canvas class="sprite" data-sprite="bot${next}" width="40" height="44"></canvas><div><b>${GENS[next].mk} ${GENS[next].name}</b><p class="dim">${esc(GENS[next].blurb)}</p>
                <p>${have ? '✅ Blueprint researched' : `🔒 Needs the <b>${bp.name}</b> (Mechanics)`}</p>${costHtml(GENS[next].cost, G.res)}
                <button class="btn primary" ${cmd({ t: 'fabricate' })} ${have && canAfford(G.res, GENS[next].cost) && G.bot.busy <= 0 ? '' : 'disabled'}>Fabricate (1 day)</button></div></div>`;
        }
    }
    return h;
}

// ---------------------------------------------------------------- Gene Lab
function lab(G, st) {
    st.tab ||= G.strains.length ? 'release' : 'splice';
    let h = tabs(st, [['splice', 'Splicer'], ['release', `Vats & release${G.strains.length ? ` (${G.strains.length})` : ''}`], ['library', 'Genome library']]);
    if (st.tab === 'library') {
        h += '<div class="lib">';
        for (const s of SPECIES) {
            const n = G.samples[s.id] || 0, need = sampleNeed(G, s.id), known = n > 0;
            h += `<div class="gen ${isSequenced(G, s.id) ? 'seq' : known ? '' : 'unknown'}"><canvas class="sprite" data-sprite="sp-${s.id}" width="32" height="32"></canvas><div><b>${known ? esc(s.name) : '???'}</b>
                <span class="dim">${s.kind === 'flora' ? '🌿 plant' : '🦴 animal'} · ${esc(ZONES[s.zone].name)}</span>
                ${known ? traitBars(s.t) : ''}<span>${isSequenced(G, s.id) ? '✅ sequenced' : `samples ${n} / ${need}`}</span>${known ? `<p class="dim">${esc(s.blurb)}</p>` : ''}</div></div>`;
        }
        h += '</div>';
    } else if (st.tab === 'splice') {
        const seq = SPECIES.filter((s) => isSequenced(G, s.id));
        if (seq.length < 2) return h + '<p>Sequence at least two genomes first: sample plants with Gather and defeat creatures on the surface.</p>';
        if (!seq.some((s) => s.id === st.a)) st.a = seq[0].id;
        if (!seq.some((s) => s.id === st.b) || st.b === st.a) st.b = seq.find((s) => s.id !== st.a).id;
        st.r ??= 0.5;
        const pick = (slot) => `<div class="picks">${seq.map((s) => `<button class="pick ${st[slot] === s.id ? 'on' : ''}" ${ui({ [slot]: s.id })} ${slot === 'b' && s.id === st.a ? 'disabled' : ''}><canvas class="sprite" data-sprite="sp-${s.id}" width="32" height="32"></canvas>${esc(s.name)}</button>`).join('')}</div>`;
        h += `<h3>Parent A</h3>${pick('a')}<h3>Parent B</h3>${pick('b')}`;
        const t = blendTraits(G, st.a, st.b, st.r), c = blendCost(st.a, st.b, st.r);
        h += `<div class="mix"><button class="btn" ${ui({ r: Math.max(0, Math.round((st.r - 0.1) * 10) / 10) })} aria-label="More ${esc(SPECIES_BY_ID[st.b].name)}">◀</button>
            <div><b>${Math.round(st.r * 100)}%</b> ${esc(SPECIES_BY_ID[st.a].name)} · <b>${Math.round((1 - st.r) * 100)}%</b> ${esc(SPECIES_BY_ID[st.b].name)}</div>
            <button class="btn" ${ui({ r: Math.min(1, Math.round((st.r + 0.1) * 10) / 10) })} aria-label="More ${esc(SPECIES_BY_ID[st.a].name)}">▶</button></div>`;
        h += traitBars(t, 'big');
        if (SPECIES_BY_ID[st.a].kind !== SPECIES_BY_ID[st.b].kind) h += '<p class="good">Plant + animal: they get along. +Fertility, +Docility.</p>';
        h += '<table class="fit"><tr><th>Zone</th><th>Fit</th><th>Would do</th></tr>';
        const s = { traits: t, key: pairKey(st.a, st.b) };
        ZONES.forEach((Z, i) => {
            if (!G.zones[i].visited) return;
            const fx = releaseEffect(G, s, i);
            h += `<tr><td>${esc(Z.name)}</td><td>${Math.round(fitOf(t, i) * 100)}%${fx.uses ? ` <small>(used ×${fx.uses})</small>` : ''}</td><td>☣ ${fx.toxic.toFixed(1)} · 🐾 ${fx.hostile.toFixed(1)} · 🌱 ${fx.barren.toFixed(1)}</td></tr>`;
        });
        h += '</table>';
        h += `<div class="act">${costHtml(c, G.res)}<button class="btn primary" ${cmd({ t: 'blend', a: st.a, b: st.b, r: st.r })} ${G.vats.length < vatSlots(G) && canAfford(G.res, c) ? '' : 'disabled'}>Splice (${2} days in a vat)</button></div>`;
        if (G.vats.length >= vatSlots(G)) h += '<p class="warn">Every vat is busy.</p>';
    } else {
        h += `<h3>Vats ${G.vats.length}/${vatSlots(G)}</h3>`;
        if (!G.vats.length) h += '<p class="dim">Nothing incubating.</p>';
        for (const v of G.vats) h += `<div class="vat"><b>${esc(v.strain.name)}</b>${bar(2 - v.left, 2, 'good')}<span>${days(v.left)}</span></div>`;
        h += '<h3>Ready to release</h3>';
        if (!G.strains.length) h += '<p class="dim">No strains ready.</p>';
        for (const s of G.strains) {
            h += `<div class="strain"><div class="sh"><b>${esc(s.name)}</b><span class="dim">${esc(SPECIES_BY_ID[s.a].name)} ${Math.round(s.r * 100)}% · ${esc(SPECIES_BY_ID[s.b].name)} ${Math.round((1 - s.r) * 100)}%</span></div>${traitBars(s.traits)}<div class="rel">`;
            ZONES.forEach((Z, i) => {
                const z = G.zones[i];
                if (!z.visited) return;
                const blocked = Z.boss && !z.boss;
                const fx = releaseEffect(G, s, i), g = -(fx.toxic + fx.hostile + fx.barren);
                h += `<button class="relb" ${cmd({ t: 'release', id: s.id, zone: i })} ${blocked ? 'disabled' : ''}><b>${esc(Z.name)}</b><span>fit ${Math.round(fx.fit * 100)}% · ${blocked ? 'the Rootmother' : `−${g.toFixed(1)} total`}</span></button>`;
            });
            h += '</div></div>';
        }
    }
    return h;
}

// ---------------------------------------------------------------- Research
function research(G, st) {
    st.tab ||= 'mech';
    let h = `<p class="dim">Benches ${G.research.active.length}/${labSlots(G)} busy. Research runs on game days, during drops too.</p>`;
    for (const a of G.research.active) { const R = RESEARCH.find((r) => r.id === a.id); h += `<div class="vat"><b>${esc(R.name)}</b>${bar(R.days - a.left, R.days, 'good')}<span>${days(a.left)}</span></div>`; }
    h += tabs(st, BRANCHES.map((b) => [b.id, `${b.icon} ${b.name}`]));
    h += '<div class="tree">';
    for (const R of RESEARCH.filter((r) => r.br === st.tab)) {
        const s = researchState(G, R.id);
        const reqs = R.req.filter((q) => !G.research.done[q]).map((q) => RESEARCH.find((r) => r.id === q).name);
        h += `<button class="node ${s}" ${cmd({ t: 'research', id: R.id })} ${s === 'ready' && G.research.active.length < labSlots(G) ? '' : 'disabled'}>
            <b>${s === 'done' ? '✅ ' : s === 'active' ? '⏳ ' : s === 'locked' ? '🔒 ' : ''}${esc(R.name)}</b><span>${esc(R.does)}</span>
            <span class="dim">${s === 'done' ? 'Done' : s === 'locked' ? 'Needs ' + esc(reqs.join(', ')) : `${R.days} days`}</span>${s === 'done' || s === 'active' ? '' : costHtml(R.cost, G.res)}</button>`;
    }
    return h + '</div>';
}

// ---------------------------------------------------------------- Archive
function archive(G, st) {
    st.tab ||= 'logs';
    let h = tabs(st, [['logs', 'Crew logs'], ['echo', `Black boxes (${G.echoes.length}/5)`], ['stats', 'The year so far']]);
    if (st.tab === 'logs') for (const l of logsOpen(G)) h += `<div class="log"><b>${esc(l.title)}</b><p>${esc(l.t)}</p></div>`;
    else if (st.tab === 'echo') {
        if (!G.echoes.length) h += '<p class="dim">VESPER left relays in every zone. Find the glowing black boxes on the surface.</p>';
        for (const i of [...G.echoes].sort()) h += `<div class="log"><b>${esc(ZONES.find((z) => z.echo === i).name)}</b>${SCENES['echo' + i].lines.filter((l) => l.w !== 'tilly').map((l) => `<p>${esc(l.t)}</p>`).join('')}</div>`;
        h += `<p class="dim">${canConcord(G) ? 'You know enough of the Chorus\'s grammar to try another way.' : 'Four black boxes and Mycelial Translation would open another way to end this.'}</p>`;
    } else {
        const S = G.stats;
        h += `<ul class="statl"><li>Drops: ${S.missions}</li><li>Bots lost: ${S.deaths}</li><li>Creatures defeated: ${S.kills}</li><li>Strains spliced: ${S.blends}</li><li>Strains released: ${S.releases}</li>
            <li>Genomes sequenced: ${SPECIES.filter((s) => isSequenced(G, s.id)).length} / ${SPECIES.length}</li><li>Research done: ${Object.keys(G.research.done).length} / ${RESEARCH.length}</li></ul>`;
    }
    return h;
}

// ---------------------------------------------------------------- mission report and endings
export function reportHtml(G) {
    const r = G.report, Z = ZONES[r.zone];
    const got = RES.filter((k) => r.brought[k]).map((k) => `${RES_INFO[k].icon} ${r.brought[k]} ${RES_INFO[k].name}`).join(' · ') || 'nothing';
    const samples = Object.entries(r.samples).map(([id, n]) => `${esc(SPECIES_BY_ID[id].name)} ×${n}${isSequenced(G, id) ? ' ✅' : ''}`).join(', ');
    return `<h2>${r.lost ? 'Signal lost' : r.how === 'recalled' ? 'Recalled' : 'Back aboard'}</h2><p class="dim">${esc(Z.name)} · ${r.days} days on the surface</p>
        <p>${r.lost ? 'The bot was destroyed. Part of its hold was recovered.' : 'Cargo unloaded.'}</p><p><b>Brought home:</b> ${got}</p>
        <p><b>Genome samples:</b> ${samples || 'none'}</p><p><b>Creatures defeated:</b> ${r.kills}</p>${r.echo ? '<p class="good">📼 One of VESPER\'s black boxes. It\'s in the Archive.</p>' : ''}`;
}
export function endingHtml(G) {
    const E = ENDINGS[G.ending.kind];
    const lines = E.lines.slice();
    if (G.ending.dog && (G.ending.kind === 'concord' || G.ending.kind === 'purge' || G.ending.kind === 'hard')) lines.push(IRIS_DOG);
    return `<h2 class="endt">${esc(E.title)}</h2>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}
        <p class="dim">Day ${Math.floor(G.ending.day)} · Eden Index ${G.ending.eden} · ${G.stats.missions} drops · ${G.stats.releases} strains released${G.ending.early ? ' · woken early' : ''}</p>`;
}
