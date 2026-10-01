/**
 * quests.js — procedural side quests offered by Wayfarers.
 *
 * Kinds: bounty (slay a named elite), cull (kill N of a species), heirloom
 * (find an item and bring it back — or keep it), rescue (free a captive who
 * then fights beside you; reach the stairs together), kindle (light every
 * unlit brazier) and purge (destroy the nests).
 *
 * Everything a quest needs is placed when the floor is built, so accepting
 * one only starts tracking it. Cull progress is measured from a baseline taken
 * at acceptance, so earlier kills never count.
 */

import { SPECIES } from './monsters.js';
import { WAYFARER_NAMES, WAYFARER_TITLES } from './worlds.js';
import { R, ev, log, gainXp, alive, pstats } from './combat.js';
import { rollItem, makeConsumable } from './items.js';

const HEIRLOOMS = ['grandmother\'s locket', 'brass compass', 'wedding ring', 'carved flute', 'father\'s pocket watch', 'silver thimble', 'map case', 'lucky lantern-hook', 'little tin soldier', 'book of pressed flowers'];

export const QUEST_TITLES = { bounty: 'Bounty', cull: 'Thin the Herd', heirloom: 'Lost Heirloom', rescue: 'Rescue', kindle: 'Kindle the Dark', purge: 'Purge the Nests' };

/**
 * ctx (from populate.js): placeMonster(spId, far, opts) → monster | null,
 * farTile(minDist) → [x, y] | null, unlitBraziers(n) → count placed, bestiary.
 */
export function planQuest(run, rng, npc, ctx) {
    const f = run.floor;
    const kinds = { bounty: 3, cull: 3, heirloom: 3, rescue: 2.5, kindle: 2, purge: 2 };
    if (f < 3) { delete kinds.rescue; delete kinds.purge; }
    const kind = rng.weighted(kinds);
    const q = {
        id: run.nextId++, kind, floor: f, giver: npc.id, giverName: npc.name, state: 'offered',
        have: 0, need: 1, title: QUEST_TITLES[kind], text: '', goal: '',
        reward: { gold: Math.round(30 + f * 9), xp: Math.round(25 + f * 7), item: rng.chance(0.55), oil: rng.chance(0.35) ? 30 : 0 },
    };
    if (kind === 'bounty') {
        const sp = rng.pick(ctx.bestiary.filter((s) => SPECIES[s].a !== 'nest'));
        const m = ctx.placeMonster(sp, 14, { elite: true });
        if (!m) return planFallback(run, rng, npc, ctx, q);
        m.quest = q.id; m.bounty = true;
        q.target = m.id;
        q.text = `"There's a thing on this floor they call ${m.ename}. ${SPECIES[sp].n}, but bigger, and wrong. It killed my partner. I can't pay much, but I'll pay."`;
        q.goal = `Slay ${m.name}`;
        q.reward.gold = Math.round(q.reward.gold * 1.4);
    } else if (kind === 'cull') {
        const sp = rng.pick(ctx.bestiary.filter((s) => ['pack', 'skirmisher', 'brute', 'archer'].includes(SPECIES[s].a)));
        const n = rng.int(4, 6);
        let placed = 0;
        for (let k = 0; k < n + 1; k++) if (ctx.placeMonster(sp, 8, {})) placed++;
        q.sp = sp; q.need = Math.min(n, placed);
        if (q.need < 3) return planFallback(run, rng, npc, ctx, q);
        q.text = `"The ${SPECIES[sp].n.toLowerCase()}s on this floor have my scent. Thin them out — ${q.need} of them — and I'll make it to the stairs."`;
        q.goal = `Kill ${q.need} ${SPECIES[sp].n}s`;
    } else if (kind === 'heirloom') {
        const pos = ctx.farTile(14);
        if (!pos) return planFallback(run, rng, npc, ctx, q);
        const name = rng.pick(HEIRLOOMS);
        const it = makeConsumable(run, 'heirloom');
        it.name = `${npc.name}'s ${name}`; it.quest = q.id;
        ctx.dropItem(pos[0], pos[1], it);
        q.itemId = it.id;
        q.text = `"I dropped my ${name} somewhere on this floor when I ran. It's all I have left of home. Please — bring it back to me."`;
        q.goal = `Find ${npc.name}'s ${name} and return it`;
        q.reward.item = true;
    } else if (kind === 'rescue') {
        const pos = ctx.farTile(12);
        if (!pos) return planFallback(run, rng, npc, ctx, q);
        const allyName = rng.pick(WAYFARER_NAMES.filter((n) => n !== npc.name));
        ctx.addObj({ k: 'captive', x: pos[0], y: pos[1], name: allyName, quest: q.id });
        q.allyName = allyName;
        q.text = `"${allyName} is caught somewhere on this floor — I heard them shouting. Free them, and see them safe to the stairs down. They can fight, if you give them the chance."`;
        q.goal = `Free ${allyName} and reach the stairs together`;
        q.reward.xp = Math.round(q.reward.xp * 1.3);
    } else if (kind === 'kindle') {
        const n = ctx.unlitBraziers(rng.int(3, 4));
        if (n < 2) return planFallback(run, rng, npc, ctx, q);
        q.need = n;
        q.text = `"The braziers on this floor have all gone out — ${n} of them. Light them again and the dark will back off. For a while."`;
        q.goal = `Light ${n} braziers`;
    } else if (kind === 'purge') {
        const n = rng.int(2, 3);
        let placed = 0;
        const sp = rng.pick(ctx.bestiary.filter((s) => SPECIES[s].a === 'pack' || SPECIES[s].a === 'skirmisher')) || ctx.bestiary[0];
        for (let k = 0; k < n; k++) {
            const m = ctx.placeMonster('nest', 10, {});
            if (m) { m.nestSp = sp; m.quest = q.id; m.name = `${SPECIES[sp].n} Nest`; placed++; }
        }
        if (placed < 2) return planFallback(run, rng, npc, ctx, q);
        q.need = placed;
        q.text = `"There are ${placed} nests on this floor. They'll keep breeding until someone burns them out. I'm not that someone. Are you?"`;
        q.goal = `Destroy ${placed} nests`;
        q.reward.gold = Math.round(q.reward.gold * 1.2);
    }
    return q;
}

// If a kind could not be set up on this floor, fall back to a bounty-free cull or a simple heirloom.
function planFallback(run, rng, npc, ctx, q) {
    const pos = ctx.farTile(8);
    if (!pos) return null;
    q.kind = 'heirloom'; q.title = QUEST_TITLES.heirloom;
    const name = rng.pick(HEIRLOOMS);
    const it = makeConsumable(run, 'heirloom');
    it.name = `${npc.name}'s ${name}`; it.quest = q.id;
    ctx.dropItem(pos[0], pos[1], it);
    q.itemId = it.id;
    q.text = `"My ${name} — I dropped it somewhere on this floor. Bring it back and I'll make it worth your while."`;
    q.goal = `Find ${npc.name}'s ${name} and return it`;
    return q;
}

export function wayfarerName(rng) {
    return { name: rng.pick(WAYFARER_NAMES), title: rng.pick(WAYFARER_TITLES) };
}

// ------------------------------------------------------------------ Lifecycle

export const activeQuests = (run) => run.quests.filter((q) => q.state === 'active');

export function acceptQuest(run, qid) {
    const q = run.quests.find((x) => x.id === qid);
    if (!q || q.state !== 'offered') return;
    q.state = 'active';
    if (q.kind === 'cull') q.base = run.stats.killsBy[q.sp] || 0;
    if (q.kind === 'kindle') q.have = run.objs.filter((o) => o.k === 'brazier' && o.lit && o.questLit).length;
    log(run, `Quest accepted: ${q.goal}.`, 'quest');
    ev(run, { t: 'quest', q: q.id, state: 'active' });
    // A heirloom already in the pack (found before asking) can be handed over straight away.
    recheck(run);
}

export function recheck(run) {
    for (const q of activeQuests(run)) {
        if (q.kind === 'bounty') {
            const m = run.mons.find((o) => o.id === q.target);
            if (!m || !alive(m)) complete(run, q);
        } else if (q.kind === 'cull') {
            q.have = Math.min(q.need, (run.stats.killsBy[q.sp] || 0) - q.base);
            if (q.have >= q.need) complete(run, q);
        } else if (q.kind === 'purge') {
            q.have = q.need - run.mons.filter((o) => o.quest === q.id && alive(o)).length;
            if (q.have >= q.need) complete(run, q);
        } else if (q.kind === 'kindle') {
            const unlit = run.objs.filter((o) => o.k === 'brazier' && o.questUnlit && !o.lit).length;
            q.have = q.need - unlit;
            if (unlit === 0) complete(run, q);
        } else if (q.kind === 'heirloom') {
            q.have = run.p.inv.some((it) => it.quest === q.id) ? 1 : 0;
        }
    }
}

export function complete(run, q) {
    if (q.state !== 'active') return;
    q.state = 'done';
    q.have = q.need;
    const rng = R(run);
    const goldMul = 1 + pstats(run).gold / 100;
    run.p.gold += Math.round(q.reward.gold * goldMul);
    run.stats.quests++;
    log(run, `Quest complete: ${q.title}! +${Math.round(q.reward.gold * goldMul)} gold.`, 'quest');
    ev(run, { t: 'quest', q: q.id, state: 'done' });
    ev(run, { t: 'gold', n: q.reward.gold });
    gainXp(run, q.reward.xp);
    if (q.reward.oil) { run.p.oil = Math.min(run.p.oilMax, run.p.oil + q.reward.oil); log(run, 'They top up your lantern, too.', 'good'); }
    if (q.reward.item) {
        const it = rollItem(run, rng, run.floor + 1, 'gear', 1);
        if (it.r < 1) it.r = 1;
        giveItem(run, it);
        log(run, `You receive: ${it.name}.`, 'loot');
    }
}

export function giveItem(run, it) {
    if (run.p.inv.length < 20) run.p.inv.push(it);
    else { run.items.push({ id: it.id, x: run.p.x, y: run.p.y, it }); ev(run, { t: 'drop', id: it.id, x: run.p.x, y: run.p.y }); log(run, 'Your pack is full — it lands at your feet.', 'warn'); }
}

/** Talking to a Wayfarer: returns a dialog object for the UI. */
export function talk(run, npc) {
    const q = run.quests.find((x) => x.id === npc.quest);
    if (!q) return { k: 'talk', obj: npc.id, name: npc.name, text: '"Keep your lamp lit, friend."' };
    if (q.state === 'offered') return { k: 'quest', obj: npc.id, q: q.id, name: npc.name };
    if (q.state === 'active' && q.kind === 'heirloom') {
        const i = run.p.inv.findIndex((it) => it.quest === q.id);
        if (i >= 0) {
            run.p.inv.splice(i, 1);
            complete(run, q);
            return { k: 'talk', obj: npc.id, name: npc.name, text: '"You found it! Oh — oh, thank you. Take this. Take all of it."' };
        }
    }
    if (q.state === 'active') return { k: 'talk', obj: npc.id, name: npc.name, text: `"${q.goal}. Please hurry."` };
    if (q.state === 'done') return { k: 'talk', obj: npc.id, name: npc.name, text: '"I owe you one. I\'ll find my own way from here."' };
    return { k: 'talk', obj: npc.id, name: npc.name, text: '"Maybe next time."' };
}

/** Called as the hero takes the stairs down. */
export function onLeaveFloor(run) {
    for (const q of run.quests) {
        if (q.floor !== run.floor) continue;
        if (q.state === 'active' && q.kind === 'rescue') {
            const ally = run.mons.find((m) => m.ally && m.quest === q.id && alive(m));
            if (ally) { complete(run, q); log(run, `${q.allyName} waves you on and heads for home.`, 'good'); continue; }
        }
        if (q.state === 'active') { q.state = 'failed'; log(run, `Quest abandoned: ${q.title}.`, 'bad'); }
        if (q.state === 'offered') q.state = 'expired';
    }
    // Heirlooms of abandoned quests turn into plain keepsakes worth a few coins.
    for (const it of run.p.inv) if (it.k === 'heirloom') { it.k = 'trinket'; it.val = 30 + run.floor * 2; it.quest = null; }
}
