// ============================================================
// Coppergate Lane — main entry point.
// Wires world, battle, and UI panels together and routes input
// based on the current game MODE.
// ============================================================
import { state } from './state.js';
import { events } from './events.js';
import { initAudio, sfx } from './sounds.js';
import { World } from './world.js';
import { Battle } from './battle.js';
import { Dialogue, Menu, Inventory, QuestLog, Shop, statusLines } from './ui.js';

const $ = (id) => document.getElementById(id);

// ---- Modes ----
const MODE = { TITLE: 'title', WORLD: 'world', DIALOGUE: 'dialogue',
               MENU: 'menu', INVENTORY: 'inventory', QUESTS: 'quests',
               SHOP: 'shop', BATTLE: 'battle' };
let mode = MODE.TITLE;

// ---- Systems ----
const canvas = $('game');
const world = new World(canvas);
const battle = new Battle({
  root: $('battle'), enemies: $('battle-enemies'),
  party: $('battle-party'), log: $('battle-log'), menu: $('battle-menu'),
});
const dialogue = new Dialogue();
const menu = new Menu(openPanel);
const inventory = new Inventory();
const questLog = new QuestLog();
const shop = new Shop();

// ---- Wire world callbacks ----
world.onEncounter = (foes, isBoss = false) => {
  mode = MODE.BATTLE;
  battle.start(foes, isBoss);
};
world.onDialogue = (lines) => {
  mode = MODE.DIALOGUE;
  dialogue.show(lines, () => { mode = MODE.WORLD; });
};
world.onShop = () => { mode = MODE.SHOP; shop.open(); };

battle.onEnd = () => { mode = MODE.WORLD; };

// ---- Panel opener (from pause menu) ----
function openPanel(name) {
  menu.close();
  if (name === 'inventory') { mode = MODE.INVENTORY; inventory.open(); }
  else if (name === 'quests') { mode = MODE.QUESTS; questLog.open(); }
  else if (name === 'status') {
    mode = MODE.DIALOGUE;
    dialogue.show(statusLines(), () => { mode = MODE.WORLD; });
  }
}

// ---- HUD ----
function updateHUD() {
  $('hud-gold').textContent = `◈ ${state.gold}`;
  $('hud-loc').textContent = world.map.name;
}
events.on('goldChanged', updateHUD);
events.on('locationChanged', updateHUD);
events.on('questComplete', (id) => {
  // brief toast via dialogue would interrupt; keep it quiet — HUD/log covers it
});

// ---- Input ----
const held = new Set();
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['arrowup','arrowdown','arrowleft','arrowright',' ','tab'].includes(k)) e.preventDefault();

  if (mode === MODE.TITLE) return;

  // one-shot keys per mode
  if (mode === MODE.WORLD) {
    if (['arrowup','w'].includes(k)) startMove(0, -1);
    else if (['arrowdown','s'].includes(k)) startMove(0, 1);
    else if (['arrowleft','a'].includes(k)) startMove(-1, 0);
    else if (['arrowright','d'].includes(k)) startMove(1, 0);
    else if (['enter',' ','x'].includes(k)) world.interact();
    else if (k === 'm') { sfx.confirm(); mode = MODE.MENU; menu.open(); }
    else if (k === 'i') { mode = MODE.INVENTORY; inventory.open(); }
    else if (k === 'q') { mode = MODE.QUESTS; questLog.open(); }
    return;
  }
  if (mode === MODE.DIALOGUE) {
    if (['enter',' ','x','z'].includes(k)) dialogue.advance();
    return;
  }
  if (mode === MODE.MENU) { menu.handleKey(k); if (!menu.isOpen && mode === MODE.MENU) mode = MODE.WORLD; return; }
  if (mode === MODE.INVENTORY) { const r = inventory.handleKey(k); if (r === 'back') mode = MODE.WORLD; return; }
  if (mode === MODE.QUESTS) { const r = questLog.handleKey(k); if (r === 'back') mode = MODE.WORLD; return; }
  if (mode === MODE.SHOP) { const r = shop.handleKey(k); if (r === 'back') mode = MODE.WORLD; return; }
  if (mode === MODE.BATTLE) { battle.handleKey(k); return; }
});

// continuous movement when holding a direction
let moveTimer = 0;
function startMove(dx, dy) {
  world.tryMove(dx, dy);
}

// ---- Title ----
$('btn-start').addEventListener('click', () => {
  initAudio();
  sfx.confirm();
  $('title').classList.add('hidden');
  mode = MODE.WORLD;
  updateHUD();
});

// ---- Main loop ----
function loop() {
  if (mode !== MODE.TITLE && mode !== MODE.BATTLE) {
    world.render();
  }
  requestAnimationFrame(loop);
}
loop();

// expose for debugging
window.__game = { state, world, battle };
