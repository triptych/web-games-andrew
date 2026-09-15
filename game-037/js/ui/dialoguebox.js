// ============================================================
// ui/dialoguebox.js - a bottom sheet, three sentences, big buttons (GDD §27.8)
// Responses are labelled with intent, not with the literal line.
// ============================================================
import { RESPONSES } from '../data/dialogue.js';
import { line, factsFor, quietify, closeDialogue, adjustDisposition, warmthTier } from '../game/dialogue.js';
import { refreshNeeds, questsOf, acceptQuest, onPlayerAction, threadOf, startThread, chooseThread, findNpc } from '../game/quests.js';
import { giveGift, stockOf } from '../game/economy.js';
import { displayName } from '../game/inventory.js';
import { learn, canTalkDown, resolveTheOne } from '../game/longthread.js';
import { openPanel } from './panels.js';
import { logLine } from '../game/state.js';

let host = null, state = null, npc = null, refresh = null;

export function initDialogue(el, refreshFn) { host = el; refresh = refreshFn; }

export function showDialogue(st, theNpc) {
  state = st; npc = theNpc;
  render('greet');
}

export function hideDialogue() {
  if (host) { host.hidden = true; host.innerHTML = ''; }
}

function render(intent, extraLines = []) {
  if (!host || !npc) return;
  host.hidden = false;
  host.innerHTML = '';

  const settle = state.W.settlements.get(npc.settlementId);
  const region = settle ? state.W.regions.get(settle.regionId) : null;
  refreshNeeds(state, npc);
  const facts = factsFor(state, npc);

  const box = document.createElement('div');
  box.className = 'dialogue';

  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = `${npc.name} · ${npc.trade}${settle ? ' of ' + settle.name : ''}`;
  box.appendChild(who);

  const said = document.createElement('div');
  said.className = 'said';
  const lines = [];
  const first = line(state, npc, intent, facts);
  if (first) lines.push(first);
  for (const e of extraLines) lines.push(e);
  if (!lines.length) lines.push('They look at you and wait.');
  for (const l of lines.slice(0, 3)) {
    const pEl = document.createElement('p');
    pEl.textContent = quietify(state, l, region);
    said.appendChild(pEl);
  }
  box.appendChild(said);

  const actions = document.createElement('div');
  actions.className = 'responses';
  for (const r of responsesFor(intent)) {
    const b = document.createElement('button');
    b.textContent = r.label;
    b.onclick = r.run;
    actions.appendChild(b);
  }
  box.appendChild(actions);
  host.appendChild(box);
}

function responsesFor(intent) {
  const out = [];
  const quests = questsOf(state, npc.id);
  const offered = quests.filter(q => q.state === 'offered');
  const active = quests.filter(q => q.state === 'active');

  if (offered.length) {
    out.push({
      label: RESPONSES.ask_need,
      run: () => {
        const q = offered[0];
        // The template already states the need; the second line says where to
        // start, rather than saying the same thing again in other words.
        const first = q.beats[0];
        render('state_need', first && first.hint ? [first.hint] : [q.summary]);
        host.querySelector('.responses').prepend(mkButton(RESPONSES.accept, () => {
          if (acceptQuest(state, q)) { adjustDisposition(state, npc, 2, 'helped'); render('thank', ['Good. That is that settled.']); }
        }));
      },
    });
  }
  for (const q of active) {
    const beat = q.beats[q.current];
    if (!beat) continue;
    const wantsTalk = beat.kind === 'talk' && beat.target.npc === npc.id;
    const wantsGive = beat.kind === 'give' && beat.target.npc === npc.id;
    if (wantsGive) {
      out.push({
        label: RESPONSES.turn_in,
        run: () => {
          onPlayerAction(state, { kind: 'give', npcId: npc.id });
          render('thank');
        },
      });
    } else if (wantsTalk) {
      out.push({
        label: `About ${q.title.toLowerCase()}`,
        run: () => { onPlayerAction(state, { kind: 'talk', npcId: npc.id }); render('teach'); },
      });
    } else {
      out.push({ label: 'Remind me', run: () => render('remind_need', [beat.hint]) });
    }
  }

  out.push({ label: RESPONSES.gossip, run: () => { onPlayerAction(state, { kind: 'talk', npcId: npc.id }); render('gossip'); } });
  out.push({ label: RESPONSES.warn, run: () => render('warn') });

  if (npc.trade === 'scholar' || npc.trade === 'herbalist' || npc.ageBand === 'elder') {
    out.push({
      label: RESPONSES.teach,
      run: () => {
        const facts = state.longThread ? state.longThread.facts : [];
        const unknown = facts.find(f => !state.knowledge.facts.has(f));
        if (unknown && (npc.disposition || 0) >= 10) {
          learn(state, unknown);
          state.stats.social++;
          render('teach', [unknown]);
        } else render('smalltalk');
      },
    });
  }

  if (isMerchant(npc)) {
    out.push({ label: RESPONSES.trade, run: () => { render('trade'); openPanel(state, 'shop', { npc }); } });
  }

  out.push({
    label: RESPONSES.gift,
    run: () => {
      const giftable = state.player.inventory.filter(i => !i.bound);
      if (!giftable.length) { render('smalltalk', ['You have nothing to give.']); return; }
      host.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'dialogue';
      box.innerHTML = `<div class="who">Give ${npc.shortName} something</div>`;
      const list = document.createElement('div');
      list.className = 'responses column';
      for (const it of giftable.slice(0, 10)) {
        list.appendChild(mkButton(displayName(it), () => {
          giveGift(state, npc, it);
          render('thank');
        }));
      }
      list.appendChild(mkButton('Never mind', () => render('greet')));
      box.appendChild(list);
      host.appendChild(box);
    },
  });

  // the region's Thread lives with its anchor
  const th = threadOf(state, npc.settlementId ? (state.W.settlements.get(npc.settlementId) || {}).regionId : null);
  if (th && th.anchor === npc.id) {
    if (th.state === 'unknown') {
      out.unshift({ label: 'Ask what is wrong here', run: () => { startThread(state, th); render('grieve', [th.premise]); } });
    } else if (th.state === 'active' && th.beats[th.current] && th.beats[th.current].kind === 'choose') {
      out.unshift({ label: th.choicePoint.question, run: () => renderChoice(th) });
    } else if (th.state === 'active') {
      out.unshift({ label: 'About the trouble', run: () => { onPlayerAction(state, { kind: 'talk', npcId: npc.id }); render('warn', [th.beats[th.current] ? th.beats[th.current].hint : th.hidden]); } });
    }
  }

  out.push({ label: RESPONSES.sit, run: () => render('smalltalk') });
  out.push({ label: RESPONSES.leave, run: () => { closeDialogue(state); hideDialogue(); if (refresh) refresh(); } });
  return out.slice(0, 7);
}

function renderChoice(th) {
  host.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'dialogue';
  box.innerHTML = `<div class="who">${th.choicePoint.question}</div>
    <div class="said"><p>${th.stake}. Both ways cost something.</p></div>`;
  const list = document.createElement('div');
  list.className = 'responses column';
  list.appendChild(mkButton(`${th.choicePoint.a} — ${th.choicePoint.aCost}`, () => { chooseThread(state, th, 'a'); render('grieve'); }));
  list.appendChild(mkButton(`${th.choicePoint.b} — ${th.choicePoint.bCost}`, () => { chooseThread(state, th, 'b'); render('grieve'); }));
  list.appendChild(mkButton('Not yet', () => render('greet')));
  box.appendChild(list);
  host.appendChild(box);
}

function mkButton(label, run) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = run;
  return b;
}

const MERCHANT_TRADES = ['innkeeper', 'smith', 'herbalist', 'baker', 'carter', 'cooper', 'potter', 'beekeeper', 'keeper'];
const isMerchant = n => MERCHANT_TRADES.includes(n.trade);
