/* TALEWRIGHT runtime — core: utilities, colour helpers, the player stylesheet.
 *
 * Every runtime file is a classic script that registers one function in
 * window.TW_MODULES. The editor runs them to build TW; the exporter writes
 * each function's source (fn.toString()) into a standalone HTML file, so an
 * exported game runs exactly this code. Rules: no imports, nothing outside TW
 * and browser globals, and never the characters "</" + "script" in source. */
(window.TW_MODULES = window.TW_MODULES || []).push(['core', function (TW) {
    'use strict';

    TW.version = '1.0.0';
    TW.W = 320;   // pixel layer size
    TW.H = 240;
    TW.T = 16;    // tile size

    const U = TW.util = {};

    U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    U.lerp = (a, b, t) => a + (b - a) * t;

    /** Deterministic 0..1 noise for integer coordinates and a seed. */
    U.hash = (x, y, s) => {
        let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 1442695041);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
    };

    /** Seeded RNG (mulberry32). Returns a function giving 0..1. */
    U.rng = (seed) => {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };

    U.strSeed = (str) => {
        let h = 2166136261;
        str = String(str);
        for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    };

    U.hex2rgb = (hex) => {
        hex = String(hex || '#000').replace('#', '');
        if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
        const n = parseInt(hex.slice(0, 6), 16) || 0;
        const a = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
    };
    U.rgb2hex = (r, g, b) => '#' + [r, g, b].map((v) => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
    /** Lighten (amt > 0) or darken (amt < 0) a colour; amt in -1..1. */
    U.shade = (hex, amt) => {
        const [r, g, b] = U.hex2rgb(hex);
        if (amt >= 0) return U.rgb2hex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
        return U.rgb2hex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
    };
    U.mix = (a, b, t) => {
        const A = U.hex2rgb(a), B = U.hex2rgb(b);
        return U.rgb2hex(U.lerp(A[0], B[0], t), U.lerp(A[1], B[1], t), U.lerp(A[2], B[2], t));
    };
    U.rgba = (hex, alpha) => {
        const [r, g, b] = U.hex2rgb(hex);
        return `rgba(${r},${g},${b},${alpha})`;
    };

    U.clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

    /** A canvas. Tests replace TW.makeCanvas with a fake. */
    U.canvas = (w, h) => {
        if (TW.makeCanvas) return TW.makeCanvas(w, h);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        return c;
    };
    U.ctx = (c) => {
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        return g;
    };

    U.byId = (list, id) => {
        if (!list) return null;
        for (let i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
        return null;
    };

    /** Storage that never throws. */
    U.store = {
        get(key) { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
        set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } },
        del(key) { try { localStorage.removeItem(key); } catch (e) { /* blocked */ } },
    };

    U.DIRS = { 2: [0, 1], 4: [-1, 0], 6: [1, 0], 8: [0, -1] };
    U.dirOf = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 4 : 6) : (dy < 0 ? 8 : 2));
    U.reverse = (d) => ({ 2: 8, 8: 2, 4: 6, 6: 4 }[d] || 2);

    // The player's stylesheet travels with the code, so an exported game is one file.
    TW.css = `
.tw-player{position:absolute;inset:0;overflow:hidden;background:#000;user-select:none;-webkit-user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent;font-family:system-ui,sans-serif}
body.tw-body{margin:0;background:#000;height:100vh;height:100dvh;overflow:hidden}
body.tw-body>.tw-player{position:fixed}
.tw-stage{position:absolute;left:0;top:0;transform-origin:0 0;box-shadow:0 0 0 1px rgba(255,255,255,.06),0 10px 40px rgba(0,0,0,.6)}
.tw-stage canvas{position:absolute;left:0;top:0;display:block}
.tw-px{image-rendering:pixelated;image-rendering:crisp-edges}
.tw-touch{position:absolute;inset:0;pointer-events:none;display:none}
.tw-player.touch .tw-touch{display:block}
.tw-pad{position:absolute;width:150px;height:150px;pointer-events:auto;touch-action:none}
.tw-pad i{position:absolute;width:50px;height:50px;border-radius:12px;background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.28);box-sizing:border-box}
.tw-pad i.on{background:rgba(255,255,255,.4)}
.tw-pad .u{left:50px;top:0}.tw-pad .d{left:50px;top:100px}.tw-pad .l{left:0;top:50px}.tw-pad .r{left:100px;top:50px}
.tw-pad .u::after,.tw-pad .d::after,.tw-pad .l::after,.tw-pad .r::after{content:'';position:absolute;left:50%;top:50%;border:8px solid transparent;transform:translate(-50%,-50%)}
.tw-pad .u::after{border-bottom-color:rgba(255,255,255,.75);margin-top:-4px}.tw-pad .d::after{border-top-color:rgba(255,255,255,.75);margin-top:4px}
.tw-pad .l::after{border-right-color:rgba(255,255,255,.75);margin-left:-4px}.tw-pad .r::after{border-left-color:rgba(255,255,255,.75);margin-left:4px}
.tw-btn{position:absolute;width:64px;height:64px;border-radius:50%;pointer-events:auto;touch-action:none;border:2px solid rgba(255,255,255,.35);background:rgba(255,255,255,.14);color:rgba(255,255,255,.9);font:700 22px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
.tw-btn.on{background:rgba(255,255,255,.42)}
.tw-btn.a{background:rgba(255,90,110,.28)}.tw-btn.b{background:rgba(90,160,255,.24)}
.tw-loader{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#e8e4ff;font:16px system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box;background:radial-gradient(circle at 50% 40%,#2a2260,#07051a)}
.tw-loader h1{font:700 28px Georgia,serif;margin:0;letter-spacing:.04em}
.tw-loader label{display:inline-block;padding:12px 22px;border-radius:10px;background:#6b5cff;color:#fff;cursor:pointer;font-weight:700}
.tw-loader input{display:none}
.tw-loader .drop{border:2px dashed rgba(255,255,255,.3);border-radius:14px;padding:28px 36px;max-width:420px}
.tw-loader .drop.over{border-color:#fff;background:rgba(255,255,255,.06)}
.tw-loader .err{color:#ff9aa8;min-height:1.2em}
`;
}]);
