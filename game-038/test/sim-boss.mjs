// Boss-fight simulation with a "competent player" stand-in: picks the move
// with the best expected damage, heals when someone drops below 40%, and
// spends the surge as soon as it is full.
import { rngFrom } from '../js/core/rand.js';
import { makeDragon, maxHp, statsOf } from '../js/gen/dragon.js';
import { makeBoss } from '../js/gen/encounters.js';
import { Battle, SIDE } from '../js/game/battle.js';
import { elementMultiplier } from '../js/data/elements.js';

/** A party a player would plausibly bring, and one that ignores the matchup. */
export const PARTIES = {
  naive: ['emberwyrm', 'tidechorus', 'skyward'],
  cinderfang: ['tidechorus', 'emberwyrm', 'skyward'],
  morvaleth: ['verdantcoil', 'stormcaller', 'emberwyrm'],
  kessa: ['stonefather', 'emberwyrm', 'verdantcoil'],
  ythrax: ['stormcaller', 'stonefather', 'emberwyrm'],
  vaelorax: ['tidechorus', 'stonefather', 'skyward'],
};

export function simBoss(bossId, level, { gear = false, gen = 2, salves = 6, seed = 'x', party = null } = {}) {
  const rng = rngFrom(seed + bossId, 'boss');
  const allies = (party || PARTIES[bossId] || PARTIES.naive).map(l =>
    makeDragon(rng, { lineageId: l, level, bond: 70, generation: gen, essenceQuality: 3 }));
  if (gear) for (const a of allies) a.equip.harness = { id: 'bulwark_rig', mods: { def: 1.25, res: 1.15, spd: 0.92 } };
  const b = makeBoss(bossId, rng);
  const bt = new Battle({ allies, enemies: [b], rng, wardenRank: 3, context: { boss: true } });
  let left = salves, guard = 0;
  while (bt.state === 'input' && guard++ < 80) {
    for (const a of bt.living(SIDE.ALLY)) {
      const opts = bt.availableMoves(a).filter(o => o.usable && o.move.kind !== 'support');
      const scored = opts.map(o => ({ o, v: (o.move.power || 0) * (o.move.element ? elementMultiplier(o.move.element, b.elements) : 1) }));
      const pick = scored.sort((x, y) => y.v - x.v)[0];
      if (pick) bt.setCommand(a.id, { type: pick.o.move.mp ? 'skill' : 'strike', moveId: pick.o.move.id, targetId: b.id });
      else bt.setCommand(a.id, { type: 'guard' });
    }
    if (bt.surge >= 100) {
      const a = bt.living(SIDE.ALLY)[0];
      if (a) bt.setCommand(a.id, { type: 'surge', targetId: b.id });
    }
    const hurt = bt.living(SIDE.ALLY).find(a => a.hp < maxHp(a) * 0.4);
    if (hurt && left > 0) { bt.setWardenCommand({ type: 'item', itemId: 'wardens_salve', targetId: hurt.id }); left--; }
    bt.resolveRound();
  }
  return { state: bt.state, rounds: bt.round, alive: bt.living(SIDE.ALLY).length, salvesUsed: salves - left };
}

if (process.argv[1].endsWith('sim-boss.mjs')) {
  const table = [['cinderfang', 12], ['morvaleth', 24], ['kessa', 34], ['ythrax', 43], ['vaelorax', 50]];
  for (const [id, lvl] of table) {
    for (const opts of [{ label: 'matched party', level: lvl },
                        { label: 'wrong party ', level: lvl, party: PARTIES.naive },
                        { label: '+4 & geared ', level: lvl + 4, gear: true }]) {
      let wins = 0, rounds = 0, salves = 0;
      for (let i = 0; i < 12; i++) {
        const r = simBoss(id, opts.level, { gear: opts.gear, seed: 's' + i, party: opts.party });
        if (r.state === 'won') wins++;
        rounds += r.rounds; salves += r.salvesUsed;
      }
      console.log(`${id.padEnd(11)} ${opts.label.padEnd(12)} wins ${wins}/12  avg rounds ${(rounds / 12).toFixed(1)}  salves ${(salves / 12).toFixed(1)}`);
    }
  }
}
