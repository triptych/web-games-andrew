// The Crooked Antler: Brannoc's bar, Willa and Corwin, the room upstairs,
// and Dagny Grael's bounty table.
import { R, fmt, clamp } from '../rng.js';
import { h } from '../engine/ui.js';
import * as S from '../engine/state.js';
import * as W from '../engine/world.js';
import { DRINKS, MAX_DRUNK } from '../data/items.js';
import { GOSSIP } from '../data/text.js';

export const roomCost = (p) => 10 + p.level * 12 + p.dk * 5;

export function inn(g) {
    const p = g.p;
    g.title('`QThe Crooked Antler', { view: 'inn', area: 'inn' });
    g.text('Warmth, noise and the smell of woodsmoke and spilled ale wrap around you as you push through the door. An enormous antler, crooked as a lightning bolt, hangs over the hearth. `QBrannoc`0 polishes tankards behind the bar with a rag that has seen things. `%Willa`0 weaves between the tables with a tray balanced on one hand, and by the fire, `%Corwin`0 the bard is tuning a lute and winking at anyone who looks his way. In the darkest corner, a woman in a grey cloak sits alone with a stack of parchment: `$Dagny Grael`0, who deals in bounties.');
    if (p.drunk >= 3) g.note('`5The room is spinning pleasantly.');
    g.nav('The Antler', 'Talk to Brannoc at the bar', 'bar', { key: 'b' });
    g.nav('The Antler', p.spouse === 'willa' ? 'Spend time with Willa, your spouse' : 'Flirt with Willa', () => g.goto('flirt', 'willa'), { key: 'w' });
    g.nav('The Antler', p.spouse === 'corwin' ? 'Spend time with Corwin, your spouse' : 'Flirt with Corwin', () => g.goto('flirt', 'corwin'), { key: 'c' });
    g.nav('The Antler', 'Listen to Corwin play', 'bard', { key: 'l' });
    g.nav('The Antler', 'Visit Dagny\'s corner (bounties)', 'bounty', { key: 'd' });
    g.nav('The Antler', `Get a room for the night (${roomCost(p)} gold)`, 'room', { key: 'g' });
    g.nav('Leave', 'Return to Hollowmere', 'village', { key: 'r' });
    g.chat('inn', '`QThe common room is lively');
}

export function bar(g) {
    const p = g.p;
    g.title('`QThe Bar', { view: 'inn', area: 'inn' });
    g.text('Brannoc leans on the bar, his great grey beard tucked into his apron. "What\'ll it be?"');
    if (p.drunk >= MAX_DRUNK) g.say('`QBrannoc:', 'No. Absolutely not. You\'ve had plenty. Water, or the door.');
    for (const d of DRINKS) {
        const cost = d.mult * p.level;
        g.nav('Drinks', `${d.name} (${fmt(cost)} gold)`, () => {
            if (p.gold < cost || p.drunk >= MAX_DRUNK) return;
            p.gold -= cost; p.drunk += d.drunk; p.stats.drinks++;
            p.buffs = p.buffs.filter((b) => b.id !== d.id);
            p.buffs.push({ id: d.id, ...d.buff });
            g.audio?.sfx('drink');
            g.spend(15);
            g.flash(`\`Q${d.text}\`0 (\`^${d.buff.name}\`0)`);
            if (p.drunk >= 3) { g.flash('`5You are thoroughly, gloriously drunk.'); g.deed('drunk'); if (!p.flags.drunkReact) { p.flags.drunkReact = true; g.react('drunk'); } }
        }, { disabled: p.gold < cost || p.drunk >= MAX_DRUNK });
    }
    g.nav('Talk', 'Ask for the latest gossip', () => {
        const n = R.pick(g.w.npcs);
        g.flash('`QBrannoc leans in close:`0 "' + R.pick(GOSSIP).replace(/\{n\}/g, n.name) + '"');
        g.spend(5);
    }, { key: 'g' });
    g.nav('Talk', 'Ask about the Jade Wyrm', () => {
        g.flash('`QBrannoc\'s face goes still.`0 "My grandfather saw it once, flying over the hills. Said it blotted out the sun. A hundred years it\'s been in that mountain, and every few years some brave fool kills it — and every few years it\'s back. You ask me, it doesn\'t die. It just... sleeps for a while. Hits like a falling castle, breathes fire every few heartbeats, and it\'s worst when you\'re already hurt. Go to it whole, if you go at all."');
    }, { key: 'w' });
    g.nav('Leave', 'Back to the common room', 'inn', { key: 'b' });
}

const FLIRT = [
    { need: 0, a: 'Wink', ok: '{N} winks back and smiles.', no: '{N} doesn\'t notice. Or pretends not to.' },
    { need: 2, a: 'Pay a compliment', ok: '{N} laughs, delighted. "Flatterer."', no: '{N} rolls {pos} eyes. "Heard that one before."' },
    { need: 4, a: 'Bring flowers', ok: '{N} blushes and tucks a flower behind {pos} ear.', no: '{N} sneezes violently. Hay fever. Wonderful.' },
    { need: 6, a: 'Recite poetry', ok: '{N} listens, chin on hand, eyes shining.', no: '{N} gently suggests you never do that again.' },
    { need: 8, a: 'Ask for a dance', ok: 'You dance by the hearth while the whole inn whistles. {N} is laughing.', no: '{N} steps on your foot. Deliberately, you think.' },
    { need: 11, a: 'Steal a kiss', ok: '{N} kisses you back, and the inn erupts in cheering.', no: '{N} slaps you. The inn erupts in cheering anyway.' },
    { need: 15, a: 'Propose marriage', ok: '', no: '{N} looks at you for a long moment. "Not yet. Ask me again when you mean it."' },
];

export function flirt(g, who) {
    const p = g.p;
    who = who || 'willa';
    const N = who === 'willa' ? 'Willa' : 'Corwin';
    const pos = who === 'willa' ? 'her' : 'his';
    const sub = (s) => s.replace(/\{N\}/g, N).replace(/\{pos\}/g, pos);
    g.title(`\`%${N}`, { view: 'inn', area: 'inn' });
    if (p.spouse === who) {
        g.text(`\`%${N}\`0 sees you and lights up. ${who === 'willa' ? 'She sets down her tray and takes your hand.' : 'He stops mid-verse and kisses you, to a chorus of groans from the audience.'} Married life suits you both.`);
        g.nav('Together', 'Spend the evening together', () => {
            if (p.flags.flirt) { g.flash(`\`%${N} smiles.\`0 "Again? You'll wear yourself out."`); return; }
            p.flags.flirt = true; p.hp = S.maxHp(p); g.spend(30);
            g.flash(`\`%You spend a lovely hour by the fire with ${N}. You feel completely restored.`);
        }, { key: 's' });
        g.nav('Together', 'Ask for a divorce', async () => {
            if (!(await g.ui.confirm('Divorce?', `Are you sure you want to divorce ${N}? Your charm will suffer.`, 'Divorce'))) return;
            p.spouse = null; p.charm = Math.max(0, p.charm - 5); p.flirt = 0;
            g.news(`\`%${p.name}\`5 and ${N} have parted ways. The Crooked Antler is unusually quiet tonight.`);
            g.flash(`\`5${N} takes off the ring and sets it on the bar without a word.`);
            return 'inn';
        }, { key: 'd' });
        g.nav('Leave', 'Back to the common room', 'inn', { key: 'b' });
        return;
    }
    if (p.spouse) {
        g.text(`\`%${N}\`0 raises an eyebrow at you. "Aren't you married to ${p.spouse === 'willa' ? 'Willa' : 'Corwin'}? I don't need that kind of trouble."`);
        g.nav('Leave', 'Back to the common room', 'inn', { key: 'b' });
        return;
    }
    g.text(who === 'willa'
        ? '`%Willa`0 sets down a tray of tankards and tucks a loose curl behind her ear. She has a laugh that carries across the room and a way of looking at people that makes them forget what they were saying.'
        : '`%Corwin`0 lowers his lute and gives you a crooked smile. He has a voice like honey over gravel, and a reputation for breaking hearts in three villages.');
    g.text(`\`7Your charm: \`^${p.charm}\`7. ${N}'s fondness for you: ${'♥'.repeat(Math.min(7, p.flirt)) || 'none yet'}.`);
    if (p.flags.flirt) g.note(`\`7You've already made eyes at ${N} today. Don't push your luck.`);
    FLIRT.forEach((f, i) => {
        g.nav('Flirt', `${f.a}${f.need ? ` (charm ${f.need})` : ''}`, () => {
            if (p.flags.flirt) return;
            p.flags.flirt = true; p.stats.flirts++;
            g.spend(10);
            const chance = clamp(0.35 + (p.charm - f.need) * 0.08, 0.05, 0.95);
            if (i === FLIRT.length - 1) {
                if (p.charm >= f.need && p.flirt >= 5 && R.chance(chance)) {
                    p.spouse = who; p.charm += 2;
                    g.news(`\`%${p.name}\`5 and \`%${N}\`5 were married at the Crooked Antler! \`5Brannoc wept openly into the ale.`);
                    g.deed('married'); g.react('married');
                    g.audio?.sfx('fanfare');
                    g.flash(`\`%\`b${N} says YES!\`b The whole inn cheers, Brannoc pours a round on the house, and before the night is out you are married beneath the crooked antler.`);
                    return;
                }
                g.flash('`5' + sub(f.no));
                return;
            }
            if (p.charm >= f.need && R.chance(chance)) {
                p.charm++; p.flirt = Math.min(7, p.flirt + 1);
                g.flash('`%' + sub(f.ok) + ' `^(+1 charm)');
            } else {
                if (p.charm < f.need) p.charm = Math.max(0, p.charm - 1);
                g.flash('`5' + sub(f.no) + (p.charm < f.need ? ' `$(-1 charm)' : ''));
            }
        }, { disabled: !!p.flags.flirt });
    });
    g.nav('Leave', 'Back to the common room', 'inn', { key: 'b' });
}

export function bard(g) {
    const p = g.p;
    g.title('`%Corwin Plays', { view: 'inn', area: 'inn' });
    if (p.flags.bard) {
        g.text('Corwin is taking a break, flirting with half the room at once. "Come back tomorrow, love, I\'ve only got so many songs in me."');
    } else {
        p.flags.bard = true;
        g.spend(20);
        const r = R.i(1, 4);
        if (r === 1) { p.turns++; g.text('Corwin plays a rollicking reel about a farmhand who outran a dragon. Your feet won\'t stop tapping. `^+1 forest fight`0.'); }
        else if (r === 2) { p.buffs.push({ id: 'ballad', name: 'Heroic Ballad', rounds: 15, atk: 1.15, def: 1.05 }); g.text('Corwin sings of the old heroes, the ones whose names are carved on the Standing Stone. Your heart swells. `^Heroic Ballad`0!'); }
        else if (r === 3) { p.hp = S.maxHp(p); g.text('Corwin plays something slow and beautiful. The whole inn falls silent. When it ends, you realise your wounds no longer ache.'); }
        else { p.charm++; g.text(`Corwin makes up a song on the spot — about you. It's flattering. Very flattering. People look at you differently afterwards. \`^+1 charm\`0.`); }
        g.audio?.sfx('lute');
    }
    g.nav('Leave', 'Back to the common room', 'inn', { key: 'b' });
}

export function room(g) {
    const p = g.p;
    const cost = roomCost(p);
    g.title('`QA Room Upstairs', { view: 'inn', area: 'inn' });
    g.text(`Brannoc jerks a thumb toward the stairs. "Room's \`^${cost}\`0 gold. Clean sheets, a lock on the door, and nobody gets in that I don't let in."`);
    g.text('`7Sleeping here ends your day. You\'ll be safe from other warriors overnight.');
    if (p.pacing === 'classic') g.note(`\`7Classic pacing: the next day dawns in ${fmtD(g.msToDawn())}. Sleeping now logs you out until then.`);
    if (p.turns > 0) g.note(`\`QYou still have ${p.turns} forest fight${p.turns === 1 ? '' : 's'} left today.`);
    const can = p.gold >= cost || p.bank >= cost;
    g.nav('Room', `Pay ${cost} gold and sleep${p.gold < cost && p.bank >= cost ? ' (from your bank)' : ''}`, () => {
        if (p.gold >= cost) p.gold -= cost; else if (p.bank >= cost) p.bank -= cost; else return;
        g.sleep('inn');
    }, { key: 's', disabled: !can, cls: 'primary' });
    g.nav('Leave', 'Back to the common room', 'inn', { key: 'b' });
}

export function bounty(g) {
    const p = g.p, w = g.w;
    g.title('`$Dagny Grael\'s Corner', { view: 'inn', area: 'inn' });
    g.text('Dagny doesn\'t look up from her parchment. "Bounties. Placing or collecting? Collecting\'s simple: kill them in the fields, I pay. Placing costs the bounty plus my ten percent."');
    const rows = Object.entries(w.bounties).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id, v]) => {
        if (id === 'you') return ['`%' + p.name + ' `$(you!)', `\`^${fmt(v)}`, `${p.level}`];
        const n = W.findNpc(w, id); return n ? [`${n.color}${n.name}`, `\`^${fmt(v)}`, `${n.level}`] : null;
    }).filter(Boolean);
    if (rows.length) g.table(['Warrior', 'Bounty', 'Level'], rows);
    else g.text('`7"Nobody worth paying for, at the moment."');
    g.heading('Place a bounty');
    const min = 50 * p.level;
    const sel = h('select', { 'aria-label': 'Target' }, w.npcs.slice().sort((a, b) => a.name.localeCompare(b.name)).map((n) => h('option', { value: n.id }, `${n.name} (lvl ${n.level})`)));
    g.add(h('div', { class: 'formrow' }, h('label', {}, 'On:'), sel));
    g.amount({ label: `Gold (min ${min}):`, buttons: [{ label: 'Place bounty', fn: (v) => {
        const total = Math.round(v * 1.1);
        if (v < min) { g.flash(`\`$"Minimum's ${min}. I don't get out of my chair for less."`); return; }
        if (p.gold < total) { g.flash('`$"You can\'t afford that."'); return; }
        const n = W.findNpc(w, sel.value); if (!n) return;
        p.gold -= total; w.bounties[n.id] = (w.bounties[n.id] || 0) + v;
        g.news(`\`$A bounty of ${fmt(v)} gold has been placed on ${n.name}'s head.`);
        g.flash(`\`$Dagny writes ${n.name}'s name on a fresh sheet. "Done."`);
    } }] });
    g.nav('Leave', 'Back to the common room', 'inn', { key: 'b' });
}

function fmtD(ms) { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; }
