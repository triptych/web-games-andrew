/**
 * stages.js — creates each 3D stage once, on first use.
 */

const made = new Map();
const makers = {
    citadel: async () => (await import('../view/citadel.js')).createCitadel(),
    showcase: async () => (await import('../view/showcase.js')).createShowcase(),
    battle: async () => (await import('../view/battleScene.js')).createBattleStage(),
    summon: async () => (await import('../view/summonScene.js')).createSummonStage(),
    mine: async () => (await import('../view/mineScene.js')).createMineStage(),
    farm: async () => (await import('../view/farmScene.js')).createFarmStage(),
    spire: async () => (await import('../view/spireScene.js')).createSpireStage(),
};

export async function getStage3D(name) {
    if (made.has(name)) return made.get(name);
    const st = await makers[name]();
    made.set(name, st);
    return st;
}

export function peekStage(name) { return made.get(name) || null; }
