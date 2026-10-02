// The simulated server: other players, their days, who is online, what they
// say in the commentary, the news, bounties and mail.

import { R, mulberry32, hashStr, clamp } from '../rng.js';
import { HANDLES, PERSONALITIES, CHAT, GREET, GREET_NEW, BYE, REACT, REACT_YOU, REPLIES, GUILDS, ADMIN, MAIL_REPLY, MAIL_GIFT, MAIL_GUILD_INVITE, SLUR } from '../data/text.js';
import { RACES, MASTERS, titleFor, expForNext } from '../data/classes.js';
import { CREATURES } from '../data/creatures.js';
import { weaponName, armorName } from '../data/items.js';

const NPC_EXP = [14, 24, 34, 45, 55, 66, 77, 89, 101, 114, 127, 141, 156, 172, 189];
const NPC_GOLD = [36, 97, 148, 198, 241, 288, 340, 388, 435, 488, 538, 600, 633, 686, 739];
const SEXES = ['m', 'f', 'n'];
const CHANNELS = ['village', 'inn', 'garden', 'shades', 'stone', 'guild'];

function randIn([a, b]) { return a + R.f() * (b - a); }

function makeNpc(id, name, opts = {}) {
    const pers = opts.pers || R.weighted(Object.keys(PERSONALITIES), (k) => PERSONALITIES[k].weight);
    const P = PERSONALITIES[pers];
    const skill = randIn(P.skill);
    let dk = 0, level = 1;
    if (!opts.fresh) {
        if (pers === 'newbie') { level = R.i(1, 5); dk = R.chance(0.1) ? 1 : 0; }
        else if (pers === 'veteran') { dk = 2 + Math.round(Math.pow(R.f(), 1.7) * 20); level = R.i(1, 15); }
        else { dk = R.chance(0.45) ? 0 : Math.round(Math.pow(R.f(), 2) * 12); level = R.i(1, 15); }
    }
    const n = {
        id, name, pers, sex: R.pick(SEXES), race: R.pick(Object.keys(RACES)),
        level, dk, exp: 0, gold: R.i(20, 200) * level, bank: R.i(0, 600) * level, gems: R.i(0, 3 + dk),
        charm: R.i(0, 6 + dk), alive: true, sleep: 'fields', killedToday: false,
        chatty: randIn(P.chatty), aggression: randIn(P.aggression), skill,
        activity: 0.45 + R.f() * 0.5,
        peak: R.weighted([...Array(24).keys()], (h) => (h >= 18 && h <= 23 ? 4 : h >= 12 && h < 18 ? 2.5 : h >= 7 && h < 12 ? 1.5 : 0.6)),
        span: R.i(2, 6),
        guild: null, spouse: null, pvpWins: 0, deaths: 0, color: R.pick(['`%', '`#', '`@', '`^', '`!', '`Q', '`&', '`5']),
        bio: '', joined: opts.day ?? 0, lastSeenDay: 0,
    };
    const lo = level > 1 ? expForNext(level - 1, dk) : 0;
    const hi = level < 15 ? expForNext(level, dk) : lo * 1.2;
    n.exp = Math.round(lo + R.f() * (hi - lo) * 0.8) || R.i(0, 60);
    gearUp(n);
    n.sleep = sleepChoice(n);
    n.bio = makeBio(n);
    return n;
}

function makeBio(n) {
    const r = RACES[n.race].name.toLowerCase();
    const lines = {
        newbie: `just started!! ${r}, still learning. be nice pls`,
        veteran: `Playing since the first Wyrm. Ask me anything.`,
        roleplayer: `A wandering ${r} of no fixed hearth, seeking an old debt and older answers.`,
        braggart: `top 10 hall of heroes soon. dont sleep in the fields.`,
        bard: `Songs sung, verses written, hearts gently broken. Ask about my ballads.`,
        merchant: `Buying and selling. Gems, gear, good advice. Mail me.`,
        lurker: `...`,
    };
    return lines[n.pers];
}

function gearUp(n) {
    n.weapon = clamp(n.level - R.i(0, 2) + (n.dk > 4 ? 1 : 0), 0, 15);
    n.armor = clamp(n.level - R.i(0, 2) + (n.dk > 4 ? 1 : 0), 0, 15);
}
function sleepChoice(n) {
    const careful = n.skill * 0.7 + (1 - n.aggression) * 0.2;
    return R.chance(careful * 0.9) ? 'inn' : 'fields';
}

export function npcStats(n) {
    return {
        hp: 10 * n.level + Math.round(n.dk * 2.5),
        atk: n.level + n.weapon + Math.round(n.dk * 0.6) + (n.race === 'troll' ? 1 : 0),
        def: n.level + n.armor + Math.round(n.dk * 0.6) + (n.race === 'elf' ? 1 : 0),
    };
}
export const npcTitle = (n) => titleFor(n.dk, n.sex);
export const npcFull = (n) => `${npcTitle(n)} ${n.name}`;
export const npcWeapon = (n) => weaponName(n.weapon, n.dk);
export const npcArmor = (n) => armorName(n.armor, n.dk);

export function createWorld(seed) {
    R.seed(seed);
    const names = R.shuffle([...HANDLES]);
    const w = {
        seed, day: 0, npcs: [], news: [], chat: Object.fromEntries(CHANNELS.map((c) => [c, []])),
        bounties: {}, guilds: GUILDS.map((g) => ({ ...g, leader: null })), unusedNames: [], admin: ADMIN,
        nextNpc: 0, rngState: seed,
        wed: { willa: null, corwin: null },
    };
    const count = 60;
    for (let i = 0; i < count; i++) w.npcs.push(makeNpc('n' + i, names[i]));
    w.unusedNames = names.slice(count);
    w.nextNpc = count;
    // guilds: veterans lead, others join
    w.guilds.forEach((g, i) => {
        const vets = w.npcs.filter((n) => n.pers === 'veteran' && !n.guild);
        const leader = vets[i % Math.max(1, vets.length)] || w.npcs[i];
        leader.guild = g.tag; g.leader = leader.id;
    });
    for (const n of w.npcs) if (!n.guild && n.level + n.dk * 2 > 4 && R.chance(0.45)) n.guild = R.pick(w.guilds).tag;
    // a few marriages
    for (let i = 0; i < 4; i++) {
        const a = R.pick(w.npcs), b = R.pick(w.npcs);
        if (a !== b && !a.spouse && !b.spouse) { a.spouse = b.id; b.spouse = a.id; }
    }
    // backstory news for "yesterday"
    for (let i = 0; i < 10; i++) simNpcBit(w, -1);
    return w;
}

// ------------------------------------------------------------ news
export function addNews(w, text, day = w.day) {
    w.news.push({ day, text });
    if (w.news.length > 400) w.news.splice(0, w.news.length - 400);
}

const nm = (n) => `${n.color}${npcFull(n)}\`0`;

// one random bit of backstory news
function simNpcBit(w, day) {
    const n = R.pick(w.npcs);
    const foe = R.pick(CREATURES[clamp(n.level, 1, 15)]);
    const t = R.f();
    if (t < 0.4) addNews(w, `${nm(n)}\`3 was slain in the Gloamwood by \`^${foe.name}\`3.`, day);
    else if (t < 0.7) addNews(w, `${nm(n)}\`3 has defeated their master, \`^${MASTERS[clamp(n.level - 2, 0, 13)].name}\`3, to advance to level \`^${n.level}\`3!`, day);
    else addNews(w, `${nm(n)}\`3 was seen staggering out of the Crooked Antler, singing loudly.`, day);
}

// ------------------------------------------------------------ the daily simulation
/**
 * Advance the world by one day. `pl` is the player (may be attacked if they
 * slept in the fields). Returns { report: [coded lines], goldLost, killed }.
 */
export function simulateDay(w, pl, hooks = {}) {
    w.day++;
    const report = [];
    let goldLost = 0, killedBy = null, expLost = 0;
    const day = w.day;
    // the bounty on you might be collected... handled in pvp below
    for (const n of w.npcs) {
        n.alive = true; n.killedToday = false;
        const active = R.chance(n.activity);
        if (!active) continue;
        n.lastSeenDay = day;
        // forest
        const fights = R.i(5, 12) + (n.dk > 0 ? 2 : 0);
        for (let i = 0; i < fights && n.alive; i++) {
            const L = n.level;
            const thrill = n.skill > 0.7 && R.chance(0.3);
            const lose = 0.035 + (1 - n.skill) * 0.05 + (thrill ? 0.03 : 0);
            if (R.chance(lose)) {
                n.alive = false; n.deaths++;
                n.gold = 0; n.exp = Math.round(n.exp * 0.9);
                const foe = R.pick(CREATURES[clamp(L + (thrill ? 1 : 0), 1, 16)]);
                addNews(w, `${nm(n)}\`3 was slain in the Gloamwood by \`^${foe.name}\`3.`);
                continue;
            }
            n.exp += Math.round(NPC_EXP[L - 1] * (thrill ? 1.25 : 1) * (0.9 + R.f() * 0.2));
            n.gold += Math.round(NPC_GOLD[L - 1] * (0.9 + R.f() * 0.2) * (n.race === 'dwarf' ? 1.2 : 1));
            if (R.chance(0.04)) n.gems++;
        }
        if (!n.alive) continue;
        // master
        if (n.level < 15 && n.exp >= expForNext(n.level, n.dk) && R.chance(0.55 + n.skill * 0.4)) {
            n.level++;
            addNews(w, `${nm(n)}\`3 has defeated their master, \`^${MASTERS[n.level - 2].name}\`3, to advance to level \`^${n.level}\`3!`);
            if (R.chance(0.6)) gearUp(n);
            hooks.react?.('level', n);
        }
        // the Wyrm
        if (n.level >= 15 && R.chance(0.25 + n.skill * 0.35)) {
            if (R.chance(0.45 + n.skill * 0.45)) {
                n.dk++; n.level = 1; n.exp = 0; n.gold = 50; n.weapon = 0; n.armor = 0;
                addNews(w, `\`&\`b${npcFull(n)} has slain the Jade Wyrm!\`b\`0 \`@All across the realm, people rejoice. ${n.name} now has \`^${n.dk}\`@ Wyrm kill${n.dk === 1 ? '' : 's'}.`);
                hooks.react?.('dk', n);
            } else {
                n.alive = false; n.deaths++; n.gold = 0;
                addNews(w, `\`2${n.name} went to face the Jade Wyrm and was burned to ash. \`3Their screams were heard as far as the village.`);
                hooks.react?.('death', n);
                continue;
            }
        }
        // bank
        const keep = Math.round(n.gold * (1 - n.skill) * 0.6);
        n.bank += n.gold - keep; n.gold = keep;
        n.bank = Math.round(n.bank * 1.03);
        if (R.chance(0.08)) n.charm++;
        if (R.chance(0.1)) gearUp(n);
        n.sleep = sleepChoice(n);
    }

    // PvP among NPCs and against the player
    const hunters = w.npcs.filter((n) => n.alive && n.aggression > 0.45 && R.chance(n.aggression * 0.6));
    for (const h of R.shuffle(hunters)) {
        const tries = R.i(1, 3);
        for (let t = 0; t < tries && h.alive; t++) {
            const targets = w.npcs.filter((x) => x !== h && x.alive && x.sleep === 'fields' && x.level >= h.level - 1 && x.level <= h.level + 2 && !x.killedToday);
            const playerOk = pl && pl.alive && pl.sleptAt === 'fields' && pl.level >= h.level - 1 && pl.level <= h.level + 2 && !pl.__attackedTonight;
            const targetPlayer = playerOk && (R.chance(0.35 + (w.bounties.you ? 0.3 : 0)) || targets.length === 0);
            if (targetPlayer) {
                const res = hooks.duelPlayer ? hooks.duelPlayer(h) : null;
                if (!res) continue;
                pl.__attackedTonight = true;
                if (res.winner === 'npc') {
                    goldLost += res.gold; expLost += res.exp; killedBy = h;
                    h.gold += res.gold; h.pvpWins++;
                    addNews(w, `${nm(h)}\`3 attacked \`%${pl.name}\`3 while they slept in the fields, and \`$won\`3!`);
                    report.push(`\`$${npcFull(h)}\`4 found you asleep in the fields and attacked! You were slain, and they made off with \`^${res.gold}\`4 gold. You lost \`^${res.exp}\`4 experience.`);
                    if (w.bounties.you) { h.gold += w.bounties.you; addNews(w, `\`^${h.name} collected the ${w.bounties.you} gold bounty on ${pl.name}!`); report.push(`\`4${h.name} also collected the \`^${w.bounties.you}\`4 gold bounty on your head.`); delete w.bounties.you; }
                } else {
                    h.alive = false; h.deaths++;
                    addNews(w, `${nm(h)}\`3 attacked \`%${pl.name}\`3 in the fields and was \`@soundly defeated\`3!`);
                    report.push(`\`@${npcFull(h)}\`2 crept up on you in the night, but you woke in time and drove them off! They fled with nothing.`);
                    hooks.react?.('defended', h);
                }
                continue;
            }
            if (!targets.length) break;
            const v = R.pick(targets);
            const a = npcStats(h), b = npcStats(v);
            const win = (a.atk + a.def + a.hp / 6) * (0.75 + R.f() * 0.5) > (b.atk + b.def + b.hp / 6) * (0.75 + R.f() * 0.5);
            if (win) {
                h.gold += v.gold; v.gold = 0; v.alive = false; v.killedToday = true; v.deaths++; h.pvpWins++;
                addNews(w, `${nm(h)}\`3 attacked ${nm(v)}\`3 in the fields and \`$slew them\`3!`);
                if (R.chance(0.25)) { const amt = R.i(2, 8) * 50 * Math.max(1, h.level); w.bounties[h.id] = (w.bounties[h.id] || 0) + amt; addNews(w, `\`^${v.name} has placed a bounty of ${amt} gold on ${h.name}'s head.`); }
            } else {
                h.alive = false; h.deaths++; h.killedToday = true;
                addNews(w, `${nm(h)}\`3 attacked ${nm(v)}\`3 in the fields but \`@was beaten\`3!`);
            }
        }
    }

    // social life
    if (R.chance(0.12)) {
        const singles = w.npcs.filter((n) => !n.spouse && n.charm > 6);
        if (singles.length >= 2) {
            const a = R.pick(singles); const b = R.pick(singles.filter((x) => x !== a));
            if (b) { a.spouse = b.id; b.spouse = a.id; addNews(w, `\`%${a.name} and ${b.name} were married in the Moonlit Gardens! \`5Brannoc is serving free ale (one each).`); hooks.react?.('wed', a); }
        }
    }
    if (R.chance(0.3)) {
        const free = w.npcs.filter((n) => !n.guild && n.level + n.dk * 2 > 4);
        if (free.length) { const n = R.pick(free); const g = R.pick(w.guilds); n.guild = g.tag; addNews(w, `\`3${n.name} has joined the guild \`^${g.name}\`3.`); }
    }
    if (R.chance(0.2) && w.unusedNames.length) {
        const n = makeNpc('n' + w.nextNpc++, w.unusedNames.shift(), { pers: R.chance(0.7) ? 'newbie' : undefined, fresh: true, day });
        w.npcs.push(n);
        addNews(w, `\`3A new warrior, ${nm(n)}\`3, has arrived in Hollowmere. Welcome!`);
    }
    for (const n of w.npcs) n.killedToday = false;
    if (pl) delete pl.__attackedTonight;
    return { report, goldLost, expLost, killedBy };
}

// ------------------------------------------------------------ online presence
const LOCS = [['village', 40], ['forest', 26], ['inn', 14], ['garden', 5], ['training', 5], ['shops', 7], ['bank', 3]];

/** Recompute who is online for the current real hour. Deterministic per (seed, real hour). */
export function computeOnline(w, now = Date.now()) {
    const d = new Date(now);
    const hour = d.getHours();
    const hourKey = Math.floor(now / 3600000);
    const slot10 = Math.floor(now / 600000); // location shuffles every 10 minutes
    const on = [];
    for (const n of w.npcs) {
        const dist = Math.min(Math.abs(hour - n.peak), 24 - Math.abs(hour - n.peak));
        const inWin = dist <= n.span / 2 + 0.5;
        const r = mulberry32(hashStr(n.id + ':' + hourKey) ^ w.seed)();
        const p = inWin ? n.activity * 0.85 : 0.06;
        if (r < p) on.push(n);
    }
    if (on.length < 7) {
        const rest = w.npcs.filter((n) => !on.includes(n)).sort((a, b) => hashStr(a.id + hourKey) - hashStr(b.id + hourKey));
        while (on.length < 7 && rest.length) on.push(rest.shift());
    }
    for (const n of on) {
        const rr = mulberry32(hashStr(n.id + ':' + slot10) ^ w.seed);
        let t = rr() * 100; n.loc = 'village';
        for (const [l, wt] of LOCS) { t -= wt; if (t <= 0) { n.loc = l; break; } }
        if (!n.alive) n.loc = 'shades';
        if (n.pers === 'bard' && rr() < 0.5) n.loc = 'inn';
    }
    return on;
}

// ------------------------------------------------------------ commentary
export function postChat(w, channel, entry) {
    const list = w.chat[channel] || (w.chat[channel] = []);
    list.push({ t: Date.now(), ...entry });
    if (list.length > 80) list.splice(0, list.length - 80);
}

const CHANNEL_LINES = {
    inn: ['another round, Brannoc!', ':slides a few coins across the bar.', 'this ale tastes like boots', 'Corwin is on fire tonight', ':joins in the chorus, badly.', 'who\'s buying', 'Willa just winked at me. or she had something in her eye', ':falls off a stool.', 'dagny keeps looking at me. do i have a bounty??', 'room upstairs is worth every copper'],
    garden: [':smells the roses.', 'so peaceful here', ':sits by the pond, skipping stones.', 'the moonflowers are out tonight', ':writes a poem and immediately hides it.', 'if anyone needs me i\'ll be under the willow', 'came here to get my charm up lol'],
    shades: ['dead again.', 'how much favor do i need', 'the ferryman hates me', 'rip me', 'tormenting souls is weirdly relaxing', ':wanders the grey shore.', 'cant wait for tomorrow', 'died with 900 gold on me. should have banked', 'anyone else here', 'it\'s so cold'],
    stone: ['the stone hums louder every kill', 'how many kills are you on now', 'remember your first wyrm?', ':places a palm against the stone.', 'farmhand life again, the eternal cycle', 'quiet here. i like it', 'the wyrm grows tougher each time i swear'],
    guild: ['guild meet at the well tonight?', 'who needs gold', 'nice work out there everyone', 'recruit drive this week, bring friends', ':raises the guild banner.', 'proud of you lot'],
};

/**
 * Generate one commentary line for a channel. ctx: { player, online, recentNews }
 * Returns an entry or null.
 */
export function chatLine(w, channel, ctx) {
    let speakers = ctx.online.filter((n) => speakerOk(n, channel, ctx.player));
    if (!speakers.length) return null;
    const last = (w.chat[channel] || []).slice(-1)[0];
    if (last && speakers.length > 1) speakers = speakers.filter((n) => n.name !== last.who);
    const n = R.weighted(speakers, (s) => s.chatty + 0.02);
    let text;
    const pName = ctx.player?.name || 'friend';
    const other = R.pick(ctx.online.filter((x) => x !== n)) || n;
    const roll = R.f();
    if (CHANNEL_LINES[channel] && roll < 0.55) text = R.pick(CHANNEL_LINES[channel]);
    else if (roll < 0.1 && ctx.recentNews?.length) {
        const item = R.pick(ctx.recentNews);
        text = R.pick(REACT[item.kind] || REACT.level).replace(/\{who\}/g, item.who);
    } else text = R.pick(CHAT[n.pers]);
    text = text.replace(/\{n\}/g, other.name).replace(/\{p\}/g, pName);
    return makeEntry(n, text, ctx.drunkNpc === n.id);
}

function speakerOk(n, channel, pl) {
    if (channel === 'shades') return !n.alive;
    if (!n.alive) return false;
    if (channel === 'stone') return n.dk > 0;
    if (channel === 'guild') return pl?.guild && n.guild === pl.guild.tag;
    if (channel === 'inn') return n.loc === 'inn' || n.loc === 'village';
    if (channel === 'garden') return n.loc === 'garden' || n.loc === 'village' || n.pers === 'roleplayer' || n.pers === 'bard';
    return n.loc !== 'shades';
}

export function makeEntry(n, text, drunk = false) {
    let emote = false;
    if (text.startsWith(':')) { emote = true; text = text.slice(1); }
    if (drunk && !emote) text = SLUR(text);
    return { who: n.name, id: n.id, color: n.color, tag: n.guild, emote, text };
}

export function greetLine(w, n, pl, isNew) {
    const t = R.pick(isNew ? GREET_NEW : GREET).replace(/\{p\}/g, pl.name);
    return makeEntry(n, t);
}
export function byeLine(n) { return makeEntry(n, R.pick(BYE)); }

/** Reply to something the player said. */
export function replyLine(w, n, said, pl) {
    for (const rule of REPLIES) {
        if (rule.k.test(said)) return makeEntry(n, R.pick(rule.r).replace(/\{p\}/g, pl.name));
    }
    return null;
}

/** Answer a newbie question with a veteran's line. */
export function answerLine(n, question, asker) {
    for (const rule of REPLIES.slice(2)) if (rule.k.test(question) && rule.k.source !== '.*') return makeEntry(n, R.pick(rule.r).replace(/\{p\}/g, asker));
    return null;
}

export function reactYou(n, kind, pl, extra = {}) {
    const list = REACT_YOU[kind]; if (!list) return null;
    let t = R.pick(list).replace(/\{p\}/g, pl.name).replace(/\{lvl\}/g, pl.level);
    for (const [k, v] of Object.entries(extra)) t = t.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    return makeEntry(n, t);
}

// ------------------------------------------------------------ mail
export function mailReply(n) { return R.pick(MAIL_REPLY[n.pers] || MAIL_REPLY.lurker); }
export function giftMail(n) { return R.pick(MAIL_GIFT); }
export function guildInvite(g, n) { return MAIL_GUILD_INVITE(g.name, n.name); }

export function findNpc(w, id) { return w.npcs.find((n) => n.id === id); }
export function findNpcByName(w, name) { const l = name.trim().toLowerCase(); return w.npcs.find((n) => n.name.toLowerCase() === l); }
