// The field HUD: the party's health, the zone and floor, the minimap, and the prompt that says
// what the action button will do right now.

import { h, $, clear, bar, portraitImg } from './dom.js';
import { ZONES } from '../sim/data/zones.js';
import { calc, partyUnits } from '../sim/units.js';
import { floorOf } from '../sim/explore.js';
import { cellAt, FLOOR } from '../sim/gen.js';

export class FieldHud {
    constructor(ui) { this.ui = ui; this.t = 0; this.key = ''; }

    refresh(G) {
        const X = G.explore;
        if (!X) return;
        const us = partyUnits(G);
        const key = us.map((u) => `${u.uid}:${u.hp}:${u.mp}:${u.lv}`).join('|') + X.zone + X.cur;
        if (key !== this.key) {
            this.key = key;
            const wrap = clear($('field-party'));
            for (const u of us) {
                const c = calc(G, u);
                wrap.append(h('div.fcard', u.agent ? portraitImg(`pc:agent:${G.look || 0}`, () => this.ui.view.portraits.person('agent', 'neutral', G.look || 0)) : portraitImg(`pc:${u.sp}`, () => this.ui.view.portraits.daemon(u.sp, 80, 100)),
                    h('div', h('div.nm', h('span', { text: u.name }), h('i', { text: `Lv${u.lv}` })), bar(u.hp / c.maxhp), bar(u.mp / c.maxmp, 'mp'))));
            }
            $('zone-name').textContent = ZONES[X.zone].short;
            $('zone-floor').textContent = `${X.cur + 1}F`;
        }
    }

    minimap(G) {
        const X = G.explore;
        if (!X) return;
        const rec = floorOf(X), fl = rec.fl;
        const cv = $('minimap'), g = cv.getContext('2d');
        const s = Math.min(cv.width / fl.w, cv.height / fl.h);
        const ox = (cv.width - fl.w * s) / 2, oy = (cv.height - fl.h * s) / 2;
        g.clearRect(0, 0, cv.width, cv.height);
        g.fillStyle = 'rgba(2,10,12,0.8)'; g.fillRect(0, 0, cv.width, cv.height);
        for (let y = 0; y < fl.h; y++) for (let x = 0; x < fl.w; x++) {
            if (!rec.seen[y * fl.w + x] || fl.cells[y * fl.w + x] !== FLOOR) continue;
            g.fillStyle = 'rgba(122,255,208,0.38)';
            g.fillRect(ox + x * s, oy + y * s, Math.ceil(s), Math.ceil(s));
        }
        const dot = (x, y, col, r = 1.5) => { g.fillStyle = col; g.fillRect(ox + x * s + s / 2 - r, oy + y * s + s / 2 - r, r * 2, r * 2); };
        const seen = (c) => rec.seen[c.y * fl.w + c.x];
        if (fl.up && seen(fl.up)) dot(fl.up.x, fl.up.y, '#5ac8ff', 2);
        if (fl.down && seen(fl.down)) dot(fl.down.x, fl.down.y, '#ffb060', 2);
        if (fl.anchor && seen(fl.anchor)) dot(fl.anchor.x, fl.anchor.y, '#9dff7a', 2);
        if (fl.exit && seen(fl.exit)) dot(fl.exit.x, fl.exit.y, '#7affd0', 2.5);
        if (fl.boss && !rec.bossDone && seen(fl.boss)) dot(fl.boss.x, fl.boss.y, '#ff4ad8', 3);
        for (const c of rec.chests) if (!c.open && seen(c)) dot(c.x, c.y, '#ffd86a', 1.5);
        for (const f of rec.foes) if (!f.dead && Math.hypot(f.x - X.p.x, f.y - X.p.y) < 10) dot(f.x - 0.5, f.y - 0.5, f.st === 'chase' ? '#ff4a6a' : '#d24bff', 1.5);
        dot(X.p.x - 0.5, X.p.y - 0.5, '#ffffff', 2);
    }

    /** What the action button does: the nearest thing in reach, else a swing. */
    hint(G) {
        const X = G.explore;
        const el = $('hint');
        if (!X || X.menu) { el.hidden = true; return; }
        const rec = floorOf(X), fl = rec.fl, p = X.p;
        const near = (c) => Math.hypot(p.x - c.x - 0.5, p.y - c.y - 0.5) <= 1.15;
        let txt = '';
        if (rec.chests.some((c) => !c.open && near(c))) txt = 'Open chest';
        else if (fl.anchor && near(fl.anchor)) txt = 'Use Sprout';
        else if (fl.up && near(fl.up)) txt = X.cur === 0 ? 'Leave the zone' : 'Go up';
        else if (fl.down && near(fl.down)) txt = fl.boss && !rec.bossDone ? 'Sealed by the guardian' : 'Go down';
        else if (fl.exit && (rec.bossDone || !fl.boss) && near(fl.exit)) txt = 'Portal home';
        const k = this.ui.input.lastDevice === 'touch' ? 'A' : 'Space';
        el.hidden = !txt;
        if (txt) el.textContent = `${k}  ·  ${txt}`;
    }
}
