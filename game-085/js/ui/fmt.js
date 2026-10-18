// Formatting helpers for the DOM layer.

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fmtTime(secs) {
    secs = Math.max(0, Math.round(secs));
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60), s = secs % 60;
    if (m < 60) return s && m < 10 ? `${m}m ${s}s` : `${m}m`;
    const h = Math.floor(m / 60), mm = m % 60;
    if (h < 48) return mm ? `${h}h ${mm}m` : `${h}h`;
    return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function fmtNum(n) {
    n = Math.round(n);
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(Math.abs(n) >= 1e7 ? 0 : 1) + 'M';
    if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(Math.abs(n) >= 1e5 ? 0 : 1) + 'k';
    return n.toLocaleString('en-US');
}

export const pct = (v) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;

export const LOG_ICON = { road: '🛤️', fight: '⚔️', win: '⚔️', loss: '💀', loot: '✨', trade: '⚖️', town: '🏘️', quest: '📜', level: '⭐', event: '🎲', craft: '🔨', story: '🏮', warden: '🗿', daily: '📬', recruit: '🤝', warn: '⚠️', camp: '🔥' };
