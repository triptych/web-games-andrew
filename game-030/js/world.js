// ============================================================
// world.js — overworld: tile rendering, movement, interaction,
// random encounters, warps, chests/objects.
// ============================================================
import { MAPS, SOLID } from './maps.js';
import { NPCS, ENCOUNTERS, ENEMIES, ITEMS } from './data.js';
import { state } from './state.js';
import { events } from './events.js';
import { sfx } from './sounds.js';

const TILE = 32;
const VIEW_W = 20, VIEW_H = 15;

// Tile colors (RPG-Maker-ish flat palette)
const TILE_STYLE = {
  '.': { fill: '#3a5a2e' },
  ',': { fill: '#8a7248' },   // path
  'f': { fill: '#3a5a2e', deco: '🌼' },
  'T': { fill: '#2a4020', deco: '🌲' },
  '#': { fill: '#6a5238' },   // building wall
  '~': { fill: '#2e5a7a', anim: true },
  'r': { fill: '#3a5a2e', deco: '🪨' },
  '=': { fill: '#7a5a38', deco: '🪧' },
  'B': { fill: '#5a2a2a' },   // boss lair floor
};

export class World {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.anim = 0;
    this.moving = false;      // input lock during transitions
    this.pickedObjects = new Set(); // "map:x,y" of collected objects
    this.onEncounter = null;  // set by main
    this.onDialogue = null;
    this.onShop = null;
  }

  get map() { return MAPS[state.map]; }

  tileAt(x, y) {
    const rows = this.map.tiles;
    if (y < 0 || y >= rows.length || x < 0 || x >= rows[y].length) return 'T';
    return rows[y][x];
  }

  npcAt(x, y) {
    return (this.map.npcs || []).find(n => n.x === x && n.y === y);
  }
  objectAt(x, y) {
    const key = `${state.map}:${x},${y}`;
    if (this.pickedObjects.has(key)) return null;
    return (this.map.objects || []).find(o => o.x === x && o.y === y);
  }
  warpAt(x, y) {
    return (this.map.warps || []).find(w => w.x === x && w.y === y);
  }

  isSolid(x, y) {
    const t = this.tileAt(x, y);
    if (SOLID.has(t)) return true;
    if (this.npcAt(x, y)) return true;
    const o = this.objectAt(x, y);
    if (o && (o.type === 'chest' || o.type === 'kettle' || o.type === 'boss')) return true;
    return false;
  }

  tryMove(dx, dy) {
    if (this.moving) return;
    const nx = state.px + dx, ny = state.py + dy;
    state.facing = { dx, dy };

    // warp?
    const w = this.warpAt(nx, ny);
    if (w) { this._warp(w); return; }

    if (this.isSolid(nx, ny)) { return; }

    state.px = nx; state.py = ny;
    sfx.step();

    // random encounter check
    const enc = ENCOUNTERS[state.map];
    if (enc && enc.rate > 0 && Math.random() < enc.rate) {
      this._triggerEncounter(enc);
    }
  }

  _warp(w) {
    this.moving = true;
    setTimeout(() => {
      state.map = w.to; state.px = w.tx; state.py = w.ty;
      events.emit('locationChanged', this.map.name);
      sfx.confirm();
      this.moving = false;
    }, 120);
  }

  _triggerEncounter(enc) {
    const pool = enc.pool;
    const n = 1 + (Math.random() < 0.4 ? 1 : 0) + (Math.random() < 0.15 ? 1 : 0);
    const foes = [];
    for (let i = 0; i < n; i++) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      foes.push(id);
    }
    sfx.encounter();
    if (this.onEncounter) this.onEncounter(foes);
  }

  // Interact with the tile the player faces
  interact() {
    const f = state.facing || { dx: 0, dy: 1 };
    const tx = state.px + f.dx, ty = state.py + f.dy;

    const npc = this.npcAt(tx, ty);
    if (npc) {
      sfx.confirm();
      const def = NPCS[npc.id];
      const result = def.talk(state);
      if (result && result.action) {
        if (result.action === 'openShop' && this.onShop) this.onShop();
        else if (result.action === 'giveScraps') this._giveScraps();
        return;
      }
      if (this.onDialogue) this.onDialogue(result);
      return;
    }

    const obj = this.objectAt(tx, ty);
    if (obj) { this._handleObject(obj, tx, ty); return; }
  }

  _giveScraps() {
    state.removeItem('scrap', 5);
    state.flags.scrapsGiven = true;
    state.completeQuest('side_scraps');
    if (this.onDialogue) this.onDialogue([
      ["Trina", "Five scraps, just like that! You're a marvel. Here — I finished it. A Spark Rod. Zap responsibly."],
    ]);
  }

  _handleObject(obj, tx, ty) {
    const key = `${state.map}:${tx},${ty}`;
    if (obj.type === 'chest') {
      state.addItem(obj.item, obj.qty || 1);
      this.pickedObjects.add(key);
      sfx.coin();
      const it = obj.item;
      if (this.onDialogue) this.onDialogue([["", `Found ${obj.qty || 1}× ${itemName(it)}!`]]);
    } else if (obj.type === 'kettle') {
      state.flags.hasKettle = true;
      this.pickedObjects.add(key);
      sfx.confirm();
      if (this.onDialogue) this.onDialogue([["", "You retrieved Mabel's copper kettle! Better get it back to her."]]);
    } else if (obj.type === 'boss') {
      if (!state.flags.berthaUnlocked) {
        if (this.onDialogue) this.onDialogue([["", "A huge shape slumbers here, clutching something golden. Best not disturb it yet..."]]);
      } else if (state.flags.berthaDefeated) {
        if (this.onDialogue) this.onDialogue([["", "The lair is quiet now. Just scattered cogs and morning light."]]);
      } else {
        sfx.encounter();
        if (this.onEncounter) this.onEncounter(['bigbertha'], true);
      }
    }
  }

  // ---- Rendering ----
  render() {
    this.anim += 0.05;
    const ctx = this.ctx;
    ctx.fillStyle = '#0e0b08';
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);

    for (let y = 0; y < VIEW_H; y++) {
      for (let x = 0; x < VIEW_W; x++) {
        const t = this.tileAt(x, y);
        const s = TILE_STYLE[t] || TILE_STYLE['.'];
        let fill = s.fill;
        if (s.anim) {
          const w = Math.sin(this.anim + x * 0.5 + y * 0.3) * 12;
          fill = `rgb(46,${90 + w},${122 + w})`;
        }
        ctx.fillStyle = fill;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        // subtle grid
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
        if (s.deco) {
          ctx.font = '22px serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(s.deco, x * TILE + TILE / 2, y * TILE + TILE / 2 + 2);
        }
      }
    }

    // labels
    (this.map.labels || []).forEach(l => {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'rgba(244,232,208,0.9)';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(l.text, l.x * TILE, l.y * TILE - 12);
    });

    // objects
    (this.map.objects || []).forEach(o => {
      const key = `${state.map}:${o.x},${o.y}`;
      if (this.pickedObjects.has(key)) return;
      let g = '📦';
      if (o.type === 'kettle') g = '🫖';
      if (o.type === 'boss') g = state.flags.berthaDefeated ? '⚙️' : '💤';
      ctx.font = '24px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g, o.x * TILE + TILE / 2, o.y * TILE + TILE / 2);
    });

    // NPCs
    (this.map.npcs || []).forEach(n => {
      const def = NPCS[n.id];
      ctx.font = '26px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.sprite, n.x * TILE + TILE / 2, n.y * TILE + TILE / 2);
    });

    // warps (little arrows on ground)
    (this.map.warps || []).forEach(w => {
      ctx.font = '16px serif';
      ctx.fillStyle = 'rgba(240,200,96,0.7)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('▪', w.x * TILE + TILE / 2, w.y * TILE + TILE / 2);
    });

    // player
    const px = state.px * TILE + TILE / 2, py = state.py * TILE + TILE / 2;
    ctx.font = '26px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🧑‍🔧', px, py + 1);
  }
}

function itemName(id) {
  return ITEMS[id] ? ITEMS[id].name : id;
}
