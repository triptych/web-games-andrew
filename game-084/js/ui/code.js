// CODE: the VESTA SCRIPT editor. One script for the game and one per object type. A textarea
// over a highlighted copy of itself, line numbers, the compiler's verdict as you type, and a bar
// of snippets you can tap instead of typing (phones!).

import { V } from '../runtime/index.js';
import { el } from './dom.js';

const KW = new Set(['if', 'then', 'elseif', 'else', 'end', 'while', 'do', 'for', 'in', 'on', 'function', 'return', 'break', 'local', 'and', 'or', 'not', 'true', 'false', 'nil', 'repeat', 'until']);
const PROPS = new Set(V.PROPS.concat(['me', 'other', 'tx', 'ty', 'tile']));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function highlight(src) {
    const re = /(--[^\n]*|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(\b\d+(?:\.\d+)?\b|\b0x[0-9a-fA-F]+\b)|([A-Za-z_][A-Za-z0-9_]*)/g;
    let out = '', last = 0, m, prevOn = false;
    while ((m = re.exec(src))) {
        out += esc(src.slice(last, m.index));
        last = re.lastIndex;
        const [t, com, str, num, word] = m;
        if (com) out += `<span class="tk-com">${esc(com)}</span>`;
        else if (str) out += `<span class="tk-str">${esc(str)}</span>`;
        else if (num) out += `<span class="tk-num">${num}</span>`;
        else if (word) {
            if (prevOn && word in V.EVENTS) out += `<span class="tk-ev">${word}</span>`;
            else if (KW.has(word)) out += `<span class="tk-kw">${word}</span>`;
            else if (V.BUILTINS[word] && src[last] === '(') out += `<span class="tk-fn">${word}</span>`;
            else if (PROPS.has(word)) out += `<span class="tk-prop">${word}</span>`;
            else out += word;
            prevOn = word === 'on';
            continue;
        } else out += esc(t);
        prevOn = false;
    }
    return out + esc(src.slice(last)) + '\n';
}

const SNIPPETS = [
    ['on start', 'on start\n  \nend\n'],
    ['on update', 'on update\n  \nend\n'],
    ['on hit …', 'on hit coin\n  destroy(other)\n  score += 1\nend\n'],
    ['on press a', 'on press a\n  \nend\n'],
    ['on bump', 'on bump\n  \nend\n'],
    ['on enter', 'on enter\n  if tile == 2 then\n    \n  end\nend\n'],
    ['on draw', 'on draw\n  text("SCORE " .. score, 2, 2, 3)\nend\n'],
    ['if', 'if  then\n  \nend\n'],
    ['for … all', 'for e in all("enemy") do\n  \nend\n'],
    ['function', 'function name()\n  \nend\n'],
    ['spawn', 'spawn("bullet", x, y)'],
    ['destroy', 'destroy(other)'],
    ['btn', 'btn("left")'],
    ['sfx', 'sfx(0)'],
    ['win', 'win()'],
    ['lose', 'lose()'],
    ['say', 'say("Hello!")'],
    ['score += 1', 'score += 1'],
    ['rnd', 'rnd(10)'],
];

export class CodeEditor {
    constructor(bench) { this.b = bench; this.which = 'game'; }
    get cart() { return this.b.cart; }
    src() { return this.which === 'game' ? this.cart.script : (this.cart.types.find((t) => t.name === this.which) || {}).script || ''; }
    setSrc(s) {
        if (this.which === 'game') this.cart.script = s;
        else { const T = this.cart.types.find((t) => t.name === this.which); if (T) T.script = s; }
    }

    mount(root) {
        this.root = root;
        root.innerHTML = '';
        if (this.which !== 'game' && !this.cart.types.find((t) => t.name === this.which)) this.which = 'game';
        this.sel = el('select', { 'aria-label': 'Which script', onchange: (e) => { this.which = e.target.value; this.load(); } });
        this.gutter = el('div', { class: 'code-gutter' });
        this.pre = el('pre', { 'aria-hidden': 'true' });
        this.ta = el('textarea', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', 'aria-label': 'Script' });
        this.status = el('div', { class: 'code-status' });
        this.console = el('div', { class: 'console', hidden: true });
        const snips = el('div', { class: 'snips' }, SNIPPETS.map(([label, text]) => el('button', { onclick: () => this.insert(text) }, label)));
        root.append(el('div', { class: 'ed', style: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch' } }, [
            el('div', { class: 'row', style: { minHeight: '40px' } }, [el('label', { class: 'hint' }, ['Script ', this.sel]), el('button', { class: 'btn small ghost', onclick: () => this.b.openCodex('script') }, '? Reference')]),
            snips,
            el('div', { class: 'code-wrap' }, [this.gutter, el('div', { class: 'code-area' }, [this.pre, this.ta])]),
            this.status, this.console,
        ]));
        this.ta.addEventListener('input', () => { this.b.snapshot(true); this.setSrc(this.ta.value); this.paint(); this.b.changed('code'); clearTimeout(this.ct); this.ct = setTimeout(() => this.check(), 250); });
        this.ta.addEventListener('scroll', () => { this.pre.scrollTop = this.ta.scrollTop; this.pre.scrollLeft = this.ta.scrollLeft; this.gutter.scrollTop = this.ta.scrollTop; });
        this.ta.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') { e.preventDefault(); this.insert('  ', true); }
            else if (e.key === 'Enter') {
                // keep the indent, and indent one more after a line that opens a block
                const v = this.ta.value, p = this.ta.selectionStart;
                const line = v.slice(v.lastIndexOf('\n', p - 1) + 1, p);
                let ind = line.match(/^\s*/)[0];
                if (/^\s*(on\b|function\b|if\b.*\bthen\s*$|elseif\b|else\s*$|for\b.*\bdo\s*$|while\b.*\bdo\s*$|repeat\s*$)/.test(line)) ind += '  ';
                e.preventDefault();
                this.insert('\n' + ind, true);
            }
        });
        this.refresh();
    }
    refresh() {
        this.sel.innerHTML = '';
        this.sel.append(el('option', { value: 'game', selected: this.which === 'game' }, 'GAME (the whole cart)'));
        for (const T of this.cart.types) this.sel.append(el('option', { value: T.name, selected: this.which === T.name }, 'object: ' + T.name));
        this.load();
    }
    show(which) { this.which = which; if (this.sel) this.refresh(); }
    load() {
        this.ta.value = this.src();
        this.paint();
        this.check();
        this.ta.scrollTop = 0;
    }
    insert(text, raw) {
        const ta = this.ta, s = ta.selectionStart, e = ta.selectionEnd;
        let t = text;
        if (!raw && text.includes('\n')) {
            // a block snippet goes on its own line, with the line's indent
            const v = ta.value, ls = v.lastIndexOf('\n', s - 1) + 1, ind = v.slice(ls, s).match(/^\s*/)[0];
            t = (v.slice(ls, s).trim() ? '\n' + ind : '') + text.replace(/\n(?=.)/g, '\n' + ind);
        }
        ta.focus();
        ta.setRangeText(t, s, e, 'end');
        // put the caret on the blank line inside a block snippet
        const blank = t.indexOf('\n  \n');
        if (!raw && blank >= 0) { const p = s + blank + 3; ta.setSelectionRange(p, p); }
        ta.dispatchEvent(new Event('input'));
    }
    paint() {
        this.pre.innerHTML = highlight(this.ta.value);
        const n = this.ta.value.split('\n').length;
        let g = '';
        for (let i = 1; i <= n; i++) g += (i === this.errLine ? `<span class="err">${i}</span>` : i) + '\n';
        this.gutter.innerHTML = g;
    }
    check() {
        const src = this.ta.value;
        const c = V.compile(src);
        let err = c.error;
        if (!err) {
            // a call to a function that exists nowhere: the same check the console makes before it runs
            const P = V.prepare(this.cart);
            const mine = P.errors.find((e) => e.where === this.which);
            if (mine) err = { line: mine.line, msg: mine.msg };
        }
        this.errLine = err ? err.line : 0;
        const handlers = Object.keys(c.handlers).filter((k) => k !== 'init');
        this.status.innerHTML = '';
        if (err) this.status.append(el('span', { class: 'warn' }, `✖ line ${err.line}: ${err.msg}`));
        else this.status.append(el('span', { class: 'ok' }, '✔ VESTA understands this. '), el('span', { class: 'hint' }, handlers.length ? 'Handlers: ' + handlers.map((h) => 'on ' + h).join(', ') + (Object.keys(c.functions).length ? ' · functions: ' + Object.keys(c.functions).join(', ') : '') : 'No handlers yet: try a snippet above.'));
        this.paint();
    }
    setLog(lines) {
        if (!this.console) return;
        this.console.hidden = !lines.length;
        this.console.textContent = lines.join('\n');
    }
}
