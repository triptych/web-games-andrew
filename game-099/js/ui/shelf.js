// The Cartridge Shelf, the Sticker Book and the share / import dialog.

import { $ } from './screens.js';
import { iconCanvas } from '../view/sprites.js';
import { encodeCart, decodeCart, paletteList, newSticker, uniqueStickerId, newCart } from '../sim/cart.js';
import { addCart, copyCart, deleteCart, getCart } from '../save.js';
import { LIMITS } from '../config.js';

export function createShelf(host) {
    const { ui, audio } = host;
    const list = $('cart-list');
    let importing = false;

    function btn(text, label, fn, cls = '') {
        const b = document.createElement('button');
        b.className = 'btn ' + cls;
        b.textContent = text;
        b.setAttribute('aria-label', label);
        b.addEventListener('click', () => { audio.ui('click'); fn(); });
        return b;
    }

    function refresh() {
        const store = host.store;
        list.textContent = '';
        const rows = [{ id: 'starter', cart: getCart(store, 'starter') }, ...store.carts];
        for (const { id, cart } of rows) {
            const li = document.createElement('li');
            if (store.cur === id) li.className = 'cur';
            const nm = document.createElement('div');
            nm.className = 'nm';
            const b = document.createElement('b');
            b.textContent = cart.name + (id === 'starter' ? ' (built in)' : '');
            const sp = document.createElement('span');
            const own = Object.keys(cart.stickers).length;
            sp.textContent = `${cart.scenes.length} scene${cart.scenes.length > 1 ? 's' : ''} · ${own} custom sticker${own === 1 ? '' : 's'}`;
            nm.append(b, sp);
            li.append(nm);
            li.append(btn('▶', `Play ${cart.name}`, () => { store.cur = id; host.persist(); host.playCart(getCart(store, id), 'room'); }, 'primary'));
            if (id === 'starter') {
                li.append(btn('Copy to edit', 'Copy to edit', () => {
                    const nid = copyCart(store, 'starter');
                    if (nid) { store.cur = nid; host.persist(); refresh(); host.toast('Copied to your shelf.'); }
                    else host.toast('The shelf is full.');
                }));
            } else {
                li.append(btn('✎ Edit', `Edit ${cart.name}`, () => { store.cur = id; host.persist(); ui.closeAll(); host.enterStage(getCart(store, id), 0); }));
                li.append(btn('Use', `Put ${cart.name} in the console`, () => { store.cur = id; host.persist(); refresh(); host.toast(`${cart.name} is in the console.`); }));
            }
            li.append(btn('Share', `Share ${cart.name}`, () => openShare(cart)));
            if (id !== 'starter') {
                li.append(btn('🗑', `Delete ${cart.name}`, () => {
                    if (!confirm(`Delete "${cart.name}"?`)) return;
                    deleteCart(store, id); host.persist(); refresh();
                }, 'danger'));
            }
            list.append(li);
        }
    }

    function openShelf() { refresh(); ui.openScreen('shelf'); }

    $('shelf-new').addEventListener('click', () => {
        audio.ui('click');
        const store = host.store;
        const cart = newCart(`Cart ${store.carts.length + 1}`);
        const id = addCart(store, cart);
        if (!id) { host.toast(`The shelf holds ${LIMITS.carts} carts.`); return; }
        store.cur = id; host.persist();
        ui.closeAll();
        host.enterStage(cart, 0);
    });
    $('shelf-import').addEventListener('click', () => { audio.ui('click'); openImport(); });

    // ------------------------------------------------------------------ the Sticker Book
    function openBook() {
        const grid = $('book-grid');
        grid.textContent = '';
        for (const def of paletteList(host.cart)) {
            const b = document.createElement('button');
            if (!def.builtin) b.classList.add('mine');
            b.append(iconCanvas(def, 40));
            const t = document.createElement('span');
            t.textContent = def.name;
            b.append(t);
            b.addEventListener('click', () => { audio.ui('click'); host.openPress(def.id, 'book'); });
            grid.append(b);
        }
        ui.openScreen('book');
    }
    $('book-new').addEventListener('click', () => { audio.ui('click'); newStickerFlow('book'); });

    function newStickerFlow(ret) {
        const cart = host.ensureEditable();
        if (Object.keys(cart.stickers).filter((k) => cart.stickers[k].cat === 'mine').length >= LIMITS.customStickers) {
            host.toast('That cart has all the stickers it can hold.');
            return null;
        }
        const id = uniqueStickerId(cart);
        cart.stickers[id] = newSticker(id, 'New Sticker');
        host.persist();
        host.openPress(id, ret);
        return id;
    }

    // ------------------------------------------------------------------ share / import
    function openShare(cart) {
        importing = false;
        $('share-title').textContent = `Share "${cart.name}"`;
        $('share-help').textContent = 'Copy this code and send it to a friend. They can import it from their shelf.';
        const t = $('share-text');
        t.value = encodeCart(cart);
        t.readOnly = true;
        $('share-go').hidden = true;
        $('share-copy').hidden = false;
        $('share-msg').textContent = `${t.value.length} characters`;
        ui.openScreen('share');
        t.select();
    }
    function openImport() {
        importing = true;
        $('share-title').textContent = 'Import a cartridge';
        $('share-help').textContent = 'Paste a code that starts with FC1: and press Import.';
        const t = $('share-text');
        t.value = ''; t.readOnly = false;
        $('share-go').hidden = false;
        $('share-copy').hidden = true;
        $('share-msg').textContent = '';
        ui.openScreen('share');
        t.focus();
    }
    $('share-copy').addEventListener('click', async () => {
        const t = $('share-text');
        t.select();
        let ok = false;
        try { await navigator.clipboard.writeText(t.value); ok = true; } catch { /* fall through */ }
        if (!ok) { try { ok = document.execCommand('copy'); } catch { ok = false; } }
        $('share-msg').textContent = ok ? 'Copied!' : 'Select the code and copy it by hand.';
    });
    $('share-go').addEventListener('click', () => {
        if (!importing) return;
        try {
            const cart = decodeCart($('share-text').value);
            const id = addCart(host.store, cart);
            if (!id) throw new Error(`the shelf holds ${LIMITS.carts} carts`);
            host.store.cur = id;
            host.persist();
            refresh();
            ui.closeScreen('share');
            host.toast(`Imported ${cart.name}.`);
        } catch (err) {
            $('share-msg').textContent = 'Could not import: ' + err.message;
        }
    });

    return { refresh, openShelf, openBook, newStickerFlow };
}
