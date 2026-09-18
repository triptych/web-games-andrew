// Headless battle simulation: drives the real engine with a crude AI on the
// player side to check that fights terminate, damage is sane and captures work.
import { rngFrom } from '../js/core/rand.js';
import { makeDragon, statsOf, maxHp } from '../js/gen/dragon.js';
import { Battle, SIDE, leaveBattle } from '../js/game/battle.js';

function simulate(seed, { allyLins, foeLins, level, bind = false, verbose = false }) {
  const rng = rngFrom(seed, 'sim');
  const allies = allyLins.map(l => makeDragon(rng, { lineageId: l, level, bond: 30 }));
  const enemies = foeLins.map(l => makeDragon(rng, { lineageId: l, level, wild: true }));
  const b = new Battle({ allies, enemies, rng, wardenRank: 2, context: { wild: true } });
  let guard = 0;
  while (b.state === 'input' && guard++ < 40) {
    for (const a of b.living(SIDE.ALLY)) {
      const options = b.availableMoves(a).filter(o => o.usable);
      const best = options.sort((x, y) => (y.move.power || 0) - (x.move.power || 0))[0];
      const foe = b.living(SIDE.ENEMY)[0];
      b.setCommand(a.id, { type: best.move.mp ? 'skill' : 'strike', moveId: best.move.id, targetId: foe && foe.id });
    }
    if (b.surge >= 100) {
      const a = b.living(SIDE.ALLY)[0];
      if (a) b.setCommand(a.id, { type: 'surge', targetId: (b.living(SIDE.ENEMY)[0] || {}).id });
    }
    if (bind) {
      const foe = b.living(SIDE.ENEMY)[0];
      if (foe && foe.hp < maxHp(foe) * 0.3) b.setWardenCommand({ type: 'bind', targetId: foe.id, itemId: 'bind_chain' });
    }
    const evs = b.resolveRound();
    if (verbose) for (const e of evs) if (e.type === 'log') console.log('   ' + e.text);
  }
  return { state: b.state, rounds: b.round, rewards: b.rewards, allies, enemies, battle: b };
}

console.log('--- even fight, level 20 ---');
let r = simulate('a', { allyLins: ['emberwyrm', 'tidechorus', 'skyward'], foeLins: ['ridgeback', 'boglurk'], level: 20 });
console.log(r.state, 'rounds', r.rounds, 'xp', r.rewards.xp, 'coin', r.rewards.coin, 'drops', r.rewards.drops.join(','));

console.log('\n--- verbose short fight ---');
r = simulate('b', { allyLins: ['emberwyrm'], foeLins: ['boglurk'], level: 10, verbose: true });
console.log(r.state, 'rounds', r.rounds);

console.log('\n--- capture attempt ---');
r = simulate('c', { allyLins: ['emberwyrm', 'skyward'], foeLins: ['glimmerwing'], level: 22, bind: true });
console.log(r.state, 'rounds', r.rounds, 'captured', r.rewards.captured && r.rewards.captured.name);

console.log('\n--- 200 random fights: termination + outcome spread ---');
const outcomes = {}; let maxRounds = 0, totalRounds = 0;
const lins = ['emberwyrm','tidechorus','skyward','stonefather','verdantcoil','cinderling','saltdrake','ridgeback','glimmerwing','boglurk','stormcaller','ashbound'];
for (let i = 0; i < 200; i++) {
  const rng = rngFrom('spread' + i, 'pick');
  const res = simulate('fight' + i, {
    allyLins: [rng.pick(lins), rng.pick(lins), rng.pick(lins)],
    foeLins: [rng.pick(lins), rng.pick(lins)],
    level: rng.int(5, 45),
  });
  outcomes[res.state] = (outcomes[res.state] || 0) + 1;
  maxRounds = Math.max(maxRounds, res.rounds);
  totalRounds += res.rounds;
}
console.log(outcomes, 'avg rounds', (totalRounds / 200).toFixed(1), 'max', maxRounds);
