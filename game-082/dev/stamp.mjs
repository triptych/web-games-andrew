/**
 * stamp.mjs — write the version into index.html's import map, so every module loads as
 * file.js?v=VERSION. After an update a phone can't mix an old file with a new one (game-080).
 *
 *   node game-082/dev/stamp.mjs          # rewrite index.html
 *   node game-082/dev/stamp.mjs --check  # exit 1 if it is out of date (simtest runs this)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { VERSION } = await import('../js/config.js');
const files = [];
const walk = (dir) => {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) {
        const rel = `${dir}/${f}`;
        if (fs.statSync(path.join(ROOT, rel)).isDirectory()) walk(rel);
        else if (f.endsWith('.js')) files.push(rel);
    }
};
walk('js');
const lines = [
    '        "three": "https://unpkg.com/three@0.165.0/build/three.module.js",',
    '        "three/addons/": "https://unpkg.com/three@0.165.0/examples/jsm/",',
    ...files.map((f, i) => `        "./${f}": "./${f}?v=${VERSION}"${i < files.length - 1 ? ',' : ''}`),
];
const map = `<script type="importmap">\n    { "imports": {\n${lines.join('\n')}\n    } }\n    </script>`;
const htmlPath = path.join(ROOT, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const next = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, map);
if (process.argv.includes('--check')) {
    if (next !== html) { console.log('index.html import map is out of date: run node game-082/dev/stamp.mjs'); process.exit(1); }
    console.log(`import map stamped v${VERSION}, ${files.length} modules`);
} else {
    fs.writeFileSync(htmlPath, next);
    console.log(`stamped v${VERSION} on ${files.length} modules`);
}
