/**
 * mapPanel.js — Slay-the-Spire style branching journey map.
 *
 * Exports:
 *   generateMapGraph()          — called by state.reset() to create a fresh map
 *   initMapPanel(k)             — call once per 'game' scene
 *   showMapPanel(onNodeChosen)  — open the overlay; calls onNodeChosen(node) when player picks
 *
 * Map structure:
 *   7 columns (0–6): Village → 5 branching cols → Boss
 *   Each node: { id, col, row, type, encounterIdx, label, visited, available }
 *   Edges: array of [fromId, toId] pairs
 *
 * NOTE: square brackets are NEVER used in k.text() strings (Kaplay styled-text gotcha).
 */

import { state }    from './state.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, MAP_CONFIG } from './config.js';
import { playMenuMove, playMenuSelect } from './sounds.js';
export { generateMapGraph } from './mapGen.js';

// ----------------------------------------------------------------
// Kaplay rendering
// ----------------------------------------------------------------

let _k = null;

export function initMapPanel(kaplay) {
    _k = kaplay;
}

// ----------------------------------------------------------------
// Panel state
// ----------------------------------------------------------------

let _open          = false;
let _onChosen      = null;
let _choices       = [];        // available next nodes
let _cursorIdx     = 0;
let _ents          = [];        // all Kaplay entities (tagged 'mapOverlay')
let _keyHandles    = [];
let _pulseTimer    = 0;
let _pulseCursors  = [];        // { ent, baseCol } for animated highlights

// Layout constants
const MAP_Z        = 210;
const PAD          = 60;
const HEADER_H     = 60;
const FOOTER_H     = 50;
const LEGEND_H     = 30;
const INNER_TOP    = PAD + HEADER_H;
const INNER_BOT    = GAME_HEIGHT - PAD - FOOTER_H - LEGEND_H;
const INNER_H      = INNER_BOT - INNER_TOP;
const INNER_LEFT   = PAD + 20;
const INNER_RIGHT  = GAME_WIDTH - PAD - 20;
const INNER_W      = INNER_RIGHT - INNER_LEFT;

// Node glyph sizes
const NODE_R       = 18;        // radius / half-size

// ----------------------------------------------------------------
// Public: open the map panel
// ----------------------------------------------------------------

export function showMapPanel(onNodeChosen) {
    if (_open) return;
    _open       = true;
    _onChosen   = onNodeChosen ?? (() => {});
    _cursorIdx  = 0;
    _pulseTimer = 0;
    _pulseCursors = [];

    // Compute available next nodes
    const graph   = state.mapGraph;
    const current = graph.nodes.find(n => n.id === state.currentNodeId);
    _choices = _nextNodes(graph, current);

    _buildUI();
    _attachKeys();
}

// ----------------------------------------------------------------
// Graph helpers
// ----------------------------------------------------------------

function _nextNodes(graph, fromNode) {
    if (!fromNode) return [];
    const nextIds = graph.edges
        .filter(([a]) => a === fromNode.id)
        .map(([, b]) => b);
    return graph.nodes.filter(n => nextIds.includes(n.id));
}

function _nodeById(id) {
    return state.mapGraph.nodes.find(n => n.id === id);
}

// ----------------------------------------------------------------
// UI construction
// ----------------------------------------------------------------

function _add(...comps) {
    const e = _k.add([...comps, 'mapOverlay']);
    _ents.push(e);
    return e;
}

function _buildUI() {
    const graph   = state.mapGraph;
    const current = _nodeById(state.currentNodeId);

    // Full-screen dim
    _add(_k.pos(0, 0), _k.rect(GAME_WIDTH, GAME_HEIGHT), _k.color(0, 0, 0), _k.opacity(0.85), _k.z(MAP_Z));

    // Outer panel
    _add(_k.pos(PAD, PAD), _k.rect(GAME_WIDTH - PAD * 2, GAME_HEIGHT - PAD * 2),
        _k.color(...COLORS.panel), _k.z(MAP_Z + 1));
    _add(_k.pos(PAD, PAD), _k.rect(GAME_WIDTH - PAD * 2, GAME_HEIGHT - PAD * 2),
        _k.outline(2, _k.rgb(...COLORS.panelBorder)), _k.color(...COLORS.panel), _k.z(MAP_Z + 2));

    // Header
    _add(_k.pos(GAME_WIDTH / 2, PAD + 18), _k.text('YOUR JOURNEY', { size: 22 }),
        _k.color(...COLORS.accent), _k.anchor('center'), _k.z(MAP_Z + 3));

    const locationText = current ? `Location: ${current.label}` : '';
    _add(_k.pos(GAME_WIDTH - PAD - 16, PAD + 18), _k.text(locationText, { size: 13 }),
        _k.color(...COLORS.text), _k.anchor('right'), _k.z(MAP_Z + 3));

    // Separator line under header
    _add(_k.pos(PAD + 10, PAD + HEADER_H - 4), _k.rect(GAME_WIDTH - PAD * 2 - 20, 1),
        _k.color(...COLORS.panelBorder), _k.z(MAP_Z + 3));

    // Draw edges first (below nodes)
    _drawEdges(graph);

    // Draw nodes
    _drawNodes(graph, current);

    // Legend
    _buildLegend();

    // Footer
    const hasChoice = _choices.length > 0;
    const footerTxt = hasChoice
        ? 'Up/Down: select path   Space/Enter: travel'
        : 'No paths — press Space to continue';
    _add(_k.pos(GAME_WIDTH / 2, GAME_HEIGHT - PAD - LEGEND_H - 14), _k.text(footerTxt, { size: 12 }),
        _k.color(100, 90, 140), _k.anchor('center'), _k.z(MAP_Z + 3));

    // Start pulse update loop
    const pulseEnt = _add(_k.pos(0, 0), _k.rect(0, 0), _k.color(0, 0, 0), _k.opacity(0), _k.z(MAP_Z));
    pulseEnt.onUpdate(() => {
        _pulseTimer += _k.dt();
        const alpha = (Math.sin(_pulseTimer * Math.PI * 2) + 1) / 2;
        for (const { ent } of _pulseCursors) {
            ent.opacity = 0.15 + alpha * 0.35;
        }
    });

    // Highlight initial cursor choices
    _refreshChoiceCursors();
}

// ----------------------------------------------------------------
// Node screen-space positions
// ----------------------------------------------------------------

function _nodePos(node) {
    const { NODES_PER_COL } = MAP_CONFIG;
    const totalCols = NODES_PER_COL.length;
    const colCount  = NODES_PER_COL[node.col];

    const x = INNER_LEFT + (node.col / (totalCols - 1)) * INNER_W;

    // Vertically distribute nodes within the column
    const segH = INNER_H / Math.max(colCount, 1);
    const y    = INNER_TOP + segH * node.row + segH / 2;

    return { x, y };
}

// ----------------------------------------------------------------
// Draw edges
// ----------------------------------------------------------------

function _drawEdges(graph) {
    const current = _nodeById(state.currentNodeId);
    const availNextIds = new Set(_choices.map(n => n.id));

    for (const [aId, bId] of graph.edges) {
        const a = _nodeById(aId);
        const b = _nodeById(bId);
        if (!a || !b) continue;

        const pa = _nodePos(a);
        const pb = _nodePos(b);

        // Determine edge visibility/color
        const isActive  = (aId === state.currentNodeId && availNextIds.has(bId));
        const isVisited = a.visited && b.visited;

        const col  = isActive  ? [200, 160, 80]   // gold for selectable
                   : isVisited ? [120, 110, 150]   // dim purple for traversed
                   :             [40, 36, 60];      // very dim for future

        const opa  = isActive ? 0.9 : isVisited ? 0.5 : 0.25;

        _drawLine(pa.x, pa.y, pb.x, pb.y, col, opa);
    }
}

function _drawLine(x1, y1, x2, y2, col, opa) {
    const dx  = x2 - x1;
    const dy  = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const angle = Math.atan2(dy, dx);
    const cx    = (x1 + x2) / 2;
    const cy    = (y1 + y2) / 2;

    // Draw as a thin rotated rect
    const e = _k.add([
        _k.pos(cx, cy),
        _k.rect(len, 2),
        _k.color(...col),
        _k.opacity(opa),
        _k.anchor('center'),
        _k.rotate(angle * (180 / Math.PI)),
        _k.z(MAP_Z + 3),
        'mapOverlay',
    ]);
    _ents.push(e);
}

// ----------------------------------------------------------------
// Draw nodes
// ----------------------------------------------------------------

function _drawNodes(graph, current) {
    for (const node of graph.nodes) {
        _drawNode(node, current);
    }
}

function _drawNode(node, current) {
    const { x, y } = _nodePos(node);
    const isCurrent  = node.id === state.currentNodeId;
    const isChoice   = _choices.some(c => c.id === node.id);

    // Background glow for choices (animated separately via _pulseCursors)
    if (isChoice) {
        const glow = _add(
            _k.pos(x, y),
            _k.circle(NODE_R + 8),
            _k.color(...COLORS.accent),
            _k.opacity(0.3),
            _k.anchor('center'),
            _k.z(MAP_Z + 4),
        );
        _pulseCursors.push({ ent: glow });
    }

    // Node shape
    switch (node.type) {
        case 'start':
            _drawDiamond(x, y, node, isCurrent, isChoice);
            break;
        case 'boss':
            _drawStar(x, y, node, isCurrent, isChoice);
            break;
        case 'rest':
            _drawHeart(x, y, node, isCurrent, isChoice);
            break;
        case 'shop':
            _drawShopNode(x, y, node, isCurrent, isChoice);
            break;
        case 'battle':
        default:
            _drawCircleNode(x, y, node, isCurrent, isChoice);
            break;
    }

    // Current position marker (small gold dot above)
    if (isCurrent) {
        _add(_k.pos(x, y - NODE_R - 10), _k.circle(5), _k.color(...COLORS.accent),
            _k.anchor('center'), _k.z(MAP_Z + 6));
    }

    // Label below node
    const labelCol = node.visited ? [140, 130, 160] : isChoice ? COLORS.accent : [60, 55, 90];
    _add(_k.pos(x, y + NODE_R + 8), _k.text(node.label, { size: 9 }),
        _k.color(...labelCol), _k.anchor('top'), _k.z(MAP_Z + 6));
}

function _nodeColor(node, isChoice) {
    if (node.visited) return [100, 90, 130];
    if (isChoice)     return COLORS.accent;
    switch (node.type) {
        case 'start': return COLORS.accent;
        case 'boss':  return COLORS.danger;
        case 'rest':  return COLORS.success;
        case 'shop':  return [200, 180, 80];
        default:      return COLORS.text;
    }
}

function _drawCircleNode(x, y, node, isCurrent, isChoice) {
    const col = _nodeColor(node, isChoice);
    const opa = node.visited ? 0.5 : isChoice ? 1.0 : 0.3;
    _add(_k.pos(x, y), _k.circle(NODE_R), _k.color(...col), _k.opacity(opa),
        _k.anchor('center'), _k.z(MAP_Z + 5));
    if (isCurrent) {
        _add(_k.pos(x, y), _k.circle(NODE_R), _k.outline(2, _k.rgb(...COLORS.accent)),
            _k.color(...col), _k.opacity(opa), _k.anchor('center'), _k.z(MAP_Z + 5));
    }
}

function _drawDiamond(x, y, node, isCurrent, isChoice) {
    // Approximate diamond with a rotated square
    const s   = NODE_R * 1.3;
    const col = _nodeColor(node, isChoice);
    const e   = _k.add([
        _k.pos(x, y),
        _k.rect(s, s),
        _k.color(...col),
        _k.opacity(1),
        _k.anchor('center'),
        _k.rotate(45),
        _k.z(MAP_Z + 5),
        'mapOverlay',
    ]);
    _ents.push(e);
    if (isCurrent) {
        const e2 = _k.add([
            _k.pos(x, y),
            _k.rect(s, s),
            _k.outline(2, _k.rgb(...COLORS.accent)),
            _k.color(...col),
            _k.anchor('center'),
            _k.rotate(45),
            _k.z(MAP_Z + 5),
            'mapOverlay',
        ]);
        _ents.push(e2);
    }
}

function _drawStar(x, y, node, isCurrent, isChoice) {
    const col = _nodeColor(node, isChoice);
    const opa = isChoice ? 1.0 : 0.6;
    // Star glyph via text
    _add(_k.pos(x, y), _k.text('*', { size: NODE_R * 2.4 }),
        _k.color(...col), _k.opacity(opa), _k.anchor('center'), _k.z(MAP_Z + 5));
}

function _drawHeart(x, y, node, isCurrent, isChoice) {
    const col = _nodeColor(node, isChoice);
    const opa = isChoice ? 1.0 : 0.35;
    // Background circle first, then glyph on top
    _add(_k.pos(x, y), _k.circle(NODE_R), _k.color(20, 16, 40), _k.opacity(0.8),
        _k.anchor('center'), _k.z(MAP_Z + 4));
    _add(_k.pos(x, y), _k.text('h', { size: NODE_R * 2 }),
        _k.color(...col), _k.opacity(opa), _k.anchor('center'), _k.z(MAP_Z + 5));
}

function _drawShopNode(x, y, node, isCurrent, isChoice) {
    const col = _nodeColor(node, isChoice);
    const opa = isChoice ? 1.0 : 0.35;
    _add(_k.pos(x, y), _k.circle(NODE_R), _k.color(20, 16, 40), _k.opacity(0.8),
        _k.anchor('center'), _k.z(MAP_Z + 4));
    _add(_k.pos(x, y), _k.text('$', { size: NODE_R * 1.6 }),
        _k.color(...col), _k.opacity(opa), _k.anchor('center'), _k.z(MAP_Z + 5));
}

// ----------------------------------------------------------------
// Legend
// ----------------------------------------------------------------

function _buildLegend() {
    const items = [
        { glyph: 'V', col: COLORS.accent,  label: 'Village' },
        { glyph: 'o', col: COLORS.text,    label: 'Battle'  },
        { glyph: 'h', col: COLORS.success, label: 'Rest'    },
        { glyph: '$', col: [200, 180, 80], label: 'Shop'    },
        { glyph: '*', col: COLORS.danger,  label: 'Boss'    },
    ];
    const legendY = GAME_HEIGHT - PAD - LEGEND_H + 8;
    const totalW  = items.length * 140;
    let lx        = GAME_WIDTH / 2 - totalW / 2;

    for (const item of items) {
        _add(_k.pos(lx, legendY), _k.text(`${item.glyph}  ${item.label}`, { size: 11 }),
            _k.color(...item.col), _k.anchor('left'), _k.z(MAP_Z + 3));
        lx += 140;
    }
}

// ----------------------------------------------------------------
// Choice cursor highlight refresh
// ----------------------------------------------------------------

// Per-choice selection highlight rectangles (destroyed/recreated on nav)
let _choiceHighlights = [];

function _refreshChoiceCursors() {
    // Destroy old highlights
    _choiceHighlights.forEach(e => { if (!e.is('destroyed')) e.destroy(); });
    _choiceHighlights = [];

    for (let i = 0; i < _choices.length; i++) {
        const node   = _choices[i];
        const { x, y } = _nodePos(node);
        const active = i === _cursorIdx;

        // Selection ring
        const ring = _k.add([
            _k.pos(x, y),
            _k.circle(NODE_R + 5),
            _k.outline(active ? 3 : 1, _k.rgb(...(active ? COLORS.accent : COLORS.panelBorder))),
            _k.color(...COLORS.panel),
            _k.opacity(active ? 0.0 : 0.0),   // transparent fill, just the outline matters
            _k.anchor('center'),
            _k.z(MAP_Z + 7),
            'mapOverlay',
        ]);
        _ents.push(ring);
        _choiceHighlights.push(ring);

        // Cursor label next to node
        const labelX = x + NODE_R + 12;
        const selLabel = _k.add([
            _k.pos(labelX, y),
            _k.text(active ? '< choose' : '', { size: 11 }),
            _k.color(...COLORS.accent),
            _k.anchor('left'),
            _k.z(MAP_Z + 7),
            'mapOverlay',
        ]);
        _ents.push(selLabel);
        _choiceHighlights.push(selLabel);
    }
}

// ----------------------------------------------------------------
// Key handling
// ----------------------------------------------------------------

function _attachKeys() {
    _keyHandles = [
        _k.onKeyPress('up',    _navUp),
        _k.onKeyPress('w',     _navUp),
        _k.onKeyPress('down',  _navDown),
        _k.onKeyPress('s',     _navDown),
        _k.onKeyPress('space', _confirm),
        _k.onKeyPress('enter', _confirm),
    ];
}

function _detachKeys() {
    _keyHandles.forEach(h => h.cancel());
    _keyHandles = [];
}

function _navUp() {
    if (_choices.length === 0) return;
    _cursorIdx = (_cursorIdx - 1 + _choices.length) % _choices.length;
    playMenuMove();
    _refreshChoiceCursors();
}

function _navDown() {
    if (_choices.length === 0) return;
    _cursorIdx = (_cursorIdx + 1) % _choices.length;
    playMenuMove();
    _refreshChoiceCursors();
}

function _confirm() {
    playMenuSelect();
    _close();
}

function _close() {
    _open = false;
    _detachKeys();

    const chosen = _choices[_cursorIdx] ?? null;

    // Advance map state
    if (chosen) {
        // Mark current node visited (already was), mark chosen as visited
        const graph = state.mapGraph;
        chosen.visited = true;
        state.currentNodeId = chosen.id;
        // Mark it available (and compute next available nodes for future render)
        const nextIds = graph.edges.filter(([a]) => a === chosen.id).map(([, b]) => b);
        graph.nodes.forEach(n => {
            if (nextIds.includes(n.id)) n.available = true;
        });
    }

    _k.destroyAll('mapOverlay');
    _ents  = [];
    _pulseCursors  = [];
    _choiceHighlights = [];

    const cb = _onChosen;
    _onChosen = null;
    cb(chosen);
}
