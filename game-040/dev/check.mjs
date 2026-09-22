/**
 * check.mjs — structural checks. Run first; it catches the mistakes that would
 * otherwise show up as a blank screen or a crash three minutes into level 4.
 *
 *   node dev/check.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { installFakeDom } from './fake-dom.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = join(here, '..', 'js');

let failures = 0;
const ok = (cond, msg) => {
    if (cond) { console.log(`  ok   ${msg}`); return true; }
    console.log(`  FAIL ${msg}`);
    failures++;
    return false;
};

function listFiles(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listFiles(p));
        else if (entry.name.endsWith('.js')) out.push(p);
    }
    return out;
}

console.log('\n== architecture ==');
{
    const simFiles = listFiles(join(jsDir, 'sim'));
    let clean = true;
    for (const file of simFiles) {
        const src = readFileSync(file, 'utf8');
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        if (/from\s+['"]three/.test(code)) { console.log(`       ${file} imports three`); clean = false; }
        if (/\bdocument\.|\bwindow\.|localStorage/.test(code)) { console.log(`       ${file} touches the DOM`); clean = false; }
        if (/Math\.random\(/.test(code)) { console.log(`       ${file} calls Math.random (sim must be deterministic)`); clean = false; }
        if (/from\s+['"]\.\.\/view\//.test(code) || /from\s+['"]\.\.\/ui\//.test(code)) {
            console.log(`       ${file} imports the view/ui layer`); clean = false;
        }
    }
    ok(clean, `js/sim/ is pure: no three.js, no DOM, no Math.random, no view imports (${simFiles.length} files)`);

    const viewFiles = listFiles(join(jsDir, 'view'));
    ok(viewFiles.length >= 6, `view layer present (${viewFiles.length} files)`);
}

console.log('\n== simulation modules import ==');
const patterns = await import('../js/sim/patterns.js');
const { ENEMIES, ENEMY_IDS } = await import('../js/sim/enemies.js');
const { BOSSES, BOSS_IDS, SPECIALS, MOVES } = await import('../js/sim/bosses.js');
const { LEVELS, totalPodBudget, totalCadetBudget } = await import('../js/sim/levels.js');
const story = await import('../js/sim/story.js');
const { FORMATION_NAMES } = await import('../js/sim/formations.js');
const config = await import('../js/core/config.js');
const world = await import('../js/sim/world.js');
ok(true, 'every sim/core module imports without a browser');

console.log('\n== patterns ==');
{
    const names = new Set(patterns.PATTERN_NAMES);
    const collect = [];
    for (const e of Object.values(ENEMIES)) for (const a of e.attacks ?? []) collect.push([e.id, a]);
    for (const b of Object.values(BOSSES)) {
        for (const ph of b.phases) for (const a of ph.attacks) collect.push([b.id, a]);
    }
    let bad = 0;
    for (const [owner, a] of collect) {
        if (a.special) {
            if (!SPECIALS[a.special]) { console.log(`       ${owner}: unknown special "${a.special}"`); bad++; }
            continue;
        }
        if (!names.has(a.pattern)) { console.log(`       ${owner}: unknown pattern "${a.pattern}"`); bad++; }
        if (a.kind && !config.BULLET_KINDS.includes(a.kind)) {
            console.log(`       ${owner}: bullet kind "${a.kind}" has no instanced mesh`); bad++;
        }
        if (a.windup === undefined && !a.special) { console.log(`       ${owner}: attack with no windup`); bad++; }
    }
    ok(bad === 0, `${collect.length} attack specs reference known patterns, specials and bullet kinds`);

    // every pattern actually produces bullets
    const ctx = { x: 0, y: 5, aimAng: -Math.PI / 2, phase: 1, rng: Object.assign(() => 0.5, { range: (a, b) => (a + b) / 2, int: (a) => a }), bulletSpeed: 1, density: 0 };
    let empties = 0;
    for (const name of patterns.PATTERN_NAMES) {
        const out = patterns.buildPattern({ pattern: name }, ctx);
        if (!Array.isArray(out) || out.length === 0) { console.log(`       pattern "${name}" produced nothing`); empties++; }
        for (const b of out) {
            if (b.beam) continue;
            if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.ang) || !Number.isFinite(b.speed)) {
                console.log(`       pattern "${name}" produced a non-finite bullet`); empties++;
            }
        }
    }
    ok(empties === 0, `all ${patterns.PATTERN_NAMES.length} patterns emit finite bullets with default args`);
}

console.log('\n== enemies & bosses ==');
{
    ok(ENEMY_IDS.length === 14, `14 enemy archetypes (${ENEMY_IDS.length})`);
    let bad = 0;
    for (const e of Object.values(ENEMIES)) {
        if (typeof e.move !== 'function') { console.log(`       ${e.id} has no move()`); bad++; }
        if (!(e.hp > 0) || !(e.r > 0) || !(e.score > 0)) { console.log(`       ${e.id} bad hp/r/score`); bad++; }
    }
    ok(bad === 0, 'every enemy has a movement script and sane stats');

    ok(BOSS_IDS.length === 6, `6 bosses (${BOSS_IDS.length})`);
    let bbad = 0;
    for (const b of Object.values(BOSSES)) {
        if (!(b.hp > 0)) { console.log(`       ${b.id} bad hp`); bbad++; }
        let prev = Infinity;
        for (const ph of b.phases) {
            if (!MOVES[ph.move]) { console.log(`       ${b.id}/${ph.name}: unknown move "${ph.move}"`); bbad++; }
            if (!(ph.attacks?.length > 0)) { console.log(`       ${b.id}/${ph.name}: no attacks`); bbad++; }
            if (ph.hpFrom > prev) { console.log(`       ${b.id}/${ph.name}: phase thresholds out of order`); bbad++; }
            prev = ph.hpFrom;
        }
        if (b.phases[0].hpFrom !== 1) { console.log(`       ${b.id}: first phase must start at 1.0`); bbad++; }
    }
    ok(bbad === 0, 'boss phases are ordered, named, and all use known movement scripts');
}

console.log('\n== levels & story ==');
{
    let bad = 0;
    for (const lv of LEVELS) {
        const bossCues = lv.cues.filter((c) => c.kind === 'boss');
        if (bossCues.length !== 1) { console.log(`       L${lv.id}: expected exactly one boss cue`); bad++; }
        if (!BOSSES[lv.bossId]) { console.log(`       L${lv.id}: unknown boss "${lv.bossId}"`); bad++; }
        let lastT = -1;
        for (const cue of lv.cues) {
            if (cue.t < lastT) { console.log(`       L${lv.id}: cue at t=${cue.t} is out of order`); bad++; }
            lastT = cue.t;
            if (cue.kind === 'wave' || cue.kind === 'midboss') {
                if (!ENEMIES[cue.enemy]) { console.log(`       L${lv.id}: unknown enemy "${cue.enemy}"`); bad++; }
            }
            if (cue.kind === 'wave' && !FORMATION_NAMES.includes(cue.formation)) {
                console.log(`       L${lv.id}: unknown formation "${cue.formation}"`); bad++;
            }
            if (cue.kind === 'comms' && !story.commsExists(cue.id)) {
                console.log(`       L${lv.id}: comms id "${cue.id}" is not in story.js`); bad++;
            }
            if (cue.kind === 'midboss') {
                for (const t of cue.opts.escort ?? []) {
                    if (!ENEMIES[t]) { console.log(`       L${lv.id}: unknown escort "${t}"`); bad++; }
                }
            }
        }
    }
    ok(bad === 0, `all ${LEVELS.reduce((n, l) => n + l.cues.length, 0)} level cues reference real content, in time order`);
    ok(totalCadetBudget() === story.TOTAL_CADETS,
        `cadet budgets total the Halcyon roll (${totalCadetBudget()} === ${story.TOTAL_CADETS})`);
    ok(LEVELS.every((l) => l.cadetBudget >= l.podBudget),
        `every level has at least one cadet per pod (${totalPodBudget()} pods carry ${totalCadetBudget()} cadets)`);
    ok(LEVELS.every((l) => l.cues.filter((c) => c.kind === 'pods').reduce((n, c) => n + c.count, 0) <= l.podBudget),
        'no level cues more pods than its budget (the rest is the boss release)');

    const levels = story.CADETS.map((c) => c.level);
    ok(new Set(levels).size === levels.length && levels.length === 5, 'five named cadets, one per level 1-5');
    ok(story.CADETS.every((c) => story.COMMS[`${c.id}_rescued`] || c.rescueLine), 'every cadet has a rescue line');
    ok(story.ENDINGS.every((e, i, arr) => i === 0 || arr[i - 1].min > e.min), 'endings are ordered by headcount');
    ok(story.endingFor(0).id === 'ashes' && story.endingFor(211).id === 'everyname', 'ending selection works at both extremes');
}

console.log('\n== weapons & balance table ==');
{
    let bad = 0;
    for (const [id, w] of Object.entries(config.WEAPONS)) {
        if (w.levels.length !== config.MAX_POWER) { console.log(`       ${id}: ${w.levels.length} power levels`); bad++; }
        let prev = 0;
        for (const [i, muzzles] of w.levels.entries()) {
            const dps = muzzles.reduce((s, m) => s + m.dmg, 0) / w.cooldown;
            if (dps <= prev) { console.log(`       ${id} L${i + 1}: dps ${dps.toFixed(0)} does not improve on L${i}`); bad++; }
            prev = dps;
        }
    }
    ok(bad === 0, 'every weapon has 5 power levels with a strictly rising DPS curve');
}

console.log('\n== index.html wiring ==');
{
    const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
    const declared = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const referenced = new Set();
    for (const file of [...listFiles(join(jsDir, 'ui')), ...listFiles(join(jsDir, 'view')),
                        join(jsDir, 'main.js')]) {
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(/getElementById\(\s*'([^']+)'/g)) referenced.add(m[1]);
        // hud.js builds its id list as an array literal
        for (const m of src.matchAll(/for \(const id of \[([^\]]+)\]/g)) {
            for (const q of m[1].matchAll(/'([^']+)'/g)) referenced.add(q[1]);
        }
    }
    const missing = [...referenced].filter((id) => !declared.has(id));
    for (const id of missing) console.log(`       index.html has no #${id}`);
    ok(missing.length === 0, `every element the code looks up exists in index.html (${referenced.size} ids)`);

    ok(html.startsWith('<!DOCTYPE html>'), 'index.html starts with the doctype and nothing else');
    ok(/three@0\.165\.0\/build\/three\.module\.js/.test(html), 'three.js r165 is pinned in the import map');
    ok(/three\/addons\//.test(html), 'the addons path is mapped (bloom lives there)');
    ok((html.match(/← Games/g) ?? []).length === 1, 'exactly one back-to-launcher link');
    ok(/href="\.\.\/index\.html"/.test(html), 'the back link points at the launcher');
    ok(/viewport-fit=cover/.test(html) && /user-scalable=no/.test(html), 'mobile viewport meta is set');
}

console.log('\n== view layer imports (with the fake three) ==');
{
    installFakeDom({ ids: ['gl', 'hud', 'screen', 'comms', 'comms-portrait'] });
    register('./hooks.mjs', import.meta.url);
    const scene = await import('../js/view/scene.js');
    const models = await import('../js/view/models.js');
    const bullets = await import('../js/view/bullets.js');
    const backdrop = await import('../js/view/backdrop.js');
    const fx = await import('../js/view/fx.js');
    const render = await import('../js/view/render.js');
    const hud = await import('../js/ui/hud.js');
    const comms = await import('../js/ui/comms.js');
    const menus = await import('../js/ui/menus.js');
    const audio = await import('../js/audio/sounds.js');
    ok(!!(scene.initScene && models.makePlayerShip && bullets.initBullets && backdrop.initBackdrop
          && fx.initFx && render.initRender && hud.initHud && comms.initComms && menus.initMenus
          && audio.initAudio), 'every view/ui/audio module imports and exports its entry point');
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
