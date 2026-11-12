// list.mjs — write js/model-files.js: the models in assets/models/. The game only requests these, so a look
// whose model has not been made yet keeps its code-built shape instead of logging a 404.
//   node game-131/dev/assets/list.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const names = fs.readdirSync(path.join(HERE, '../../assets/models')).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)).sort();
fs.writeFileSync(path.join(HERE, '../../js/model-files.js'),
    `// Written by dev/assets/list.mjs: every model in assets/models/ (without .glb). The game only requests these.\nexport const MODEL_FILES = new Set(${JSON.stringify(names)});\n`);
console.log(names.length, 'models listed');
