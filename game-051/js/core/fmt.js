/** fmt.js — number and time formatting for the UI. */

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

export function num(n) {
    n = Math.floor(n);
    if (Math.abs(n) < 10000) return n.toLocaleString('en-US');
    let u = 0, v = n;
    while (Math.abs(v) >= 1000 && u < UNITS.length - 1) { v /= 1000; u++; }
    return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/\.0+$/, '') + UNITS[u];
}

export function pct(v, digits = 0) { return (v * 100).toFixed(digits) + '%'; }

export function dur(ms) {
    if (ms <= 0) return 'Ready';
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
    return `${sec}s`;
}

export function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
