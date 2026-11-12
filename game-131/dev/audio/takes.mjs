// takes.mjs — print the voice takes: every spoken line of the game, grouped into a few long takes per voice with
// [long pause] between lines. process.py cuts each take back into its lines at those pauses, in this order.
//   node game-131/dev/audio/takes.mjs            # the takes as JSON (ids and text)
//   node game-131/dev/audio/takes.mjs fray-1  # one take's text, ready to paste into a speech node
import { LINES, CARDS, OTHERS } from '../../js/sim/data/story.js';
import { TUNNELS } from '../../js/sim/data/zones.js';

const fray = [];
for (const [id, v] of Object.entries(LINES)) {
    if (Array.isArray(v)) v.forEach((t, i) => fray.push([`${id}-${i + 1}`, t])); else fray.push([id, v]);
}
for (const [id, t] of Object.entries(TUNNELS)) { fray.push([`tun-${id}-found`, t.found]); fray.push([`tun-${id}-used`, t.used]); }
const cards = Object.entries(CARDS).map(([id, c]) => [`card-${id}`, c.text]);
const narr = ['organAsk', 'organDone', 'tideAsk', 'tideDone'].map((id) => [id, OTHERS[id].text]);
const chunk = (list, n) => { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; };

export const TAKES = {};
chunk(fray, 13).forEach((c, i) => { TAKES[`fray-${i + 1}`] = { voice: 'Fray', lines: c }; });
chunk([...cards, ...narr], 5).forEach((c, i) => { TAKES[`narrator-${i + 1}`] = { voice: 'Narrator', lines: c }; });
TAKES.golem = { voice: 'Grandfather Lichen', lines: ['golemAsk', 'golemDone'].map((id) => [id, OTHERS[id].text]) };
TAKES.elder = { voice: 'Elder Grusk', lines: ['elder1', 'elder2', 'elder3'].map((id) => [id, OTHERS[id].text]) };
// Recorded again after the goblin was renamed Fray: these replace the lines of the same id cut from the earlier
// takes (process.py handles takes in name order, so a later take wins).
TAKES['narrator-5'] = { voice: 'Narrator', lines: ['healed', 'light', 'moon', 'hearth', 'heart', 'end'].map((id) => [`card-${id}`, CARDS[id].text]) };
TAKES['elder-2'] = { voice: 'Elder Grusk', lines: [['elder3', OTHERS.elder3.text]] };
export const takeText = (name) => TAKES[name].lines.map(([, t]) => t).join(' [long pause] ');

if (process.argv[1]?.endsWith('takes.mjs')) {
    const name = process.argv[2];
    if (name) console.log(takeText(name));
    else console.log(JSON.stringify(Object.fromEntries(Object.entries(TAKES).map(([k, v]) => [k, { voice: v.voice, ids: v.lines.map((l) => l[0]), chars: takeText(k).length }])), null, 1));
}
