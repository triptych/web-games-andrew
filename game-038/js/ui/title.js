// ============================================================
// ui/title.js - the title screen, new game, and the save slots
// ============================================================
import { el, $ } from '../core/util.js';
import { bus } from '../core/bus.js';
import { state, newGame, addDragon, addItem } from '../game/state.js';
import { show, registerScreen, toast, confirmDialog, openOverlay, closeOverlay, screenHeader, syncChrome } from './shell.js';
import { dragonSprite } from './sprites.js';
import { makeDragon } from '../gen/dragon.js';
import { rngFrom } from '../core/rand.js';
import { slotSummaries, loadFrom, saveTo, deleteSlot, anySave, markGameLive } from '../game/save.js';
import { wireQuests, checkQuests } from '../game/quests.js';
import { wireScenes, requestScene } from '../game/scenes.js';
import { LINEAGE_IDS } from '../data/lineages.js';
import { VERSION } from '../data/constants.js';
import { sfx, unlock, playMusic } from '../audio.js';

const SLOT_LABEL = { auto: 'Autosave', a: 'Slot A', b: 'Slot B', c: 'Slot C' };

function decorativeDragons() {
  const rng = rngFrom(String(Date.now() % 100000), 'title');
  const row = el('div.title-dragons');
  for (let i = 0; i < 4; i++) {
    const d = makeDragon(rng, { lineageId: rng.pick(LINEAGE_IDS), level: rng.int(10, 40) });
    row.append(dragonSprite(d, { scale: 2, flip: i % 2 === 1 }));
  }
  return row;
}

registerScreen('title', () => {
  const seedInput = el('input', {
    type: 'text', placeholder: 'seed (optional)', 'aria-label': 'World seed',
    maxlength: '28', value: '',
  });

  const startNew = () => {
    unlock();
    const seed = seedInput.value.trim() || randomSeed();
    beginNewGame(seed);
  };

  const summaries = slotSummaries().filter(s => !s.empty);

  return el('div.title-screen', null,
    decorativeDragons(),
    el('h1.logo', null, 'EMBERBROOD'),
    el('p.tagline', null, 'Fight them. Bind them. Raise them. Breed them.',
      el('br'), 'Put the sky back together.'),
    el('div.stack', null,
      el('button.btn.wide.primary', { onclick: startNew }, 'New game'),
      summaries.length
        ? el('button.btn.wide', { onclick: () => openLoadDialog() }, `Continue — ${summaries.length} save${summaries.length > 1 ? 's' : ''}`)
        : null,
      el('div.seed-row', null, seedInput,
        el('button.btn', { onclick: () => { seedInput.value = randomSeed(); sfx.ui(); } }, '↻')),
      el('p.faint.center', null,
        'The whole world grows from that seed. The same seed makes the same country, every time.'),
      el('div.sep'),
      el('p.faint.center', null, `v${VERSION} · no assets, no libraries · plays with one thumb`)),
  );
});

function randomSeed() {
  const words = ['ember', 'salt', 'gale', 'hollow', 'wyrm', 'cinder', 'brood', 'ash', 'line', 'spire',
                 'reed', 'scree', 'quiet', 'long', 'grey', 'warm'];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${Math.floor(Math.random() * 900 + 100)}`;
}

/** Everything a new save needs, in one place, so the sim and the UI agree. */
export function beginNewGame(seed, wardenName = 'Warden') {
  newGame(seed, wardenName);
  wireQuests();
  wireScenes();

  markGameLive(true);

  // Put the world up FIRST. Scenes play as an overlay over whatever screen is
  // behind them, so without this the intro sits on top of the title screen and
  // closing it drops the player straight back onto the title with no way
  // forward - which is exactly what it did.
  show('place');

  // And queue the framing BEFORE handing over the starter dragon: adding a
  // dragon emits roster:changed, which runs a quest pass, which queues the
  // first quest's own scene. Do it the other way round and the player reads
  // "here is the dragon she left you" before they have been told who she was.
  requestScene('intro');

  const rng = rngFrom(seed, 'starter');
  // Maerin's last hatchling: an Emberwyrm, deliberately, so the first fight
  // teaches the elemental chart rather than punishing you with it.
  const starter = makeDragon(rng, { lineageId: 'emberwyrm', level: 5, bond: 20, temperament: 'fond' });
  addDragon(starter, { toParty: true });

  for (const [id, n] of Object.entries({
    ember_salve: 4, ley_tonic: 2, rune_cord: 3, hearth_bread: 2, ashwash: 1, broodwell_key: 1, wardens_seal: 1,
  })) addItem(id, n);

  checkQuests();
  saveTo('auto');
  playMusic('town');
  bus.emit('game:begun');
}

function openLoadDialog() {
  const rows = slotSummaries().map(s => {
    if (s.empty) return el('div.card.tight', null, el('span.faint', null, `${SLOT_LABEL[s.slot]} — empty`));
    return el('div.card.tight', null,
      el('div.row.spread', null,
        el('div.grow', null,
          el('div', null, `${SLOT_LABEL[s.slot]} — ${s.warden}`),
          el('div.meta', null,
            `Act ${s.act} · ${s.roster} dragon${s.roster === 1 ? '' : 's'} · best Lv ${s.best} · ${s.done} quests`),
          el('div.meta', null, new Date(s.savedAt).toLocaleString())),
        el('div.stack', null,
          el('button.btn.small.primary', {
            onclick: () => {
              closeOverlay();
              if (loadFrom(s.slot)) {
                wireQuests(); wireScenes(); checkQuests();
                toast('Loaded.', 'good');
                show('map');
              } else toast('That save could not be read.', 'bad');
            },
          }, 'Load'),
          el('button.btn.small.danger', {
            onclick: () => confirmDialog({
              title: `Delete ${SLOT_LABEL[s.slot]}?`,
              body: 'This cannot be undone.', danger: true, confirmText: 'Delete it',
              onConfirm: () => { deleteSlot(s.slot); closeOverlay(); openLoadDialog(); },
            }),
          }, 'Delete'))));
  });
  openOverlay(el('div', null,
    el('h2', null, 'Saved games'),
    el('div.stack', null, ...rows),
    el('button.btn.wide', { onclick: closeOverlay }, 'Back')));
}

export { openLoadDialog };
