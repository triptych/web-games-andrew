// VESTA-8 runtime: VESTA SCRIPT, a small Lua-like language.
//
//   on update
//     if btn("left") then x -= 2 end
//   end
//   on hit coin
//     score += 1
//     destroy(other)
//   end
//   function serve()
//     x = 76  vx = 1.2
//   end
//
// lex → parse to an AST → compile to JS closures. Every statement counts against a per-frame
// budget, so an endless loop stops the game with an error instead of freezing the page.
// Bare names: locals first, then `me`, then the object's own properties (x, y, vx, …), then
// shared globals (score, lives, anything else). An unset global or field reads as 0.

export function lang(V) {
    const KW = new Set(['if', 'then', 'elseif', 'else', 'end', 'while', 'do', 'for', 'in', 'on', 'function',
        'return', 'break', 'local', 'and', 'or', 'not', 'true', 'false', 'nil', 'repeat', 'until']);
    const OPS = ['==', '~=', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '..', '+', '-', '*', '/', '%', '<', '>', '=', '(', ')', ',', '.'];
    // Properties every object has, read and written as bare names inside its own scripts.
    V.PROPS = ['x', 'y', 'vx', 'vy', 'spr', 'flipx', 'flipy', 'hp', 'timer', 'onground', 'speed', 'visible',
        'type', 'dead', 'gravity', 'bounce', 'fx', 'fy', 'w', 'h', 'climbing', 'frame'];
    const PROPS = new Set(V.PROPS);
    const READONLY = new Set(['type', 'dead', 'w', 'h', 'onground', 'climbing']);
    V.EVENTS = {
        start: 'when the object appears (or the game starts, in the game script)',
        update: 'every frame, 60 times a second',
        hit: 'when it touches another object; `on hit coin` only for coins. The other one is `other`',
        bump: 'when it runs into a solid tile; tx, ty are the tile cell and tile its sprite',
        enter: 'when its centre moves into a new tile cell; tx, ty, tile',
        hazard: 'every frame it overlaps a tile flagged HAZARD',
        press: '`on press a` when a button is pressed (left, right, up, down, a, b)',
        land: 'when it lands on the ground',
        die: 'just before it is destroyed',
        draw: 'after everything is drawn: text(), rect()… in screen pixels (game script)',
    };
    const BUTTONS = ['left', 'right', 'up', 'down', 'a', 'b'];

    function VErr(msg, line) {
        const e = new Error(msg);
        e.vline = line || 0;
        e.vesta = true;
        return e;
    }
    V.VErr = VErr;

    // ------------------------------------------------------------------ lexer
    function lex(src) {
        const toks = [];
        let i = 0, line = 1;
        const n = src.length;
        while (i < n) {
            const c = src[i];
            if (c === '\n') { line++; i++; continue; }
            if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
            if ((c === '-' && src[i + 1] === '-') || (c === '/' && src[i + 1] === '/')) {
                while (i < n && src[i] !== '\n') i++;
                continue;
            }
            if ((c >= '0' && c <= '9') || (c === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
                let j = i;
                if (c === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
                    j += 2;
                    while (j < n && /[0-9a-fA-F]/.test(src[j])) j++;
                } else {
                    while (j < n && ((src[j] >= '0' && src[j] <= '9') || src[j] === '.')) j++;
                }
                const s = src.slice(i, j);
                const v = Number(s);
                if (!Number.isFinite(v)) throw VErr(`"${s}" is not a number`, line);
                toks.push({ t: 'num', v, line });
                i = j;
                continue;
            }
            if (/[A-Za-z_]/.test(c)) {
                let j = i + 1;
                while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
                const w = src.slice(i, j);
                toks.push({ t: KW.has(w) ? 'kw' : 'name', v: w, line });
                i = j;
                continue;
            }
            if (c === '"' || c === "'") {
                let j = i + 1, s = '';
                while (j < n && src[j] !== c) {
                    if (src[j] === '\n') throw VErr('this text is missing its closing quote', line);
                    if (src[j] === '\\' && j + 1 < n) {
                        const e = src[j + 1];
                        s += e === 'n' ? '\n' : e === 't' ? '  ' : e;
                        j += 2;
                        continue;
                    }
                    s += src[j++];
                }
                if (j >= n) throw VErr('this text is missing its closing quote', line);
                toks.push({ t: 'str', v: s, line });
                i = j + 1;
                continue;
            }
            let op = null;
            for (const o of OPS) if (src.startsWith(o, i)) { op = o; break; }
            if (!op) throw VErr(`unexpected character "${c}"`, line);
            toks.push({ t: 'op', v: op === '!=' ? '~=' : op, line });
            i += op.length;
        }
        toks.push({ t: 'eof', v: '', line });
        return toks;
    }

    // ------------------------------------------------------------------ parser
    function parse(src) {
        const toks = lex(src);
        let p = 0;
        const peek = () => toks[p];
        const next = () => toks[p++];
        const is = (t, v) => toks[p].t === t && (v === undefined || toks[p].v === v);
        const accept = (t, v) => (is(t, v) ? next() : null);
        const desc = (tk) => (tk.t === 'eof' ? 'the end of the script' : tk.t === 'str' ? 'some text' : `"${tk.v}"`);
        const expect = (t, v, what) => {
            if (is(t, v)) return next();
            throw VErr(`expected ${what || `"${v}"`} but found ${desc(peek())}`, peek().line);
        };
        const name = (what) => {
            if (is('name')) return next().v;
            throw VErr(`expected ${what || 'a name'} but found ${desc(peek())}`, peek().line);
        };

        function block(enders) {
            const out = [];
            while (!(peek().t === 'kw' && enders.includes(peek().v)) && peek().t !== 'eof') out.push(statement());
            return out;
        }
        function closeEnd(opener, line) {
            if (accept('kw', 'end')) return;
            throw VErr(`"${opener}" on line ${line} needs an "end"`, peek().line);
        }

        function statement() {
            const tk = peek();
            const line = tk.line;
            if (tk.t === 'kw') {
                switch (tk.v) {
                    case 'local': {
                        next();
                        const nm = name('a variable name');
                        let e = null;
                        if (accept('op', '=')) e = expr();
                        return { k: 'local', name: nm, e, line };
                    }
                    case 'if': {
                        next();
                        const clauses = [];
                        let els = null;
                        const c = expr();
                        expect('kw', 'then', '"then"');
                        clauses.push({ c, b: block(['elseif', 'else', 'end']) });
                        for (;;) {
                            if (accept('kw', 'elseif')) {
                                const c2 = expr();
                                expect('kw', 'then', '"then"');
                                clauses.push({ c: c2, b: block(['elseif', 'else', 'end']) });
                            } else if (accept('kw', 'else')) {
                                els = block(['end']);
                                closeEnd('if', line);
                                break;
                            } else { closeEnd('if', line); break; }
                        }
                        return { k: 'if', clauses, els, line };
                    }
                    case 'while': {
                        next();
                        const c = expr();
                        expect('kw', 'do', '"do"');
                        const b = block(['end']);
                        closeEnd('while', line);
                        return { k: 'while', c, b, line };
                    }
                    case 'repeat': {
                        next();
                        const b = block(['until']);
                        expect('kw', 'until', '"until"');
                        return { k: 'repeat', b, c: expr(), line };
                    }
                    case 'for': {
                        next();
                        const nm = name('a loop variable');
                        if (accept('kw', 'in')) {
                            const e = expr();
                            expect('kw', 'do', '"do"');
                            const b = block(['end']);
                            closeEnd('for', line);
                            return { k: 'forin', name: nm, e, b, line };
                        }
                        expect('op', '=', '"=" or "in"');
                        const a = expr();
                        expect('op', ',', '","');
                        const z = expr();
                        const s = accept('op', ',') ? expr() : null;
                        expect('kw', 'do', '"do"');
                        const b = block(['end']);
                        closeEnd('for', line);
                        return { k: 'fornum', name: nm, a, z, s, b, line };
                    }
                    case 'return': {
                        next();
                        let e = null;
                        const nx = peek();
                        if (nx.line === line && !(nx.t === 'kw' && ['end', 'else', 'elseif', 'until'].includes(nx.v)) && nx.t !== 'eof') e = expr();
                        return { k: 'return', e, line };
                    }
                    case 'break': next(); return { k: 'break', line };
                    case 'function': throw VErr('functions can only be made at the top of a script, not inside another block', line);
                    case 'on': throw VErr('"on" handlers can only be at the top of a script — is an "end" missing above?', line);
                    default: throw VErr(`unexpected "${tk.v}"`, line);
                }
            }
            const target = suffixed();
            const op = peek();
            if (op.t === 'op' && ['=', '+=', '-=', '*=', '/='].includes(op.v)) {
                if (target.k !== 'name' && target.k !== 'field') throw VErr('you can only assign to a variable or a field', line);
                next();
                return { k: 'assign', target, op: op.v, e: expr(), line };
            }
            if (target.k === 'call') return { k: 'call', e: target, line };
            if (target.k === 'name' && op.t === 'name' && op.line === line) throw VErr(`unknown command "${target.name}" — did you mean ${target.name}(…)?`, line);
            throw VErr(`"${srcOf(target)}" does nothing on its own — assign it with = or call a function`, line);
        }
        function srcOf(e) {
            return e.k === 'name' ? e.name : e.k === 'field' ? srcOf(e.o) + '.' + e.name : '…';
        }

        function suffixed() {
            const tk = peek();
            let e;
            if (tk.t === 'name') { next(); e = { k: 'name', name: tk.v, line: tk.line }; }
            else if (accept('op', '(')) { e = expr(); expect('op', ')', '")"'); }
            else throw VErr(`expected a statement but found ${desc(tk)}`, tk.line);
            for (;;) {
                if (accept('op', '.')) {
                    e = { k: 'field', o: e, name: name('a field name after "."'), line: tk.line };
                } else if (is('op', '(') && peek().line === toks[p - 1].line) {
                    if (e.k !== 'name') throw VErr('only named functions can be called', tk.line);
                    next();
                    const args = [];
                    if (!is('op', ')')) {
                        do { args.push(expr()); } while (accept('op', ','));
                    }
                    expect('op', ')', '")"');
                    e = { k: 'call', name: e.name, args, line: tk.line };
                } else break;
            }
            return e;
        }

        const BIN = [
            ['or'], ['and'], ['<', '>', '<=', '>=', '==', '~='], ['..'], ['+', '-'], ['*', '/', '%'],
        ];
        function expr(lvl = 0) {
            if (lvl >= BIN.length) return unary();
            let a = expr(lvl + 1);
            for (;;) {
                const tk = peek();
                if ((tk.t === 'op' || tk.t === 'kw') && BIN[lvl].includes(tk.v)) {
                    next();
                    const b = expr(lvl + 1);
                    a = { k: 'bin', op: tk.v, a, b, line: tk.line };
                } else return a;
            }
        }
        function unary() {
            const tk = peek();
            if (accept('kw', 'not')) return { k: 'un', op: 'not', a: unary(), line: tk.line };
            if (accept('op', '-')) return { k: 'un', op: '-', a: unary(), line: tk.line };
            return primary();
        }
        function primary() {
            const tk = peek();
            if (tk.t === 'num') { next(); return { k: 'lit', v: tk.v }; }
            if (tk.t === 'str') { next(); return { k: 'lit', v: tk.v }; }
            if (tk.t === 'kw') {
                if (tk.v === 'true') { next(); return { k: 'lit', v: true }; }
                if (tk.v === 'false') { next(); return { k: 'lit', v: false }; }
                if (tk.v === 'nil') { next(); return { k: 'lit', v: null }; }
            }
            if (tk.t === 'name' || (tk.t === 'op' && tk.v === '(')) return suffixed();
            throw VErr(`expected a value but found ${desc(tk)}`, tk.line);
        }

        const prog = { handlers: [], functions: [], loose: [] };
        while (!is('eof')) {
            const tk = peek();
            if (accept('kw', 'on')) {
                const ev = name('an event name after "on"');
                if (!(ev in V.EVENTS)) throw VErr(`unknown event "${ev}" — events are: ${Object.keys(V.EVENTS).join(', ')}`, tk.line);
                let arg = null;
                if (is('name') && peek().line === tk.line) arg = next().v;
                if (ev === 'press' && !BUTTONS.includes(arg)) throw VErr('"on press" needs a button: left, right, up, down, a or b', tk.line);
                if (arg && ev !== 'hit' && ev !== 'press') throw VErr(`"on ${ev}" doesn't take a name after it`, tk.line);
                const b = block(['end']);
                closeEnd('on ' + ev, tk.line);
                prog.handlers.push({ ev, arg: arg === 'other' || arg === 'any' ? null : arg, b, line: tk.line });
            } else if (accept('kw', 'function')) {
                const nm = name('a function name');
                if (V.BUILTINS && V.BUILTINS[nm]) throw VErr(`"${nm}" is already a built-in function — pick another name`, tk.line);
                expect('op', '(', '"("');
                const params = [];
                if (!is('op', ')')) {
                    do { params.push(name('a parameter name')); } while (accept('op', ','));
                }
                expect('op', ')', '")"');
                const b = block(['end']);
                closeEnd('function', tk.line);
                prog.functions.push({ name: nm, params, b, line: tk.line });
            } else {
                prog.loose.push(statement());
            }
        }
        return prog;
    }
    V.parse = parse;

    // ------------------------------------------------------------------ compiler
    const truthy = (v) => v !== false && v != null && v !== 0;
    V.truthy = truthy;
    const num = (v, line, what) => {
        if (typeof v === 'number') return v;
        if (v == null || v === false) return 0;
        if (v === true) return 1;
        if (typeof v === 'string' && v !== '' && !isNaN(+v)) return +v;
        throw VErr(`can't do maths with ${typeof v === 'string' ? `the text "${v}"` : 'an object'}${what ? ' in ' + what : ''}`, line);
    };
    const str = (v) => {
        if (v == null) return 'nil';
        if (typeof v === 'number') return String(Math.round(v * 1000) / 1000);
        if (typeof v === 'object') return v.type || 'object';
        return String(v);
    };
    V.str = str;
    const eq = (a, b) => a === b || (a == null && b == null);

    function getField(o, k, line) {
        if (o == null) throw VErr(`can't read .${k} of nil (nothing there)`, line);
        if (typeof o !== 'object') throw VErr(`can't read .${k} of ${str(o)}`, line);
        if (PROPS.has(k)) return o[k];
        const v = o.vars[k];
        return v === undefined ? 0 : v;
    }
    function setField(o, k, v, line) {
        if (o == null) throw VErr(`can't set .${k} of nil (nothing there)`, line);
        if (typeof o !== 'object') throw VErr(`can't set .${k} of ${str(o)}`, line);
        if (READONLY.has(k)) throw VErr(`.${k} can't be changed`, line);
        if (PROPS.has(k)) o[k] = k === 'visible' || k === 'flipx' || k === 'flipy' ? truthy(v) : num(v, line, '.' + k);
        else o.vars[k] = v;
    }

    function tick(F, line) {
        const R = F.R;
        R.line = line;
        if (++R.ops > R.opLimit) throw VErr('the script ran too long this frame — is a loop never ending?', line);
    }

    function makeScope(parent, fn) { return { parent, vars: new Map(), fn }; }
    function lookup(sc, nm) {
        for (let s = sc; s; s = s.parent) if (s.vars.has(nm)) return s.vars.get(nm);
        return -1;
    }
    function declare(sc, nm) {
        const slot = sc.fn.n++;
        sc.vars.set(nm, slot);
        return slot;
    }

    function cExpr(e, sc) {
        switch (e.k) {
            case 'lit': { const v = e.v; return () => v; }
            case 'name': {
                const nm = e.name;
                const slot = lookup(sc, nm);
                if (slot >= 0) return (F) => F.L[slot];
                if (nm === 'me') return (F) => F.me;
                if (PROPS.has(nm)) {
                    return (F) => {
                        if (F.me) return F.me[nm];
                        const v = F.R.globals[nm];
                        return v === undefined ? 0 : v;
                    };
                }
                return (F) => { const v = F.R.globals[nm]; return v === undefined ? 0 : v; };
            }
            case 'field': {
                const o = cExpr(e.o, sc), k = e.name, line = e.line;
                return (F) => getField(o(F), k, line);
            }
            case 'call': {
                const args = e.args.map((a) => cExpr(a, sc));
                const nm = e.name, line = e.line, n = args.length;
                sc.fn.calls.push({ name: nm, line });
                return (F) => {
                    const av = new Array(n);
                    for (let i = 0; i < n; i++) av[i] = args[i](F);
                    return call(F, nm, av, line);
                };
            }
            case 'un': {
                const a = cExpr(e.a, sc), line = e.line;
                if (e.op === 'not') return (F) => !truthy(a(F));
                return (F) => -num(a(F), line);
            }
            case 'bin': {
                const a = cExpr(e.a, sc), b = cExpr(e.b, sc), line = e.line;
                switch (e.op) {
                    case 'and': return (F) => { const x = a(F); return truthy(x) ? b(F) : x; };
                    case 'or': return (F) => { const x = a(F); return truthy(x) ? x : b(F); };
                    case '==': return (F) => eq(a(F), b(F));
                    case '~=': return (F) => !eq(a(F), b(F));
                    case '<': return (F) => cmp(a(F), b(F), line) < 0;
                    case '>': return (F) => cmp(a(F), b(F), line) > 0;
                    case '<=': return (F) => cmp(a(F), b(F), line) <= 0;
                    case '>=': return (F) => cmp(a(F), b(F), line) >= 0;
                    case '..': return (F) => str(a(F)) + str(b(F));
                    case '+': return (F) => {
                        const x = a(F), y = b(F);
                        if (typeof x === 'string' || typeof y === 'string') {
                            if (!(typeof x === 'string' && !isNaN(+x) && x !== '') && !(typeof y === 'string' && !isNaN(+y) && y !== '')) return str(x) + str(y);
                        }
                        return num(x, line) + num(y, line);
                    };
                    case '-': return (F) => num(a(F), line) - num(b(F), line);
                    case '*': return (F) => num(a(F), line) * num(b(F), line);
                    case '/': return (F) => { const y = num(b(F), line); return y === 0 ? 0 : num(a(F), line) / y; };
                    case '%': return (F) => { const y = num(b(F), line); if (y === 0) return 0; const x = num(a(F), line); return x - Math.floor(x / y) * y; };
                }
            }
        }
        throw VErr('internal: unknown expression', e.line);
    }
    function cmp(x, y, line) {
        if (typeof x === 'string' && typeof y === 'string') return x < y ? -1 : x > y ? 1 : 0;
        return num(x, line) - num(y, line);
    }

    function cAssign(s, sc) {
        const rhs = cExpr(s.e, sc), line = s.line, op = s.op;
        const combine = op === '=' ? null
            : op === '+=' ? (o, v) => (typeof o === 'string' || typeof v === 'string' ? str(o) + str(v) : num(o, line) + num(v, line))
            : op === '-=' ? (o, v) => num(o, line) - num(v, line)
            : op === '*=' ? (o, v) => num(o, line) * num(v, line)
            : (o, v) => { const y = num(v, line); return y === 0 ? 0 : num(o, line) / y; };
        const t = s.target;
        if (t.k === 'name') {
            const nm = t.name;
            const slot = lookup(sc, nm);
            if (slot >= 0) return (F) => { tick(F, line); const v = rhs(F); F.L[slot] = combine ? combine(F.L[slot], v) : v; };
            if (nm === 'me') throw VErr('"me" can\'t be changed', line);
            if (PROPS.has(nm)) {
                return (F) => {
                    tick(F, line);
                    const v = rhs(F);
                    if (F.me) {
                        const old = F.me[nm];
                        setField(F.me, nm, combine ? combine(old, v) : v, line);
                    } else {
                        const g = F.R.globals, old = g[nm] === undefined ? 0 : g[nm];
                        g[nm] = combine ? combine(old, v) : v;
                    }
                };
            }
            return (F) => {
                tick(F, line);
                const g = F.R.globals, v = rhs(F);
                g[nm] = combine ? combine(g[nm] === undefined ? 0 : g[nm], v) : v;
            };
        }
        const o = cExpr(t.o, sc), k = t.name;
        return (F) => {
            tick(F, line);
            const obj = o(F), v = rhs(F);
            setField(obj, k, combine ? combine(getField(obj, k, line), v) : v, line);
        };
    }

    // statement results: 0 carry on, 1 break, 2 return (value in F.rv)
    function cStmt(s, sc) {
        const line = s.line;
        switch (s.k) {
            case 'local': {
                const e = s.e ? cExpr(s.e, sc) : null;
                const slot = declare(sc, s.name);
                return (F) => { tick(F, line); F.L[slot] = e ? e(F) : null; return 0; };
            }
            case 'assign': { const f = cAssign(s, sc); return (F) => { f(F); return 0; }; }
            case 'call': { const f = cExpr(s.e, sc); return (F) => { tick(F, line); f(F); return 0; }; }
            case 'if': {
                const cl = s.clauses.map((c) => ({ c: cExpr(c.c, sc), b: cBlock(c.b, makeScope(sc, sc.fn)) }));
                const els = s.els ? cBlock(s.els, makeScope(sc, sc.fn)) : null;
                return (F) => {
                    tick(F, line);
                    for (let i = 0; i < cl.length; i++) if (truthy(cl[i].c(F))) return cl[i].b(F);
                    return els ? els(F) : 0;
                };
            }
            case 'while': {
                const c = cExpr(s.c, sc), b = cBlock(s.b, makeScope(sc, sc.fn));
                return (F) => {
                    for (;;) {
                        tick(F, line);
                        if (!truthy(c(F))) return 0;
                        const r = b(F);
                        if (r === 1) return 0;
                        if (r === 2) return 2;
                    }
                };
            }
            case 'repeat': {
                const inner = makeScope(sc, sc.fn);
                const b = cBlock(s.b, inner), c = cExpr(s.c, inner);
                return (F) => {
                    for (;;) {
                        tick(F, line);
                        const r = b(F);
                        if (r === 1) return 0;
                        if (r === 2) return 2;
                        if (truthy(c(F))) return 0;
                    }
                };
            }
            case 'fornum': {
                const a = cExpr(s.a, sc), z = cExpr(s.z, sc), st = s.s ? cExpr(s.s, sc) : null;
                const inner = makeScope(sc, sc.fn);
                const slot = declare(inner, s.name);
                const b = cBlock(s.b, inner);
                return (F) => {
                    tick(F, line);
                    const from = num(a(F), line), to = num(z(F), line), step = st ? num(st(F), line) : 1;
                    if (step === 0) throw VErr('a for loop can\'t count in steps of 0', line);
                    for (let i = from; step > 0 ? i <= to : i >= to; i += step) {
                        tick(F, line);
                        F.L[slot] = i;
                        const r = b(F);
                        if (r === 1) break;
                        if (r === 2) return 2;
                    }
                    return 0;
                };
            }
            case 'forin': {
                const e = cExpr(s.e, sc);
                const inner = makeScope(sc, sc.fn);
                const slot = declare(inner, s.name);
                const b = cBlock(s.b, inner);
                return (F) => {
                    tick(F, line);
                    const list = e(F);
                    if (!Array.isArray(list)) throw VErr('"for … in" needs a list, like all("enemy")', line);
                    for (let i = 0; i < list.length; i++) {
                        const it = list[i];
                        if (it && it.dead === true) continue;
                        tick(F, line);
                        F.L[slot] = it;
                        const r = b(F);
                        if (r === 1) break;
                        if (r === 2) return 2;
                    }
                    return 0;
                };
            }
            case 'return': {
                const e = s.e ? cExpr(s.e, sc) : null;
                return (F) => { tick(F, line); F.rv = e ? e(F) : null; return 2; };
            }
            case 'break': return (F) => { tick(F, line); return 1; };
        }
        throw VErr('internal: unknown statement', line);
    }
    function cBlock(stmts, sc) {
        const fs = stmts.map((s) => cStmt(s, sc));
        const n = fs.length;
        return (F) => {
            for (let i = 0; i < n; i++) { const r = fs[i](F); if (r) return r; }
            return 0;
        };
    }

    function call(F, nm, args, line) {
        const R = F.R;
        const uf = R.fns[nm];
        if (uf) {
            if (++R.depth > 60) throw VErr(`${nm}() called itself too many times`, line);
            const F2 = { R, me: F.me, L: new Array(uf.n), rv: null };
            for (let i = 0; i < uf.params; i++) F2.L[i] = args[i] === undefined ? null : args[i];
            try { uf.body(F2); } finally { R.depth--; }
            return F2.rv;
        }
        const b = V.BUILTINS[nm];
        if (!b) throw VErr(`there is no function called ${nm}()`, line);
        R.line = line;
        return b(F, ...args);
    }

    /** Compile a script. Returns { handlers, functions, calls, error }: error is { line, msg } or null. */
    V.compile = (src) => {
        const out = { handlers: {}, functions: {}, calls: [], error: null };
        let prog;
        try { prog = parse(src || ''); } catch (err) {
            if (!err.vesta) throw err;
            out.error = { line: err.vline, msg: err.message };
            return out;
        }
        try {
            const mk = (params, body, binds) => {
                const fn = { n: 0, calls: out.calls };
                const sc = makeScope(null, fn);
                for (const p of params) declare(sc, p);
                for (const b of binds || []) declare(sc, b);
                const blk = cBlock(body, sc);
                return { n: () => fn.n, blk, params: params.length };
            };
            if (prog.loose.length) {
                const h = mk([], prog.loose);
                out.handlers.init = { fn: h.blk, n: h.n() };
            }
            for (const h of prog.handlers) {
                const binds = h.ev === 'hit' ? ['other'] : h.ev === 'bump' || h.ev === 'enter' ? ['tx', 'ty', 'tile'] : [];
                const c = mk([], h.b, binds);
                const entry = { fn: c.blk, n: c.n(), arg: h.arg, line: h.line };
                if (h.ev === 'hit' || h.ev === 'press') (out.handlers[h.ev] = out.handlers[h.ev] || []).push(entry);
                else {
                    if (out.handlers[h.ev]) throw VErr(`there are two "on ${h.ev}" handlers — merge them into one`, h.line);
                    out.handlers[h.ev] = entry;
                }
            }
            for (const f of prog.functions) {
                if (out.functions[f.name]) throw VErr(`there are two functions called ${f.name}`, f.line);
                const c = mk(f.params, f.b);
                out.functions[f.name] = { body: c.blk, n: c.n(), params: c.params, line: f.line };
            }
        } catch (err) {
            if (!err.vesta) throw err;
            out.error = { line: err.vline, msg: err.message };
        }
        return out;
    };

    /** Run a compiled handler for an object (me may be null for the game script). */
    V.runHandler = (R, h, me, binds) => {
        const F = { R, me, L: new Array(h.n), rv: null };
        if (binds) for (let i = 0; i < binds.length; i++) F.L[i] = binds[i];
        R.depth = 0;
        h.fn(F);
        return F.rv;
    };
    V.callFn = call;
    V.getField = getField;
    V.setField = setField;
    V.num = num;
}
