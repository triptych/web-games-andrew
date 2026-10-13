// Export: a standalone game (one HTML file: runtime + project), the runtime
// player on its own, and the project file. The runtime's source comes from the
// registered module functions themselves (fn.toString()), so an export runs
// exactly the code the editor just playtested, with no fetch and no bundler.
import { h, modal, toast, download, slug } from './ui.js';
import { store } from './store.js';
import { bus } from './bus.js';
import { meta } from '../meta/progress.js';

const SCRIPT_END = '<' + '/script>';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** JSON that is safe inside a script element. */
const safeJSON = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(new RegExp('\\u2028', 'g'), '\\u2028').replace(new RegExp('\\u2029', 'g'), '\\u2029');

export function runtimeSource() {
    const mods = window.TW_MODULES || [];
    const parts = ['window.TW_MODULES = [];'];
    for (const [name, fn] of mods) {
        const src = fn.toString();
        if (/<\/script/i.test(src)) throw new Error('Runtime module ' + name + ' contains a closing script tag.');
        parts.push('TW_MODULES.push([' + JSON.stringify(name) + ', ' + src + ']);');
    }
    return parts.join('\n');
}

function page(title, body, boot) {
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#000000">\n<meta name="generator" content="TALEWRIGHT ' + esc(store.TW.version) + '">\n<title>' + esc(title) + '</title>\n<style>html,body{margin:0;height:100%;background:#000}</style>\n</head>\n<body>\n' +
        '<script>\n' + runtimeSource() + '\n' + SCRIPT_END + '\n' + (body || '') + '<script>\n' + boot + '\n' + SCRIPT_END + '\n</body>\n</html>\n';
}

/** One HTML file that plays the project. */
export function buildStandalone(project) {
    const p = store.TW.schema.validate(JSON.parse(JSON.stringify(project)));
    const data = '<script>\nwindow.TW_GAME = ' + safeJSON(p) + ';\n' + SCRIPT_END + '\n';
    const boot = '(function () { var TW = {}; TW_MODULES.forEach(function (m) { m[1](TW); }); window.TW = TW; TW.boot(document.body, window.TW_GAME); })();';
    return page(p.system.title || 'A TALEWRIGHT game', data, boot);
}

/** The runtime player: opens any .talewright.json. */
export function buildPlayer() {
    const boot = '(function () { var TW = {}; TW_MODULES.forEach(function (m) { m[1](TW); }); window.TW = TW; TW.player(document.body); })();';
    return page('TALEWRIGHT Player', '', boot);
}

export function projectJSON(project) { return JSON.stringify(project, null, 1); }

export function downloadProject() {
    const p = store.project;
    download(slug(p.system.title) + '.talewright.json', projectJSON(p), 'application/json');
    bus.emit('edit', { kind: 'download' });
    toast('Project downloaded.', 'ok', { icon: '💾' });
}

export function openExport() {
    if (!meta.has('export')) { toast('Export: ' + meta.why('export'), 'warn'); return; }
    const p = store.project;
    const card = (icon, title, text, label, fn) => h('div.expcard', h('div.expicon', { text: icon }), h('div.grow', h('h3', { text: title }), h('p', { text })), h('button.primary', { text: label, on: { click: fn } }));
    const name = slug(p.system.title);
    const body = h('div.export',
        h('p', { text: 'Bind your tale into a book. Everything is generated in code, so exports are small and need nothing else: no server, no network, no image files.' }),
        card('📕', 'Standalone game', 'One .html file with the engine and your game inside. Double-click it to play, put it on any web host, or upload it to itch.io as an HTML game.', 'Download ' + name + '.html', () => {
            try {
                const html = buildStandalone(p);
                download(name + '.html', html, 'text/html');
                bus.emit('edit', { kind: 'export', what: 'html', size: html.length });
                toast('Exported ' + Math.round(html.length / 1024) + ' KB.', 'ok', { icon: '📕', title: 'Your game is a book' });
            } catch (e) { toast('Export failed: ' + e.message, 'err'); }
        }),
        card('📗', 'Runtime player', 'The TALEWRIGHT engine on its own. Open it and choose any .talewright.json, or host it and link to player.html?game=my-tale.talewright.json.', 'Download talewright-player.html', () => {
            const html = buildPlayer();
            download('talewright-player.html', html, 'text/html');
            bus.emit('edit', { kind: 'export', what: 'player', size: html.length });
            toast('Runtime player exported.', 'ok', { icon: '📗' });
        }),
        card('💾', 'Project file', 'Your project as data, to back up, share, or open in the runtime player. Import it again from Project ▸ Import.', 'Download ' + name + '.talewright.json', () => downloadProject()));
    modal({ title: 'Export', wide: true, body, buttons: [{ label: 'Close' }] });
}
