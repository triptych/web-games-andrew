// The Bindery: a novel → a standalone HTML book, an EPUB 3, a print proof (for Save as PDF), a manuscript
// in standard submission format, and Markdown. Pure: everything is a string or bytes. Every fragment is
// well-formed XHTML, so the same chapter markup goes into the web page, the print proof and the EPUB.

import { parseBlocks, inlineHtml, escapeXml as x, countWords, plain, typeset } from '../sim/text.js';
import { zip } from './zip.js';
import { hashString } from '../rng.js';

export const TYPEFACES = {
    garamond: { name: 'EB Garamond', stack: "'EB Garamond', Garamond, 'Palatino Linotype', Palatino, Georgia, serif", google: 'EB+Garamond:ital,wght@0,400;0,600;1,400' },
    cormorant: { name: 'Cormorant Garamond', stack: "'Cormorant Garamond', Garamond, Georgia, serif", google: 'Cormorant+Garamond:ital,wght@0,500;0,700;1,500' },
    crimson: { name: 'Crimson Pro', stack: "'Crimson Pro', 'Times New Roman', Georgia, serif", google: 'Crimson+Pro:ital,wght@0,400;0,600;1,400' },
    lora: { name: 'Lora', stack: "Lora, Georgia, 'Times New Roman', serif", google: 'Lora:ital,wght@0,400;0,600;1,400' },
    georgia: { name: 'Georgia (no web font)', stack: "Georgia, 'Times New Roman', serif", google: null },
};
export const PAGE_SIZES = {
    trade: { name: 'Trade paperback, 6 × 9 in', size: '6in 9in', margin: '0.8in 0.7in 0.9in 0.8in', font: '11.5pt' },
    digest: { name: 'Digest, 5.5 × 8.5 in', size: '5.5in 8.5in', margin: '0.75in 0.65in 0.85in 0.75in', font: '11pt' },
    pocket: { name: 'Pocket, 4.25 × 6.87 in', size: '4.25in 6.87in', margin: '0.6in 0.5in 0.7in 0.55in', font: '10pt' },
    a5: { name: 'A5', size: '148mm 210mm', margin: '20mm 17mm 22mm 19mm', font: '11pt' },
    letter: { name: 'US Letter', size: '8.5in 11in', margin: '1in 1in 1.1in', font: '12pt' },
    a4: { name: 'A4', size: '210mm 297mm', margin: '25mm 25mm 27mm', font: '12pt' },
};
export const FLEURONS = ['❦', '⁂', '✦', '* * *', '❧', '~'];
export const HEADINGS = { words: 'Chapter One', numerals: 'Chapter 1', roman: 'I, II, III', titles: 'Titles only' };

const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
export function numberWords(n) {
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
    if (n < 1000) return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + numberWords(n % 100) : '');
    return String(n);
}
export function roman(n) {
    const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = '';
    for (const [v, r] of map) while (n >= v) { s += r; n -= v; }
    return s;
}
const GENERIC = /^\s*(chapter\s+)?([0-9]+|[ivxlcdm]+|[a-z]+(-[a-z]+)?)\s*$/i;
const WORDY = new RegExp(`^\\s*chapter\\s+(${ONES.concat(TENS.filter(Boolean)).join('|')})`, 'i');

// ------------------------------------------------------------------ the model every format reads

/**
 * opts: { illum, appendices, sigilSvg, mapSrc (an image URL for HTML/print), mapFile (bool, EPUB), today }.
 * Talent-gated options (drop caps, appendices, map) arrive already decided by the caller.
 */
export function bookModel(P, opts = {}) {
    const b = P.book;
    const smart = b.smart !== false;
    const chapters = [];
    let n = 0;
    for (const ch of P.chapters) {
        const scenes = ch.scenes.map((id) => P.scenes[id]).filter((sc) => sc && sc.text.trim());
        if (!scenes.length) continue;
        n++;
        const custom = ch.title && !(GENERIC.test(ch.title) || WORDY.test(ch.title)) ? ch.title : '';
        const label = b.headings === 'numerals' ? `Chapter ${n}` : b.headings === 'roman' ? roman(n) : b.headings === 'titles' ? (custom ? '' : `Chapter ${numberWords(n)}`) : `Chapter ${numberWords(n)}`;
        chapters.push({ id: ch.id, n, label, title: custom, scenes: scenes.map((sc) => ({ title: sc.title, blocks: parseBlocks(sc.text) })) });
    }
    const dramatis = opts.appendices && b.dramatis ? P.characters.filter((c) => (c.name || '').trim()).map((c) => ({
        name: c.name, role: c.role, people: c.people,
        line: firstSentence(c.appearance) || firstSentence(c.arcStart) || firstSentence(c.want) || '',
    })) : [];
    const glossary = opts.appendices && b.glossary ? P.world.filter((e) => (e.name || '').trim()).map((e) => ({ name: e.name, kind: e.kind, line: firstSentence(e.summary) || firstSentence(e.details) || '' }))
        .sort((a, c) => a.name.localeCompare(c.name)) : [];
    return {
        id: P.id, title: P.title || 'Untitled', subtitle: P.subtitle || '', author: b.author || 'Anonymous', lang: b.lang || 'en',
        genre: P.genre, logline: P.logline || '', dedication: b.dedication || '', epigraph: b.epigraph || '', epigraphBy: b.epigraphBy || '',
        chapters, dramatis, glossary, smart, toc: b.toc !== false, sceneTitles: !!b.sceneTitles,
        fleuron: FLEURONS.includes(b.fleuron) ? b.fleuron : '❦', dropcaps: !!(opts.illum && b.dropcaps), illum: !!opts.illum,
        typeface: TYPEFACES[b.typeface] ? b.typeface : 'garamond', size: PAGE_SIZES[b.size] ? b.size : 'trade',
        map: !!(opts.mapSrc || opts.mapFile), mapSrc: opts.mapSrc || '', sigilSvg: opts.sigilSvg || '',
        words: P.chapters.reduce((a, ch) => a + ch.scenes.reduce((s, id) => s + (P.scenes[id]?.words || 0), 0), 0),
        today: opts.today || '',
        complete: P.status === 'complete',
    };
}

function firstSentence(s) {
    const t = plain(s || '').trim();
    if (!t) return '';
    const m = t.match(/^.*?[.!?](?=\s|$)/);
    return (m ? m[0] : t).slice(0, 220);
}

// ------------------------------------------------------------------ shared XHTML fragments

const inl = (m, s) => inlineHtml(s, { smart: m.smart });
const ts = (m, s) => x(m.smart ? typeset(s) : s);

export function chapterBody(m, ch) {
    const out = [];
    let first = true;
    ch.scenes.forEach((sc, si) => {
        if (si > 0) { out.push(`<p class="break" aria-hidden="true">${x(m.fleuron)}</p>`); first = true; }
        if (m.sceneTitles && sc.title) out.push(`<h3 class="scene-title">${ts(m, sc.title)}</h3>`);
        for (const bl of sc.blocks) {
            if (bl.type === 'break') { out.push(`<p class="break" aria-hidden="true">${x(m.fleuron)}</p>`); first = true; continue; }
            if (bl.type === 'quote') { out.push(`<blockquote><p>${bl.lines.map((l) => inl(m, l)).join('<br/>')}</p></blockquote>`); continue; }
            const html = inl(m, bl.text);
            if (first) {
                // a drop cap needs the first letter wrapped; skip leading quote marks and markup
                if (m.dropcaps && si === 0 && out.filter((o) => o.startsWith('<p class="first')).length === 0) out.push(`<p class="first drop">${dropCap(html)}</p>`);
                else out.push(`<p class="first">${html}</p>`);
                first = false;
            } else out.push(`<p>${html}</p>`);
        }
    });
    return out.join('\n');
}

/** Wrap the first letter (after any tags, entities or quote marks) in <span class="dc">. */
function dropCap(html) {
    const m = html.match(/^((?:<[^>]+>|&[#\w]+;|[“‘"'(\[])*)(\p{L}|\p{N})/u);
    if (!m) return html;
    return `${m[1]}<span class="dc">${m[2]}</span>${html.slice(m[0].length)}`;
}

function chapterHead(m, ch) {
    return `<header class="chapter-head">${ch.label ? `<p class="chapter-label">${x(ch.label)}</p>` : ''}${ch.title ? `<h2 class="chapter-title">${ts(m, ch.title)}</h2>` : ''}</header>`;
}
const chapterName = (ch) => ch.title ? (ch.label ? `${ch.label}: ${ch.title}` : ch.title) : ch.label;

function frontMatter(m, { mapImg = '' } = {}) {
    const out = [];
    out.push(`<section class="title-page" id="title">${m.sigilSvg ? `<div class="sigil">${m.sigilSvg}</div>` : ''}<h1 class="book-title">${ts(m, m.title)}</h1>${m.subtitle ? `<p class="subtitle">${ts(m, m.subtitle)}</p>` : ''}<p class="ornament" aria-hidden="true">${x(m.fleuron)}</p><p class="author">${ts(m, m.author)}</p></section>`);
    if (m.dedication.trim()) out.push(`<section class="dedication" id="dedication">${m.dedication.split(/\n+/).map((l) => `<p>${inl(m, l)}</p>`).join('')}</section>`);
    if (m.epigraph.trim()) out.push(`<section class="epigraph" id="epigraph"><blockquote>${m.epigraph.split(/\n+/).map((l) => `<p>${inl(m, l)}</p>`).join('')}</blockquote>${m.epigraphBy.trim() ? `<p class="attribution">— ${ts(m, m.epigraphBy)}</p>` : ''}</section>`);
    if (mapImg) out.push(`<section class="map-plate" id="map"><img src="${x(mapImg)}" alt="A map of the world of ${x(m.title)}"/></section>`);
    return out.join('\n');
}

function appendices(m) {
    const out = [];
    if (m.dramatis.length) out.push(`<section class="appendix" id="dramatis"><h2 class="appendix-title">Dramatis Personae</h2><dl>${m.dramatis.map((c) => `<dt>${ts(m, c.name)}</dt><dd>${[c.role, c.people].filter(Boolean).map((s) => ts(m, s)).join(', ')}${c.line ? `. ${ts(m, c.line)}` : ''}</dd>`).join('')}</dl></section>`);
    if (m.glossary.length) out.push(`<section class="appendix" id="glossary"><h2 class="appendix-title">Glossary</h2><dl>${m.glossary.map((g) => `<dt>${ts(m, g.name)}</dt><dd><i>${x(g.kind)}.</i> ${ts(m, g.line)}</dd>`).join('')}</dl></section>`);
    return out.join('\n');
}

function bookCss(m, { print = false, page = null, web = false } = {}) {
    const face = TYPEFACES[m.typeface].stack;
    return `
:root { --ink: #1d1a16; --paper: #fbf7ee; --dim: #6c6457; --rule: #c9b98f; --accent: #7a5418; }
${web ? `@media (prefers-color-scheme: dark) { :root { --ink: #e9e2d2; --paper: #16130f; --dim: #a59c8a; --rule: #5a4c30; --accent: #d9b56b; } }` : ''}
html { background: var(--paper); color: var(--ink); }
body { margin: 0; font-family: ${face}; font-size: ${print ? page.font : '1.18rem'}; line-height: ${print ? 1.42 : 1.62}; hyphens: auto; -webkit-hyphens: auto; ${web ? 'padding: 0 1.25rem;' : ''} }
${web ? 'main { max-width: 34em; margin: 0 auto; padding: 3rem 0 6rem; }' : ''}
p { margin: 0; text-indent: 1.4em; text-align: justify; orphans: 2; widows: 2; }
p.first, .dedication p, .epigraph p, blockquote p, .title-page p, p.break { text-indent: 0; }
.title-page p, .dedication p, .epigraph p, .attribution, .colophon p { text-align: center; }
p.break { text-align: center; margin: 1em 0; color: var(--accent); letter-spacing: 0.3em; }
blockquote { margin: 0.9em 1.6em; font-style: italic; }
blockquote p { text-align: left; }
h1, h2, h3 { font-weight: 600; font-family: ${face}; }
.title-page { text-align: center; padding: ${print ? '22% 0 0' : '4rem 0 3rem'}; ${print ? 'break-after: page;' : 'min-height: 70vh;'} }
.title-page .sigil svg { width: 5.5em; height: auto; }
.book-title { font-size: 2.5em; line-height: 1.12; margin: 0.6em 0 0.25em; letter-spacing: 0.02em; }
.subtitle { font-style: italic; font-size: 1.2em; color: var(--dim); }
.ornament { color: var(--accent); font-size: 1.4em; margin: 1.2em 0; }
.author { font-variant: small-caps; letter-spacing: 0.12em; font-size: 1.25em; }
.dedication, .epigraph { text-align: center; font-style: italic; padding: ${print ? '30% 0 0' : '3rem 0'}; ${print ? 'break-after: page;' : ''} }
.epigraph blockquote { margin: 0 auto; max-width: 24em; }
.attribution { margin-top: 0.8em; font-style: normal; font-variant: small-caps; }
.map-plate { text-align: center; ${print ? 'break-after: page;' : 'padding: 2rem 0;'} }
.map-plate img { max-width: 100%; ${print ? 'max-height: 95%;' : ''} border: 1px solid var(--rule); }
nav.toc { ${print ? 'break-after: page; padding-top: 12%;' : 'padding: 2rem 0;'} }
nav.toc h2, .appendix-title { text-align: center; font-variant: small-caps; letter-spacing: 0.1em; font-weight: 400; font-size: 1.4em; }
nav.toc ol { list-style: none; padding: 0; margin: 1em auto; max-width: 24em; }
nav.toc li { margin: 0.35em 0; }
nav.toc a { color: inherit; text-decoration: none; }
nav.toc a:hover { color: var(--accent); }
.chapter { ${print ? 'break-before: page;' : 'padding-top: 3.5rem;'} }
.chapter-head { text-align: center; margin: ${print ? '18% 0 2.2em' : '0 0 2em'}; }
.chapter-label { text-indent: 0; text-align: center; font-variant: small-caps; letter-spacing: 0.18em; color: var(--dim); font-size: 0.95em; }
.chapter-title { font-size: 1.6em; margin: 0.3em 0 0; font-weight: 500; font-style: italic; }
.scene-title { text-align: center; font-size: 1em; font-variant: small-caps; letter-spacing: 0.08em; font-weight: 400; margin: 1.6em 0 0.8em; color: var(--dim); }
${m.illum ? `.chapter-head::after { content: "${m.fleuron.length === 1 ? m.fleuron : '❦'}"; display: block; color: var(--accent); margin-top: 0.7em; font-size: 1.1em; }
p.first::first-line { font-variant: small-caps; letter-spacing: 0.04em; }` : ''}
${m.dropcaps ? `.dc { float: left; font-size: 3.6em; line-height: 0.82; padding: 0.06em 0.08em 0 0; color: var(--accent); font-weight: 600; }` : ''}
.appendix { ${print ? 'break-before: page; padding-top: 10%;' : 'padding-top: 3.5rem;'} }
.appendix dl { margin: 1.4em 0; }
.appendix dt { font-weight: 600; margin-top: 0.7em; font-variant: small-caps; letter-spacing: 0.05em; }
.appendix dd { margin: 0.1em 0 0 1.4em; }
.colophon { text-align: center; color: var(--dim); font-size: 0.85em; ${print ? 'break-before: page; padding-top: 60%;' : 'padding: 4rem 0 0;'} }
.colophon p { text-indent: 0; text-align: center; }
`;
}

const fontLink = (m) => TYPEFACES[m.typeface].google
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${TYPEFACES[m.typeface].google}&amp;display=swap"/>`
    : '';

function tocHtml(m, href = (ch) => `#${ch.id}`) {
    if (!m.toc || !m.chapters.length) return '';
    const items = m.chapters.map((ch) => `<li><a href="${href(ch)}">${ts(m, chapterName(ch))}</a></li>`);
    if (m.dramatis.length) items.push(`<li><a href="${href({ id: 'dramatis', appendix: true })}">Dramatis Personae</a></li>`);
    if (m.glossary.length) items.push(`<li><a href="${href({ id: 'glossary', appendix: true })}">Glossary</a></li>`);
    return `<nav class="toc" id="contents"><h2>Contents</h2><ol>${items.join('')}</ol></nav>`;
}

const colophon = (m) => `<section class="colophon"><p>${ts(m, m.title)}</p><p>${m.complete ? 'Finished' : 'A work in progress'}${m.today ? `, ${x(m.today)}` : ''}. ${m.words.toLocaleString('en')} words.</p><p>Bound at the Guild of the Quillsworn, Vellmere.</p></section>`;

// ------------------------------------------------------------------ the formats

/** One self-contained web page. */
export function buildHtml(m) {
    const body = [
        frontMatter(m, { mapImg: m.mapSrc }),
        tocHtml(m),
        ...m.chapters.map((ch) => `<section class="chapter" id="${ch.id}">${chapterHead(m, ch)}\n${chapterBody(m, ch)}</section>`),
        appendices(m),
        colophon(m),
    ].join('\n');
    return `<!DOCTYPE html>
<html lang="${x(m.lang)}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="author" content="${x(m.author)}"/>
<meta name="description" content="${x(m.logline)}"/>
<title>${x(m.title)}</title>
${fontLink(m)}
<style>${bookCss(m, { web: true })}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
}

/** A page laid out for print; the browser's print dialog saves it as a PDF. */
export function buildPrint(m) {
    const page = PAGE_SIZES[m.size];
    const body = [
        frontMatter(m, { mapImg: m.mapSrc }),
        tocHtml(m),
        ...m.chapters.map((ch) => `<section class="chapter" id="${ch.id}">${chapterHead(m, ch)}\n${chapterBody(m, ch)}</section>`),
        appendices(m),
        colophon(m),
    ].join('\n');
    return `<!DOCTYPE html>
<html lang="${x(m.lang)}">
<head>
<meta charset="utf-8"/>
<title>${x(m.title)}</title>
${fontLink(m)}
<style>
@page { size: ${page.size}; margin: ${page.margin}; @bottom-center { content: counter(page); font-family: ${TYPEFACES[m.typeface].stack}; font-size: 9pt; color: #6c6457; } }
@page :first { @bottom-center { content: none; } }
${bookCss(m, { print: true, page })}
html, body { background: #fff; }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

/** A string safe inside a CSS "..." literal (no markup escaping: <style> is raw text in HTML). */
const cssStr = (s) => String(s).replace(/[\\"]/g, '\\$&').replace(/[\n\r]+/g, ' ').replace(/<\//g, '<\\/');

/** Standard manuscript format: what agents and editors ask for. */
export function buildManuscript(m, { contact = '' } = {}) {
    const surname = (m.author.trim().split(/\s+/).pop() || 'Author');
    const approx = Math.max(100, Math.round(m.words / (m.words > 10000 ? 1000 : 100)) * (m.words > 10000 ? 1000 : 100));
    const chapters = m.chapters.map((ch) => {
        const paras = [];
        ch.scenes.forEach((sc, si) => {
            if (si > 0) paras.push('<p class="ms-break">#</p>');
            for (const bl of sc.blocks) {
                if (bl.type === 'break') paras.push('<p class="ms-break">#</p>');
                else if (bl.type === 'quote') paras.push(`<p class="ms-quote">${bl.lines.map((l) => inlineHtml(l, { smart: false })).join('<br/>')}</p>`);
                else paras.push(`<p>${inlineHtml(bl.text, { smart: false })}</p>`);
            }
        });
        return `<section class="ms-chapter"><p class="ms-head">${x(chapterName(ch).toUpperCase())}</p>${paras.join('\n')}</section>`;
    }).join('\n');
    return `<!DOCTYPE html>
<html lang="${x(m.lang)}">
<head>
<meta charset="utf-8"/>
<title>${x(m.title)} (manuscript)</title>
<style>
@page { size: 8.5in 11in; margin: 1in; @top-right { content: "${cssStr(surname)} / ${cssStr(m.title.toUpperCase())} / " counter(page); font-family: 'Times New Roman', Times, serif; font-size: 12pt; } }
@page :first { @top-right { content: none; } }
html, body { background: #fff; color: #000; }
body { margin: 0; font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 2; }
p { margin: 0; text-indent: 0.5in; }
.ms-cover { height: 9in; position: relative; break-after: page; line-height: 1.2; }
.ms-contact { position: absolute; top: 0; left: 0; white-space: pre-line; }
.ms-count { position: absolute; top: 0; right: 0; }
.ms-titleblock { position: absolute; top: 3.5in; left: 0; right: 0; text-align: center; line-height: 2; }
.ms-titleblock p { text-indent: 0; }
.ms-chapter { break-before: page; padding-top: 2.5in; }
.ms-chapter:first-of-type { break-before: auto; }
.ms-head { text-align: center; text-indent: 0; margin-bottom: 1em; }
.ms-break { text-align: center; text-indent: 0; }
.ms-quote { margin: 0 0.5in; text-indent: 0; }
.ms-end { text-align: center; text-indent: 0; margin-top: 1em; }
</style>
</head>
<body>
<section class="ms-cover">
<div class="ms-contact">${x(contact || m.author)}</div>
<div class="ms-count">About ${approx.toLocaleString('en')} words</div>
<div class="ms-titleblock"><p>${x(m.title.toUpperCase())}</p>${m.subtitle ? `<p>${x(m.subtitle)}</p>` : ''}<p>by ${x(m.author)}</p></div>
</section>
${chapters}
<p class="ms-end">THE END</p>
</body>
</html>
`;
}

export function buildMarkdown(m) {
    const out = [`# ${m.title}`];
    if (m.subtitle) out.push(`*${m.subtitle}*`);
    out.push(`by ${m.author}`, '');
    if (m.dedication.trim()) out.push(...m.dedication.split(/\n+/).map((l) => `*${l}*`), '');
    if (m.epigraph.trim()) out.push(...m.epigraph.split(/\n+/).map((l) => `> ${l}`), m.epigraphBy ? `>\n> — ${m.epigraphBy}` : '', '');
    for (const ch of m.chapters) {
        out.push(`## ${chapterName(ch)}`, '');
        ch.scenes.forEach((sc, si) => {
            if (si > 0) out.push('* * *', '');
            if (m.sceneTitles && sc.title) out.push(`### ${sc.title}`, '');
            for (const bl of sc.blocks) {
                if (bl.type === 'break') out.push('* * *', '');
                else if (bl.type === 'quote') out.push(...bl.lines.map((l) => `> ${l}`), '');
                else out.push(bl.text, '');
            }
        });
    }
    if (m.dramatis.length) { out.push('## Dramatis Personae', ''); for (const c of m.dramatis) out.push(`- **${c.name}**, ${[c.role, c.people].filter(Boolean).join(', ')}${c.line ? `. ${c.line}` : ''}`); out.push(''); }
    if (m.glossary.length) { out.push('## Glossary', ''); for (const g of m.glossary) out.push(`- **${g.name}** (${g.kind}). ${g.line}`); out.push(''); }
    return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ------------------------------------------------------------------ the cover, as SVG

function wrapTitle(t, max = 15) {
    const words = t.split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
        if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 5);
}

export function coverSvg(m, palette = { bg1: '#1c2b3a', bg2: '#0c141c', gold: '#d9b56b', ink: '#f3ead2' }) {
    const lines = wrapTitle(m.smart ? typeset(m.title) : m.title);
    const size = lines.length > 3 ? 54 : lines.length > 2 ? 62 : 72;
    const top = 330 - (lines.length - 1) * size * 0.55;
    const title = lines.map((l, i) => `<text x="300" y="${(top + i * size * 1.12).toFixed(0)}" text-anchor="middle" font-size="${size}" font-family="Georgia, 'Times New Roman', serif" fill="${palette.ink}" letter-spacing="1">${x(l)}</text>`).join('');
    const sigil = m.sigilSvg ? `<g transform="translate(250 600) scale(0.5)">${m.sigilSvg.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>` : '';
    const corner = (tx, ty, sx, sy) => `<path transform="translate(${tx} ${ty}) scale(${sx} ${sy})" d="M0 0 C 30 0 46 10 52 34 M0 0 C 0 30 10 46 34 52 M14 14 C 24 18 30 24 34 34" fill="none" stroke="${palette.gold}" stroke-width="2.5"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900">
<defs><radialGradient id="g" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${palette.bg1}"/><stop offset="1" stop-color="${palette.bg2}"/></radialGradient></defs>
<rect width="600" height="900" fill="url(#g)"/>
<rect x="28" y="28" width="544" height="844" fill="none" stroke="${palette.gold}" stroke-width="3"/>
<rect x="40" y="40" width="520" height="820" fill="none" stroke="${palette.gold}" stroke-width="1" opacity="0.7"/>
${corner(40, 40, 1, 1)}${corner(560, 40, -1, 1)}${corner(40, 860, 1, -1)}${corner(560, 860, -1, -1)}
<text x="300" y="140" text-anchor="middle" font-size="22" font-family="Georgia, serif" fill="${palette.gold}" letter-spacing="6">${m.complete ? 'A NOVEL' : 'A WORK IN PROGRESS'}</text>
<path d="M200 170 H400" stroke="${palette.gold}" stroke-width="1.5"/>
${title}
${m.subtitle ? `<text x="300" y="${(top + lines.length * size * 1.12 + 10).toFixed(0)}" text-anchor="middle" font-size="24" font-style="italic" font-family="Georgia, serif" fill="${palette.ink}" opacity="0.85">${x(m.smart ? typeset(m.subtitle) : m.subtitle).slice(0, 60)}</text>` : ''}
${sigil}
<path d="M200 760 H400" stroke="${palette.gold}" stroke-width="1.5"/>
<text x="300" y="805" text-anchor="middle" font-size="30" font-family="Georgia, serif" fill="${palette.gold}" letter-spacing="4">${x(m.author.toUpperCase())}</text>
</svg>`;
}

// ------------------------------------------------------------------ EPUB 3

const XHTML = (m, title, body, extraHead = '') => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${x(m.lang)}" lang="${x(m.lang)}">
<head><meta charset="utf-8"/><title>${x(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/>${extraHead}</head>
<body>
${body}
</body>
</html>
`;

export function bookUuid(m) {
    const h = (s) => hashString(s).toString(16).padStart(8, '0');
    const a = h(`${m.id}:${m.title}:a`), b = h(`${m.id}:b`), c = h(`${m.author}:c`), d = h(`${m.id}:${m.author}:d`);
    return `${a}-${b.slice(0, 4)}-4${b.slice(5, 8)}-a${c.slice(1, 4)}-${c.slice(4)}${d}`;
}

/** → Uint8Array of a valid EPUB 3 (with an EPUB 2 NCX for older readers). mapPng: Uint8Array or null. */
export function buildEpub(m, { mapPng = null, modified = '2026-01-01T00:00:00Z' } = {}) {
    const files = [];
    const manifest = [];
    const spine = [];
    const add = (id, href, type, data, { props = '', spineIt = false, linear = true } = {}) => {
        files.push({ name: `OEBPS/${href}`, data });
        manifest.push(`<item id="${id}" href="${href}" media-type="${type}"${props ? ` properties="${props}"` : ''}/>`);
        if (spineIt) spine.push(`<itemref idref="${id}"${linear ? '' : ' linear="no"'}/>`);
    };
    const css = bookCss(m, {}) + '\nbody { margin: 0 4%; }\n.cover { margin: 0; padding: 0; text-align: center; }\n.cover img { max-width: 100%; max-height: 100%; }\n';
    add('css', 'style.css', 'text/css', css);
    add('cover-image', 'cover.svg', 'image/svg+xml', coverSvg(m), { props: 'cover-image' });
    add('cover', 'cover.xhtml', 'application/xhtml+xml', XHTML(m, 'Cover', `<section class="cover" epub:type="cover"><img src="cover.svg" alt="${x(m.title)}"/></section>`), { spineIt: true });
    add('title', 'title.xhtml', 'application/xhtml+xml', XHTML(m, m.title, frontMatter({ ...m, dedication: '', epigraph: '' })), { spineIt: true, props: m.sigilSvg ? 'svg' : '' });
    if (m.dedication.trim() || m.epigraph.trim()) {
        const fm = frontMatter({ ...m, title: '', subtitle: '', author: '', sigilSvg: '' }).replace(/<section class="title-page"[\s\S]*?<\/section>\n?/, '');
        add('front', 'front.xhtml', 'application/xhtml+xml', XHTML(m, 'Dedication', fm), { spineIt: true });
    }
    if (mapPng) {
        add('map-image', 'map.png', 'image/png', mapPng);
        add('map', 'map.xhtml', 'application/xhtml+xml', XHTML(m, 'Map', `<section class="map-plate" id="map"><img src="map.png" alt="A map of the world of ${x(m.title)}"/></section>`), { spineIt: true });
    }
    const chFile = (ch) => ch.appendix ? `${ch.id}.xhtml` : `chapter-${String(ch.n).padStart(3, '0')}.xhtml`;
    for (const ch of m.chapters) {
        add(`ch${ch.n}`, chFile(ch), 'application/xhtml+xml', XHTML(m, chapterName(ch), `<section class="chapter" epub:type="chapter" id="${ch.id}">${chapterHead(m, ch)}\n${chapterBody(m, ch)}</section>`), { spineIt: true });
    }
    const apx = appendices(m);
    if (m.dramatis.length) add('dramatis', 'dramatis.xhtml', 'application/xhtml+xml', XHTML(m, 'Dramatis Personae', apx.match(/<section class="appendix" id="dramatis">[\s\S]*?<\/section>/)[0]), { spineIt: true });
    if (m.glossary.length) add('glossary', 'glossary.xhtml', 'application/xhtml+xml', XHTML(m, 'Glossary', apx.match(/<section class="appendix" id="glossary">[\s\S]*?<\/section>/)[0]), { spineIt: true });
    add('colophon', 'colophon.xhtml', 'application/xhtml+xml', XHTML(m, 'Colophon', colophon(m)), { spineIt: true });

    // navigation: an EPUB 3 nav document and an EPUB 2 NCX
    const navItems = [`<li><a href="title.xhtml">${ts(m, m.title)}</a></li>`]
        .concat(mapPng ? ['<li><a href="map.xhtml">Map</a></li>'] : [])
        .concat(m.chapters.map((ch) => `<li><a href="${chFile(ch)}">${ts(m, chapterName(ch))}</a></li>`))
        .concat(m.dramatis.length ? ['<li><a href="dramatis.xhtml">Dramatis Personae</a></li>'] : [])
        .concat(m.glossary.length ? ['<li><a href="glossary.xhtml">Glossary</a></li>'] : []);
    add('nav', 'nav.xhtml', 'application/xhtml+xml', XHTML(m, 'Contents', `<nav epub:type="toc" id="toc" class="toc"><h2>Contents</h2><ol>${navItems.join('')}</ol></nav><nav epub:type="landmarks" hidden="hidden"><ol><li><a epub:type="cover" href="cover.xhtml">Cover</a></li>${m.chapters.length ? `<li><a epub:type="bodymatter" href="${chFile(m.chapters[0])}">Begin reading</a></li>` : ''}</ol></nav>`), { props: 'nav', spineIt: m.toc, linear: true });
    const uuid = bookUuid(m);
    const points = [{ label: m.title, href: 'title.xhtml' }].concat(m.chapters.map((ch) => ({ label: chapterName(ch), href: chFile(ch) })));
    const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="urn:uuid:${uuid}"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>
<docTitle><text>${x(m.title)}</text></docTitle>
<navMap>${points.map((p, i) => `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${x(p.label)}</text></navLabel><content src="${p.href}"/></navPoint>`).join('')}</navMap>
</ncx>
`;
    add('ncx', 'toc.ncx', 'application/x-dtbncx+xml', ncx);

    const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${x(m.lang)}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">urn:uuid:${uuid}</dc:identifier>
<dc:title>${x(m.title)}</dc:title>
<dc:creator>${x(m.author)}</dc:creator>
<dc:language>${x(m.lang)}</dc:language>
<dc:subject>Fantasy</dc:subject>
${m.logline ? `<dc:description>${x(m.logline)}</dc:description>` : ''}
<dc:publisher>The Guild of the Quillsworn</dc:publisher>
<meta property="dcterms:modified">${x(modified)}</meta>
<meta name="cover" content="cover-image"/>
</metadata>
<manifest>
${manifest.join('\n')}
</manifest>
<spine toc="ncx">
${spine.join('\n')}
</spine>
</package>
`;
    const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`;
    const [y, mo, d] = (modified.slice(0, 10).split('-').map(Number));
    return zip([
        { name: 'mimetype', data: 'application/epub+zip' },
        { name: 'META-INF/container.xml', data: container },
        { name: 'OEBPS/content.opf', data: opf },
        ...files,
    ], { y, m: mo, d });
}

/** A filesystem-safe name for downloads. */
export function fileStem(title) {
    return (title || 'book').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60) || 'book';
}

export { countWords };
