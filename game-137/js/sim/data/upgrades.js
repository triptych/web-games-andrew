// Level-up choices inside a sortie (red voxels fill the bar). They last until the sortie ends.
// `need` names the weapon type(s) the mech must carry for the card to be offered.

export const UPGRADES = {
    dmg: { name: 'Hot Barrels', icon: '🔥', desc: '+15% damage', max: 6 },
    rate: { name: 'Quick Feed', icon: '⏩', desc: '+12% fire rate', max: 6 },
    speed: { name: 'Servo Boost', icon: '💨', desc: '+9% move speed', max: 4 },
    magnet: { name: 'Big Magnet', icon: '🧲', desc: '+1.2 magnet reach, +0.3 pickup', max: 4 },
    hp: { name: 'Patch Armour', icon: '🧱', desc: '+20 max HP and repair 30', max: 5 },
    shield: { name: 'Field Coil', icon: '🔷', desc: '+20 shield', max: 4 },
    regen: { name: 'Nano Repair', icon: '💚', desc: 'Regenerate 0.8 HP a second', max: 3 },
    multi: { name: 'Twin Feed', icon: '🔫', desc: 'Guns fire one more bullet', max: 3, need: ['bullet'] },
    salvo: { name: 'Bigger Salvo', icon: '🚀', desc: 'One more rocket each salvo', max: 3, need: ['rocket'] },
    blast: { name: 'Shaped Charge', icon: '💣', desc: '+25% blast radius', max: 3, need: ['rocket', 'mortar', 'stomp'] },
    beam: { name: 'Wide Lance', icon: '⚡', desc: 'Laser +40% width and +3 range', max: 3, need: ['beam'] },
    saws: { name: 'Extra Saw', icon: '🌀', desc: 'One more saw drone', max: 3, need: ['orbit'] },
    od: { name: 'Burning Spirit', icon: '✨', desc: 'Overdrive charges 30% faster', max: 3 },
};
