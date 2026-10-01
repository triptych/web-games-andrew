/** format.js — big-number formatting shared by the sim's text and the UI. */

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];

export function fmt(n) {
    if (!Number.isFinite(n)) return '∞';
    const neg = n < 0;
    let v = Math.abs(n);
    if (v < 1000) return (neg ? '-' : '') + (v < 10 && v % 1 ? v.toFixed(1) : Math.floor(v).toString());
    let u = 0;
    while (v >= 1000 && u < UNITS.length - 1) { v /= 1000; u++; }
    const s = v >= 100 ? Math.floor(v).toString() : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return (neg ? '-' : '') + s.replace(/\.?0+$/, '') + UNITS[u];
}

export function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
}
