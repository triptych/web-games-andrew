// Dev-only render smoke test. Implements a strict fake Canvas2D context that
// throws on unknown methods, NaN coordinates, or undefined fill styles, then
// drives the real render path for many frames across every screen. This catches
// the class of bug the headless physics sim cannot: bad draw calls.

let opCount = 0;
const seenFills = new Set();

function makeCtx(label) {
    const known = new Set([
        'fillRect', 'clearRect', 'drawImage', 'save', 'restore', 'translate',
        'beginPath', 'arc', 'fill', 'setTransform', 'stroke', 'moveTo', 'lineTo',
        'closePath', 'scale', 'rotate', 'strokeRect', 'createLinearGradient'
    ]);
    const ctx = {
        canvas: { width: 160, height: 192 },
        fillStyle: '#000',
        strokeStyle: '#000',
        globalCompositeOperation: 'source-over',
        globalAlpha: 1,
        imageSmoothingEnabled: false,
        lineWidth: 1
    };
    return new Proxy(ctx, {
        get(t, prop) {
            if (prop in t) return t[prop];
            if (typeof prop !== 'string') return undefined;
            if (!known.has(prop)) {
                throw new Error(`[${label}] unknown canvas method: ${prop}`);
            }
            return (...args) => {
                opCount++;
                for (const a of args) {
                    if (typeof a === 'number' && !Number.isFinite(a)) {
                        throw new Error(`[${label}] ${prop} got non-finite arg: ${args.join(',')}`);
                    }
                }
                if (prop === 'fillRect') {
                    if (t.fillStyle === undefined || t.fillStyle === 'undefined') {
                        throw new Error(`[${label}] fillRect with undefined fillStyle`);
                    }
                    seenFills.add(String(t.fillStyle));
                }
                if (prop === 'drawImage' && (args[0] === undefined || args[0] === null)) {
                    throw new Error(`[${label}] drawImage with no image (args: ${args.length})\n` +
                        new Error().stack.split('\n').slice(2, 6).join('\n'));
                }
            };
        },
        set(t, prop, v) {
            if ((prop === 'fillStyle' || prop === 'strokeStyle') &&
                (v === undefined || v === null || v === 'undefined')) {
                throw new Error(`[${label}] ${String(prop)} set to ${v}`);
            }
            t[prop] = v;
            return true;
        }
    });
}

// A real browser dispatches an event to every registered listener; the game
// registers two keydown listeners (game input and menu input), so the fake DOM
// must fan out to all of them or the test exercises only half the code.
const listeners = {};
function addTo(key, fn) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(fn);
}
function fire(key, ev) {
    for (const fn of listeners[key] || []) fn(ev);
}
globalThis.document = {
    // Offscreen canvases must be distinguishable objects, because the renderer
    // bakes sprites into them and later passes them to drawImage; returning a
    // bare {} would make every drawImage look like a real failure.
    createElement: (tag) => {
        const el = {
            nodeName: String(tag || 'canvas').toUpperCase(),
            width: 0, height: 0,
            isCanvas: true
        };
        el.getContext = () => makeCtx('offscreen');
        return el;
    },
    getElementById: () => ({
        width: 320, height: 192,
        style: { width: '640px', height: '384px' },
        getContext: () => makeCtx('visible'),
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 384 }),
        addEventListener: (n, f) => addTo('canvas:' + n, f)
    }),
    addEventListener: (n, f) => addTo('doc:' + n, f),
    hidden: false
};
globalThis.window = {
    addEventListener: (n, f) => addTo('win:' + n, f),
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 2,
    AudioContext: undefined, webkitAudioContext: undefined
};
globalThis.performance = globalThis.performance || { now: () => Date.now() };
const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
};

// Capture the rAF callback so we can pump frames deterministically.
let rafCb = null;
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };

let fails = 0;
function check(name, fn) {
    try {
        fn();
        console.log('PASS  ' + name);
    } catch (err) {
        console.log('FAIL  ' + name + '  -- ' + err.message);
        fails++;
    }
}

// Booting main.js runs resize(), builds art, pushes the title screen.
await import('../js/main.js');

function pump(frames, startTs = 0, step = 16.67) {
    let ts = startTs;
    for (let i = 0; i < frames; i++) {
        if (!rafCb) throw new Error('no animation frame scheduled');
        const cb = rafCb;
        rafCb = null;
        ts += step;
        cb(ts);
    }
    return ts;
}

check('boot renders the title screen', () => {
    const before = opCount;
    pump(30);
    if (opCount <= before) throw new Error('nothing was drawn');
});

check('title screen animates over time without error', () => {
    pump(120);
});

check('how-to-play renders every page', () => {
    const key = (ev) => fire('win:keydown', ev);
    if (!listeners['win:keydown']) throw new Error('no keydown handler registered');
    // Down to HOW TO PLAY, then select.
    key({ key: 'ArrowDown', preventDefault() {} });
    key({ key: ' ', preventDefault() {} });
    pump(10);
    for (let p = 0; p < 6; p++) {
        key({ key: 'ArrowRight', preventDefault() {} });
        pump(10);
    }
});

check('load screen renders with empty slots', () => {
    const key = (ev) => fire('win:keydown', ev);
    key({ key: 'Escape', preventDefault() {} });   // back to title
    pump(5);
    key({ key: 'ArrowDown', preventDefault() {} });
    key({ key: 'ArrowDown', preventDefault() {} });
    key({ key: ' ', preventDefault() {} });         // LOAD GAME
    pump(20);
});

check('a live run renders across many frames', () => {
    const key = (ev) => fire('win:keydown', ev);
    key({ key: 'Escape', preventDefault() {} });   // back to title
    pump(5);
    // NEW RUN is index 0; make sure we are on it, then select.
    key({ key: 'ArrowUp', preventDefault() {} });
    key({ key: 'ArrowUp', preventDefault() {} });
    key({ key: 'ArrowUp', preventDefault() {} });
    key({ key: ' ', preventDefault() {} });
    pump(60 * 12);   // 12 seconds of real gameplay, including wave 1 spawns
});

check('gameplay with input renders', () => {
    const key = (ev) => fire('win:keydown', ev);
    const up = (ev) => fire('win:keyup', ev);
    // Thrust and flip while frames run.
    key({ key: 'ArrowRight', preventDefault() {} });
    pump(60);
    key({ key: ' ', preventDefault() {} });
    pump(60);
    up({ key: 'ArrowRight' });
    key({ key: 'Shift', preventDefault() {} });    // silent running
    pump(60);
    up({ key: 'Shift' });
    pump(60);
});

const key = (ev) => fire('win:keydown', ev);
const space = () => key({ key: ' ', preventDefault() {} });
const esc = () => key({ key: 'Escape', preventDefault() {} });
const stack = () => globalThis.window.__wakeform.stack();

/**
 * Home a menu to row 0. These menus wrap, so pressing Up a fixed number of
 * times lands on (sel - n) mod rows, not on row 0 -- the count must be a
 * common multiple of every menu length in the game (3, 4 and 5 rows).
 */
const HOME_PRESSES = 60;   // divisible by 3, 4 and 5
function home() {
    for (let i = 0; i < HOME_PRESSES; i++) key({ key: 'ArrowUp', preventDefault() {} });
}
function down(n) {
    for (let i = 0; i < n; i++) key({ key: 'ArrowDown', preventDefault() {} });
}

/** Close every open screen so each check starts from the live board. */
function toBoard() {
    for (let i = 0; i < 8 && stack().length; i++) { esc(); pump(2); }
    if (!globalThis.window.__wakeform.hasRun()) {
        // No run in progress: start one from the title.
        home();
        space();
        pump(30);
    }
    if (stack().length) throw new Error('could not reach the board: ' + stack());
}

check('pause overlay renders over the live board', () => {
    toBoard();
    key({ key: 'p', preventDefault() {} });
    pump(30);
    if (stack().join() !== 'pause') throw new Error('stack is ' + stack());
});

check('save screen opens from pause and writes a slot', () => {
    home();
    down(1);                    // RESUME -> SAVE GAME
    space();
    pump(20);
    if (stack().join() !== 'pause,save') throw new Error('stack is ' + stack());
    home();                     // slot 1
    space();                    // write it
    pump(20);
    if (!store.has('wakeform.slot.1')) throw new Error('slot 1 was not written');
});

check('a saved slot round-trips through the load screen', () => {
    toBoard();
    key({ key: 'p', preventDefault() {} });
    pump(5);
    home();
    down(2);                    // RESUME -> SAVE -> LOAD GAME
    space();
    pump(20);
    if (stack().join() !== 'pause,load') throw new Error('stack is ' + stack());
    home();                     // slot 1
    space();                    // load it
    pump(60 * 3);
    if (stack().length) throw new Error('load did not resume play: ' + stack());
    if (!globalThis.window.__wakeform.hasRun()) throw new Error('no run after load');
});

check('long run stays stable (60s, no accumulating error)', () => {
    pump(60 * 60);
});

check('a stalled tab does not tunnel the simulation', () => {
    // One enormous frame delta, as happens when a tab is backgrounded.
    pump(1, 0, 5000);
    pump(60);
});

check('pointer input on a menu is handled', () => {
    toBoard();
    key({ key: 'p', preventDefault() {} });
    pump(5);
    fire('canvas:pointerdown', { clientX: 320, clientY: 130 });
    pump(20);
});

check('visibility change autosaves without throwing', () => {
    globalThis.document.hidden = true;
    fire('doc:visibilitychange');
    globalThis.document.hidden = false;
});

check('window resize is handled', () => {
    globalThis.window.innerWidth = 480;
    globalThis.window.innerHeight = 900;
    fire('win:resize');
    pump(20);
});

check('several distinct colours were actually drawn', () => {
    if (seenFills.size < 6) {
        throw new Error('only ' + seenFills.size + ' fill colours: ' + [...seenFills].join(' '));
    }
});

console.log('\ncanvas ops executed: ' + opCount);
console.log('distinct fill colours: ' + seenFills.size);
console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL RENDER CHECKS PASSED');
process.exit(fails ? 1 : 0);
