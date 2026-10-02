// Guildhall Row, the new-day page, preferences & saves, help.
import { R, fmt } from '../rng.js';
import { h } from '../engine/ui.js';
import { colorize, esc } from '../colors.js';
import * as S from '../engine/state.js';
import * as W from '../engine/world.js';
import { fmtDur } from '../engine/game.js';
import { SPECIALTIES, RACES } from '../data/classes.js';

// ------------------------------------------------------------- guilds
export function guilds(g, arg) {
    const p = g.p, w = g.w;
    const mine = S.guild(p);
    if (mine && arg !== 'row') return guildHall(g);
    g.title('`6Guildhall Row', { view: 'guilds', area: 'village' });
    g.text('A street of tall timbered halls, each hung with its guild\'s banner. Warriors come and go, slapping backs and arguing about who carried whom through the forest.');
    const count = (tag) => w.npcs.filter((n) => n.guild === tag).length + (p.guild?.tag === tag ? 1 : 0);
    const rows = w.guilds.map((gu) => {
        const leader = W.findNpc(w, gu.leader);
        const join = g.button(p.guild?.tag === gu.tag ? 'Member' : 'Apply', () => {
            if (p.guild) { g.flash('`6You must leave your current guild first.'); return; }
            const ok = p.level + p.dk * 3 >= 3 || R.chance(0.3);
            if (!ok) { g.flash(`\`6${leader ? leader.name : 'The guild'} reads your application and sends it back: "Come back when you\'ve got a few levels on you."`); return; }
            p.guild = { tag: gu.tag, rank: 'Member', joined: p.day };
            g.deed('guild');
            g.news(`\`3${p.name} has joined the guild \`^${gu.name}\`3.`);
            g.flash(`\`6Welcome to \`^${gu.name}\`6! (${gu.perkDesc})`);
            return 'guilds';
        }, 'small');
        if (p.guild) join.disabled = true;
        return [`\`^<${gu.tag}>\`0 ${gu.name}`, `\`7${gu.motto}`, gu.perkDesc, String(count(gu.tag)), join];
    });
    if (p.guild?.custom) rows.push([`\`^<${p.guild.tag}>\`0 ${p.guild.custom.name}`, '`7Your own guild', p.guild.custom.perkDesc, String(count(p.guild.tag)), h('span', { class: 'c7' }, 'Yours')]);
    g.table(['Guild', 'Motto', 'Perk', 'Members', ''], rows, 'shop');
    if (!p.guild) {
        g.heading('Found your own guild (10,000 gold and 5 gems)');
        const nm = h('input', { type: 'text', maxlength: 28, placeholder: 'Guild name', 'aria-label': 'Guild name' });
        const tg = h('input', { type: 'text', maxlength: 3, placeholder: 'TAG', 'aria-label': 'Three-letter tag', style: { width: '5em', textTransform: 'uppercase' } });
        const perk = h('select', { 'aria-label': 'Perk' }, [['atk', '+5% attack'], ['def', '+5% defence'], ['gold', '+10% forest gold'], ['hp', '+5% max HP']].map(([v, l]) => h('option', { value: v }, l)));
        g.add(h('div', { class: 'formrow' }, nm, tg, perk, g.button('Found guild', () => {
            const name = nm.value.replace(/`/g, '').trim(), tag = tg.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 3);
            if (!name || tag.length < 2) { g.flash('`6You need a name and a two- or three-letter tag.'); return; }
            if (w.guilds.some((x) => x.tag === tag)) { g.flash('`6That tag is taken.'); return; }
            if (p.gold + p.bank < 10000 || p.gems < 5) { g.flash('`6You can\'t afford a charter yet.'); return; }
            let cost = 10000; const fromGold = Math.min(p.gold, cost); p.gold -= fromGold; cost -= fromGold; p.bank -= cost; p.gems -= 5;
            const perkDesc = perk.selectedOptions[0].textContent;
            p.guild = { tag, rank: 'Leader', joined: p.day, custom: { tag, name, perk: perk.value, perkDesc, motto: '' } };
            g.deed('guild');
            g.news(`\`^${p.name} has founded a new guild: <${tag}> ${name}!`);
            g.flash(`\`6The charter is signed. \`^<${tag}> ${name}\`6 is born.`);
            return 'guilds';
        }, 'primary')));
    }
    g.nav('Leave', mine ? 'Back to your guild hall' : 'Return to Hollowmere', mine ? 'guilds' : 'village', { key: 'r' });
}

function guildHall(g) {
    const p = g.p, w = g.w;
    const gu = S.guild(p);
    g.title(`\`6<${gu.tag}> ${gu.name}`, { view: 'guilds', area: 'inn' });
    g.text(`The guild hall smells of pipe smoke and polished leather. The banner of \`^${gu.name}\`0 hangs over the hearth${gu.motto ? `, its motto stitched in gold: "\`^${gu.motto}\`0"` : ''}. Your guild perk: \`@${gu.perkDesc}\`0.`);
    const members = w.npcs.filter((n) => n.guild === gu.tag).sort((a, b) => b.dk - a.dk || b.level - a.level);
    g.text(`\`7Members: \`^${members.length + 1}\`7 · Your rank: \`^${p.guild.rank}`);
    if (members.length) g.add(h('div', { class: 'roster' }, members.slice(0, 30).map((n) => h('button', { type: 'button', class: 'chip', html: colorize(`${n.color}${n.name}\`0 <small>${n.level}${n.dk ? '★' + n.dk : ''}</small>`), onclick: () => g.showProfile(n) }))));
    if (p.guild.custom && R.chance(0.6) && !p.flags.recruit) {
        p.flags.recruit = true;
        const free = w.npcs.filter((n) => !n.guild);
        if (free.length && R.chance(0.5)) { const n = R.pick(free); n.guild = gu.tag; g.flash(`\`6${n.name} has joined your guild!`); }
    }
    g.nav('Guild', 'Visit Guildhall Row', () => g.goto('guilds', 'row'), { key: 'v' });
    g.nav('Guild', 'Leave the guild', async () => {
        if (!(await g.ui.confirm('Leave guild?', `Leave ${gu.name}?`, 'Leave'))) return;
        if (p.guild.custom) for (const n of w.npcs) if (n.guild === gu.tag) n.guild = null;
        p.guild = null; g.flash(`\`6You hand back your guild ring.`);
        return 'guilds';
    }, { key: 'l' });
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
    g.chat('guild', `\`6<${gu.tag}> guild chatter`);
}

// ------------------------------------------------------------- new day
export function newday(g, arg = {}) {
    const p = g.p;
    if (arg.first) {
        g.title('`@Welcome to Hollowmere', { view: 'village', area: 'village' });
        const r = RACES[p.race], sp = SPECIALTIES[p.spec];
        g.text(`\`&${r.arrive}`);
        g.text(`\`&${sp.child}`);
        g.text('Now you stand at the gates of `@Hollowmere`0, a village of thatched roofs and tall tales, ringed on every side by the dark pines of the `2Gloamwood`0. Somewhere deep in that forest, in a mountain scorched to glass, sleeps the `@Jade Wyrm`0. Every warrior in the village dreams of slaying it. Most of them die trying.');
        g.text(`You have \`^50\`0 gold, the clothes on your back and your bare fists. It's a start.`);
        if (!arg.done) { arg.done = true; g.newDay(); }
        p.turns = S.turnsPerDay(p);
        g.text(`\`@Today you have \`^${p.turns}\`@ forest fights. The village square is through the gate. Good luck, ${S.fullName(p)}.`);
        g.nav('Begin', 'Enter Hollowmere', 'village', { key: 'e', cls: 'primary' });
        return;
    }
    g.title('`@It is a new day!', { view: 'dawn', area: 'village', banner: '`@A new day dawns' });
    if (!arg.rolled) {
        arg.rolled = g.newDay();
        g.audio?.sfx('newday');
    }
    const r = arg.rolled;
    g.text(`You open your eyes to find that a new day has been given to you. It is day \`^${p.day}\`0 of your life in Hollowmere.`);
    if (arg.slept === 'inn') g.text('`QYou wake in your room at the Crooked Antler to the smell of bacon and Brannoc singing tunelessly downstairs.');
    else if (arg.slept === 'fields') g.text('`2You wake in the fields, damp with dew, a beetle exploring your ear.');
    else if (arg.slept === 'shades' || r.wasDead) g.text('`&The grey shore dissolves. You gasp, and breathe, and are alive again — waking in the Hollowmere graveyard with dirt in your hair.');
    if (r.report.length) { g.heading('`$While you slept...'); g.lines(r.report); }
    else if (arg.slept === 'fields') g.text('`7Nobody bothered you in the night.');
    const spirit = ['very low', 'low', 'normal', 'high', 'very high'][r.spirits + 2];
    g.text(`Your spirits are \`^${spirit}\`0${r.spiritTurns ? ` (${r.spiritTurns > 0 ? '+' : ''}${r.spiritTurns} forest fight${Math.abs(r.spiritTurns) === 1 ? '' : 's'})` : ''}. Today you have \`^${p.turns}\`0 forest fights and \`^${p.pvp}\`0 attacks on other warriors.`);
    if (r.lines.length) g.lines(r.lines);
    const today = g.w.news.filter((n) => n.day === g.w.day).slice(-4);
    if (today.length) { g.heading('`^From the Herald'); g.add(h('ul', { class: 'newslist' }, today.map((n) => h('li', { html: colorize(n.text) })))); }
    g.nav('Onward', 'Into the village', 'village', { key: 'v', cls: 'primary' });
    g.nav('Onward', 'Read the full Herald', 'news', { key: 'n' });
}

// ------------------------------------------------------------- preferences & saves
export function prefs(g) {
    const p = g.p, pr = g.prefs;
    g.title('`7Preferences & Saves', { view: p.alive ? 'village' : 'shades', area: p.alive ? 'village' : 'shades' });
    const set = (k, v) => { pr[k] = v; S.savePrefs(pr); g.applyPrefs?.(); };
    const tog = (k, label) => g.button(`${label}: \`^${pr[k] ? 'On' : 'Off'}`, () => set(k, !pr[k]), 'small');
    g.heading('Sound & display');
    g.add(h('div', { class: 'btnrow' }, tog('sound', 'Sound effects'), tog('music', 'Music'), tog('motion', 'Animation'), tog('autoStop', 'Auto-fight safety stop')));
    const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: pr.volume, 'aria-label': 'Volume', oninput: (e) => set('volume', +e.target.value) });
    g.add(h('div', { class: 'formrow' }, h('label', {}, 'Volume'), vol));
    g.add(h('div', { class: 'formrow' }, h('label', {}, '3D quality'), ...['auto', 'high', 'low', 'off'].map((q) => g.button(q === 'auto' ? 'Auto' : q === 'off' ? 'Off (still image)' : q[0].toUpperCase() + q.slice(1), () => set('quality', q), 'small' + (pr.quality === q ? ' primary' : '')))));
    g.add(h('div', { class: 'formrow' }, h('label', {}, 'Text size'), ...[[0.9, 'Small'], [1, 'Normal'], [1.12, 'Large'], [1.25, 'Huge']].map(([s, l]) => g.button(l, () => set('textSize', s), 'small' + (pr.textSize === s ? ' primary' : '')))));
    g.heading('Day pacing');
    g.text(p.pacing === 'classic'
        ? `\`^Classic\`0: a new day dawns every 6 real hours, like the original. Next dawn in \`^${fmtDur(g.msToDawn())}\`0.`
        : '`^Adventurer`0: sleep at the inn or in the fields whenever you like to start a new day.');
    g.add(h('div', { class: 'btnrow' },
        g.button('Adventurer', () => { p.pacing = 'adventurer'; }, 'small' + (p.pacing !== 'classic' ? ' primary' : '')),
        g.button('Classic (real-time)', () => { p.pacing = 'classic'; p.lastDawn = Date.now(); }, 'small' + (p.pacing === 'classic' ? ' primary' : ''))));
    g.heading('Your biography');
    const bio = h('textarea', { rows: 3, maxlength: 300, 'aria-label': 'Biography' }); bio.value = p.bio || '';
    g.add(h('div', { class: 'compose' }, bio, h('div', { class: 'btnrow' }, g.button('Save biography', () => { p.bio = bio.value.trim(); g.flash('`7Biography saved.'); }, 'small'))));
    g.heading('Saving');
    g.text('`7Your warrior saves automatically after every action. You can also download a save file to keep, or move to another browser.');
    g.add(h('div', { class: 'btnrow' },
        g.button('Save now', () => { g.save(); g.ui.toast('Game saved.', '💾'); }, 'small primary'),
        g.button('Export save file', () => { g.exportSave?.(); }, 'small'),
        g.button('Load / switch warrior', () => { g.save(); g.onLogout?.(null); }, 'small'),
        g.button('Log out', () => { g.save(); g.onLogout?.('You have logged out. Your warrior is safe.'); }, 'small')));
    g.nav('Leave', 'Return', p.alive ? 'village' : 'shades', { key: 'r' });
    g.nav('Other', 'Help & FAQ', 'help', { key: 'h' });
    g.nav('Other', 'Petition the Keeper', () => g.goto('mail', { compose: '__admin' }), { key: 'k' });
}

export function help(g) {
    const p = g.p;
    g.title('`#Help & FAQ', { view: p.alive ? 'village' : 'shades', area: p.alive ? 'village' : 'shades' });
    const qa = [
        ['What do I do?', 'Fight creatures in the Gloamwood for gold and experience. When you have enough experience, beat your master at the Proving Yard to gain a level. At level 15, find and slay the Jade Wyrm. Then do it all again, stronger.'],
        ['Why can\'t I fight any more?', 'You have a limited number of forest fights each day. Sleep at the Crooked Antler or in the fields to start a new day. Humans, mounts, Wyrm kills, the Lodge and good spirits all add more.'],
        ['How do days work?', 'In Adventurer pacing (the default), a new day starts whenever you sleep. In Classic pacing, a new day dawns every 6 real hours, like the original web game. Change this in Preferences.'],
        ['What happens when I die?', 'You lose the gold you were carrying and 10% of your experience, and your spirit goes to the Pale Shore. A new day brings you back. Or torment souls in the Barrow Field to earn 100 favour, and Vorgath will send you back early.'],
        ['How do I keep my gold safe?', 'Deposit it at the Quill & Ledger Counting House. Banked gold earns a little interest each day and is never lost.'],
        ['Who are all these other players?', 'This realm is simulated: everyone else in Hollowmere lives inside your save. They log on and off on a real clock, chat, fight, level up, slay the Wyrm, marry, form guilds — and sometimes come for you in the fields.'],
        ['What is PvP?', 'Hunt other warriors who are sleeping in the fields (from one level below you to two above). Win, and you take their gold and some experience. Lose, and you die. Sleep at the inn so nobody can do the same to you.'],
        ['What are specialties?', 'Shadow Arts, Arcane Lore or Thievery. Each has four skills that unlock as your skill grows (1, 3, 6, 10). You gain skill with every level and from some forest events. Use them in combat with keys 1–4.'],
        ['Thrill-seeking and slumming?', 'Thrill-seeking finds a creature one level above you, worth 25% more experience. Slumming finds one a level below, worth 25% less.'],
        ['What is charm for?', 'Flirting with Willa or Corwin at the Crooked Antler — and eventually marrying one of them, which brings a daily bonus. Gain charm in the Gardens, from forest events, and from Zorya\'s philtres.'],
        ['Colour codes?', '__colors'],
        ['Keyboard?', 'Every action has a hotkey: the underlined letter. Press it anywhere outside a text box. Esc closes dialogs and drawers.'],
        ['Saving?', 'The game saves after every action. Preferences has Export (download a save file) and Load. The title screen can import a save file.'],
    ];
    const CODES = [['1', 'dark blue'], ['!', 'blue'], ['2', 'dark green'], ['@', 'green'], ['3', 'teal'], ['#', 'cyan'], ['4', 'dark red'], ['$', 'red'], ['5', 'purple'], ['%', 'pink'], ['6', 'gold'], ['^', 'yellow'], ['Q', 'amber'], ['7', 'grey'], ['&', 'white']];
    for (const [q, a] of qa) {
        const body = a === '__colors'
            ? h('div', {}, h('p', { text: 'In the commentary, type a backtick (`) followed by a code to change colour, and `0 to reset. Start a message with : (or /me) for an emote.' }),
                h('div', { class: 'codes' }, CODES.map(([c, n]) => h('span', { class: 'code', html: `<kbd>\`${esc(c)}</kbd> ${colorize('`' + c + n)}` }))))
            : h('p', { html: colorize(a) });
        g.add(h('details', { class: 'faq' }, h('summary', {}, q), body));
    }
    g.nav('Leave', 'Return', p.alive ? 'village' : 'shades', { key: 'r' });
}
