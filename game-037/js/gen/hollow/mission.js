// ============================================================
// gen/hollow/mission.js - the Zelda logic (GDD §12.6)
// A small DAG of what the floor asks, generated with no knowledge of space.
// PURE.
// ============================================================

let counter = 0;   // run-local node ids only; never persisted

const node = (kind, extra = {}) => ({ id: 'm' + (counter++), kind, ...extra });

/** Key kinds are floor-local; they are never Key Capabilities. */
const KEY_KINDS = ['rusted key', 'sluice handle', 'bell-tone', 'brass tally', 'wax seal', 'iron tooth'];

/**
 * @pure Rewrite the grammar into 4-11 nodes. The cap is what keeps a floor
 * a floor rather than a sprawl.
 */
export function generateMission(rng, depth, isBossFloor) {
  counter = 0;
  const nodes = [];
  const entry = node('entry');
  nodes.push(entry);

  if (isBossFloor) {
    const keyKind = rng.pick(KEY_KINDS);
    const key = node('key', { keyKind });
    const lock = node('lock', { keyKind });
    nodes.push(key, lock, node('boss'), node('treasure', { prize: true }), node('exit'));
  } else {
    middle(rng, nodes, depth, 0);
    nodes.push(node('exit'));
  }

  // one secret per floor, a bit over half the time
  if (rng.chance(0.55)) nodes.push(node('secret'));

  // a second key/lock pair deeper down
  if (depth >= 3 && rng.chance(0.35)) {
    const keyKind = rng.pick(KEY_KINDS.filter(k => !nodes.some(n => n.keyKind === k)));
    if (keyKind) {
      const lockIdx = nodes.findIndex(n => n.kind === 'exit');
      nodes.splice(Math.max(1, lockIdx), 0, node('key', { keyKind }), node('lock', { keyKind }));
    }
  }

  // hard cap: a floor is 4-11 demands
  while (nodes.length > 11) {
    const i = nodes.findIndex(n => n.kind === 'filler' || n.kind === 'combat');
    if (i < 0) break;
    nodes.splice(i, 1);
  }
  while (nodes.length < 4) nodes.splice(nodes.length - 1, 0, node('combat'));

  return { nodes, hub: nodes.find(n => n.kind === 'hub') || null };
}

function middle(rng, nodes, depth, level) {
  if (level > 2) { challenge(rng, nodes); return; }
  const options = ['one', 'two'];
  const weights = [4, 3];
  if (depth >= 2) { options.push('hub2'); weights.push(4); }
  if (depth >= 3) { options.push('hub3'); weights.push(3); }
  options.push('gated'); weights.push(5);

  switch (rng.weighted(options, weights)) {
    case 'one': challenge(rng, nodes); break;
    case 'two': challenge(rng, nodes); challenge(rng, nodes); break;
    case 'hub2': {
      nodes.push(node('hub'));
      branch(rng, nodes, depth, level + 1); branch(rng, nodes, depth, level + 1);
      break;
    }
    case 'hub3': {
      nodes.push(node('hub'));
      branch(rng, nodes, depth, level + 1); branch(rng, nodes, depth, level + 1); branch(rng, nodes, depth, level + 1);
      break;
    }
    case 'gated': {
      const keyKind = rng.pick(KEY_KINDS);
      nodes.push(node('key', { keyKind }));
      nodes.push(node('lock', { keyKind }));
      middle(rng, nodes, depth, level + 1);
      break;
    }
  }
}

function challenge(rng, nodes) {
  const pick = rng.weightedKey({ combat: 5, puzzle: 3, combat_treasure: 3, puzzle_treasure: 2 });
  if (pick === 'combat') nodes.push(node('combat'));
  else if (pick === 'puzzle') nodes.push(node('puzzle'));
  else if (pick === 'combat_treasure') { nodes.push(node('combat'), node('treasure')); }
  else { nodes.push(node('puzzle'), node('treasure')); }
}

function branch(rng, nodes, depth, level) {
  const pick = rng.weightedKey({ challenge_treasure: 5, gated: 2, secret: 2 });
  if (pick === 'challenge_treasure') { challenge(rng, nodes); nodes.push(node('treasure')); }
  else if (pick === 'gated') {
    const keyKind = rng.pick(KEY_KINDS);
    nodes.push(node('key', { keyKind }), node('lock', { keyKind }));
    challenge(rng, nodes);
  } else nodes.push(node('secret'));
}

export { KEY_KINDS };
