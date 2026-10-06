/**
 * format.js — number and time formatting. Pure (used by the HUD and the dev scripts).
 */

const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];
const LONG = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion',
    'undecillion', 'duodecillion', 'tredecillion', 'quattuordecillion', 'quindecillion', 'sexdecillion', 'septendecillion', 'octodecillion', 'novemdecillion', 'vigintillion'];

let style = 'short';   // 'short' | 'sci'
export function setNumberStyle(s) { style = s === 'sci' ? 'sci' : 'short'; }
export function numberStyle() { return style; }

/** 1234 → "1,234"; 1.5e6 → "1.50M"; small numbers keep a decimal. */
export function fmt(n, decimals = 2) {
    if (!Number.isFinite(n)) return n > 0 ? '∞' : '0';
    if (n < 0) return '-' + fmt(-n, decimals);
    if (n < 10 && n !== Math.floor(n)) return n.toFixed(1);
    if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
    const e = Math.floor(Math.log10(n) + 1e-9);
    if (style === 'sci' || e >= SUFFIX.length * 3) {
        const m = n / Math.pow(10, e);
        return `${m.toFixed(decimals)}e${e}`;
    }
    const tier = Math.floor(e / 3);
    const m = n / Math.pow(1000, tier);
    return `${m.toFixed(m >= 100 ? 1 : decimals)}${SUFFIX[tier]}`;
}

/** Long form for tooltips: "1.50 million". */
export function fmtLong(n) {
    if (!Number.isFinite(n) || n < 1e6) return fmt(n);
    const e = Math.floor(Math.log10(n) + 1e-9);
    const tier = Math.floor(e / 3);
    if (tier >= LONG.length) return fmt(n);
    return `${(n / Math.pow(1000, tier)).toFixed(2)} ${LONG[tier]}`;
}

export function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (d) return `${d}d ${h}h`;
    if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
}

export function fmtPct(x) { return `${Math.round(x * 100)}%`; }
