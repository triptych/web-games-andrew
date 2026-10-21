/**
 * simtest.mjs — the rules, art and economy of Colorverse, headless in Node.
 *
 *   node game-086/dev/simtest.mjs            (ONLY=purity,art,rules,save,story,bot  VERBOSE=1)
 *
 * purity   the pure modules never touch the DOM, storage, the clock or Math.random
 * art      every mosaic rasterises, uses every colour, has no two colours too alike to tell apart
 *          once painted, and no colour so rare it's a chore to find
 * rules    brushes (smart and not), pour, burst, wrong paint and painting over it, locked pixels,
 *          True Hand, undo (glimmer, order, mistakes, charges all put back), completion rewards
 * save     round trip, unknown version / broken JSON / tampered cells are rejected or dropped
 * story    page order and unlocks, every page has its scenes, every speaker exists
 * bot      plays the whole story buying skills as it goes, and checks the Constellation can be
 *          finished; prints Glimmer at the end of each chapter
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const JS = path.join(HERE, '..', 'js');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (n) => !ONLY.length || ONLY.includes(n);
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('  ✗', msg); } };
const section = (n) => console.log(`\n— ${n}`);

const { ARTWORKS, ART_BY_ID, PORTRAITS, PORTRAIT_ART } = await import('../js/artworks.js');
const { colorDistance } = await import('../js/pixelart.js');
const P = await import('../js/progress.js');
const SK = await import('../js/skills.js');
const ST = await import('../js/story.js');
const CFG = await import('../js/config.js');

if (want('purity')) {
    section('purity');
    for (const f of ['pixelart.js', 'artworks.js', 'progress.js', 'skills.js', 'story.js', 'config.js']) {
        const src = fs.readFileSync(path.join(JS, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        for (const bad of ['document', 'window', 'localStorage', 'Math.random', 'Date.now', 'performance.now', 'new Date']) {
            ok(!src.includes(bad), `${f} uses ${bad}`);
        }
    }
}

if (want('art')) {
    section('art');
    const ids = new Set();
    for (const a of [...ARTWORKS, ...PORTRAIT_ART]) {
        ok(!ids.has(a.id), `duplicate art id ${a.id}`); ids.add(a.id);
        ok(a.cells.length === a.w * a.h, `${a.id} cell count`);
        ok(a.palette.length <= 13, `${a.id} has ${a.palette.length} colours (max 13 so the studio palette fits base36)`);
        a.counts.forEach((n, k) => ok(n > 0, `${a.id}: colour ${k + 1} ${a.palette[k].name} is never used`));
    }
    for (const a of ARTWORKS) {
        a.counts.forEach((n, k) => ok(n >= 3, `${a.id}: colour ${k + 1} ${a.palette[k].name} has only ${n} pixels`));
        const grey = a.id === 'hush' ? 30 : 48; // the Hush is all greys on purpose
        for (let i = 0; i < a.palette.length; i++) for (let j = i + 1; j < a.palette.length; j++) {
            const d = colorDistance(a.palette[i].hex, a.palette[j].hex);
            ok(d >= grey, `${a.id}: ${a.palette[i].name} and ${a.palette[j].name} are too alike (${d.toFixed(0)})`);
        }
        ok(ST.ALL_PAGES.includes(a.id), `${a.id} is not on any chapter`);
        ok(typeof a.blurb === 'string' && a.blurb.length > 10, `${a.id} has no blurb`);
    }
    for (const [who, p] of Object.entries(PORTRAITS)) {
        const a = ART_BY_ID[p.art];
        ok(!!a, `portrait ${who} art ${p.art}`);
        if (a) ok(p.x + p.size <= a.w && p.y + p.size <= a.h, `portrait ${who} crop fits`);
        ok(!!ART_BY_ID[p.colorAfter], `portrait ${who} colorAfter`);
        ok(!!ST.SPEAKERS[who], `portrait ${who} has a speaker`);
    }
    if (process.env.VERBOSE) for (const a of ARTWORKS) console.log(`  ${a.id.padEnd(11)} ${a.w}×${a.h} ${a.palette.length} colours`);
}

if (want('rules')) {
    section('rules');
    const art = ART_BY_ID.prism;
    const s = P.newGame();
    const ps = P.pageOf(s, art);
    const idxOf = (c) => [...art.cells].findIndex((v) => v === c);
    // a wrong pixel, then painting over it
    const i0 = idxOf(0), x0 = i0 % art.w, y0 = Math.floor(i0 / art.w);
    let st = P.beginStroke(s, art, ps);
    let r = P.paintCells(s, art, ps, [i0], 1, st);
    ok(r.wrong.length === 1 && ps.mistakes === 1 && ps.cells[i0] === 2, 'wrong colour paints a mistake');
    ok(s.glimmer === 0, 'mistakes earn nothing');
    r = P.paintCells(s, art, ps, [i0], 0, st);
    ok(r.correct.length === 1 && ps.cells[i0] === 1 && ps.correct === 1, 'painting over a mistake with the right colour');
    ok(s.glimmer === 1, 'one glimmer per pixel');
    r = P.paintCells(s, art, ps, [i0], 3, st);
    ok(r.wrong.length === 0 && ps.cells[i0] === 1, 'a correct pixel is locked');
    // undo puts it all back
    P.undoStroke(s, art, ps, st);
    ok(ps.cells[i0] === 0 && ps.correct === 0 && s.glimmer === 0 && ps.mistakes === 0 && ps.order.length === 0, 'undo restores cells, glimmer, mistakes, order');

    // slips: wrong pixels count against the colour used; at the limit that colour smudges
    {
        const sv = P.newGame(), pv = P.pageOf(sv, art);
        const lim = P.slipLimit(art, 1);
        ok(lim >= CFG.SLIPS.min && lim <= CFG.SLIPS.max, 'slip limit inside its bounds');
        const ones = [...art.cells.keys()].filter((i) => art.cells[i] === 1);
        const notOnes = [...art.cells.keys()].filter((i) => art.cells[i] !== 1);
        let sk = P.beginStroke(sv, art, pv);
        P.paintCells(sv, art, pv, ones.slice(0, 10), 1, sk);
        P.commitSlips(art, pv, sk);
        const g10 = sv.glimmer;
        sk = P.beginStroke(sv, art, pv);
        P.paintCells(sv, art, pv, notOnes.slice(0, lim - 1), 1, sk);
        ok(P.commitSlips(art, pv, sk).length === 0 && pv.slips[1] === lim - 1, 'slips counted, not over yet');
        P.undoStroke(sv, art, pv, sk);
        ok(pv.slips[1] === lim - 1, 'undo does not take back slips');
        sk = P.beginStroke(sv, art, pv);
        P.paintCells(sv, art, pv, notOnes.slice(0, 1), 1, sk);
        P.undoStroke(sv, art, pv, sk);
        ok(pv.slips[1] === lim - 1, 'an uncommitted (cancelled) stroke adds no slips');
        sk = P.beginStroke(sv, art, pv);
        P.paintCells(sv, art, pv, notOnes.slice(0, 2), 1, sk);
        const over = P.commitSlips(art, pv, sk);
        ok(over.length === 1 && over[0] === 1, 'the last slip puts the colour over');
        const sm = P.smudgeColor(sv, art, pv, 1);
        ok(sm.cleared === 10 && sm.changed.length === 12 && !pv.cells.some((v) => v === 2), 'smudge wipes every pixel of that colour, right and wrong');
        ok(pv.correct === 0 && pv.order.length === 0 && Math.abs(sv.glimmer - (g10 - sm.lost)) < 1e-9 && sv.glimmer < 1e-9, 'smudge takes back its Glimmer');
        ok(pv.slips[1] === 0 && sv.streak === 0, 'smudge resets slips and streak');
        // a finished colour is safe
        const k = art.palette.length - 1;
        sk = P.beginStroke(sv, art, pv);
        P.paintCells(sv, art, pv, [...art.cells.keys()].filter((i) => art.cells[i] === k), k, sk);
        P.paintCells(sv, art, pv, notOnes.filter((i) => art.cells[i] !== k).slice(0, 40), k, sk);
        ok(P.commitSlips(art, pv, sk).length === 0 && pv.slips[k] === 0, 'a finished colour never smudges');
        // slips survive a save
        pv.slips[1] = 3;
        const back = P.deserialize(P.serialize(sv), ART_BY_ID);
        ok(back.pages.prism.slips[1] === 3, 'slips are saved');
    }

    // brushes
    ok(P.brushCells(art, x0, y0, 0, 0).length === 1, 'single brush');
    const plus = P.brushCells(art, 5, 5, 1, art.cells[5 * art.w + 5]);
    ok(plus.every((i) => i === 5 * art.w + 5 || art.cells[i] === art.cells[5 * art.w + 5]), 'smart brush only takes matching numbers');
    ok(P.brushCells(art, 0, 0, 3, 0, false).length === 8, 'round brush clipped at the corner');
    ok(P.brushCells(art, 10, 10, 3, 0, false).length === 21, 'round brush is 21 pixels');
    ok(P.brushCells(art, 10, 10, 2, 0, false).length === 9, 'square brush is 9 pixels');

    // pour fills the connected region of one number
    const region = P.pourCells(art, x0, y0);
    ok(region.length > 50 && region.every((i) => art.cells[i] === 0), 'pour stays inside its number');
    const seen = new Set(region);
    for (const i of region) {
        const x = i % art.w, y = Math.floor(i / art.w);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= art.w || ny >= art.h) continue;
            const j = ny * art.w + nx;
            if (art.cells[j] === 0) ok(seen.has(j), 'pour reaches every touching pixel of its number');
        }
    }
    const b = P.burstCells(art, 12, 12, 0);
    ok(b.every((i) => art.cells[i] === 0 && Math.hypot((i % art.w) - 12, Math.floor(i / art.w) - 12) <= CFG.STARBURST.radius + 1), 'burst is a circle of one number');

    // True Hand skips wrong pixels
    s.skills.push('lantern', 'truehand');
    st = P.beginStroke(s, art, ps);
    r = P.paintCells(s, art, ps, [i0], 1, st);
    ok(r.wrong.length === 0 && ps.cells[i0] === 0, 'True Hand never paints a mistake');

    // charges
    const s2 = P.newGame(); s2.skills.push('soft', 'broad', 'comet', 'pour', 'burst');
    const art2 = ART_BY_ID.castle, ps2 = P.pageOf(s2, art2);
    st = P.beginStroke(s2, art2, ps2);
    const all = [...art2.cells.keys()];
    for (const i of all.slice(0, CFG.STARBURST.pixelsPerCharge * 2)) P.paintCells(s2, art2, ps2, [i], art2.cells[i], st);
    ok(s2.charges === 2, `two charges after ${CFG.STARBURST.pixelsPerCharge * 2} pixels (got ${s2.charges})`);
    P.undoStroke(s2, art2, ps2, st);
    ok(s2.charges === 0 && s2.chargeProgress === 0, 'undo takes the charges back');
    st = P.beginStroke(s2, art2, ps2);
    for (const i of all.slice(0, CFG.STARBURST.pixelsPerCharge * 6)) P.paintCells(s2, art2, ps2, [i], art2.cells[i], st);
    ok(s2.charges === CFG.STARBURST.maxCharges, `charges stop at ${CFG.STARBURST.maxCharges}`);
    P.undoStroke(s2, art2, ps2, st);
    s2.skills.push('supernova');
    st = P.beginStroke(s2, art2, ps2);
    for (const i of all.slice(0, CFG.STARBURST.pixelsPerCharge * 7)) P.paintCells(s2, art2, ps2, [i], art2.cells[i], st);
    ok(s2.charges === CFG.SUPERNOVA.maxCharges && SK.burstRadius(s2) === CFG.SUPERNOVA.radius, 'Supernova: more charges, a wider burst');
    ok(SK.lanternAt(P.newGame()) === CFG.LANTERN_AT && SK.lanternAt({ skills: ['moonlit'] }) === CFG.MOONLIT_AT, 'Moonlit Lanterns glow sooner');

    // streak and catcher
    const s3 = P.newGame();
    ok(P.glimmerPerPixel(s3) === 1, 'base glimmer');
    s3.skills.push('catcher'); ok(P.glimmerPerPixel(s3) === 1.25, 'catcher');
    s3.skills.push('streak'); s3.streak = 1e6; ok(P.glimmerPerPixel(s3) === 1.25 * (1 + CFG.GLIMMER.streakMax), 'streak caps');

    // completion
    const s4 = P.newGame(), w = ART_BY_ID.wick, p4 = P.pageOf(s4, w);
    st = P.beginStroke(s4, w, p4);
    for (let i = 0; i < w.total; i++) P.paintCells(s4, w, p4, [i], w.cells[i], st);
    const res = P.finishIfComplete(s4, w, p4);
    ok(res && p4.done, 'page completes');
    ok(res.complete === Math.round(w.total * CFG.GLIMMER.completeBonus) && res.flawless > 0, 'completion and flawless bonus');
    ok(P.finishIfComplete(s4, w, p4) === null, 'rewards are paid once');
    ok(P.paintCells(s4, w, p4, [0], 3, st).wrong.length === 0, 'a finished page cannot be painted');
    ok(P.undoStroke(s4, w, p4, st).length === 0 && p4.done, 'a finished page cannot be undone');
    ok(Math.abs(s4.glimmer - (w.total + res.complete + res.flawless)) < 1e-9, 'glimmer totals add up');
    ok(p4.order.length === w.total && new Set(p4.order).size === w.total, 'the time-lapse order has every pixel once');
    const s4g = P.newGame(); s4g.skills.push('gilded');
    const p4g = P.pageOf(s4g, w);
    st = P.beginStroke(s4g, w, p4g);
    for (let i = 0; i < w.total; i++) P.paintCells(s4g, w, p4g, [i], w.cells[i], st);
    const rg = P.finishIfComplete(s4g, w, p4g);
    ok(rg.complete === Math.round(w.total * CFG.GLIMMER.completeBonus * CFG.GILDED) && rg.flawless === Math.round(w.total * CFG.GLIMMER.flawlessBonus * CFG.GILDED), 'Gilded Frame doubles the completion bonuses');

    // flourish threshold
    const s5 = P.newGame(); s5.skills.push('flourish');
    const p5 = P.pageOf(s5, w);
    p5.correct = Math.ceil(w.total * CFG.FLOURISH_AT) - 1;
    ok(!P.canFlourish(s5, w, p5), 'no flourish below 90%');
    p5.correct++;
    ok(P.canFlourish(s5, w, p5), 'flourish at 90%');

    // skills
    const s6 = P.newGame();
    ok(!SK.canBuy(s6, 'soft'), 'cannot buy without glimmer');
    s6.glimmer = 5000;
    ok(!SK.canBuy(s6, 'broad'), 'cannot buy without the prerequisite');
    ok(SK.buySkill(s6, 'soft') && s6.glimmer === 5000 - SK.SKILL_BY_ID.soft.cost, 'buying costs glimmer');
    ok(!SK.buySkill(s6, 'soft'), 'cannot buy twice');
    for (const sk of SK.SKILLS) for (const r of sk.req) ok(!!SK.SKILL_BY_ID[r], `${sk.id} needs unknown ${r}`);
}

if (want('save')) {
    section('save');
    const s = P.newGame();
    s.skills.push('soft', 'pour'); s.seen.push('prologue');
    const art = ART_BY_ID.dragon, ps = P.pageOf(s, art);
    const st = P.beginStroke(s, art, ps);
    for (let i = 0; i < 300; i++) P.paintCells(s, art, ps, [i], i % 7 === 0 ? (art.cells[i] + 1) % art.palette.length : art.cells[i], st);
    s.glimmer = 123.5;
    s.free.wick = Uint8Array.from(ART_BY_ID.wick.cells, (c) => (c % 20) + 1);
    const text = P.serialize(s);
    const back = P.deserialize(text, ART_BY_ID);
    ok(!!back, 'round trip loads');
    ok(back.glimmer === 123.5 && back.skills.join() === s.skills.join() && back.seen.join() === 'prologue', 'glimmer, skills, seen');
    const bp = back.pages.dragon;
    ok(bp && bp.cells.every((v, i) => v === ps.cells[i]) && bp.correct === ps.correct && bp.mistakes === ps.mistakes, 'page cells, correct and mistakes');
    ok(bp.order.join() === ps.order.join(), 'paint order');
    ok(back.free.wick.every((v, i) => v === s.free.wick[i]), 'freestyle cells');
    ok(P.deserialize('{oops', ART_BY_ID) === null, 'broken JSON');
    ok(P.deserialize(JSON.stringify({ v: 1 }), ART_BY_ID) === null, 'old version');
    const raw = JSON.parse(text);
    raw.pages.dragon.c = raw.pages.dragon.c.slice(1);
    raw.pages.bogus = { c: '000' };
    raw.skills.push('nope', 'comet');          // unknown, and one whose prerequisite is missing
    raw.glimmer = -50;
    raw.pages.wick = { c: 'z'.repeat(256), d: 1 };
    const t = P.deserialize(JSON.stringify(raw), ART_BY_ID);
    ok(t && !t.pages.dragon && !t.pages.bogus && !t.pages.wick, 'tampered pages are dropped');
    ok(!t.skills.includes('nope') && !t.skills.includes('comet'), 'unknown skills and skills missing a prerequisite are dropped');
    ok(t.glimmer === 0, 'negative glimmer clamps');
    // done flag must match the cells
    const raw2 = JSON.parse(text); raw2.pages.dragon.d = 1;
    ok(!P.deserialize(JSON.stringify(raw2), ART_BY_ID).pages.dragon.done, 'a page is only done if its cells are');
}

if (want('story')) {
    section('story');
    const s = P.newGame();
    ok(P.isPageUnlocked(s, 'wick') && !P.isPageUnlocked(s, 'comet'), 'only the first page is open');
    ok(!P.isPageUnlocked(s, 'snail'), 'bonus pages need Hidden Sketches');
    ok(P.nextPage(s) === 'wick', 'continue goes to Wick');
    ok(ST.STORY_PAGES.length === 29 && new Set(ST.ALL_PAGES).size === ST.ALL_PAGES.length, 'twenty-nine story pages, no repeats');
    ok(ST.ALL_PAGES.length === 35, 'thirty-five pages in all');
    ok(ST.FINAL_PAGE === 'farshore' && ST.STORY_PAGES.indexOf(ST.BOOK_ONE_END) === 13, 'Book One ends at the Colorverse, Book Two at the Far Shore');
    ok(ST.CHAPTERS.every((c) => ST.BOOKS[c.book]), 'every chapter is in a book');
    for (const e of ST.EXTRAS) ok(!!SK.SKILL_BY_ID[e.skill], `${e.id} opens with a real skill`);
    for (const id of ST.ALL_PAGES) {
        ok(!!ART_BY_ID[id], `page ${id} has art`);
        ok(!!ST.SCENES[`after:${id}`], `page ${id} has an after-scene`);
        ok(!!ST.SCENES[`before:${id}`], `page ${id} has a before-scene`);
    }
    for (const [k, lines] of Object.entries(ST.SCENES)) for (const [who, text] of lines) {
        ok(who === null || !!ST.SPEAKERS[who], `${k}: unknown speaker ${who}`);
        ok(typeof text === 'string' && text.length > 1 && !/[\[\]]/.test(text), `${k}: bad line`);
    }
    for (const id of ST.STORY_PAGES) {
        const art = ART_BY_ID[id];
        s.pages[id] = { ...P.blankPage(art), done: true, correct: art.total };
    }
    ok(P.storyDone(s) && P.nextPage(s) === undefined, 'story done, nothing next without the bonus');
    s.skills.push('catcher', 'streak', 'sketches');
    ok(P.nextPage(s) === 'snail' && P.isPageUnlocked(s, 'koi'), 'bonus pages open with the skill');
    ok(!P.isPageUnlocked(s, 'rabbit'), 'postcards need their own skill');
    for (const id of ST.BONUS.pages) s.pages[id] = { ...P.blankPage(ART_BY_ID[id]), done: true };
    ok(P.nextPage(s) === undefined, 'nothing next once the sketches are done');
    s.skills.push('postcards');
    ok(P.nextPage(s) === 'rabbit' && P.isPageUnlocked(s, 'owl'), 'postcards open with their skill');
    const mid = P.newGame();
    for (const id of ST.STORY_PAGES.slice(0, 14)) mid.pages[id] = { ...P.blankPage(ART_BY_ID[id]), done: true };
    ok(P.nextPage(mid) === 'jellies', 'Book Two starts once the Colorverse is restored');
}

if (want('bot')) {
    section('bot');
    // The bot paints every page with the best brush it has, makes a mistake every 40 pixels
    // (fixing it), and buys skills cheapest-first whenever it can.
    const s = P.newGame();
    const log = [];
    const buyAll = () => {
        let bought = true;
        while (bought) {
            bought = false;
            const options = SK.SKILLS.filter((k) => SK.canBuy(s, k.id)).sort((a, b) => a.cost - b.cost);
            if (options.length) { SK.buySkill(s, options[0].id); bought = true; log.push(options[0].id); }
        }
    };
    const playPage = (id) => {
        const art = ART_BY_ID[id], ps = P.pageOf(s, art);
        let n = 0, dabs = 0;
        for (let c = 0; c < art.palette.length; c++) {
            for (let i = 0; i < art.total; i++) {
                if (art.cells[i] !== c || P.isCorrect(art, ps, i)) continue;
                const st = P.beginStroke(s, art, ps);
                if (++n % 40 === 0 && !SK.has(s, 'truehand')) P.paintCells(s, art, ps, [i], (c + 1) % art.palette.length, st);
                const x = i % art.w, y = Math.floor(i / art.w);
                const cells = SK.has(s, 'pour') ? P.pourCells(art, x, y) : P.brushCells(art, x, y, SK.brushLevel(s), c);
                P.paintCells(s, art, ps, cells, c, st);
                dabs++;
                if (SK.has(s, 'flourish') && P.canFlourish(s, art, ps)) {
                    for (let j = 0; j < art.total; j++) P.paintCells(s, art, ps, [j], art.cells[j], st);
                }
            }
        }
        const res = P.finishIfComplete(s, art, ps);
        ok(!!res, `${id} completes`);
        ok(ps.order.length === art.total, `${id} order complete`);
        return dabs;
    };
    for (const ch of ST.CHAPTERS) {
        let dabs = 0;
        for (const id of ch.pages) { ok(P.isPageUnlocked(s, id), `${id} unlocked in time`); dabs += playPage(id); buyAll(); }
        console.log(`  after ${ch.title.padEnd(20)} glimmer ${Math.floor(s.glimmer).toString().padStart(5)}  earned ${Math.floor(s.earned).toString().padStart(6)}  skills ${s.skills.length}/${SK.SKILLS.length}  dabs ${dabs}`);
    }
    for (const id of ST.EXTRAS.flatMap((e) => e.pages)) { ok(P.isPageUnlocked(s, id), `${id} unlocked`); playPage(id); buyAll(); }
    ok(s.skills.length === SK.SKILLS.length, `every skill learnable by the end (${s.skills.length}/${SK.SKILLS.length}, total cost ${SK.totalSkillCost()}, earned ${Math.floor(s.earned)})`);
    if (process.env.VERBOSE) console.log('  bought in order:', log.join(', '));
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
