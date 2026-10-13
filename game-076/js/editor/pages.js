// Event pages, as the editor needs to reason about them. The runtime shows the
// LAST page whose conditions all hold, so a later page with no conditions
// always wins, and an empty one makes the whole event vanish. These helpers
// let the map view and the event editor show and warn about that.

/** Does this page have any condition at all? */
export function hasConditions(pg) {
    const c = (pg && pg.cond) || {};
    return !!(c.sw1 || c.sw2 || c.var || c.item || c.actor || c.self);
}

/** Has neither a graphic nor commands: the event is gone while this page is active. */
export function isEmpty(pg) {
    return !!pg && (!pg.gfx || !pg.gfx.kind || pg.gfx.kind === 'none') && !(pg.list && pg.list.length);
}

/**
 * The page that is active when a new game starts, before any switch, variable,
 * item or self switch has changed: the last page with no conditions. (A variable
 * condition such as "≥ 0" could also hold at the start; treating every condition
 * as unmet keeps this simple and errs on the side of showing page 1.)
 */
export function startPageIndex(ev) {
    const pages = (ev && ev.pages) || [];
    for (let i = pages.length - 1; i >= 0; i--) if (!hasConditions(pages[i])) return i;
    return -1;
}

/** Later pages with no conditions, which hide every page before them. */
export function overridingPages(ev) {
    const out = [];
    ((ev && ev.pages) || []).forEach((pg, i) => { if (i > 0 && !hasConditions(pg)) out.push(i); });
    return out;
}

/** A plain-words note about an event's pages, or '' when nothing is surprising. */
export function pageWarning(ev) {
    const over = overridingPages(ev);
    if (!over.length) return '';
    const last = over[over.length - 1];
    const pg = ev.pages[last];
    const hidden = last === 1 ? 'page 1' : 'pages 1–' + last;
    return 'Page ' + (last + 1) + ' has no conditions, so it is always the one in use and ' + hidden + ' never appear' +
        (isEmpty(pg) ? '. It is also empty, so in the game this event is invisible and does nothing.' : '.');
}

/** The next self switch a new page should wait for: A, then B, C, D. */
export function nextSelfKey(ev) {
    const used = new Set(((ev && ev.pages) || []).map((pg) => pg.cond && pg.cond.self).filter(Boolean));
    return ['A', 'B', 'C', 'D'].find((k) => !used.has(k)) || 'D';
}
