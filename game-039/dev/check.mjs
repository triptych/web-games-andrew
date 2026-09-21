// Dev-only wiring check: verifies every relative import resolves and every
// named import actually exists as an export in the target module.
import fs from 'fs';
import path from 'path';

const files = [];
(function walk(d) {
    for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (f.endsWith('.js')) files.push(p);
    }
})('../js');

function exportedNames(src) {
    const names = new Set();
    const decl = /export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
    let m;
    while ((m = decl.exec(src))) names.add(m[1]);
    const list = /export\s*\{([^}]*)\}/g;
    while ((m = list.exec(src))) {
        for (let n of m[1].split(',')) {
            n = n.trim();
            if (!n) continue;
            const parts = n.split(/\s+as\s+/);
            names.add((parts[1] || parts[0]).trim());
        }
    }
    if (/export\s+default/.test(src)) names.add('default');
    return names;
}

let issues = 0;
for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const re = /import\s+([\s\S]*?)\s+from\s+['"](\.[^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src))) {
        const clause = m[1];
        const target = path.resolve(path.dirname(f), m[2]);
        if (!fs.existsSync(target)) {
            console.log('MISSING FILE', f, '->', m[2]);
            issues++;
            continue;
        }
        const have = exportedNames(fs.readFileSync(target, 'utf8'));
        const braces = clause.match(/\{([\s\S]*)\}/);
        if (!braces) continue;               // namespace or default import
        for (let n of braces[1].split(',')) {
            n = n.trim().split(/\s+as\s+/)[0].trim();
            if (!n) continue;
            if (!have.has(n)) {
                console.log('NO EXPORT:', n, 'from', m[2], '(imported by ' + f + ')');
                issues++;
            }
        }
    }
}
console.log(issues ? 'issues: ' + issues : 'OK: all imports and named exports resolve');
