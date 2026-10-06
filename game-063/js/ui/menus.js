// Every menu screen: title, hero creator, map card, the Clubhouse (shop, gear, stats, spellbook,
// records), hole results, pause, settings, confirmations and the credits. Buttons carry data-act and
// the app handles them in one place.

import { LOOKS, OUTFITS, CLUB_SETS, BALLS, CHARMS, ITEMS, ITEM_ORDER, SPELLS, SPELL_ORDER, STAT_KEYS, STAT_INFO, xpToNext, totalStats, gearStats, shopStock, derive, scoreName, MAX_LEVEL } from '../sim/rpg.js';
import { HOLES } from '../sim/holes.js';
import { REALMS } from '../sim/realms.js';
import { REALM_SHARD } from '../sim/story.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const starsHtml = (n, max = 3) => `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(max - n)}</span></span>`;
const statLine = (g) => STAT_KEYS.filter((k) => g[k]).map((k) => `${STAT_INFO[k].short} +${g[k]}`).join(' · ');

export class Menus {
    constructor(app) { this.app = app; this.tab = 'shop'; this.titleSel = 0; }

    // ---------------------------------------------------------------- title
    title(hasSave) {
        const items = [];
        if (hasSave) items.push(['continue', 'Continue Quest', 'gold']);
        items.push(['new', hasSave ? 'New Quest' : 'Begin the Quest', hasSave ? '' : 'gold'], ['settings', 'Settings', 'ghost']);
        this.titleItems = items;
        this.titleSel = 0;
        $('title-menu').innerHTML = items.map(([a, l, c], i) => `<button class="btn ${c}${i === 0 ? ' sel' : ''}" data-act="title-${a}">${l}</button>`).join('');
    }
    titleMove(d) {
        if (!this.titleItems) return;
        this.titleSel = (this.titleSel + d + this.titleItems.length) % this.titleItems.length;
        [...$('title-menu').children].forEach((b, i) => b.classList.toggle('sel', i === this.titleSel));
    }
    titleChosen() { return this.titleItems?.[this.titleSel]?.[0]; }

    // ---------------------------------------------------------------- creator
    creator(state) {
        $('look-row').innerHTML = LOOKS.map((l, i) => `<button class="chip${state.look === i ? ' on' : ''}" data-act="pick-look" data-i="${i}" style="background:${l.hair};color:#fff;text-shadow:0 1px 0 #000">${l.name}</button>`).join('');
        $('outfit-row').innerHTML = OUTFITS.map((c, i) => `<button class="chip swatch${state.outfit === i ? ' on' : ''}" data-act="pick-outfit" data-i="${i}" style="background:${c}" aria-label="Colour ${i + 1}"></button>`).join('');
    }

    // ---------------------------------------------------------------- map
    mapTop(p) {
        $('map-hero').innerHTML = `<b>${esc(p.name)}</b> · Lv ${p.level} · 🪙 ${p.gold}`;
        const got = REALMS.map((_, r) => !!p.holes[`${r + 1}-4`]);
        $('map-shards').innerHTML = got.map((g, r) => `<i class="shard${g ? ' got' : ''}" title="${REALM_SHARD[r]}"></i>`).join('');
    }
    mapCard(node, p, unlocked) {
        const el = $('map-card');
        const go = $('map-go');
        if (node.kind === 'club') {
            el.innerHTML = `<h3>The Royal Clubhouse</h3><div class="meta">Pro Shop · Gear · Stats · Spellbook</div><p>Old Man Eagle keeps the shop. Spend your gold, swap your gear and spend your level-up points.</p>`;
            go.textContent = 'Enter'; go.disabled = false;
            return;
        }
        const h = node.hole, rec = p.holes[h.id];
        const yd = Math.round(Math.hypot(h.cup[0] - h.tee[0], h.cup[1] - h.tee[1]));
        el.innerHTML = `<h3>${h.id} · ${esc(h.name)}${h.boss ? ' ☠' : ''}</h3><div class="meta">${REALMS[h.realm].name} · Par ${h.par} · ${yd} yd</div>` +
            (unlocked ? `<p>${esc(h.blurb ?? '')}</p><div>${starsHtml(rec?.stars ?? 0)} ${rec ? `<small>best ${rec.best}</small>` : ''}</div>` : `<p><i>Locked — clear the hole before it to open the path.</i></p>`);
        go.textContent = rec ? 'Play again' : 'Play';
        go.disabled = !unlocked;
    }

    // ---------------------------------------------------------------- clubhouse
    club(p, progress) {
        $('club-gold').textContent = `🪙 ${p.gold}`;
        for (const b of $('club-tabs').children) b.classList.toggle('on', b.dataset.tab === this.tab);
        const body = $('club-body');
        const d = derive(p);
        if (this.tab === 'shop') {
            const stock = shopStock(p, progress);
            body.innerHTML = `<div class="grid">${stock.map((g) => {
                const owned = g.cat !== 'items' && g.owned;
                const stats = g.cat !== 'items' ? statLine(g) : '';
                return `<div class="card"><div class="cat">${{ clubs: 'Club set', balls: 'Ball', charms: 'Charm', items: 'Item' }[g.cat]}</div><div class="nm">${g.icon ?? ''} ${esc(g.name)}</div><div class="ds">${esc(g.desc ?? '')}${stats ? `<br><b>${stats}</b>` : ''}</div>` +
                    `<div class="ft"><span>🪙 ${g.cost}${g.cat === 'items' ? ` · have ${g.have}` : ''}</span>` +
                    (owned ? '<span>Owned ✓</span>' : `<button class="btn small gold" data-act="buy" data-cat="${g.cat}" data-id="${g.id}" ${p.gold < g.cost ? 'disabled' : ''}>Buy</button>`) + '</div></div>';
            }).join('')}</div><p style="margin-top:10px;font-size:13px;color:#4a3446">Old Man Eagle: “Back in my day we played with a turnip and a stick. You kids don't know how good you've got it.”</p>`;
        } else if (this.tab === 'gear') {
            const sec = (cat, table, slot) => `<h3 style="margin:8px 0 6px">${{ clubs: 'Club sets', balls: 'Balls', charms: 'Charms' }[cat]}</h3><div class="grid">${p.owned[cat].map((id) => {
                const g = table[id], on = p.equip[slot] === id;
                return `<div class="card${on ? ' equipped' : ''}"><div class="nm">${esc(g.name)}</div><div class="ds">${esc(g.desc ?? '')}${statLine(g) ? `<br><b>${statLine(g)}</b>` : ''}</div><div class="ft"><span></span>${on ? '<span>Equipped ✓</span>' : `<button class="btn small" data-act="equip" data-cat="${cat}" data-id="${id}">Equip</button>`}</div></div>`;
            }).join('')}</div>`;
            const g = gearStats(p);
            body.innerHTML = `<div class="card"><b>Gear bonus:</b> ${statLine(g) || 'none'} · Power ×${d.powMult.toFixed(2)} · MP ${d.maxMp}</div>` + sec('clubs', CLUB_SETS, 'clubs') + sec('balls', BALLS, 'ball') + sec('charms', CHARMS, 'charm');
        } else if (this.tab === 'stats') {
            const tot = totalStats(p), g = gearStats(p);
            const need = xpToNext(p.level);
            body.innerHTML = `<div><b>Level ${p.level}</b>${p.level >= MAX_LEVEL ? ' (max)' : ` · ${p.xp} / ${need} XP`}</div><div class="xpbar"><i style="width:${Math.min(100, (p.xp / need) * 100)}%"></i></div>` +
                `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><b>Points to spend: ${p.pts}</b><button class="btn small" data-act="auto-stats" ${p.pts ? '' : 'disabled'}>Auto</button></div>` +
                STAT_KEYS.map((k) => `<div class="stat-row"><div><b>${STAT_INFO[k].name}</b><br><small>${STAT_INFO[k].desc}</small></div><div class="bar"><i style="width:${Math.min(100, tot[k] * 4)}%"></i></div><div class="val">${tot[k]}${g[k] ? `<small style="font-size:11px"> (+${g[k]})</small>` : ''}</div><button class="btn round small" data-act="add-stat" data-k="${k}" ${p.pts ? '' : 'disabled'} aria-label="Add ${STAT_INFO[k].name}">+</button></div>`).join('') +
                `<p style="margin-top:10px;font-size:14px">Power ×${d.powMult.toFixed(2)} · Meter speed ×${d.meterSpeed.toFixed(2)} · Preview ${Math.round(d.arcFrac * 100)}% · PERFECT zone ±${(d.perfectZone * 100).toFixed(1)}% · Max MP ${d.maxMp} · Gold ×${d.goldMult.toFixed(2)}</p>`;
        } else if (this.tab === 'spells') {
            body.innerHTML = `<div class="grid">${SPELL_ORDER.map((id) => {
                const S = SPELLS[id], has = p.spells.includes(id);
                return `<div class="card" style="${has ? '' : 'opacity:0.55'}"><div class="nm" style="color:${has ? S.color : '#888'};text-shadow:0 1px 0 #000">${has ? S.name : '???'}</div><div class="ds">${has ? esc(S.desc) : 'A spell Wedgewick has forgotten. A Tee Shard might jog his memory.'}</div><div class="ft"><span>Key ${S.key}</span><span>${id === 'mulligan' ? d.mulliganCost : S.mp} MP</span></div></div>`;
            }).join('')}</div><h3 style="margin:12px 0 6px">Items</h3><div class="grid">${ITEM_ORDER.map((k) => `<div class="card"><div class="nm">${ITEMS[k].icon} ${ITEMS[k].name} ×${p.items[k] || 0}</div><div class="ds">${ITEMS[k].desc}</div></div>`).join('')}</div>`;
        } else {
            const rows = HOLES.map((h) => { const r = p.holes[h.id]; return `<tr><td>${h.id}</td><td>${esc(h.name)}</td><td>${h.par}</td><td>${r ? r.best : '–'}</td><td>${r ? starsHtml(r.stars) : ''}</td></tr>`; }).join('');
            const T = p.totals;
            const stars = Object.values(p.holes).reduce((a, r) => a + r.stars, 0);
            body.innerHTML = `<div class="records"><p><b>${stars} / 60 ★</b> · Holes played ${T.holes} · Strokes ${T.strokes} · Monsters bonked ${T.monsters} · Coins ${T.coins} · PERFECT strikes ${T.perfects} · Holes in one ${T.holeInOnes}</p><table><tr><th>Hole</th><th>Name</th><th>Par</th><th>Best</th><th>Stars</th></tr>${rows}</table></div>`;
        }
    }

    // ---------------------------------------------------------------- results
    result(hole, r, pay, extra = {}) {
        const name = scoreName(r.strokes, hole.par);
        const el = $('result-panel');
        el.innerHTML = `<div class="score-name">${name}</div><div class="strokes">${r.strokes} strokes · Par ${hole.par}${r.penalties ? ` · ${r.penalties} penalty` : ''}</div>` +
            `<div class="stars" id="res-stars">${starsHtml(0)}</div>` +
            `<div class="rewards"><div>✨ +${pay.xp} XP</div><div>🪙 +${pay.gold} gold</div><div>⭐ ${r.monsters} monsters</div><div>🎯 ${r.perfects} PERFECT</div>${Object.entries(r.itemsFound || {}).map(([k, n]) => `<div>${ITEMS[k].icon} +${n} ${ITEMS[k].name}</div>`).join('')}</div>` +
            (pay.newBest && !pay.first ? '<div><b>New personal best!</b></div>' : '') +
            (pay.ups ? `<div class="levelup">LEVEL UP! Lv ${pay.level0} → ${pay.level} · +${pay.ups * 2} stat points</div>` : '') +
            (extra.note ? `<div>${extra.note}</div>` : '') +
            `<div class="row-buttons" style="justify-content:center"><button class="btn ghost" data-act="res-retry">Play again</button><button class="btn gold" data-act="res-continue">Continue</button></div>`;
        $('result').classList.remove('hidden');
        return pay.stars;
    }
    showStars(n) { $('res-stars').innerHTML = starsHtml(n); }
    failed(hole) {
        $('result-panel').innerHTML = `<div class="score-name">Cursed!</div><div class="strokes">Lord Bogey's curse caps ${esc(hole.name)} at ${hole.par + (hole.boss ? 6 : 4)} strokes.</div><p>Wedgewick: “Shake it off. Even I had a fourteen once. Well, Bogart did.”</p><div class="row-buttons" style="justify-content:center"><button class="btn ghost" data-act="res-map">Back to the map</button><button class="btn gold" data-act="res-retry">Try again</button></div>`;
        $('result').classList.remove('hidden');
    }

    // ---------------------------------------------------------------- pause / settings / confirm
    pause(inHole) {
        $('pause-panel').innerHTML = `<h2>Paused</h2><button class="btn gold" data-act="resume">Resume</button>${inHole ? '<button class="btn" data-act="retry">Restart hole</button><button class="btn" data-act="quit-map">Quit to the map</button>' : ''}<button class="btn" data-act="open-settings">Settings</button>` +
            `<div style="font-size:13px;line-height:1.5;margin-top:4px"><b>Aim</b> ← → or drag · <b>Club</b> ↑ ↓ · <b>Swing</b> Space ×3 · <b>Spells</b> 1–5 · <b>Items</b> Q · <b>View</b> V · <b>Look</b> right-drag · <b>Mute</b> M</div>`;
        $('pause').classList.remove('hidden');
    }
    settings(s, onTitle) {
        const lvl = (v) => (v <= 0 ? 'Off' : v < 0.45 ? 'Low' : v < 0.8 ? 'Medium' : 'High');
        const q = ['Low', 'Medium', 'High'];
        $('settings-panel').innerHTML = `<h2>Settings</h2>` +
            `<div class="set-row">Music <button class="btn small" data-act="set-music">${lvl(s.music)}</button></div>` +
            `<div class="set-row">Sound effects <button class="btn small" data-act="set-sfx">${lvl(s.sfx)}</button></div>` +
            `<div class="set-row">Graphics <button class="btn small" data-act="set-quality">${s.quality < 0 ? 'Auto' : q[s.quality]}</button></div>` +
            `<div class="set-row">Gentle swing <button class="btn small" data-act="set-gentle">${s.gentle ? 'On' : 'Off'}</button></div>` +
            `<div class="set-row">Screen shake <button class="btn small" data-act="set-shake">${s.shake ? 'On' : 'Off'}</button></div>` +
            `<div class="set-row">Wedgewick's tips <button class="btn small" data-act="set-tips">${s.tips ? 'On' : 'Off'}</button></div>` +
            (onTitle ? '<button class="btn ghost" data-act="erase">Erase saved quest</button>' : '') +
            '<button class="btn gold" data-act="close-settings">Done</button>';
        $('settings').classList.remove('hidden');
    }
    confirm(text, yes, no = 'Cancel') {
        $('confirm-panel').innerHTML = `<h2>Are you sure?</h2><p style="text-align:center">${text}</p><div class="row-buttons" style="justify-content:center"><button class="btn ghost" data-act="confirm-no">${no}</button><button class="btn gold" data-act="confirm-yes">${yes}</button></div>`;
        $('confirm').classList.remove('hidden');
    }

    credits(p) {
        const stars = Object.values(p.holes).reduce((a, r) => a + r.stars, 0);
        $('credits-roll').innerHTML = `<h1>TEE &amp; SORCERY</h1><p>The Golden Tee is whole again.</p><p><b>${esc(p.name)}</b>, Royal Caddie-Knight and Champion of Fairhaven</p><p>Level ${p.level} · ${stars} / 60 ★ · ${p.totals.monsters} monsters bonked</p>` +
            '<h3>Starring</h3><p>Wedgewick the Wise, as himself (a wedge)</p><p>Queen Birdie · Old Man Eagle · Fescue · Zephyrine · Yodel · Cinder · Lady Albatross</p>' +
            '<h3>Featuring</h3><p>Grubbins the Gopher King · Duneborn · Big Frosty · Double Bogey (both of them)</p><p>and Lord Bogey, now Royal Greenskeeper</p>' +
            '<h3>Made with</h3><p>three.js, Web Audio and no asset files at all</p><p>Every model, face, tune and sound is generated in code.</p>' +
            '<h3>Thank you for playing</h3><p>Free Play is open: replay any hole for more stars.</p><p>The Starforged clubs await in the Pro Shop.</p><p style="margin-top:40px">— tap to continue —</p>';
        $('credits').classList.remove('hidden');
    }
}
