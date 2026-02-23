/**
 * commandMenu.js — Keyboard-navigable action menu for battle turns.
 *
 * Listens for 'turnStart' event (actor = party member).
 * Shows a menu with actions: Attack, Magic, Item, Defend, Run.
 * When "Magic" selected → sub-menu of abilities.
 * When action chosen → emits 'actionChosen'(actor, action).
 *
 * Key design rule: key handlers are registered ONCE per phase transition,
 * never from inside a handler. Visual redraws use _renderMenu() only.
 *
 * NOTE: Square brackets MUST NOT appear in k.text() strings.
 * Use parentheses instead.
 */

import { events }   from './events.js';
import { state }    from './state.js';
import { ABILITY_DEFS, CLASS_ABILITIES, ENCOUNTERS, BATTLE, COLORS, SHOP_ITEMS } from './config.js';
import { playMenuMove, playMenuSelect, playMenuBack } from './sounds.js';
import { initMessageLog, showMessage } from './ui.js';

// ----------------------------------------------------------------
// Module-level state
// ----------------------------------------------------------------

let _k        = null;
let _actor    = null;
let _phase    = 'hidden';   // 'hidden' | 'main' | 'ability' | 'item' | 'target'

let _mainIndex    = 0;
let _abilityIndex = 0;
let _targetIndex  = 0;

let _pendingAbilityId = null;
let _pendingItemId    = null;
let _itemIndex        = 0;

// Snapshot of targets for the current target-selection phase
let _currentTargets = [];

// Entity refs for the menu visuals — destroyed on each redraw
let _menuEnts = [];

// Kaplay key-handler cancel functions — cancelled on phase change
let _keyHandlers = [];

// ----------------------------------------------------------------
// Menu definitions
// ----------------------------------------------------------------

const MAIN_ACTIONS = [
    { label: 'Attack',  id: 'attack'  },
    { label: 'Magic',   id: 'magic'   },
    { label: 'Item',    id: 'item'    },
    { label: 'Defend',  id: 'defend'  },
    { label: 'Run',     id: 'run'     },
];

// ----------------------------------------------------------------
// Public init
// ----------------------------------------------------------------

export function isCommandMenuInSubPhase() {
    return _phase === 'ability' || _phase === 'item' || _phase === 'target';
}

export function initCommandMenu(kaplay) {
    _k = kaplay;
    initMessageLog();

    const off1 = events.on('turnStart', _onTurnStart);
    _k.onSceneLeave(() => { off1(); _enterPhase('hidden'); });
}

// ----------------------------------------------------------------
// Phase management — single entry point for all transitions
// ----------------------------------------------------------------

function _enterPhase(phase, extra) {
    // Always cancel existing key handlers before registering new ones
    _cancelKeyHandlers();
    _phase = phase;

    if (phase === 'hidden') {
        _clearMenuEnts();
        return;
    }

    if (phase === 'main') {
        _renderMainMenu();
        _registerMainKeys();
    } else if (phase === 'ability') {
        _renderAbilityMenu();
        _k.wait(0, _registerAbilityKeys);
    } else if (phase === 'item') {
        _renderItemMenu();
        // Defer key registration by one frame so the triggering Space/Enter
        // keypress does not immediately fire the item-confirm handler.
        _k.wait(0, _registerItemKeys);
    } else if (phase === 'target') {
        _currentTargets = extra ?? [];
        _renderTargetMenu();
        _k.wait(0, _registerTargetKeys);
    }
}

// ----------------------------------------------------------------
// Turn start
// ----------------------------------------------------------------

function _onTurnStart(actor) {
    _actor     = actor;
    _mainIndex = 0;
    showMessage(`${actor.name}'s turn.`);
    _enterPhase('main');
}

// ----------------------------------------------------------------
// Pure render functions (no side effects on key handlers)
// ----------------------------------------------------------------

function _clearMenuEnts() {
    for (const e of _menuEnts) {
        if (e && e.exists()) _k.destroy(e);
    }
    _menuEnts = [];
}

function _add(comps) {
    const e = _k.add(comps);
    _menuEnts.push(e);
    return e;
}

function _renderPanel(headerText) {
    _clearMenuEnts();

    const { PANEL_X, PANEL_Y, PANEL_W, PANEL_H } = BATTLE;

    _add([
        _k.pos(PANEL_X, PANEL_Y),
        _k.rect(PANEL_W, PANEL_H),
        _k.color(...COLORS.panel),
        _k.z(100),
    ]);
    _add([
        _k.pos(PANEL_X, PANEL_Y),
        _k.rect(PANEL_W, PANEL_H),
        _k.outline(2, _k.rgb(...COLORS.panelBorder)),
        _k.color(...COLORS.panel),
        _k.z(101),
    ]);

    const headerColor = _actor ? (_actor.color ?? COLORS.accent) : COLORS.accent;
    _add([
        _k.pos(PANEL_X + 12, PANEL_Y + 8),
        _k.text(headerText, { size: 13 }),
        _k.color(...headerColor),
        _k.anchor('topleft'),
        _k.z(102),
    ]);
}

function _renderMainMenu() {
    _renderPanel(_actor ? _actor.name : '');

    const { PANEL_X, PANEL_Y } = BATTLE;
    const startY = PANEL_Y + 36;

    MAIN_ACTIONS.forEach((action, i) => {
        const sel = i === _mainIndex;
        _add([
            _k.pos(PANEL_X + 24, startY + i * 28),
            _k.text((sel ? '> ' : '  ') + action.label, { size: 15 }),
            _k.color(...(sel ? COLORS.accent : COLORS.text)),
            _k.anchor('topleft'),
            _k.z(102),
        ]);
    });
}

function _renderAbilityMenu() {
    const abilities = CLASS_ABILITIES[_actor.classId] ?? [];
    _renderPanel(`${_actor.name}  -- Magic`);

    const { PANEL_X, PANEL_Y } = BATTLE;
    const startY = PANEL_Y + 36;

    abilities.forEach((abilId, i) => {
        const abil = ABILITY_DEFS[abilId];
        if (!abil) return;
        const sel   = i === _abilityIndex;
        const hasMp = _actor.mp >= abil.mp;
        const col   = !hasMp ? [80, 60, 100] : sel ? COLORS.accent : COLORS.text;

        _add([
            _k.pos(PANEL_X + 24, startY + i * 26),
            _k.text((sel ? '> ' : '  ') + abil.name + `  (${abil.mp}MP)`, { size: 13 }),
            _k.color(...col),
            _k.anchor('topleft'),
            _k.z(102),
        ]);
    });
}

function _getUsableItems() {
    // Returns array of { itemId, item } for items with count > 0
    return Object.entries(state.inventory)
        .filter(([, count]) => count > 0)
        .map(([itemId]) => ({ itemId, item: SHOP_ITEMS[itemId] }))
        .filter(({ item }) => !!item);
}

function _renderItemMenu() {
    const usable = _getUsableItems();
    _renderPanel(`${_actor ? _actor.name : ''}  -- Items`);

    const { PANEL_X, PANEL_Y } = BATTLE;
    const startY = PANEL_Y + 36;

    if (usable.length === 0) {
        _add([
            _k.pos(PANEL_X + 24, startY),
            _k.text('  No items', { size: 13 }),
            _k.color(80, 70, 100),
            _k.anchor('topleft'),
            _k.z(102),
        ]);
        return;
    }

    usable.forEach(({ itemId, item }, i) => {
        const sel = i === _itemIndex;
        const count = state.inventory[itemId];
        _add([
            _k.pos(PANEL_X + 24, startY + i * 26),
            _k.text((sel ? '> ' : '  ') + item.name + `  x${count}`, { size: 13 }),
            _k.color(...(sel ? COLORS.accent : COLORS.text)),
            _k.anchor('topleft'),
            _k.z(102),
        ]);
    });
}

function _registerItemKeys() {
    const usable = _getUsableItems();
    const n = usable.length;

    _keyHandlers.push(_k.onKeyPress('up',   _ifActive(() => {
        if (n === 0) return;
        _itemIndex = (_itemIndex - 1 + n) % n;
        playMenuMove(); _renderItemMenu();
    })));
    _keyHandlers.push(_k.onKeyPress('w',    _ifActive(() => {
        if (n === 0) return;
        _itemIndex = (_itemIndex - 1 + n) % n;
        playMenuMove(); _renderItemMenu();
    })));
    _keyHandlers.push(_k.onKeyPress('down', _ifActive(() => {
        if (n === 0) return;
        _itemIndex = (_itemIndex + 1) % n;
        playMenuMove(); _renderItemMenu();
    })));
    _keyHandlers.push(_k.onKeyPress('s',    _ifActive(() => {
        if (n === 0) return;
        _itemIndex = (_itemIndex + 1) % n;
        playMenuMove(); _renderItemMenu();
    })));
    _keyHandlers.push(_k.onKeyPress('space',     _ifActive(() => _itemConfirm(usable))));
    _keyHandlers.push(_k.onKeyPress('enter',     _ifActive(() => _itemConfirm(usable))));
    _keyHandlers.push(_k.onKeyPress('escape',    _ifActive(() => { playMenuBack(); _enterPhase('main'); })));
    _keyHandlers.push(_k.onKeyPress('backspace', _ifActive(() => { playMenuBack(); _enterPhase('main'); })));
}

function _itemConfirm(usable) {
    if (_phase !== 'item') return;
    if (usable.length === 0) { showMessage('No items.'); return; }

    const { itemId, item } = usable[_itemIndex];
    playMenuSelect();

    const aliveParty = state.aliveParty;
    const koParty    = state.party.filter(m => m.isKO);

    if (item.effect === 'revive') {
        if (koParty.length === 0) { showMessage('No fallen allies.'); return; }
        _targetIndex = 0;
        _pendingItemId = itemId;
        _pendingAbilityId = null;
        _enterPhase('target', koParty);
    } else if (item.effect === 'healHp' || item.effect === 'healMp' || item.effect === 'cureStatus') {
        _targetIndex = 0;
        _pendingItemId = itemId;
        _pendingAbilityId = null;
        _enterPhase('target', aliveParty);
    } else {
        // Fallback: use on first alive
        _enterPhase('hidden');
        events.emit('actionChosen', _actor, { type: 'item', itemId, targets: [aliveParty[0]] });
    }
}

function _renderTargetMenu() {
    _renderPanel('Choose target:');

    const { PANEL_X, PANEL_Y } = BATTLE;

    _currentTargets.forEach((t, i) => {
        const sel = i === _targetIndex;
        _add([
            _k.pos(PANEL_X + 24, PANEL_Y + 36 + i * 26),
            _k.text((sel ? '> ' : '  ') + t.name + `  HP ${t.hp}/${t.maxHp}`, { size: 13 }),
            _k.color(...(sel ? COLORS.accent : COLORS.text)),
            _k.anchor('topleft'),
            _k.z(102),
        ]);
    });
}

// ----------------------------------------------------------------
// Key handler registration (called once per phase entry)
// ----------------------------------------------------------------

function _cancelKeyHandlers() {
    for (const h of _keyHandlers) h.cancel();
    _keyHandlers = [];
}

// Wrap a key callback so it no-ops while the escape/pause menu is open.
function _ifActive(fn) {
    return (...args) => { if (!state.isPaused) fn(...args); };
}

function _registerMainKeys() {
    _keyHandlers.push(_k.onKeyPress('up',    _ifActive(_mainUp)));
    _keyHandlers.push(_k.onKeyPress('w',     _ifActive(_mainUp)));
    _keyHandlers.push(_k.onKeyPress('down',  _ifActive(_mainDown)));
    _keyHandlers.push(_k.onKeyPress('s',     _ifActive(_mainDown)));
    _keyHandlers.push(_k.onKeyPress('space', _ifActive(_mainConfirm)));
    _keyHandlers.push(_k.onKeyPress('enter', _ifActive(_mainConfirm)));
}

function _mainUp() {
    _mainIndex = (_mainIndex - 1 + MAIN_ACTIONS.length) % MAIN_ACTIONS.length;
    playMenuMove();
    _renderMainMenu();
}
function _mainDown() {
    _mainIndex = (_mainIndex + 1) % MAIN_ACTIONS.length;
    playMenuMove();
    _renderMainMenu();
}
function _mainConfirm() {
    if (_phase !== 'main') return;
    const action = MAIN_ACTIONS[_mainIndex];
    playMenuSelect();

    switch (action.id) {
        case 'attack':
            _targetIndex = 0;
            _pendingAbilityId = null;
            _enterPhase('target', state.enemies.filter(e => !e.isKO));
            break;

        case 'magic':
            _abilityIndex = 0;
            _enterPhase('ability');
            break;

        case 'item':
            _itemIndex = 0;
            _enterPhase('item');
            break;

        case 'defend':
            _enterPhase('hidden');
            events.emit('actionChosen', _actor, { type: 'defend' });
            break;

        case 'run': {
            const enc = ENCOUNTERS[state.encounterIndex] ?? null;
            if (enc && enc.isBoss) {
                showMessage('Cannot flee from a boss!');
                return;
            }
            if (Math.random() < 0.5) {
                _enterPhase('hidden');
                showMessage('The party fled!');
                events.emit('battleEnd', 'flee');
            } else {
                showMessage('Could not escape!');
            }
            break;
        }
    }
}

function _registerAbilityKeys() {
    const abilities = CLASS_ABILITIES[_actor.classId] ?? [];

    _keyHandlers.push(_k.onKeyPress('up',        _ifActive(() => { _abilityIndex = (_abilityIndex - 1 + abilities.length) % abilities.length; playMenuMove(); _renderAbilityMenu(); })));
    _keyHandlers.push(_k.onKeyPress('w',         _ifActive(() => { _abilityIndex = (_abilityIndex - 1 + abilities.length) % abilities.length; playMenuMove(); _renderAbilityMenu(); })));
    _keyHandlers.push(_k.onKeyPress('down',      _ifActive(() => { _abilityIndex = (_abilityIndex + 1) % abilities.length; playMenuMove(); _renderAbilityMenu(); })));
    _keyHandlers.push(_k.onKeyPress('s',         _ifActive(() => { _abilityIndex = (_abilityIndex + 1) % abilities.length; playMenuMove(); _renderAbilityMenu(); })));
    _keyHandlers.push(_k.onKeyPress('space',     _ifActive(() => _abilityConfirm(abilities))));
    _keyHandlers.push(_k.onKeyPress('enter',     _ifActive(() => _abilityConfirm(abilities))));
    _keyHandlers.push(_k.onKeyPress('escape',    _ifActive(() => { playMenuBack(); _enterPhase('main'); })));
    _keyHandlers.push(_k.onKeyPress('backspace', _ifActive(() => { playMenuBack(); _enterPhase('main'); })));
}

function _abilityConfirm(abilities) {
    if (_phase !== 'ability') return;
    const abilId = abilities[_abilityIndex];
    const abil   = ABILITY_DEFS[abilId];
    if (!abil) return;

    if (_actor.mp < abil.mp) {
        showMessage('Not enough MP!');
        return;
    }
    playMenuSelect();

    const aliveEnemies = state.enemies.filter(e => !e.isKO);
    const aliveParty   = state.aliveParty;

    if (abil.target === 'allEnemies') {
        _enterPhase('hidden');
        events.emit('actionChosen', _actor, { type: 'ability', abilityId: abilId, targets: aliveEnemies });
    } else if (abil.target === 'allAllies') {
        _enterPhase('hidden');
        events.emit('actionChosen', _actor, { type: 'ability', abilityId: abilId, targets: aliveParty });
    } else if (abil.target === 'self') {
        _enterPhase('hidden');
        events.emit('actionChosen', _actor, { type: 'ability', abilityId: abilId, targets: [_actor] });
    } else if (abil.target === 'ally') {
        _targetIndex = 0;
        _pendingAbilityId = abilId;
        _enterPhase('target', aliveParty);
    } else {
        // 'enemy' and fallback
        _targetIndex = 0;
        _pendingAbilityId = abilId;
        _enterPhase('target', aliveEnemies);
    }
}

function _registerTargetKeys() {
    const n = _currentTargets.length;

    _keyHandlers.push(_k.onKeyPress('up',    _ifActive(() => { _targetIndex = (_targetIndex - 1 + n) % n; playMenuMove(); _renderTargetMenu(); })));
    _keyHandlers.push(_k.onKeyPress('left',  _ifActive(() => { _targetIndex = (_targetIndex - 1 + n) % n; playMenuMove(); _renderTargetMenu(); })));
    _keyHandlers.push(_k.onKeyPress('down',  _ifActive(() => { _targetIndex = (_targetIndex + 1) % n; playMenuMove(); _renderTargetMenu(); })));
    _keyHandlers.push(_k.onKeyPress('right', _ifActive(() => { _targetIndex = (_targetIndex + 1) % n; playMenuMove(); _renderTargetMenu(); })));
    _keyHandlers.push(_k.onKeyPress('space', _ifActive(_targetConfirm)));
    _keyHandlers.push(_k.onKeyPress('enter', _ifActive(_targetConfirm)));
    _keyHandlers.push(_k.onKeyPress('escape',    _ifActive(_targetBack)));
    _keyHandlers.push(_k.onKeyPress('backspace', _ifActive(_targetBack)));
}

function _targetConfirm() {
    if (_phase !== 'target') return;
    playMenuSelect();

    const target = _currentTargets[_targetIndex];
    if (!target) return;

    if (_pendingItemId) {
        const id = _pendingItemId;
        _pendingItemId = null;
        _enterPhase('hidden');
        events.emit('actionChosen', _actor, { type: 'item', itemId: id, targets: [target] });
    } else if (_pendingAbilityId) {
        const id = _pendingAbilityId;
        _pendingAbilityId = null;
        _enterPhase('hidden');
        events.emit('actionChosen', _actor, { type: 'ability', abilityId: id, targets: [target] });
    } else {
        _enterPhase('hidden');
        events.emit('actionChosen', _actor, { type: 'attack', targets: [target] });
    }
}

function _targetBack() {
    playMenuBack();
    if (_pendingItemId) {
        _pendingItemId = null;
        _enterPhase('item');
    } else if (_pendingAbilityId) {
        _pendingAbilityId = null;
        _enterPhase('ability');
    } else {
        _enterPhase('main');
    }
}
