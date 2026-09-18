// ============================================================
// ui/journal.js - the quest log, the ledger, and settings
// ============================================================
import { el, num, cap } from '../core/util.js';
import { state, wardenRank, partyDragons } from '../game/state.js';
import { registerScreen, show, toast, openOverlay, closeOverlay, confirmDialog,
         screenHeader, emptyState, refresh, bar } from './shell.js';
import { activeEntries, questFor, progressOf, abandonQuest, currentMainQuest } from '../game/quests.js';
import { MAIN_CHAIN, SIDE_QUESTS } from '../data/quests.js';
import { ITEMS } from '../data/items.js';
import { NODES } from '../data/world.js';
import { RANKS, VERSION } from '../data/constants.js';
import { endingAvailability } from '../game/scenes.js';
import { ELDER_LINEAGES, lineage } from '../data/lineages.js';
import { saveTo, slotSummaries, loadFrom, deleteSlot } from '../game/save.js';
import { sfx, setVolume, setMusicEnabled, setSoundEnabled, playMusic } from '../audio.js';

registerScreen('journal', () => {
  const entries = activeEntries();
  const rank = wardenRank();

  const cards = entries.map(entry => {
    const q = questFor(entry);
    if (!q) return null;
    const p = progressOf(entry);
    return el(`div.card.quest-card.${entry.kind}`, null,
      el('div.row.spread', null,
        el('strong', null, q.title),
        el('span.faint', null, entry.kind === 'main' ? 'Main' : entry.kind === 'board' ? 'Board' : 'Side')),
      el('p.dim', { style: { fontSize: '12px', margin: '6px 0' } }, q.detail),
      p.detail ? el('div.goal', null, p.detail) : null,
      p.need > 1 ? el('div', null, bar(p.have, p.need, 'xp'), el('div.prog', null, `${p.have} / ${p.need}`)) : null,
      q.reward ? el('div.faint', null,
        'Pays ' + [q.reward.coin ? `●${q.reward.coin}` : null,
                   ...(q.reward.items || []).map(i => ITEMS[i] ? ITEMS[i].name : i)].filter(Boolean).join(', ')) : null,
      entry.kind !== 'main' ? el('button.btn.small.danger', {
        style: { marginTop: '8px' },
        onclick: () => confirmDialog({
          title: `Give up on "${q.title}"?`,
          body: 'You can take it on again from the board or the person who asked.',
          danger: true, confirmText: 'Give it up',
          onConfirm: () => { abandonQuest(entry.id); refresh(); },
        }),
      }, 'Give up') : null);
  }).filter(Boolean);

  const done = state.quests.done.length;

  return el('div', null,
    screenHeader('Journal', `${rank.name} · ${done} finished`),
    el('div.btn-grid', { style: { marginBottom: '12px' } },
      el('button.btn', { onclick: () => show('ledger') }, 'Ledger'),
      el('button.btn', { onclick: () => show('settings') }, 'Settings')),
    cards.length ? el('div.stack', null, ...cards) : emptyState('Nothing on the books. Try a notice board.'));
});

// ----------------------------------------------------------------- ledger --
registerScreen('ledger', () => {
  const s = state.stats;
  const rank = wardenRank();
  const nextRank = RANKS.find(r => r.needed > rank.score);
  const avail = endingAvailability();
  const roster = state.roster;

  const line = (k, v) => el('div.row.spread', null, el('span.faint', null, k), el('span', null, String(v)));

  return el('div', null,
    screenHeader('The Ledger', 'What you have done so far.',
      el('button.btn.small', { onclick: () => show('journal') }, 'Back')),
    el('div.card', null,
      el('h3', null, `Warden rank: ${rank.name}`),
      nextRank ? el('div', null,
        bar(rank.score, nextRank.needed, 'bond'),
        el('div.faint', null, `${rank.score} / ${nextRank.needed} toward ${nextRank.name}`))
        : el('div.faint', null, 'The highest there is.'),
      el('p.faint', null, 'Rank comes from lineages held, dragons bound, dragons bred, and how far the story has gone. It makes every binding a little likelier.')),
    el('div.card', null,
      el('h3', null, 'Tally'),
      line('Battles', s.battles), line('Won', s.wins),
      line('Dragons bound', s.captures), line('Eggs laid', s.bred), line('Eggs hatched', s.hatched),
      line('Times gone down', s.faints), line('Places walked', state.visited.length),
      line('Seed', state.seed)),
    el('div.card', null,
      el('h3', null, 'The five Elder lines'),
      ...ELDER_LINEAGES.map(id => {
        const held = roster.find(d => d.lineageId === id);
        return el('div.row.spread', null,
          el('span', { class: held ? '' : 'faint' }, lineage(id).name),
          el('span', { class: held ? 'good' : 'faint' }, held ? `${held.name} (${held.stage})` : 'not held'));
      }),
      el('p.faint', { style: { marginTop: '8px' } },
        avail.canRekindle ? 'All five, grown. The Rekindle ending is open to you.'
                          : 'Hold one of each, grown to Wyrm or better, and you can put the lines back where they came from.')),
    el('div.card', null,
      el('h3', null, 'Succession'),
      el('p.faint', null, avail.canSuccession
        ? 'There is one among them you could ask.'
        : 'It would take a dragon you bred yourself: third generation, Elder-grown, and bonded to you completely.')));
});

// --------------------------------------------------------------- settings --
registerScreen('settings', () => {
  const sw = (label, get, set) => {
    const btn = el('button.btn.small.switch', {
      onclick: () => { set(!get()); sfx.ui(); btn.textContent = get() ? 'On' : 'Off'; },
    }, get() ? 'On' : 'Off');
    return el('div.setting-row', null, el('span', null, label), btn);
  };

  const vol = el('input', {
    type: 'range', min: '0', max: '1', step: '0.05', value: String(state.settings.volume ?? 0.6),
    oninput: (e) => setVolume(Number(e.target.value)),
  });

  return el('div', null,
    screenHeader('Settings', null, el('button.btn.small', { onclick: () => show('journal') }, 'Back')),
    el('div.card', null,
      sw('Sound effects', () => state.settings.sound !== false, v => setSoundEnabled(v)),
      sw('Music', () => state.settings.music !== false, v => setMusicEnabled(v)),
      el('div.setting-row', null, el('span', null, 'Volume'), vol),
      sw('Reduced motion', () => !!state.settings.reducedMotion, v => { state.settings.reducedMotion = v; }),
      sw('Fast text', () => !!state.settings.fastText, v => { state.settings.fastText = v; })),
    el('div.card', null,
      el('h3', null, 'Saving'),
      el('p.faint', null, 'The game saves itself after every fight, capture, hatch and quest. These are the manual slots.'),
      el('div.btn-grid.three', null,
        ...['a', 'b', 'c'].map(slot => el('button.btn', {
          onclick: () => { const r = saveTo(slot); toast(r.ok ? `Saved to ${slot.toUpperCase()}.` : r.why, r.ok ? 'good' : 'bad'); },
        }, `Save ${slot.toUpperCase()}`))),
      el('div.btn-grid.three', { style: { marginTop: '8px' } },
        ...['a', 'b', 'c'].map(slot => {
          const sum = slotSummaries().find(x => x.slot === slot);
          return el('button.btn', {
            disabled: !sum || sum.empty,
            onclick: () => confirmDialog({
              title: `Load slot ${slot.toUpperCase()}?`,
              body: 'Anything since your last save is lost.',
              confirmText: 'Load it',
              onConfirm: () => { if (loadFrom(slot)) { toast('Loaded.', 'good'); show('map'); } else toast('Could not read it.', 'bad'); },
            }),
          }, `Load ${slot.toUpperCase()}`);
        }))),
    el('div.card', null,
      el('h3', null, 'This game'),
      el('p.faint', null, `Emberbrood v${VERSION}. Seed: ${state.seed}. Vanilla HTML, CSS and JavaScript — no libraries, no build step, and not one asset file: every dragon is drawn in code from its own genes and every sound is synthesised on the spot.`),
      el('button.btn.wide.danger', {
        onclick: () => confirmDialog({
          title: 'Give up this warden and start again?',
          body: 'Your autosave is overwritten the moment the new game starts.',
          danger: true, confirmText: 'Start again',
          onConfirm: () => show('title'),
        }),
      }, 'Back to the title')));
});
