/**
 * fake-dom.mjs — just enough DOM for the HUD, comms portraits and menus to run
 * in Node, plus a strict Canvas2D context (the same trick game-039 used): it
 * throws on non-finite coordinates and on drawing with an undefined fill, so a
 * portrait or a text texture that would have silently rendered nothing fails
 * the test instead.
 */

export const canvasOps = { calls: 0, byOp: {} };

class FakeClassList {
    constructor() { this.set = new Set(); }
    add(...c) { c.forEach((x) => this.set.add(x)); }
    remove(...c) { c.forEach((x) => this.set.delete(x)); }
    toggle(c, force) {
        const want = force === undefined ? !this.set.has(c) : !!force;
        if (want) this.set.add(c); else this.set.delete(c);
        return want;
    }
    contains(c) { return this.set.has(c); }
    get value() { return [...this.set].join(' '); }
}

class FakeElement {
    constructor(tag = 'div', id = '') {
        this.tagName = tag.toUpperCase();
        this.id = id;
        this.children = [];
        this.style = new Proxy({}, { set: (t, k, v) => { t[k] = v; return true; } });
        this.dataset = {};
        this.classList = new FakeClassList();
        this._text = '';
        this._html = '';
        this.listeners = {};
        this.disabled = false;
        this.title = '';
    }
    set className(v) { this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get className() { return this.classList.value; }
    set textContent(v) { this._text = String(v); }
    get textContent() { return this._text; }
    set innerHTML(v) { this._html = String(v); this.children = []; }
    get innerHTML() { return this._html; }
    appendChild(child) { this.children.push(child); return child; }
    removeChild(child) { this.children = this.children.filter((c) => c !== child); }
    addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
    removeEventListener() {}
    dispatch(name, ev = {}) { for (const fn of this.listeners[name] ?? []) fn(ev); }
    querySelector(sel) { return this._query(sel)[0] ?? null; }
    querySelectorAll(sel) { return this._query(sel); }
    _query(sel) {
        // Only the couple of shapes the UI actually uses.
        const out = [];
        const walk = (node) => {
            for (const c of node.children) {
                if (sel.startsWith('.') && c.classList.contains(sel.slice(1))) out.push(c);
                else if (sel.startsWith('[data-action') && c.dataset.action) out.push(c);
                walk(c);
            }
        };
        walk(this);
        return out;
    }
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
    getContext(kind) { return kind === '2d' ? makeCtx() : {}; }
    focus() {}
    click() { this.dispatch('click', {}); }
}

function num(...vals) {
    for (const v of vals) {
        if (typeof v === 'number' && !Number.isFinite(v)) {
            throw new Error(`[fake-canvas] non-finite coordinate: ${v}`);
        }
    }
}

function makeCtx() {
    const ctx = {
        canvas: { width: 512, height: 256 },
        fillStyle: '#000', strokeStyle: '#000', shadowColor: '', shadowBlur: 0,
        globalAlpha: 1, lineWidth: 1, font: '10px monospace',
        textAlign: 'left', textBaseline: 'alphabetic',
    };
    const op = (name, check = () => {}) => (...args) => {
        canvasOps.calls++;
        canvasOps.byOp[name] = (canvasOps.byOp[name] ?? 0) + 1;
        num(...args.filter((a) => typeof a === 'number'));
        check(...args);
        return undefined;
    };
    const needsFill = () => {
        if (ctx.fillStyle === undefined || ctx.fillStyle === null) {
            throw new Error('[fake-canvas] fill with an undefined fillStyle');
        }
    };
    Object.assign(ctx, {
        clearRect: op('clearRect'),
        fillRect: op('fillRect', needsFill),
        strokeRect: op('strokeRect'),
        fillText: op('fillText', needsFill),
        strokeText: op('strokeText'),
        beginPath: op('beginPath'),
        closePath: op('closePath'),
        moveTo: op('moveTo'),
        lineTo: op('lineTo'),
        arc: op('arc'),
        ellipse: op('ellipse'),
        rect: op('rect'),
        fill: op('fill', needsFill),
        stroke: op('stroke'),
        save: op('save'),
        restore: op('restore'),
        translate: op('translate'),
        rotate: op('rotate'),
        scale: op('scale'),
        drawImage: op('drawImage'),
        measureText: (t) => ({ width: String(t).length * 8 }),
        createRadialGradient: (...a) => {
            num(...a);
            return { addColorStop: (stop, color) => {
                if (color === undefined) throw new Error('[fake-canvas] gradient stop with undefined colour');
            } };
        },
        createLinearGradient: (...a) => {
            num(...a);
            return { addColorStop: () => {} };
        },
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        putImageData: op('putImageData'),
    });
    return ctx;
}

const elements = new Map();

export function installFakeDom({ width = 1280, height = 720, ids = [] } = {}) {
    const document = {
        readyState: 'complete',
        hidden: false,
        body: new FakeElement('body'),
        documentElement: new FakeElement('html'),
        createElement: (tag) => new FakeElement(tag),
        getElementById: (id) => {
            if (!elements.has(id)) elements.set(id, new FakeElement('div', id));
            return elements.get(id);
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
    };
    for (const id of ids) document.getElementById(id);

    const listeners = {};
    const window = {
        innerWidth: width,
        innerHeight: height,
        devicePixelRatio: 1,
        addEventListener: (n, fn) => { (listeners[n] ??= []).push(fn); },
        removeEventListener: () => {},
        dispatch: (n, ev = {}) => { for (const fn of listeners[n] ?? []) fn(ev); },
        requestAnimationFrame: (fn) => setTimeout(() => fn(performance.now()), 0),
        localStorage: makeStorage(),
        matchMedia: () => ({ matches: false, addEventListener() {} }),
    };

    globalThis.window = window;
    globalThis.document = document;
    globalThis.localStorage = window.localStorage;
    globalThis.requestAnimationFrame = window.requestAnimationFrame;
    globalThis.devicePixelRatio = 1;
    globalThis.navigator ??= { userAgent: 'node' };
    return { window, document, elements };
}

function makeStorage() {
    const map = new Map();
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: (k) => map.delete(k),
        clear: () => map.clear(),
    };
}

export function resizeWindow(w, h) {
    globalThis.window.innerWidth = w;
    globalThis.window.innerHeight = h;
    globalThis.window.dispatch('resize', {});
}

export function getElement(id) { return elements.get(id); }
export function resetCanvasOps() { canvasOps.calls = 0; canvasOps.byOp = {}; }
