/**
 * hero.js — one hero on the pedestal: stats, skills, gear, growth, lore.
 */

import { h, app, btn, icon, elIcon, clsIcon, stars, num, modal, toast, heroCard, gearCard, gearIcon, statLine, costLine, confirmBox, bar, elBadge, clsBadge, showRewards } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { peekStage } from '../stages.js';
import { gestures, canvasEl } from '../input.js';
import { heroById, gearById, gearLookup } from '../../sim/state.js';
import { heroStats, baseStats, heroPower } from '../../sim/stats.js';
import { maxLevel, xpToNext, canEvolve, evolveCost, awakenCost, skillTemplate, SKILL_MAX, releaseValue } from '../../sim/heroes.js';
import { useElixir, autoLevel, evolveHero, awakenHero, skillUpWithTome, skillUpWithHero, equip, unequip, autoEquip, toggleLock, removeHero, fodderOk } from '../../sim/actions.js';
import { gearScore } from '../../sim/gear.js';
import { heroBusy, setTrainee, trainingSlots, isTraining } from '../../sim/idle.js';
import { RARITY, ELEMENT, RACES, TRAITS, STAT_NAME, PCT_STATS, MAX_LEVEL } from '../../data/core.js';
import { CLASSES } from '../../data/classes.js';
import { SLOTS, SLOT, SETS, ITEMS, ESSENCE_NAME } from '../../data/items.js';
import { skillDescription } from '../skilltext.js';
import { leaderText } from './team.js';
import { sfx } from '../../audio.js';
import { pct } from '../../core/fmt.js';

let tab = 'stats';

export const heroScreen = {
    id: 'hero',
    tab: 'heroes',
    stage: 'showcase',
    enter(root, params) {
        this.root = root;
        this.heroId = params.id;
        this.list = params.list || [params.id];
        if (params.tab) tab = params.tab;
        const st = peekStage('showcase');
        this.detach = gestures(canvasEl(), { onDrag: (dx) => st.drag(dx) });
        this.show3d();
        this.render();
    },
    exit() { if (this.detach) this.detach(); },
    hero() { return heroById(G.S, this.heroId); },
    show3d() {
        const hero = this.hero();
        if (!hero) return;
        const st = peekStage('showcase');
        st.showOne(hero, { sheet: 0.56, top: 0.16, element: hero.el });
        if (hero.isNew) { hero.isNew = false; changed('seen'); }
    },
    render() {
        const S = G.S, hero = this.hero();
        const root = this.root;
        root.innerHTML = '';
        if (!hero) { back('heroes'); return; }
        const gl = gearLookup(S);
        const power = heroPower(hero, { gearOf: gl, talents: S.overlord.talents });
        const idx = this.list.indexOf(hero.id);
        const nav = (d) => { const n = this.list[(idx + d + this.list.length) % this.list.length]; this.heroId = n; this.show3d(); this.render(); sfx('page'); };
        const top = h('div.hd-top',
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                btn(icon('back'), () => back('heroes'), 'ghost small', { aria: 'Back' }),
                this.list.length > 1 ? btn('‹', () => nav(-1), 'ghost small', { aria: 'Previous hero' }) : null),
            h('div.hd-title',
                h('div', { html: stars(hero.star, 0, hero.awake) + (hero.radiant ? ' <span style="color:#ff8ad8;font-family:var(--title)">RADIANT</span>' : '') }),
                h('div.hd-name', hero.name),
                h('div.hd-epithet', hero.awake ? `Awakened · ${hero.epithet}` : hero.epithet),
                h('div.chips', { style: { justifyContent: 'center', marginTop: '4px' } }, h('span', { html: elBadge(hero.el) }), h('span', { html: clsBadge(hero.cls) }), h('span.chip', { html: `${icon('sword')} ${num(power)}` }))),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                btn(icon('lock'), () => { toggleLock(S, hero.id); changed('lock'); this.render(); toast(hero.locked ? 'Locked — protected from release and fodder.' : 'Unlocked.'); }, hero.locked ? 'gold small' : 'ghost small', { aria: 'Lock' }),
                this.list.length > 1 ? btn('›', () => nav(1), 'ghost small', { aria: 'Next hero' }) : null),
        );
        const tabs = h('div.tabs', ...[['stats', 'Stats'], ['skills', 'Skills'], ['gear', 'Gear'], ['grow', 'Grow'], ['lore', 'Lore']].map(([k, l]) => h('button.tbtn', { class: tab === k ? 'on' : '', onclick: () => { tab = k; sfx('tab'); this.render(); } }, l)));
        const body = h('div.sheet-body');
        ({ stats: () => this.stats(body, hero), skills: () => this.skills(body, hero), gear: () => this.gear(body, hero), grow: () => this.grow(body, hero), lore: () => this.lore(body, hero) })[tab]();
        app(root, top, h('div.hd-sheet', tabs, body));
    },

    stats(body, hero) {
        const S = G.S;
        const full = heroStats(hero, { gearOf: gearLookup(S), talents: S.overlord.talents });
        const base = baseStats(hero);
        const rows = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'].map((k) => {
            const pctStat = PCT_STATS.has(k);
            const v = pctStat ? pct(full[k]) : num(full[k]);
            const d = full[k] - (pctStat ? base[k] : Math.round(base[k]));
            const bonus = d > (pctStat ? 0.0005 : 0.5) ? (pctStat ? `+${(d * 100).toFixed(0)}%` : `+${num(d)}`) : '';
            return h('div.stat-row', h('span.k', STAT_NAME[k]), h('span.v', { html: `${v}${bonus ? `<b>${bonus}</b>` : ''}` }));
        });
        app(body, 
            h('div.row', { style: { marginBottom: '8px' } }, h('span.grade', { class: hero.grade }, hero.grade), h('div.small.muted', { html: `Stat roll: HP ${Math.round(hero.rolls.hp * 100)}% · ATK ${Math.round(hero.rolls.atk * 100)}% · DEF ${Math.round(hero.rolls.def * 100)}% · SPD ${hero.rolls.spd >= 0 ? '+' : ''}${hero.rolls.spd}` })),
            h('div', bar(hero.level / maxLevel(hero), 'gold tall', `Level ${hero.level} / ${maxLevel(hero)}${hero.level < maxLevel(hero) ? ` · ${num(hero.xp)} / ${num(xpToNext(hero.level, hero.star))} XP` : ' · MAX'}`)),
            h('div.stat-grid', { style: { marginTop: '10px' } }, rows),
            h('h2.sec', 'Traits'),
            hero.traits.length ? h('div.chips', hero.traits.map((t) => h('div.trait-chip', h('b', TRAITS[t].name), h('span', TRAITS[t].desc)))) : h('p.muted.small', 'No traits. Higher rarities roll more; a 6★ evolution adds one.'),
            full.sets.length ? h('div', h('h2.sec', 'Active Sets'), h('div.chips', full.sets.map((s) => h('div.chip', { style: { borderColor: SETS[s].color } }, `${SETS[s].name}: ${SETS[s].desc}`)))) : null,
        );
    },

    skills(body, hero) {
        const S = G.S;
        for (const s of hero.skills) {
            const tpl = skillTemplate(hero, s);
            const kind = s.k === 'ult' ? 'Ultimate' : s.k === 'active' ? 'Skill' : 'Attack';
            app(body, h('div.skill-card', h('div.sk-badge', { class: s.k === 'ult' ? 'ult' : '' }, kind), h('div.grow',
                h('div.sk-name', s.n), h('div.sk-meta', `Lv ${s.lvl}/${SKILL_MAX}${tpl.cd ? ` · Cooldown ${Math.max(0, tpl.cd - (s.lvl >= 5 ? 1 : 0))}` : ''}`),
                h('div.sk-desc', skillDescription(tpl, s.lvl)))));
        }
        if (hero.passive) {
            const tpl = skillTemplate(hero, hero.passive);
            app(body, h('div.skill-card', h('div.sk-badge.passive', 'Passive'), h('div.grow', h('div.sk-name', hero.passive.n), h('div.sk-desc', skillDescription(tpl, hero.passive.lvl)))));
        } else app(body, h('p.muted.small', 'Passive skill unlocks at 3★.'));
        if (hero.leader) app(body, h('div.skill-card', h('div.sk-badge.leader', 'Leader'), h('div.grow', h('div.sk-name', 'Leader Skill'), h('div.sk-desc', `When this hero leads the team: ${leaderText(hero.leader)}.`))));
        app(body, h('h2.sec', 'Skill Up'),
            h('p.muted.small', 'Use a Skill Tome, or fuse a hero of the same class, to raise a random skill by one level (+6% power each level; level 5 also cuts the cooldown by one).'),
            h('div.btn-row',
                btn(`${icon('tome')} Use Tome <small>(${S.res.tomes})</small>`, () => { const r = skillUpWithTome(S, hero.id); if (!r) { toast(S.res.tomes ? 'All skills are maxed.' : 'You have no Skill Tomes.'); return; } sfx('levelup'); toast(`${r.skill} → Lv ${r.lvl}!`, 'good'); changed('skill'); this.render(); }, 'blue', { disabled: !S.res.tomes }),
                btn(`Fuse ${CLASSES[hero.cls].name}`, () => this.fusePicker(hero), '')));
    },
    fusePicker(hero) {
        const S = G.S;
        const cands = S.heroes.filter((x) => x.id !== hero.id && x.cls === hero.cls && fodderOk(S, x)).sort((a, b) => a.star - b.star || a.level - b.level);
        const grid = h('div.hero-grid');
        if (!cands.length) app(grid, h('p.muted', `No free ${CLASSES[hero.cls].name} heroes to fuse. Locked, teamed and busy heroes are skipped.`));
        let m;
        for (const c of cands) app(grid, heroCard(c, { onClick: async () => {
            if (c.star >= 4 && !(await confirmBox(`Fuse ${c.name} (${c.star}★)? They will be consumed.`, 'Fuse', 'Cancel', 'red'))) return;
            const r = skillUpWithHero(S, hero.id, c.id);
            m.close();
            if (r) { sfx('levelup'); toast(`${r.skill} → Lv ${r.lvl}!`, 'good'); changed('skill'); this.render(); } else toast('All skills are maxed.');
        } }));
        m = modal({ title: 'Choose a hero to fuse', body: grid, cls: 'wide' });
    },

    gear(body, hero) {
        const S = G.S;
        const grid = h('div.slot-grid');
        for (const slot of SLOTS) {
            const g = hero.gear[slot] ? gearById(S, hero.gear[slot]) : null;
            const el = h('button.slot', { type: 'button', class: g ? 'filled' : '', onclick: () => this.slotPicker(hero, slot) });
            if (g) app(el, gearIcon(g), h('div.small', { style: { color: SETS[g.set].color } }, SETS[g.set].name));
            else app(el, h('span', { html: icon(SLOT[slot].icon) }), h('span', SLOT[slot].name));
            app(grid, el);
        }
        const st = heroStats(hero, { gearOf: gearLookup(S), talents: S.overlord.talents });
        app(body, grid,
            st.sets.length ? h('div.chips', { style: { marginTop: '8px' } }, st.sets.map((s) => h('div.chip', { style: { borderColor: SETS[s].color, color: SETS[s].color } }, `${SETS[s].name}: ${SETS[s].desc}`))) : h('p.muted.small', 'Equip 2 or 4 of the same set for a bonus.'),
            h('div.btn-row', { style: { marginTop: '10px' } },
                btn('Auto-equip', () => { const n = autoEquip(S, hero.id); toast(n ? `Equipped ${n} Sigilstone${n > 1 ? 's' : ''}.` : 'Nothing better to equip.'); changed('gear'); this.render(); }, 'gold'),
                btn('Unequip All', () => { for (const s of SLOTS) unequip(S, hero.id, s); changed('gear'); this.render(); }, 'ghost'),
                btn(`${icon('hammer')} Forge`, () => go('forge'), 'ghost')));
    },
    slotPicker(hero, slot) {
        const S = G.S;
        const cur = hero.gear[slot] ? gearById(S, hero.gear[slot]) : null;
        const list = S.gear.filter((g) => g.slot === slot && g.id !== (cur && cur.id)).sort((a, b) => (a.owner ? 1 : 0) - (b.owner ? 1 : 0) || gearScore(b) - gearScore(a));
        const wrap = h('div');
        let m;
        if (cur) app(wrap, h('h2.sec', 'Equipped'), gearCard(cur), h('div.btn-row', { style: { margin: '8px 0' } },
            btn('Unequip', () => { unequip(S, hero.id, slot); changed('gear'); m.close(); this.render(); }, 'ghost small'),
            btn('Enhance', () => { m.close(); go('forge', { gear: cur.id }); }, 'blue small')));
        app(wrap, h('h2.sec', `${SLOT[slot].name} Sigilstones`, h('span.aside', `${list.length}`)));
        if (!list.length) app(wrap, h('p.muted', 'None yet — win battles, craft at the Forge or collect the Treasury.'));
        const g = h('div.gear-grid');
        for (const x of list.slice(0, 60)) {
            const owner = x.owner ? heroById(S, x.owner) : null;
            g.append(gearCard(x, { ownerName: owner ? `on ${owner.name}` : null, onClick: () => { equip(S, hero.id, x.id); sfx('buff'); changed('gear'); m.close(); this.render(); } }));
        }
        app(wrap, g);
        m = modal({ title: SLOT[slot].name, body: wrap, cls: 'wide' });
    },

    grow(body, hero) {
        const S = G.S;
        const max = maxLevel(hero);
        // level
        const lvl = h('div.card',
            h('div.row', h('b.grow', `Level ${hero.level} / ${max}`), h('span.muted.small', hero.level >= max ? 'Max level' : `${num(hero.xp)} / ${num(xpToNext(hero.level, hero.star))} XP`)),
            h('div', { style: { margin: '6px 0' } }, bar(hero.level / max, 'gold')),
            h('div.btn-row', ...['xpS', 'xpM', 'xpL'].map((it) => btn(`${icon('elixir')} ${ITEMS[it].name.replace('XP Elixir ', '')} <small>×${S.res.items[it] || 0}</small>`, () => {
                const r = useElixir(S, hero.id, it, 1);
                if (!r || !r.used) { toast(hero.level >= max ? 'Already at max level.' : 'None left. Cook meals or collect the Treasury.'); return; }
                if (r.levels) { sfx('levelup'); peekStage('showcase').fx.pillar(peekStage('showcase').subjectActor().root.position, '#ffe08a', { radius: 0.6, height: 3 }); }
                changed('xp'); this.render();
            }, 'small', { disabled: !(S.res.items[it] > 0) || hero.level >= max })),
            btn('Auto', () => { const r = autoLevel(S, hero.id); if (!r || !r.used) { toast('No elixirs to use.'); return; } sfx('levelup'); toast(`Used ${r.used} elixirs: +${r.levels} levels.`, 'good'); changed('xp'); this.render(); }, 'gold small', { disabled: hero.level >= max })));
        app(body, lvl);
        // evolve
        const ec = evolveCost(hero);
        const evo = h('div.card', h('div.row', h('b.grow', `Evolve to ${Math.min(6, hero.star + 1)}★`), h('span', { html: stars(hero.star + 1 > 6 ? 6 : hero.star + 1) })),
            h('p.muted.small', hero.star >= 6 ? 'Already Mythic — the highest rank.' : `Needs max level and ${ec.fodder} other ${hero.star}★ hero${ec.fodder > 1 ? 'es' : ''} as fodder. The hero returns to level 1 with much higher stats${hero.star === 5 ? ' and gains a trait' : ''}.`),
            hero.star < 6 ? btn(`Choose Fodder · ${costLine({ gold: ec.gold }, S)}`, () => this.evolvePicker(hero), 'gold small', { disabled: !canEvolve(hero) }) : null);
        app(body, evo);
        // awaken
        const ac = awakenCost(hero);
        const aw = h('div.card', h('div.row', h('b.grow', hero.awake ? 'Awakened' : 'Awaken')),
            h('p.muted.small', hero.awake ? 'This hero has awakened: +15% stats, +5 SPD, +5% Crit and Accuracy, and an aura.' : `Awakening grants +15% stats, +5 SPD, +5% Crit Rate and Accuracy, and an elemental aura. Costs ${ELEMENT[hero.el].name} essences from Rifts, the Mine and expeditions.`),
            hero.awake ? null : btn(`Awaken · ${costLine({ gold: ac.gold, essences: { [ac.el]: { lo: ac.lo, mid: ac.mid, hi: ac.hi } } }, S)}`, () => {
                if (!awakenHero(S, hero.id)) { sfx('error'); toast('Not enough essences or gold.'); return; }
                sfx('reveal5');
                const st = peekStage('showcase');
                st.fx.pillar(st.subjectActor().root.position, ELEMENT[hero.el].color, { radius: 0.8, height: 5, dur: 1.4 });
                this.show3d();
                changed('awaken'); this.render();
            }, 'blue small'));
        app(body, aw);
        // jobs
        const busy = heroBusy(S, hero.id);
        const job = h('div.card', h('b', 'Jobs'), h('p.muted.small', busy ? `Currently: ${busy}.` : 'Idle heroes can train, mine, farm or explore while you are away.'),
            h('div.btn-row',
                isTraining(S, hero.id) ? btn('Stop Training', () => { S.training.slots = S.training.slots.filter((s) => s.heroId !== hero.id); changed('train'); this.render(); }, 'ghost small')
                    : btn('Train', () => { if (S.training.slots.length >= trainingSlots(S)) { toast('All training slots are full. Upgrade the Training Grounds.'); return; } setTrainee(S, S.training.slots.length, hero.id); changed('train'); toast(`${hero.name} is training.`, 'good'); this.render(); }, 'small', { disabled: !!busy && !isTraining(S, hero.id) }),
                btn('Wardrobe', () => go('creator', { mode: 'hero', id: hero.id }), 'small')));
        app(body, job);
        // release
        const rv = releaseValue(hero);
        app(body, h('div.card', h('b', 'Release'), h('p.muted.small', `Send this hero home for ${num(rv.dust)} Soul Dust and ${num(rv.gold)} gold. Soul Dust buys sigils and tomes at the Market.`),
            btn('Release', async () => {
                if (!fodderOk(S, hero)) { toast(hero.locked ? 'Unlock first.' : 'Remove from teams and jobs first.'); return; }
                if (!(await confirmBox(`Release ${hero.name}? This cannot be undone.`, 'Release', 'Keep', 'red'))) return;
                removeHero(S, hero.id, true); changed('release'); back('heroes');
            }, 'red small', { disabled: hero.locked })));
    },
    evolvePicker(hero) {
        const S = G.S;
        const need = evolveCost(hero).fodder;
        const sel = new Set();
        const cands = S.heroes.filter((x) => x.id !== hero.id && x.star === hero.star && fodderOk(S, x)).sort((a, b) => a.level - b.level || a.nat - b.nat);
        const grid = h('div.hero-grid');
        const go2 = btn(`Evolve (0/${need})`, () => {
            const r = evolveHero(S, hero.id, [...sel]);
            if (!r) { sfx('error'); toast('Evolution failed — check fodder and gold.'); return false; }
            sfx('reveal5');
            const st = peekStage('showcase');
            this.show3d();
            st.fx.pillar(st.subjectActor().root.position, '#ffe08a', { radius: 0.9, height: 6, dur: 1.5 });
            st.fx.burst(st.subjectActor().root.position.clone().setY(1), '#ffe08a', 60, { speed: 5 });
            toast(`${hero.name} evolved to ${r.star}★!`, 'good');
            changed('evolve'); this.render();
        }, 'gold', { disabled: true });
        const draw = () => {
            grid.innerHTML = '';
            for (const c of cands) app(grid, heroCard(c, { selected: sel.has(c.id), onClick: () => { if (sel.has(c.id)) sel.delete(c.id); else if (sel.size < need) sel.add(c.id); draw(); } }));
            if (!cands.length) app(grid, h('p.muted', `You need ${need} more ${hero.star}★ heroes that are unlocked, not in a team and not busy.`));
            go2.innerHTML = `Evolve (${sel.size}/${need})`;
            go2.disabled = sel.size !== need;
        };
        draw();
        modal({ title: `Fodder: ${need} × ${hero.star}★`, body: h('div', h('p.muted.small', 'Tip: summon with Common Sigils and train low heroes to make fodder.'), grid), cls: 'wide', buttons: [] }).el.append(h('div.modal-btns', go2));
    },

    lore(body, hero) {
        const R = RACES[hero.race], C = CLASSES[hero.cls];
        app(body, 
            h('p', hero.lore),
            h('div.kv', h('span.k', 'Race'), h('span.v', R.name), h('span.k', 'Class'), h('span.v', `${C.name} · ${C.blurb}`), h('span.k', 'Natural rarity'), h('span.v', { html: `${RARITY[hero.nat].name} ${stars(hero.nat)}` }), h('span.k', 'Element'), h('span.v', ELEMENT[hero.el].name), h('span.k', 'Summoned'), h('span.v', hero.got ? new Date(hero.got).toLocaleDateString() : '—')),
            hero.radiant ? h('div.notice', { style: { marginTop: '10px' } }, 'A Radiant — one hero in fifty is born of brighter sigil-light: a rare palette, a shimmer, and +10% to every stat.') : null,
        );
    },
    refresh(what) { if (what === 'tick' || what === 'seen') return; this.render(); },
};
