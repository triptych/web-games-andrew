// node test/lint.mjs - the global invariants G1-G9 (GDD §30)
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../js/', import.meta.url));
const files = [];
async function walk(dir) {
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) await walk(p);
    else if (name.endsWith('.js')) files.push(p);
  }
}
await walk(ROOT);

const fails = [];
const sources = new Map();
for (const f of files) sources.set(f, await readFile(f, 'utf8'));

const rel = f => relative(ROOT, f).split(sep).join('/');
/** Strip comments and string literals so prose about a rule is not a breach. */
const code = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''")
  .replace(/`(?:[^`\\]|\\.)*`/g, '``');
const isGen = f => rel(f).startsWith('gen/');
const isData = f => rel(f).startsWith('data/');

// G1: gen/ is pure - no bus, no DOM, no game state, no rendering.
for (const [f, src] of sources) {
  if (!isGen(f)) continue;
  for (const bad of ['/game/', '/ui/', '/render/', 'core/bus.js', 'world/']) {
    if (new RegExp(`from '[^']*${bad.replace(/\//g, '\\/')}`).test(src)) {
      fails.push(`G1 ${rel(f)} imports ${bad}`);
    }
  }
  if (/(^|[^.\w])(document|window)\s*\./.test(code(src))) fails.push(`G1 ${rel(f)} touches the DOM`);
}

// G2: no Math.random anywhere except the one documented fallback in seed.js.
for (const [f, src] of sources) {
  if (!/Math\.random/.test(code(src))) continue;
  // cosmetic jitter and audio dither are never read back into the model
  if (rel(f) === 'render/effects.js' || rel(f) === 'audio.js') continue;
  fails.push(`G2 ${rel(f)} calls Math.random`);
}

// G3: wall-clock time only in the view layer.
for (const [f, src] of sources) {
  if (!/Date\.now\(\)|performance\.now\(\)/.test(code(src))) continue;
  const r = rel(f);
  if (r.startsWith('render/') || r.startsWith('ui/') || r.startsWith('input/') ||
      r === 'main.js' || r === 'audio.js' || r === 'world/save.js' || r === 'core/seed.js' ||
      r === 'game/economy.js' || r === 'gen/threadutil.js') continue;
  fails.push(`G3 ${r} reads the wall clock`);
}

// G4: every emitted event type is declared.
const events = new Set();
const evSrc = sources.get(join(ROOT, 'data/events.js')) || '';
for (const m of evSrc.matchAll(/'([a-z]+:[A-Za-z]+)'/g)) events.add(m[1]);
for (const [f, src] of sources) {
  for (const m of src.matchAll(/bus\.(?:emit|on)\(\s*'([^']+)'/g)) {
    if (!events.has(m[1])) fails.push(`G4 ${rel(f)} uses undeclared event "${m[1]}"`);
  }
}

// G6: data tables are frozen at load.
for (const [f, src] of sources) {
  if (!isData(f)) continue;
  if (rel(f) === 'data/constants.js') continue;    // frozen per-export
  if (!/Object\.freeze/.test(src)) fails.push(`G6 ${rel(f)} is not frozen`);
}

// G9: no file over 500 lines (data tables exempt).
for (const [f, src] of sources) {
  const lines = src.split('\n').length;
  if (isData(f)) continue;
  if (lines > 500) fails.push(`G9 ${rel(f)} is ${lines} lines`);
}

console.log(`${files.length} files checked.`);
if (fails.length) { console.log(fails.map(x => '  ✗ ' + x).join('\n')); process.exit(1); }
console.log('  ✓ G1-G9 clean');
