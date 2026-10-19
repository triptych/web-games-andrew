// Prose: counting words, the manuscript's light markup, and the Scribe's Lens. Pure.
//
// Markup, one paragraph per line (blank lines are ignored):
//   *italic* or _italic_, **bold**
//   a line of only * * *, ***, ~, # or ❦ is a scene break
//   a line starting with "> " is a quotation (letters, songs, inscriptions); consecutive lines join

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu;

export function countWords(s) {
    if (!s) return 0;
    let n = 0;
    WORD_RE.lastIndex = 0;
    while (WORD_RE.exec(s)) n++;
    return n;
}

export function words(s) {
    return (s || '').match(WORD_RE) || [];
}

const BREAK_RE = /^\s*(\*\s*\*\s*\*|\*{3,}|~+|#+|❦|⁂|-{3,})\s*$/;

/** text → [{ type: 'p' | 'quote' | 'break', text }] */
export function parseBlocks(text) {
    const out = [];
    for (const raw of (text || '').split(/\r?\n/)) {
        const line = raw.replace(/\s+$/, '');
        if (!line.trim()) { if (out.length && out[out.length - 1].type === 'quote') out[out.length - 1].closed = true; continue; }
        if (BREAK_RE.test(line)) { out.push({ type: 'break' }); continue; }
        const q = /^\s*>\s?(.*)$/.exec(line);
        if (q) {
            const last = out[out.length - 1];
            if (last && last.type === 'quote' && !last.closed) last.lines.push(q[1]);
            else out.push({ type: 'quote', lines: [q[1]] });
            continue;
        }
        out.push({ type: 'p', text: line.trim() });
    }
    for (const b of out) delete b.closed;
    return out;
}

export function escapeXml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Typographer's quotes, dashes and ellipses on plain text (before escaping). */
export function typeset(s) {
    return s
        .replace(/\.\.\./g, '…')
        .replace(/---/g, '—')
        .replace(/--/g, '—')
        .replace(/(^|[\s(\[{—–-])"/g, '$1“')
        .replace(/"/g, '”')
        .replace(/(^|\s)'(?=(tis|twas|twere|twill|em|til|cause|round|neath|n|\d0s)\b)/gi, '$1’')
        .replace(/(^|[\s(\[{—–-])'/g, '$1‘')
        .replace(/'/g, '’');
}

/**
 * Inline markup → HTML that is always well-formed XHTML (the EPUB needs that): markers are paired
 * with a stack, a marker that would cross another is literal, and anything left open is literal.
 */
export function inlineHtml(s, { smart = true } = {}) {
    const src = smart ? typeset(s) : s;
    const parts = src.split(/(\*\*|\*|_)/);
    const root = { tag: null, kids: [] };
    const stack = [root];
    const top = () => stack[stack.length - 1];
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p === '**' || p === '*' || p === '_') {
            if (p === '_') {
                // only at a word edge: snake_case and the like stay literal
                const before = i > 0 ? parts[i - 1].slice(-1) : '';
                const after = i + 1 < parts.length ? parts[i + 1].charAt(0) : '';
                const opening = !/[\p{L}\p{N}]/u.test(before) && /\S/.test(after);
                const closing = /\S/.test(before) && !/[\p{L}\p{N}]/u.test(after);
                if (top().tag === '_' ? !closing : !opening) { top().kids.push(p); continue; }
            }
            if (top().tag === p) {
                const node = stack.pop();
                top().kids.push(node);
            } else if (stack.some((f) => f.tag === p)) {
                top().kids.push(p);
            } else {
                stack.push({ tag: p, kids: [] });
            }
        } else if (p) top().kids.push(p);
    }
    // unwind anything left open into literal text
    while (stack.length > 1) {
        const f = stack.pop();
        top().kids.push(f.tag, ...f.kids);
    }
    const render = (node) => node.kids.map((k) => {
        if (typeof k === 'string') return escapeXml(k);
        const inner = render(k);
        if (!inner) return '';
        return k.tag === '**' ? `<strong>${inner}</strong>` : `<em>${inner}</em>`;
    }).join('');
    return render(root);
}

/** Strip the markup, for plain text and for analysis. */
export function plain(s) {
    return (s || '').replace(/\*\*|\*/g, '').replace(/(^|\W)_(\S[^_]*?)_(?=\W|$)/g, '$1$2');
}

// ------------------------------------------------------------------ the Scribe's Lens

const NOT_ADVERBS = new Set(('only family early holy ugly reply belly fly ally rely supply apply july lily silly jolly friendly lovely lonely ' +
    'lively likely costly deadly elderly kindly lowly orderly smelly woolly wily curly hilly oily chilly bully gully jelly rally sally tally ' +
    'folly melancholy anomaly monopoly assembly butterfly dragonfly firefly italy emily molly polly holly kelly billy willy sly shy ally lordly ' +
    'ghostly ghastly comely cowardly courtly earthly heavenly homely leisurely manly motherly fatherly brotherly sisterly worldly princely queenly ' +
    'kingly beastly unlikely unruly surly burly gnarly grizzly prickly sickly stately timely untimely weekly daily monthly yearly nightly hourly').split(' '));

const FILTER = ['felt', 'feel', 'feels', 'saw', 'see', 'sees', 'heard', 'hear', 'hears', 'noticed', 'notice', 'realized', 'realised', 'realize',
    'seemed', 'seems', 'wondered', 'watched', 'thought', 'decided', 'knew', 'looked', 'smelled', 'tasted', 'could see', 'could hear'];
const HEDGES = ['very', 'really', 'just', 'quite', 'rather', 'somewhat', 'suddenly', 'actually', 'basically', 'literally', 'simply', 'totally', 'kind of', 'sort of', 'a bit', 'a little'];
const BOOKISMS = ['exclaimed', 'retorted', 'hissed', 'growled', 'snarled', 'chortled', 'chuckled', 'ejaculated', 'interjected', 'opined', 'queried',
    'quipped', 'snapped', 'barked', 'purred', 'spat', 'breathed', 'sighed', 'laughed', 'smiled', 'grinned', 'expostulated', 'declared', 'intoned', 'proclaimed'];
const CLICHES = [
    ['chosen one', 'the Chosen One'], ['dark lord', 'a Dark Lord'], ['ancient evil', 'an ancient evil'], ['the prophecy foretold', 'the prophecy foretold'],
    ['farm boy', 'the farm boy'], ['piercing blue eyes', 'piercing blue eyes'], ["breath (?:he|she|they|i) didn['’]t know", 'the breath they didn’t know they were holding'],
    ['a single tear', 'a single tear'], ['dark and stormy night', 'a dark and stormy night'], ['little did (?:he|she|they|i|we) know', 'little did they know'],
    ['since time immemorial', 'since time immemorial'], ['as old as time', 'as old as time'], ['the end of an era', 'the end of an era'],
    ['all hell broke loose', 'all hell broke loose'], ['heart pounding', 'a pounding heart'], ['blood ran cold', 'blood running cold'],
    ['orbs', 'eyes called orbs'], ['raven(?:-| )haired', 'raven hair'], ['ruggedly handsome', 'ruggedly handsome'], ['mysterious stranger', 'a mysterious stranger'],
    ['in the nick of time', 'the nick of time'], ['wise old', 'a wise old mentor'], ['ancient tome', 'an ancient tome'], ['evil sorcerer', 'an evil sorcerer'],
    ['tavern wench', 'the tavern wench'], ['it was all a dream', 'it was all a dream'],
];
const SENSES = {
    sight: 'saw see glint gleam shadow light dark bright colour color gold silver crimson pale glow shimmer flicker glimpse stared gaze dim blaze shine shone hue'.split(' '),
    sound: 'heard hear sound silence whisper roar crack hum ring rang echo creak thunder murmur hiss song sang clang rustle shout scream chime drum'.split(' '),
    smell: 'smell smelled scent reek stench aroma perfume smoke musk incense fragrant sour rot rotten pine resin brine'.split(' '),
    taste: 'taste tasted bitter sweet salt salty honey wine ale bread tongue savory sour spice spiced copper'.split(' '),
    touch: 'cold warm rough smooth soft sharp wet damp ache sting itch grip touched texture heavy coarse slick frozen burning callused'.split(' '),
};
const STOP = new Set(('the a an and or but of to in on at by for with from as is was were be been being it its it’s that this these those he she they them his her their ' +
    'i me my we us our you your not no so if then than there here what which who whom when where why how all any some one two had has have do did does ' +
    'said into out up down over under again only just very can could would should will shall may might must too also more most much many such own same ' +
    'like back now even still yet about after before through while because each other off upon against without within around').split(' '));

const LONG = /\b(am|is|are|was|were|be|been|being|is not|was not)\s+(?:\w+ly\s+)?(\w+ed|known|seen|given|taken|done|made|born|broken|chosen|driven|eaten|fallen|forgotten|frozen|hidden|held|kept|left|lost|shown|sold|spoken|stolen|struck|sworn|thrown|told|torn|woken|worn|written|bound|built|caught|found|led|meant|paid|sent|set|shot|slain|spun|wound)\b/gi;

function syllables(w) {
    w = w.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    const m = w.match(/[aeiouy]{1,2}/g);
    return Math.max(1, m ? m.length : 1);
}

function countList(lower, list) {
    const found = {};
    for (const term of list) {
        const re = new RegExp(`\\b${term}\\b`, 'g');
        const n = (lower.match(re) || []).length;
        if (n) found[term] = n;
    }
    return found;
}
const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const topN = (o, n = 6) => Object.entries(o).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n);

/** A full reading of a passage. The UI shows the parts the apprentice's Lens talents allow. */
export function analyze(text) {
    const src = plain(text || '');
    const ws = words(src);
    const n = ws.length;
    const lower = src.toLowerCase().replace(/[’‘]/g, "'");
    const sentences = src.split(/(?<=[.!?…])["”’)]*\s+|\n+/).map((s) => s.trim()).filter((s) => countWords(s) > 0);
    const lens = sentences.map(countWords);
    const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
    const sd = lens.length ? Math.sqrt(lens.reduce((a, b) => a + (b - avg) ** 2, 0) / lens.length) : 0;

    const adverbs = {};
    for (const w of ws) {
        const l = w.toLowerCase();
        if (l.length > 4 && l.endsWith('ly') && !NOT_ADVERBS.has(l)) adverbs[l] = (adverbs[l] || 0) + 1;
    }
    const filters = countList(lower, FILTER);
    const hedges = countList(lower, HEDGES);
    const bookisms = countList(lower, BOOKISMS);
    const passive = (src.match(LONG) || []).length;

    const cliches = [];
    for (const [re, label] of CLICHES) {
        const m = lower.match(new RegExp(`\\b${re}\\b`, 'g'));
        if (m) cliches.push([label, m.length]);
    }

    // echoes: the same telling word twice within 30 words
    const echoes = {};
    const lastAt = {};
    ws.forEach((w, i) => {
        const l = w.toLowerCase().replace(/['’]s$/, '');
        if (l.length < 4 || STOP.has(l)) return;
        if (lastAt[l] !== undefined && i - lastAt[l] <= 30) echoes[l] = (echoes[l] || 0) + 1;
        lastAt[l] = i;
    });

    const senses = {};
    const wset = ws.map((w) => w.toLowerCase());
    for (const [k, list] of Object.entries(SENSES)) senses[k] = wset.filter((w) => list.includes(w)).length;

    // dialogue: characters inside double quotes, straight or curly
    let inQuote = 0;
    for (const m of src.matchAll(/["“]([^"”\n]*)["”]/g)) inQuote += m[1].length;
    const letters = src.replace(/\s/g, '').length || 1;

    const syl = ws.reduce((a, w) => a + syllables(w), 0);
    const flesch = n && lens.length ? 206.835 - 1.015 * (n / lens.length) - 84.6 * (syl / n) : 0;

    return {
        words: n,
        sentences: lens.length,
        avgSentence: +avg.toFixed(1),
        rhythm: +sd.toFixed(1),
        longest: lens.length ? Math.max(...lens) : 0,
        lengths: lens,
        adverbs: { count: total(adverbs), per1k: n ? +(total(adverbs) * 1000 / n).toFixed(1) : 0, top: topN(adverbs) },
        filters: { count: total(filters), top: topN(filters) },
        hedges: { count: total(hedges), top: topN(hedges) },
        bookisms: { count: total(bookisms), top: topN(bookisms) },
        passive,
        cliches,
        echoes: { count: total(echoes), top: topN(echoes) },
        senses,
        dialogue: +(Math.min(1, inQuote / letters)).toFixed(2),
        readingEase: Math.round(Math.max(0, Math.min(100, flesch))),
    };
}

/** Thalion's verdicts on a reading: [tier, mood, line]. Tier 1/2/3 is the Lens talent needed to see it. */
export function verdicts(r) {
    const out = [];
    if (r.words < 60) return [[1, 'smile', 'Give me a little more to read, and I will tell you what I see. A hundred words at least; a page is better.']];
    if (r.adverbs.per1k > 18) out.push([1, 'wry', `${r.adverbs.count} adverbs. When a verb needs a crutch, find a stronger verb: she didn't walk *quickly*, she *hurried*. Keep the ones that surprise.`]);
    else out.push([1, 'smile', 'Your adverbs are kept on a short leash. Good. Strong verbs do the work here.']);
    if (r.filters.count > r.words / 120) out.push([1, 'thoughtful', `I count ${r.filters.count} filter words (${r.filters.top.slice(0, 3).map((t) => t[0]).join(', ')}). "She saw the dragon land" holds the reader at arm's length. "The dragon landed" puts them in the field.`]);
    if (r.bookisms.count > 2) out.push([1, 'wry', `Your characters ${r.bookisms.top.slice(0, 3).map((t) => t[0]).join(', ')} their lines. *Said* is invisible. Let the words carry the anger, and the tag stay quiet.`]);
    if (r.hedges.count > r.words / 80) out.push([1, 'concern', `"${r.hedges.top[0][0]}" appears ${r.hedges.top[0][1]} times. Hedging words make a brave sentence apologise. Cut most of them and read it again.`]);
    if (r.passive > Math.max(3, r.sentences / 6)) out.push([2, 'thoughtful', `About ${r.passive} sentences are in the passive voice. Sometimes that's right (the throne *was stolen*: we don't know by whom). Mostly, tell me who did it.`]);
    if (r.echoes.count > r.words / 150) out.push([2, 'wry', `Echoes: ${r.echoes.top.slice(0, 4).map(([w, k]) => `"${w}" ×${k + 1}`).join(', ')}, each within a breath of itself. The ear notices before the eye does.`]);
    if (r.cliches.length) out.push([2, 'concern', `I found ${r.cliches.map((c) => c[0]).slice(0, 3).join(', ')}. A cliché is not a crime, apprentice. It's a borrowed coat. Wear it if you've tailored it.`]);
    else if (r.words > 200) out.push([2, 'proud', 'Not one cliché I could catch, and I have read every book in Vellmere twice.']);
    if (r.sentences > 6 && r.rhythm < 3.5) out.push([3, 'thoughtful', `Your sentences march in step: ${r.avgSentence} words each, give or take ${r.rhythm}. Vary them. A long one that winds through the forest, gathering moss and rumour. Then a short one. Thud.`]);
    else if (r.sentences > 6) out.push([3, 'smile', `Good rhythm: sentences from a few words to ${r.longest}. Prose that breathes.`]);
    const dead = Object.entries(r.senses).filter(([, v]) => v === 0).map(([k]) => k);
    if (r.words > 150 && dead.length >= 3) out.push([3, 'concern', `I can ${Object.entries(r.senses).filter(([, v]) => v > 0).map(([k]) => k).join(' and ') || 'barely sense anything'} in this, but there is no ${dead.join(', no ')}. What does the room *smell* of?`]);
    if (r.dialogue > 0.6) out.push([3, 'thoughtful', `Most of this is dialogue (${Math.round(r.dialogue * 100)}%). Talk is quick to read; ground it now and then with a gesture or the place they're standing.`]);
    else if (r.words > 300 && r.dialogue < 0.03) out.push([3, 'thoughtful', 'No one speaks here. That can be beautiful (a lone ride, a long night). Make sure it is a choice.']);
    out.push([3, 'smile', `Reading ease ${r.readingEase} of 100. ${r.readingEase > 75 ? 'Swift and clear, like a fireside tale.' : r.readingEase > 50 ? 'A comfortable read for most of the guild.' : 'Dense. Fine for a sage’s treatise; heavy for a chase through the market.'}`]);
    return out;
}
