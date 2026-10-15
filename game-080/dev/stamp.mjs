/**
 * stamp.mjs — stamp the release version onto every module and the stylesheet in index.html.
 *
 *   node game-080/dev/stamp.mjs          # rewrite index.html for the VERSION in js/config.js
 *
 * A browser keeps each file it fetched for a while (GitHub Pages says ten minutes). Right after
 * an update a phone can hold the old js/sim/game.js and fetch the new js/main.js; the modules
 * then fail to link, nothing runs, and the title screen sits there with dead buttons. The
 * import map in index.html sends every module to `file.js?v=VERSION`, so a new release is a
 * new set of URLs and always arrives whole. simtest checks the map is current: run this after
 * bumping VERSION or adding a module.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(HERE, '..');

export function modules(dir = path.join(ROOT, 'js')) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
        const p = path.join(dir, d.name);
        return d.isDirectory() ? modules(p) : d.name.endsWith('.js') ? [path.relative(ROOT, p).split(path.sep).join('/')] : [];
    }).sort();
}

export function version() {
    return fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8').match(/VERSION = '([^']+)'/)[1];
}

/** index.html as it should be for this version and these modules. */
export function stamped(html, v = version(), files = modules()) {
    const map = `    <script type="importmap">\n    { "imports": {\n${files.map((f) => `        "./${f}": "./${f}?v=${v}"`).join(',\n')}\n    } }\n    </script>`;
    return html
        .replace(/ {4}<script type="importmap">[\s\S]*?<\/script>/, map)
        .replace(/href="style\.css(\?v=[^"]*)?"/, `href="style.css?v=${v}"`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const file = path.join(ROOT, 'index.html');
    const html = fs.readFileSync(file, 'utf8');
    const out = stamped(html);
    fs.writeFileSync(file, out);
    console.log(out === html ? 'index.html already stamped' : `stamped index.html: ${modules().length} modules at v${version()}`);
}
