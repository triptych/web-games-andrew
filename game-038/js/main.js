// ============================================================
// main.js - boot (GDD 16)
// Wire the systems, wire the chrome, put a screen up. Nothing here knows
// any rules; it is the only file allowed to know about both.
// ============================================================
import { $, $$, el } from './core/util.js';
import { bus } from './core/bus.js';
import { state } from './game/state.js';
import { wireQuests, checkQuests } from './game/quests.js';
import { wireScenes } from './game/scenes.js';
import { wireAutosave, anySave, loadFrom } from './game/save.js';
import { show, syncChrome, toast, currentScreenName, overlayOpen, closeOverlay, confirmDialog } from './ui/shell.js';
import { wireSceneUI, playPending } from './ui/scene.js';
import { startAudio, unlock, playMusic, sfx, setVolume } from './audio.js';

// Screens register themselves on import.
import './ui/title.js';
import './ui/map.js';
import './ui/battle.js';
import './ui/brood.js';
import './ui/pack.js';
import './ui/journal.js';

// ---- systems ----
wireQuests();
wireScenes();
wireSceneUI();
wireAutosave();

// ---- chrome ----
for (const btn of $$('#tabbar button')) {
  btn.addEventListener('click', () => {
    unlock();
    sfx.ui();
    const tab = btn.dataset.tab;
    show(tab === 'map' ? (state.node ? 'place' : 'map') : tab);
  });
}
$('#btn-settings').addEventListener('click', () => { unlock(); sfx.ui(); show('settings'); });
$('#btn-place').addEventListener('click', () => { unlock(); sfx.ui(); show('map'); });

// Keep the top bar honest without every screen having to remember to do it.
for (const ev of ['coin:changed', 'node:changed', 'act:changed', 'roster:changed', 'state:loaded']) {
  bus.on(ev, () => syncChrome());
}

bus.on('save:failed', ({ message }) =>
  toast('This browser will not let the game save. You can play on, but nothing will be kept.', 'bad'));

bus.on('quest:completed', ({ quest, reward }) => {
  toast(`Finished: ${quest.title}`, 'good');
});

bus.on('act:changed', (n) => toast(`Act ${n}.`, 'gold'));

bus.on('game:ended', ({ title }) => toast(`— ${title} —`, 'gold'));

// ---- keyboard, for the people who want it ----
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (overlayOpen()) { closeOverlay(); e.preventDefault(); }
    return;
  }
  if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const map = { '1': 'map', '2': 'brood', '3': 'items', '4': 'journal' };
  if (map[e.key] && currentScreenName() !== 'title' && currentScreenName() !== 'battle') {
    show(map[e.key] === 'map' ? 'place' : map[e.key]);
  }
});

// The first tap anywhere is what lets audio start at all.
document.addEventListener('pointerdown', () => { unlock(); }, { once: true });

// ---- go ----
function boot() {
  setVolume(state.settings.volume ?? 0.6);
  show('title');
  syncChrome();
  // A game already in progress gets offered back rather than silently resumed:
  // being dropped into somebody else's save with no warning is disorienting.
  if (anySave()) {
    const auto = true;
    setTimeout(() => {
      if (currentScreenName() !== 'title') return;
      confirmDialog({
        title: 'Pick up where you left off?',
        body: 'There is an autosave in this browser.',
        confirmText: 'Carry on',
        cancelText: 'Start fresh',
        onConfirm: () => {
          if (loadFrom('auto')) {
            wireQuests(); wireScenes(); checkQuests();
            playMusic('town');
            show('place');
            playPending();
          } else toast('That save could not be read.', 'bad');
        },
      });
    }, 260);
  }
}

boot();

// Exposed for the test harness; the game itself never reads these.
window.EMBERBROOD = { state, bus, show };
