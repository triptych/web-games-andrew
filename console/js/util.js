// Small helpers shared by the console's modules: escaping, game paths,
// sorting keys, relative times and the title/description search.

export const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Trim a long description to roughly `n` characters on a word boundary. */
export function excerpt(text, n = 200) {
    if (text.length <= n) return text;
    const cut = text.slice(0, n);
    return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 30)).replace(/[,;:\s—-]+$/, '') + '…';
}

/** game-135 → 135 */
export const gameNo = (g) => parseInt(g.id.replace(/\D+/g, ''), 10) || 0;

/** The console lives one folder down from the repo root. */
export const thumbUrl = (g) => `../garden/img/games/${encodeURIComponent(g.id)}.jpg`;
export const playUrl = (g) => `../${g.folder}/index.html`;

/** Sort the way a music player sorts artists: "The River" files under R. */
export const sortKey = (g) =>
    g.title
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/^[^\p{L}\p{N}]+/u, '')
        .toLowerCase();

export function azLetter(g) {
    const c = sortKey(g).charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? c : '#';
}

export function timeAgo(t, now = Date.now()) {
    const s = Math.max(0, (now - t) / 1000);
    if (s < 60) return 'just now';
    const m = s / 60;
    if (m < 60) return `${Math.floor(m)}m ago`;
    const h = m / 60;
    if (h < 24) return `${Math.floor(h)}h ago`;
    const d = h / 24;
    if (d < 7) return `${Math.floor(d)}d ago`;
    return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tokensOf = (q) => q.trim().toLowerCase().split(/\s+/).filter(Boolean);

/**
 * Title-and-description search. Every word typed must appear somewhere (title,
 * description, a tag or the genre); titles weigh most, so "drag" puts the
 * dragon games ahead of a game whose blurb mentions dragging.
 */
export function searchGames(list, query, genreText) {
    const tokens = tokensOf(query);
    if (!tokens.length) return [];
    const q = tokens.join(' ');
    const out = [];
    for (const g of list) {
        const title = g.title.toLowerCase();
        const desc = g.description.toLowerCase();
        const tags = g.tags.map((t) => t.label).join(' ').toLowerCase();
        const genre = genreText(g).toLowerCase();
        let score = 0;
        let ok = true;
        for (const t of tokens) {
            let s = 0;
            if (title.includes(t)) s += title.startsWith(t) ? 60 : new RegExp(`\\b${escRe(t)}`).test(title) ? 40 : 25;
            if (tags.includes(t)) s += 12;
            if (genre.includes(t)) s += 10;
            if (desc.includes(t)) s += 4 + Math.min(4, desc.split(t).length - 2);
            if (!s) {
                ok = false;
                break;
            }
            score += s;
        }
        if (!ok) continue;
        if (title === q) score += 200;
        else if (title.startsWith(q)) score += 100;
        else if (title.includes(q)) score += 50;
        out.push({ g, score });
    }
    out.sort((a, b) => b.score - a.score || gameNo(b.g) - gameNo(a.g));
    return out.map((x) => x.g);
}

/** Escape `text` and wrap each searched word in <mark>. */
export function markText(text, query) {
    const tokens = tokensOf(query).map(escRe);
    if (!tokens.length) return esc(text);
    const re = new RegExp(`(${tokens.join('|')})`, 'ig');
    return text
        .split(re)
        .map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part)))
        .join('');
}

/** A short window of the description around the first searched word, or null. */
export function descSnippet(text, query, n = 90) {
    const tokens = tokensOf(query);
    const lower = text.toLowerCase();
    let at = -1;
    for (const t of tokens) {
        const i = lower.indexOf(t);
        if (i >= 0 && (at < 0 || i < at)) at = i;
    }
    if (at < 0) return null;
    const start = Math.max(0, at - 28);
    const from = start ? text.indexOf(' ', start) + 1 || start : 0;
    let s = text.slice(from, from + n);
    if (from + n < text.length) s = s.slice(0, s.lastIndexOf(' ')) + '…';
    return (from ? '…' : '') + s;
}

export function shuffled(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
