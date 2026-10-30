// Number and time formatting for big idle-game numbers. Pure.

const SHORT = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];
const LONG = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion', 'tredecillion', 'quattuordecillion', 'quindecillion', 'sexdecillion', 'septendecillion', 'octodecillion', 'novemdecillion', 'vigintillion'];

/** 12.3 · 4,560 · 1.23M · 45.6B */
export function fmt(n, small = 1) {
    if (!Number.isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n, small);
    if (n < 10 && small) return (Math.round(n * 10) / 10).toString();
    if (n < 1e4) return Math.floor(n).toLocaleString('en-US');
    const tier = Math.floor(Math.log10(n) / 3);
    if (tier >= SHORT.length) return n.toExponential(2).replace('e+', 'e');
    const v = n / 10 ** (tier * 3);
    return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v).toString()) + SHORT[tier];
}

/** 1.234 million — for the big counter, where there's room. */
export function fmtLong(n) {
    if (!Number.isFinite(n)) return '∞';
    if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
    const tier = Math.floor(Math.log10(n) / 3);
    if (tier >= LONG.length) return n.toExponential(3).replace('e+', 'e');
    return (n / 10 ** (tier * 3)).toFixed(3) + ' ' + LONG[tier];
}

/** 45s · 12m 5s · 3h 20m · 2d 4h */
export function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
    const h = Math.floor(m / 60), mm = m % 60;
    if (h < 48) return mm ? `${h}h ${mm}m` : `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
}
