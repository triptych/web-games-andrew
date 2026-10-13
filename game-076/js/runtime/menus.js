/* TALEWRIGHT runtime — menus: the main menu (items, skills, equip, status,
 * save, quit), shops and the save/load slots. Each is a modal widget on the UI
 * stack built out of ListWin and a party picker. */
(window.TW_MODULES = window.TW_MODULES || []).push(['menus', function (TW) {
    'use strict';
    const U = TW.util;
    const { win, text, cursor, img, partyPanel, ListWin, inRect, F, VW, VH } = TW.ui;

    const SLOTS = 3;

    // ── save slots ───────────────────────────────────────────────────────────
    function slotKey(game, i) { return (game.opts.saveKey || 'tw.game') + ':' + i; }
    function readSlot(game, i) { return U.store.get(slotKey(game, i)); }
    function anySave(game) { for (let i = 1; i <= SLOTS; i++) if (readSlot(game, i)) return true; return false; }
    function fmtTime(sec) { sec = Math.floor(sec || 0); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(s).padStart(2, '0'); }

    /** Pick a party member on the party panel (x, y, w, h must match partyPanel's). */
    class PartyPicker {
        constructor(ui, rect, o) {
            this.ui = ui; this.modal = true; this.rect = rect; this.index = 0; this.t = 0; this.done = false;
            Object.assign(this, o);
        }
        update(inp, dt) {
            this.t += dt;
            const n = this.ui.game.state.party.length;
            const nav = inp.nav();
            if (nav === 'down' && this.index < n - 1) { this.index++; this.ui.game.sfx('cursor'); }
            if (nav === 'up' && this.index > 0) { this.index--; this.ui.game.sfx('cursor'); }
            const tap = inp.tapNow, r = this.rect;
            if (tap) {
                if (inRect(tap, r.x, r.y, r.w, r.h)) {
                    const rowH = Math.min(46, (r.h - 8) / Math.max(1, n));
                    const i = Math.floor((tap.y - r.y - 4) / rowH);
                    if (i >= 0 && i < n) { this.index = i; this.ui.game.sfx('confirm'); this.onChoose(i); }
                } else if (this.onCancel) { this.ui.game.sfx('cancel'); this.onCancel(); }
                return;
            }
            if (inp.pressed('ok')) { inp.eat('ok'); this.ui.game.sfx('confirm'); this.onChoose(this.index); }
            else if (inp.pressed('cancel') && this.onCancel) { inp.eat('cancel'); this.ui.game.sfx('cancel'); this.onCancel(); }
        }
        draw() { /* drawn by the owner's party panel */ }
    }

    /** A screen made of several widgets, with one focused at a time. */
    class Screen {
        constructor(ui) { this.ui = ui; this.modal = true; this.done = false; this.focus = null; this.t = 0; }
        update(inp, dt) { this.t += dt; if (this.focus) this.focus.update(inp, dt); }
        close() { this.done = true; }
    }

    // ── main menu ────────────────────────────────────────────────────────────
    class MainMenu extends Screen {
        constructor(ui) {
            super(ui);
            const game = ui.game;
            this.panel = { x: 100, y: 8, w: 212, h: 186 };
            this.cmd = new ListWin(ui, {
                x: 8, y: 8, w: 86, rows: 6,
                items: [{ label: 'Items' }, { label: 'Skills' }, { label: 'Equip' }, { label: 'Status' }, { label: 'Save', enabled: game.canSave() }, { label: 'Quit' }],
            });
            this.cmd.onCancel = () => this.close();
            this.cmd.onChoose = (it, i) => this.open(i);
            this.focus = this.cmd;
            this.sub = null;      // an overlay list (items, skills, equip, slots)
            this.pick = null;     // party picker
            this.info = null;     // a status or description line
            game.sfx('confirm');
        }
        back() { this.sub = null; this.pick = null; this.info = null; this.status = null; this.focus = this.cmd; }
        picker(onChoose, onCancel) {
            this.pick = new PartyPicker(this.ui, this.panel, { onChoose, onCancel: onCancel || (() => this.back()) });
            this.focus = this.pick;
        }
        open(i) {
            const game = this.ui.game, st = game.state;
            if (i === 0) this.items();
            if (i === 1) this.picker((a) => this.skills(st.party[a]));
            if (i === 2) this.picker((a) => this.equip(st.party[a]));
            if (i === 3) {
                const show = (a) => {
                    this.status = st.party[a];
                    this.focus = { update: (inp) => { if (inp.pressed('ok') || inp.pressed('cancel') || inp.tapNow) { inp.eat('ok'); inp.eat('cancel'); this.status = null; this.picker(show); } } };
                };
                this.picker(show);
            }
            if (i === 4) this.slots();
            if (i === 5) {
                const l = new ListWin(this.ui, { x: 100, y: 80, w: 120, rows: 2, title: 'Return to title?', items: [{ label: 'Yes' }, { label: 'No' }], index: 1, tapSelects: true });
                l.onChoose = (it, k) => { if (k === 0) { this.close(); game.toTitle(); } else this.back(); };
                l.onCancel = () => this.back();
                this.sub = l; this.focus = l;
            }
        }
        items() {
            const game = this.ui.game, st = game.state;
            const make = () => st.inventory().map((it) => ({ label: it.name, right: '×' + st.count(it.id), iconCanvas: TW.sprites.icon(it.icon || 'potion'), item: it, enabled: it.kind === 'consumable' && it.menu !== false }));
            const l = new ListWin(this.ui, { x: 8, y: 34, w: 304, rows: 9, cols: 2, items: make(), empty: 'No items.' });
            const desc = () => { const it = l.items[l.index]; this.info = it ? it.item.desc || '' : ''; };
            l.onMove = desc; desc();
            l.onCancel = () => this.back();
            l.onChoose = (row) => {
                const item = row.item;
                const all = item.scope === 'all';
                this.picker((a) => {
                    const targets = all ? st.party : [st.party[a]];
                    let did = false;
                    for (const t of targets) did = st.useItemOn(item, t) || did;
                    if (did) { st.gainItem(item.id, -1); game.sfx('heal'); game.hook('useItem', { id: item.id }); } else game.sfx('buzzer');
                    if (st.count(item.id) <= 0) { l.items = make(); l.index = U.clamp(l.index, 0, Math.max(0, l.items.length - 1)); desc(); this.pick = null; this.focus = l; this.sub = l; }
                }, () => { this.pick = null; this.focus = l; this.sub = l; });
                this.sub = null;
            };
            this.sub = l; this.focus = l;
        }
        skills(actor) {
            const game = this.ui.game, st = game.state;
            const list = st.skillsOf(actor).map((id) => st.skillDb(id)).filter(Boolean);
            const l = new ListWin(this.ui, {
                x: 8, y: 34, w: 304, rows: 9, cols: 2, empty: actor.name + ' knows no skills.', title: actor.name + '  MP ' + actor.mp + '/' + st.maxMp(actor),
                items: list.map((s) => ({ label: s.name, right: s.mp + ' MP', skill: s, enabled: (s.kind === 'heal' || s.kind === 'revive') && actor.mp >= s.mp && actor.hp > 0 })),
            });
            l.onCancel = () => this.back();
            l.onMove = (row) => { this.info = row ? describeSkill(row.skill) : ''; };
            if (list[0]) this.info = describeSkill(list[0]);
            l.onChoose = (row) => {
                const s = row.skill;
                const all = s.scope === 'allAllies';
                this.picker((a) => {
                    if (actor.mp < s.mp) { game.sfx('buzzer'); return; }
                    const targets = all ? st.party : [st.party[a]];
                    let did = false;
                    for (const t of targets) {
                        if (s.kind === 'revive' && t.hp <= 0) { t.hp = Math.max(1, Math.floor(st.maxHp(t) * 0.5)); did = true; }
                        else if (s.kind === 'heal' && t.hp > 0 && t.hp < st.maxHp(t)) { t.hp = Math.min(st.maxHp(t), t.hp + healAmount(st, actor, s)); did = true; }
                    }
                    if (did) { actor.mp -= s.mp; game.sfx('heal'); l.title = actor.name + '  MP ' + actor.mp + '/' + st.maxMp(actor); l.items.forEach((r) => { r.enabled = (r.skill.kind === 'heal' || r.skill.kind === 'revive') && actor.mp >= r.skill.mp; }); }
                    else game.sfx('buzzer');
                }, () => { this.pick = null; this.focus = l; this.sub = l; });
                this.sub = null;
            };
            this.sub = l; this.focus = l;
        }
        equip(actor) {
            const game = this.ui.game, st = game.state;
            const slots = [['weapon', 'Weapon'], ['armor', 'Armour'], ['acc', 'Accessory']];
            const mk = () => slots.map(([k, n]) => { const it = actor.equip[k] && st.itemDb(actor.equip[k]); return { label: n + ':  ' + (it ? it.name : '—'), slot: k, iconCanvas: it ? TW.sprites.icon(it.icon || 'sword') : null }; });
            const l = new ListWin(this.ui, { x: 8, y: 34, w: 190, rows: 3, items: mk(), title: actor.name });
            this.equipActor = actor;
            l.onCancel = () => { this.equipActor = null; this.back(); };
            l.onChoose = (row) => {
                const kind = row.slot === 'acc' ? 'accessory' : row.slot;
                const opts = st.inventory().filter((it) => it.kind === kind).map((it) => ({ label: it.name, right: '×' + st.count(it.id), iconCanvas: TW.sprites.icon(it.icon || 'sword'), item: it }));
                opts.unshift({ label: '(remove)', item: null });
                const l2 = new ListWin(this.ui, { x: 8, y: 90, w: 190, rows: 6, items: opts });
                l2.onMove = (r) => { this.preview = r && { slot: row.slot, item: r.item }; };
                l2.onMove(opts[0]);
                l2.onCancel = () => { this.preview = null; this.sub2 = null; this.focus = l; };
                l2.onChoose = (r) => {
                    st.equip(actor, row.slot, r.item ? r.item.id : 0);
                    game.hook('equip', { actor: actor.id, item: r.item ? r.item.id : 0 });
                    l.items = mk(); this.preview = null; this.sub2 = null; this.focus = l;
                };
                this.sub2 = l2; this.focus = l2;
            };
            this.sub = l; this.focus = l;
        }
        slots() {
            const game = this.ui.game;
            const l = new SlotList(this.ui, 'save', (i) => {
                game.save(i);
                game.sfx('save');
                l.refresh();
            });
            l.onCancel = () => this.back();
            this.sub = l; this.focus = l;
        }
        draw(g, s) {
            const game = this.ui.game, st = game.state;
            partyPanel(g, s, game, this.panel.x, this.panel.y, this.panel.w, this.panel.h, this.pick ? this.pick.index : -1, this.t);
            this.cmd.draw(g, s);
            win(g, s, 8, 198, 86, 34);
            text(g, s, st.gold + ' ' + ((game.project.system && game.project.system.currency) || 'G'), 88, 203, { align: 'right', color: s.accent, bold: true });
            text(g, s, fmtTime(st.playtime), 88, 217, { align: 'right', color: s.dim, size: 8 });
            if (this.status) drawStatus(g, s, game, this.status);
            if (this.sub) {
                this.sub.draw(g, s);
                if (this.info !== null && this.info !== undefined && this.sub.y === 34) { win(g, s, 8, 8, 304, 22); text(g, s, this.info, 14, 13, { max: 292 }); }
            }
            if (this.sub2) this.sub2.draw(g, s);
            if (this.equipActor) drawEquipStats(g, s, game, this.equipActor, this.preview);
        }
    }

    function healAmount(st, user, s) { return Math.floor((s.power | 0) + st.stat(user, 'mag') * 1.5); }
    function describeSkill(s) {
        const kinds = { damage: 'Damage', heal: 'Heal', revive: 'Revive', buffAtk: 'Raise ATK', buffDef: 'Raise DEF' };
        const scopes = { enemy: 'one enemy', allEnemies: 'all enemies', ally: 'one ally', allAllies: 'all allies', self: 'self' };
        return (kinds[s.kind] || s.kind) + ' — ' + (scopes[s.scope] || '') + (s.element && s.element !== 'none' ? ' — ' + s.element : '') + (s.power ? ' — power ' + s.power : '');
    }

    function drawStatus(g, s, game, a) {
        const st = game.state, db = st.actorDb(a.id) || {};
        win(g, s, 8, 34, 304, 198);
        img(g, TW.sprites.face(db.sprite || 'hero'), 18, 44, 3);
        text(g, s, a.name, 66, 44, { bold: true, size: 11 });
        text(g, s, (db.cls || '') + '   Level ' + a.level, 66, 59, { color: s.dim });
        const next = TW.expFor(a.level + 1);
        text(g, s, 'EXP ' + a.exp + (a.level < 99 ? '   next ' + (next - a.exp) : ''), 66, 71, { color: s.dim, size: 8 });
        const rows = [['HP', a.hp + ' / ' + st.maxHp(a)], ['MP', a.mp + ' / ' + st.maxMp(a)], ['ATK', st.stat(a, 'atk')], ['DEF', st.stat(a, 'def')], ['MAG', st.stat(a, 'mag')], ['SPD', st.stat(a, 'spd')]];
        rows.forEach(([k, v], i) => { text(g, s, k, 22, 96 + i * 14, { color: s.accent }); text(g, s, String(v), 130, 96 + i * 14, { align: 'right' }); });
        const slots = [['weapon', 'Weapon'], ['armor', 'Armour'], ['acc', 'Accessory']];
        slots.forEach(([k, n], i) => {
            const it = a.equip[k] && st.itemDb(a.equip[k]);
            text(g, s, n, 150, 96 + i * 26, { color: s.accent, size: 8 });
            if (it) { img(g, TW.sprites.icon(it.icon || 'sword'), 150, 106 + i * 26); text(g, s, it.name, 165, 106 + i * 26); }
            else text(g, s, '—', 150, 106 + i * 26, { color: s.dim });
        });
        const sk = st.skillsOf(a).map((id) => st.skillDb(id)).filter(Boolean).map((x) => x.name).join(', ');
        text(g, s, 'Skills: ' + (sk || '—'), 22, 186, { size: 8, color: s.dim, max: 280 });
    }

    function drawEquipStats(g, s, game, a, preview) {
        const st = game.state;
        win(g, s, 204, 34, 108, 100);
        const keys = ['atk', 'def', 'mag', 'spd'];
        let after = null;
        if (preview) {
            const saved = a.equip[preview.slot];
            a.equip[preview.slot] = preview.item ? preview.item.id : 0;
            after = keys.map((k) => st.stat(a, k));
            a.equip[preview.slot] = saved;
        }
        keys.forEach((k, i) => {
            const v = st.stat(a, k);
            text(g, s, k.toUpperCase(), 212, 42 + i * 20, { color: s.accent });
            text(g, s, String(v), 262, 42 + i * 20, { align: 'right' });
            if (after) {
                const n = after[i];
                text(g, s, '→ ' + n, 304, 42 + i * 20, { align: 'right', color: n > v ? '#6ae07a' : n < v ? '#ff6a6a' : s.text });
            }
        });
    }

    class SlotList extends ListWin {
        constructor(ui, mode, onPick) {
            super(ui, { x: 8, y: 34, w: 304, rows: SLOTS, rowH: 40, items: [], title: mode === 'save' ? 'Save to which slot?' : 'Load which game?' });
            this.mode = mode;
            this.onChoose = (it, i) => onPick(i + 1);
            this.refresh();
        }
        refresh() {
            const game = this.ui.game;
            this.items = [];
            for (let i = 1; i <= SLOTS; i++) {
                const d = readSlot(game, i);
                this.items.push({ label: '', slot: i, data: d, enabled: this.mode === 'save' || !!d });
            }
        }
        draw(g, s) {
            const saved = this.items.map((it) => it.label);
            super.draw(g, s);
            const game = this.ui.game;
            this.items.forEach((it, i) => {
                const r = this.rowRect(i);
                text(g, s, 'File ' + it.slot, r.x + 6, r.y + 4, { bold: true, color: s.accent });
                const d = it.data;
                if (!d) { text(g, s, '— empty —', r.x + 60, r.y + 14, { color: s.dim }); return; }
                const map = U.byId(game.project.maps, d.mapId);
                text(g, s, (map ? map.name : '?'), r.x + 60, r.y + 4);
                text(g, s, 'Lv ' + (d.level || 1) + '   ' + fmtTime(d.playtime) + '   ' + (d.gold | 0) + ' ' + ((game.project.system && game.project.system.currency) || 'G'), r.x + 60, r.y + 18, { color: s.dim, size: 8 });
                (d.party || []).slice(0, 4).forEach((a, k) => {
                    const db = U.byId(game.project.actors, a.id);
                    if (db) TW.sprites.drawChar(g, db.sprite || 'hero', 2, 1, r.x + r.w - 76 + k * 18, r.y + 9);
                });
            });
            void saved;
        }
    }

    // ── shop ─────────────────────────────────────────────────────────────────
    class Shop extends Screen {
        constructor(ui, goods) {
            super(ui);
            this.goods = goods;
            const game = ui.game;
            this.cmd = new ListWin(ui, { x: 8, y: 30, w: 304, rows: 1, cols: 3, items: [{ label: 'Buy' }, { label: 'Sell' }, { label: 'Leave' }], tapSelects: true });
            this.cmd.onChoose = (it, i) => (i === 0 ? this.buy() : i === 1 ? this.sell() : this.close());
            this.cmd.onCancel = () => this.close();
            this.focus = this.cmd;
            this.info = 'Welcome! What can I get you?';
            game.sfx('confirm');
        }
        cur() { return (this.ui.game.project.system && this.ui.game.project.system.currency) || 'G'; }
        back() { this.list = null; this.qty = null; this.focus = this.cmd; this.info = 'Anything else?'; }
        buy() {
            const st = this.ui.game.state;
            const mk = () => this.goods.map((id) => st.itemDb(id)).filter(Boolean).map((it) => ({ label: it.name, right: it.price + ' ' + this.cur(), item: it, iconCanvas: TW.sprites.icon(it.icon || 'potion'), enabled: st.gold >= it.price && st.count(it.id) < 99 }));
            const l = new ListWin(this.ui, { x: 8, y: 54, w: 190, rows: 9, items: mk() });
            l.onMove = (r) => { this.info = r ? r.item.desc || '' : ''; this.hover = r && r.item; };
            l.onMove(l.items[0]);
            l.onCancel = () => this.back();
            l.onChoose = (r) => this.quantity(r.item, 'buy', () => { l.items = mk(); });
            this.list = l; this.focus = l;
        }
        sell() {
            const st = this.ui.game.state;
            const mk = () => st.inventory().map((it) => ({ label: it.name, right: '×' + st.count(it.id), item: it, iconCanvas: TW.sprites.icon(it.icon || 'potion'), enabled: it.kind !== 'key' && it.price > 0 }));
            const l = new ListWin(this.ui, { x: 8, y: 54, w: 190, rows: 9, items: mk(), empty: 'Nothing to sell.' });
            l.onMove = (r) => { this.info = r ? 'Sells for ' + Math.floor(r.item.price / 2) + ' ' + this.cur() : ''; this.hover = r && r.item; };
            l.onMove(l.items[0]);
            l.onCancel = () => this.back();
            l.onChoose = (r) => this.quantity(r.item, 'sell', () => { l.items = mk(); l.index = U.clamp(l.index, 0, Math.max(0, l.items.length - 1)); });
            this.list = l; this.focus = l;
        }
        quantity(item, mode, after) {
            const game = this.ui.game, st = game.state;
            const unit = mode === 'buy' ? item.price : Math.floor(item.price / 2);
            const max = mode === 'buy' ? Math.max(1, Math.min(99 - st.count(item.id), unit ? Math.floor(st.gold / unit) : 99)) : st.count(item.id);
            const prev = this.focus;
            this.qty = { item, n: 1, max, unit, mode };
            const q = this.qty;
            this.focus = {
                update: (inp) => {
                    const nav = inp.nav();
                    if (nav === 'up' || nav === 'right') { q.n = Math.min(q.max, q.n + (nav === 'up' ? 10 : 1)); game.sfx('cursor'); }
                    if (nav === 'down' || nav === 'left') { q.n = Math.max(1, q.n - (nav === 'down' ? 10 : 1)); game.sfx('cursor'); }
                    const tap = inp.tapNow;
                    if (tap && inRect(tap, 204, 150, 108, 46)) {
                        if (tap.x < 230) q.n = Math.max(1, q.n - 1); else if (tap.x > 286) q.n = Math.min(q.max, q.n + 1);
                        else { this.commit(q); after(); this.qty = null; this.focus = prev; }
                        return;
                    }
                    if (inp.pressed('ok')) { inp.eat('ok'); this.commit(q); after(); this.qty = null; this.focus = prev; }
                    else if (inp.pressed('cancel') || tap) { inp.eat('cancel'); game.sfx('cancel'); this.qty = null; this.focus = prev; }
                },
            };
        }
        commit(q) {
            const game = this.ui.game, st = game.state;
            if (q.mode === 'buy') {
                const cost = q.unit * q.n;
                if (st.gold < cost) { game.sfx('buzzer'); return; }
                st.gainGold(-cost); st.gainItem(q.item.id, q.n);
                game.hook('shopBuy', { id: q.item.id, n: q.n });
                this.info = 'Thank you!';
            } else {
                st.gainItem(q.item.id, -q.n); st.gainGold(q.unit * q.n);
                game.hook('shopSell', { id: q.item.id, n: q.n });
                this.info = 'Pleasure doing business.';
            }
            game.sfx('coin');
            game.refresh();
        }
        draw(g, s) {
            const game = this.ui.game, st = game.state;
            win(g, s, 8, 8, 304, 20);
            text(g, s, this.info || '', 14, 12.5, { max: 292 });
            this.cmd.draw(g, s);
            win(g, s, 204, 54, 108, 22);
            text(g, s, st.gold + ' ' + this.cur(), 304, 59, { align: 'right', color: s.accent, bold: true });
            if (this.list) {
                this.list.draw(g, s);
                const it = this.hover;
                if (it) {
                    win(g, s, 204, 80, 108, 66);
                    text(g, s, 'Owned: ' + st.count(it.id), 212, 86, { color: s.dim, size: 8 });
                    const kind = it.kind === 'weapon' ? 'atk' : it.kind === 'armor' ? 'def' : null;
                    if (kind || it.kind === 'accessory') {
                        let y = 98;
                        for (const a of st.party) {
                            const slot = st.slotFor(it);
                            const cur = a.equip[slot] && st.itemDb(a.equip[slot]);
                            const key = kind || 'mag';
                            const d = (it[key] | 0) - (cur ? cur[key] | 0 : 0);
                            text(g, s, a.name, 212, y, { size: 8, max: 54 });
                            text(g, s, (d > 0 ? '+' : '') + d + ' ' + key.toUpperCase(), 304, y, { size: 8, align: 'right', color: d > 0 ? '#6ae07a' : d < 0 ? '#ff6a6a' : s.dim });
                            y += 11;
                        }
                    }
                }
            }
            if (this.qty) {
                const q = this.qty;
                win(g, s, 204, 150, 108, 46);
                text(g, s, '◀', 212, 157, { color: s.cursor });
                text(g, s, '×' + q.n, 258, 157, { align: 'center', bold: true, size: 11 });
                text(g, s, '▶', 296, 157, { color: s.cursor });
                text(g, s, (q.unit * q.n) + ' ' + this.cur(), 304, 177, { align: 'right', color: s.accent });
                text(g, s, q.mode === 'buy' ? 'Buy' : 'Sell', 212, 177, { color: s.dim, size: 8 });
            }
        }
    }

    TW.menus = { MainMenu, Shop, SlotList, PartyPicker, Screen, anySave, readSlot, slotKey, fmtTime, healAmount, describeSkill, SLOTS };
}]);
