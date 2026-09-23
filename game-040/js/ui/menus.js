/**
 * menus.js — every full-screen panel: title, intro crawl, level select,
 * briefing, pause/options, level clear, game over, ending.
 *
 * All screens render into one #screen element. main.js passes callbacks in;
 * this module never touches the simulation.
 */

import { DIFFICULTY, DIFFICULTY_IDS } from '../core/config.js';
import { CADETS, CADET_BY_ID, INTRO, BRIEFINGS, TOTAL_CADETS, endingFor, cadetForLevel } from '../sim/story.js';
import { LEVELS } from '../sim/levels.js';
import { getBinds, cancelCaptureBind } from '../core/input.js';
import { formatScore } from './hud.js';

let root = null;
let hooks = {};
let currentPrimary = null;

export function initMenus(callbacks = {}) {
    root = document.getElementById('screen');
    hooks = callbacks;
    if (typeof window !== 'undefined') {
        window.addEventListener('keydown', (e) => {
            if (!root || root.classList.contains('hidden')) return;
            if (e.code === 'Enter' && currentPrimary) { e.preventDefault(); currentPrimary(); }
        });
    }
}

export function hideScreens() {
    // a rebind left waiting for a key must not outlive the panel that started it
    cancelCaptureBind();
    root?.classList.add('hidden');
    if (root) root.innerHTML = '';
    currentPrimary = null;
}

function render(html, { primary = null, cls = '' } = {}) {
    if (!root) return;
    root.className = `overlay ${cls}`;
    root.innerHTML = html;
    root.classList.remove('hidden');
    currentPrimary = primary;
    for (const btn of root.querySelectorAll('[data-action]')) {
        btn.addEventListener('click', () => {
            const fn = ACTIONS[btn.dataset.action];
            fn?.(btn.dataset.value, btn);
        });
    }
}

const ACTIONS = {};
export function registerAction(name, fn) { ACTIONS[name] = fn; }

// ---------------------------------------------------------------------- title

export function showTitle(save) {
    const best = save.bestScore ? `BEST ${formatScore(save.bestScore)} · ${save.bestRescued} SAVED` : '';
    render(`
      <div class="panel title-panel">
        <div class="title-mark">STARCADET</div>
        <div class="title-sub">TWO HUNDRED AND ELEVEN CADETS. ONE TRAINER. ONE TOW HOOK.</div>
        <div class="title-blurb">
          The Chorus took Halcyon Academy at 06:41. You are Cadet Theo Vance, callsign SPARROW,
          the worst shot in your class, and the only pilot still flying.
        </div>
        <div class="menu-list">
          <button class="btn primary" data-action="start">${save.unlockedLevel > 1 ? 'NEW RUN' : 'BEGIN'}</button>
          ${save.unlockedLevel > 1 ? '<button class="btn" data-action="levelselect">LEVEL SELECT</button>' : ''}
          <button class="btn" data-action="options">OPTIONS</button>
          <button class="btn subtle" data-action="roll">THE ROLL</button>
        </div>
        <div class="title-best">${best}</div>
        <div class="hint">ARROWS / WASD or DRAG to fly · SHIFT focus · X flare · C overdrive · ENTER to begin</div>
      </div>`, { primary: () => hooks.onStart?.(), cls: 'title' });
}

export function showIntro() {
    const lines = INTRO.map((l) => `<div class="crawl-line">${l || '&nbsp;'}</div>`).join('');
    render(`
      <div class="panel crawl-panel">
        <div class="crawl">${lines}</div>
        <button class="btn primary" data-action="introDone">CONTINUE</button>
      </div>`, { primary: () => hooks.onIntroDone?.(), cls: 'crawl-screen' });
}

// --------------------------------------------------------------- level select

export function showLevelSelect(save) {
    const cards = LEVELS.map((lv) => {
        const unlocked = lv.id <= save.unlockedLevel;
        const best = save.levelBests?.[String(lv.id)];
        return `
          <button class="level-card ${unlocked ? '' : 'locked'}" data-action="pickLevel" data-value="${lv.id}"
                  ${unlocked ? '' : 'disabled'}>
            <div class="lc-num">${String(lv.id).padStart(2, '0')}</div>
            <div class="lc-body">
              <div class="lc-name">${unlocked ? lv.name : 'LOCKED'}</div>
              <div class="lc-sub">${unlocked ? lv.subtitle : 'CLEAR THE PREVIOUS LEVEL'}</div>
              ${best ? `<div class="lc-best">BEST ${formatScore(best.score)} · ${best.rescued}/${lv.podBudget} PODS · RANK ${best.rank}</div>` : ''}
            </div>
          </button>`;
    }).join('');
    render(`
      <div class="panel wide">
        <h1>LEVEL SELECT</h1>
        <div class="difficulty-row">
          ${DIFFICULTY_IDS.map((d) => `
            <button class="btn small ${save.difficulty === d ? 'on' : ''}" data-action="pickDifficulty" data-value="${d}">
              ${DIFFICULTY[d].name}
            </button>`).join('')}
        </div>
        <div class="level-grid">${cards}</div>
        <button class="btn subtle" data-action="back">BACK</button>
      </div>`, { primary: null, cls: '' });
}

// -------------------------------------------------------------------- briefing

export function showBriefing(levelNum, run) {
    const lv = LEVELS.find((l) => l.id === levelNum) ?? LEVELS[0];
    const b = BRIEFINGS[levelNum] ?? { title: lv.name, subtitle: lv.subtitle, lines: [] };
    const cadet = cadetForLevel(levelNum);
    const wing = run.cadets.map((id) => {
        const c = CADET_BY_ID[id];
        return `<li><b>${c.callsign}</b> — ${c.abilityName}: ${c.abilityDesc}</li>`;
    }).join('') || '<li class="dim">No crew yet. You are flying this one alone.</li>';
    render(`
      <div class="panel wide briefing">
        <div class="brief-head">
          <div class="brief-num">LEVEL ${String(levelNum).padStart(2, '0')}</div>
          <h1>${b.title}</h1>
          <div class="brief-sub">${b.subtitle}</div>
        </div>
        <div class="brief-cols">
          <div class="brief-col">
            <h3>OBJECTIVE</h3>
            <ul>${b.lines.map((l) => `<li>${l}</li>`).join('')}</ul>
            <div class="brief-stat">PODS IN THIS SECTOR: <b>${lv.podBudget}</b></div>
            <div class="brief-stat">CADETS RECOVERED SO FAR: <b>${run.rescued}</b> / ${TOTAL_CADETS}</div>
            ${cadet ? `<div class="brief-stat hi">HELD HERE: <b>${cadet.name}</b> (${cadet.callsign})</div>` : ''}
          </div>
          <div class="brief-col">
            <h3>YOUR WING</h3>
            <ul class="wing-list">${wing}</ul>
          </div>
        </div>
        <button class="btn primary" data-action="launch">LAUNCH</button>
        <div class="hint">ENTER to launch</div>
      </div>`, { primary: () => hooks.onLaunch?.(), cls: '' });
}

// ---------------------------------------------------------------------- pause

export function showPause(run) {
    render(`
      <div class="panel pause">
        <h1>PAUSED</h1>
        <div class="pause-stats">
          <div><span>SCORE</span><b>${formatScore(run.score)}</b></div>
          <div><span>CADETS SAVED</span><b>${run.rescued}</b></div>
          <div><span>CADETS LOST</span><b>${run.lost}</b></div>
        </div>
        <div class="menu-list">
          <button class="btn primary" data-action="resume">RESUME</button>
          <button class="btn" data-action="options">OPTIONS</button>
          <button class="btn subtle" data-action="quit">ABANDON RUN</button>
        </div>
      </div>`, { primary: () => hooks.onResume?.(), cls: 'dimmed' });
}

// -------------------------------------------------------------------- options

export function showOptions(save, { fromPause = false } = {}) {
    const binds = getBinds();
    const bindRow = (action, label) =>
        `<div class="bind-row"><span>${label}</span>
           <button class="btn tiny" data-action="rebind" data-value="${action}">${(binds[action] ?? []).join(' / ')}</button>
         </div>`;
    render(`
      <div class="panel wide">
        <h1>OPTIONS</h1>
        <div class="opt-cols">
          <div class="opt-col">
            <h3>DIFFICULTY</h3>
            <div class="difficulty-row">
              ${DIFFICULTY_IDS.map((d) => `
                <button class="btn small ${save.difficulty === d ? 'on' : ''}" data-action="pickDifficulty" data-value="${d}">
                  ${DIFFICULTY[d].name}
                </button>`).join('')}
            </div>
            <div class="opt-note">
              CADET: slower bullets, thinner patterns, 5 lives.<br>
              PILOT: as designed.<br>
              ACE: faster bullets, an extra arm on every radial pattern, 2 lives.
            </div>
            <h3>GRAPHICS</h3>
            <div class="toggle-row">
              ${[['auto', 'AUTO'], ['0', 'HIGH'], ['1', 'MEDIUM'], ['2', 'LOW']].map(([v, label]) => `
                <button class="btn small ${(save.options.quality ?? 'auto') === v ? 'on' : ''}"
                        data-action="quality" data-value="${v}">${label}</button>`).join('')}
            </div>
            <div class="opt-note">
              AUTO starts a touch device one tier down and drops another if the frame
              rate will not hold. Lower tiers render fewer pixels and a softer bloom.
            </div>
            <h3>TOGGLES</h3>
            <div class="toggle-row">
              <button class="btn small ${save.options.autofire ? 'on' : ''}" data-action="toggle" data-value="autofire">AUTO-FIRE</button>
              <button class="btn small ${save.options.sfx ? 'on' : ''}" data-action="toggle" data-value="sfx">SFX</button>
              <button class="btn small ${save.options.music ? 'on' : ''}" data-action="toggle" data-value="music">MUSIC</button>
              <button class="btn small ${save.options.screenShake ? 'on' : ''}" data-action="toggle" data-value="screenShake">SCREEN SHAKE</button>
              <button class="btn small ${save.options.showFps ? 'on' : ''}" data-action="toggle" data-value="showFps">FPS</button>
            </div>
          </div>
          <div class="opt-col">
            <h3>CONTROLS <span class="dim-note">(keyboard)</span></h3>
            ${['up', 'down', 'left', 'right', 'fire', 'focus', 'flare', 'od', 'pause']
                .map((a) => bindRow(a, a.toUpperCase())).join('')}
            <button class="btn tiny subtle" data-action="resetBinds">RESET TO DEFAULTS</button>
          </div>
        </div>
        <button class="btn primary" data-action="${fromPause ? 'backToPause' : 'back'}">DONE</button>
      </div>`, { primary: () => (fromPause ? hooks.onBackToPause?.() : hooks.onBack?.()), cls: 'dimmed' });
}

export function markCapturing(action) {
    const btn = root?.querySelector(`[data-action="rebind"][data-value="${action}"]`);
    if (btn) btn.textContent = 'PRESS A KEY…';
}

// --------------------------------------------------------------- level clear

export function showLevelClear(summary, run, cadet) {
    const rescueLine = cadet
        ? `<div class="cadet-card">
             <div class="cadet-name">${cadet.name} — "${cadet.callsign}"</div>
             <div class="cadet-line">"${cadet.rescueLine}"</div>
             <div class="cadet-ability">WING ABILITY UNLOCKED — ${cadet.abilityName}: ${cadet.abilityDesc}</div>
           </div>` : '';
    render(`
      <div class="panel wide">
        <div class="clear-mark">SECTOR CLEAR</div>
        <h1>${summary.name}</h1>
        <div class="result-grid">
          <div><span>PODS RECOVERED</span><b>${summary.rescued} / ${summary.budget}</b></div>
          <div><span>PODS LOST</span><b class="${summary.lost ? 'bad' : ''}">${summary.lost}</b></div>
          <div><span>CADETS ABOARD</span><b>${summary.cadets}</b></div>
          <div><span>KILLS</span><b>${summary.kills}</b></div>
          <div><span>GRAZE</span><b>${summary.graze}</b></div>
          <div><span>BEST CHAIN</span><b>x${summary.maxChain}</b></div>
          <div><span>DEATHS</span><b class="${summary.deaths ? 'bad' : ''}">${summary.deaths}</b></div>
          <div><span>BONUS</span><b>${formatScore(summary.bonus)}</b></div>
        </div>
        <div class="rank-row">RANK <span class="rank rank-${summary.rank}">${summary.rank}</span></div>
        <div class="running-total">RUN TOTAL — ${formatScore(run.score)} · ${run.rescued} CADETS ABOARD</div>
        ${rescueLine}
        <button class="btn primary" data-action="next">CONTINUE</button>
        <div class="hint">ENTER to continue</div>
      </div>`, { primary: () => hooks.onNextLevel?.(), cls: '' });
}

// ------------------------------------------------------------------ game over

export function showGameOver(run, { canContinue }) {
    render(`
      <div class="panel">
        <h1 class="bad">SHOT DOWN</h1>
        <div class="go-body">
          ${run.rescued} cadets made it aboard before you went down.
          ${canContinue ? 'You have a spare airframe in the bay.' : 'There are no more airframes.'}
        </div>
        <div class="pause-stats">
          <div><span>SCORE</span><b>${formatScore(run.score)}</b></div>
          <div><span>SAVED</span><b>${run.rescued}</b></div>
          <div><span>LOST</span><b>${run.lost}</b></div>
          <div><span>CONTINUES</span><b>${run.continues}</b></div>
        </div>
        <div class="menu-list">
          ${canContinue ? '<button class="btn primary" data-action="continueRun">CONTINUE</button>' : ''}
          <button class="btn ${canContinue ? '' : 'primary'}" data-action="retryLevel">RETRY LEVEL</button>
          <button class="btn subtle" data-action="quit">TITLE</button>
        </div>
      </div>`, {
        primary: () => (canContinue ? hooks.onContinue?.() : hooks.onRetry?.()),
        cls: 'dimmed',
    });
}

// --------------------------------------------------------------------- ending

export function showEnding(run) {
    const ending = endingFor(run.rescued);
    const named = run.cadets.map((id) => CADET_BY_ID[id]?.name).filter(Boolean);
    render(`
      <div class="panel wide ending">
        <div class="ending-tag">ENDING</div>
        <h1>${ending.title}</h1>
        <div class="ending-lines">${ending.lines.map((l) => `<div>${l || '&nbsp;'}</div>`).join('')}</div>
        <div class="result-grid">
          <div><span>CADETS HOME</span><b>${run.rescued} / ${TOTAL_CADETS}</b></div>
          <div><span>CADETS LOST</span><b class="${run.lost ? 'bad' : ''}">${run.lost}</b></div>
          <div><span>FINAL SCORE</span><b>${formatScore(run.score)}</b></div>
          <div><span>DIFFICULTY</span><b>${DIFFICULTY[run.difficulty].name}</b></div>
        </div>
        <div class="named-roll">
          <h3>NAMED ABOARD</h3>
          <div>${named.length ? named.join(' · ') : 'Nobody you knew by name.'}</div>
        </div>
        <button class="btn primary" data-action="quit">RETURN TO TITLE</button>
      </div>`, { primary: () => hooks.onQuit?.(), cls: '' });
}

// ----------------------------------------------------------------- the roll

export function showRoll(save) {
    const rows = CADETS.map((c) => `
      <div class="roll-row">
        <div class="roll-name">${c.name} <span class="roll-call">"${c.callsign}"</span></div>
        <div class="roll-bio">${c.bio}</div>
        <div class="roll-ability">${c.abilityName} — ${c.abilityDesc}</div>
      </div>`).join('');
    render(`
      <div class="panel wide">
        <h1>THE ROLL</h1>
        <div class="roll-intro">
          ${TOTAL_CADETS} cadets were on the Halcyon roll the morning the Chorus arrived.
          Five of them have names you will hear on the radio.
        </div>
        <div class="roll-list">${rows}</div>
        <div class="roll-intro dim">BEST RUN: ${save.bestRescued} recovered · rank ${save.bestRank || '—'}</div>
        <button class="btn primary" data-action="back">BACK</button>
      </div>`, { primary: () => hooks.onBack?.(), cls: '' });
}
