// node test/run.mjs - the same tests, outside a browser
import { runAll } from './tests.js';

const t0 = Date.now();
const { pass, fail, total } = await runAll(r => {
  const mark = r.ok ? '✓' : '✗';
  console.log(`${mark} ${r.name} (${r.ms}ms)` + (r.ok ? '' : `\n    ${r.error}`));
});
console.log(`\n${pass}/${total} passed, ${fail} failed, ${Date.now() - t0}ms`);
process.exit(fail ? 1 : 0);
