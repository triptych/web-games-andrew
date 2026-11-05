// The story: characters, screens and radio lines. Pure data.

export const WHO = {
    mara:  { name: 'Mara Quill',      icon: '🧑‍🚀', col: '#6fe0ff' },
    pip:   { name: 'PIP',             icon: '🤖', col: '#ffd24d' },
    ines:  { name: 'Cdr. Ines Okafor', icon: '👩‍✈️', col: '#9dff8a' },
    colon: { name: 'Colonist',        icon: '🧑‍🌾', col: '#ffb3d9' },
    tomas: { name: 'Old Tomas',       icon: '🧓', col: '#ffb27a' },
    zhar:  { name: 'Zhar-Kul',        icon: '👾', col: '#ff6a6a' },
    skarn: { name: 'Skarn Net',       icon: '📡', col: '#c68cff' },
};

export const PROLOGUE = [
    { who: 'pip', text: 'Planet Tessera IV. Day 31 since the Skarn fell on Haven\'s Rest. 312 colonists were dragged off to the Hive at the far end of the Vessk Rift. I have been counting. I do not like the number.' },
    { who: 'mara', text: 'I was out in the badlands surveying when it happened. All I have left is MITE: a six-legged survey walker with one pulse gun bolted on, and you, PIP.' },
    { who: 'pip', text: 'MITE is, to be accurate, a very small mech. But six legs go places treads cannot, and the Skarn leave a great deal of good scrap lying about.' },
    { who: 'mara', text: 'Then we walk. Through Haven\'s Ruin, the marsh, the canyon, the ice and the forge-fields, all the way to the Hive. Every cage we crack open is a family we get back. And every scrap we gather makes MITE a little bigger.' },
];

export const BRIEFING = {
    ruin:   'The relay station beyond the burnt farmland is the only way out. A Skarn Gatekeeper sits on the pass. Colonist pods are reported in the camps along the road.',
    fen:    'Sporefen is thick with acid pools and Wasp drones. The rescued engineers say the Skarn prisoner convoys came through here.',
    rift:   'Redrock Canyon is a maze of terraces and cliffs. Step over what you can, jump what you cannot. An artillery walker holds the narrow pass at the far end.',
    ice:    'Whitelight Glacier: black ice, gale winds, and something big tunnelling under it. Do not stand still.',
    cinder: 'The Skarn smelt colony iron in the Cinder Basin. Lava everywhere. A forge-colossus is built to guard the furnaces.',
    hive:   'The Hive. 312 minus whoever you freed are in the pens, and Zhar-Kul sits over them. This is the last walk.',
};

export const RADIO = {
    // level start
    'ruin.start':   { who: 'pip',  text: 'Scanning. Eleven hostiles in the first camp. Orange pods are colonist cages: shoot the lock to open them.' },
    'ruin.mid':     { who: 'mara', text: 'These are the farm roads. I used to wave to the harvesters here.' },
    'ruin.boss':    { who: 'pip',  text: 'Heavy armour ahead: a Gatekeeper tank. Keep moving. It cannot track a walker that strafes.' },
    'fen.start':    { who: 'pip',  text: 'Acid pools and spore haze. Wasp drones love this place. Watch the sky.' },
    'fen.mid':      { who: 'tomas', text: 'Mara? Is that you? We are in the pens at the next camp. Please hurry.' },
    'rift.start':   { who: 'ines', text: 'Mara, this is Commander Okafor. I am alive. The Skarn are using the canyon as a corridor to the Hive. Break it.' },
    'rift.mid':     { who: 'pip',  text: 'Legs upgrades let MITE step over rubble. At this size, small rocks are scenery.' },
    'rift.boss':    { who: 'pip',  text: 'A Siege Strider holds the pass. Its mortars are telegraphed. Mind the red circles.' },
    'ice.start':    { who: 'pip',  text: 'Black ice ahead. Traction is poor. Jump jets will help in a pinch.' },
    'ice.mid':      { who: 'pip',  text: 'Seismic readings under the glacier. Something huge is following us.' },
    'ice.boss':     { who: 'pip',  text: 'It is surfacing! A Leviathan. Do not stand where the ice cracks.' },
    'cinder.start': { who: 'ines', text: 'The forges are where they melted our colony down. You are almost there, Mara.' },
    'cinder.mid':   { who: 'pip',  text: 'Lava pools leave you no room to stand and shoot. Keep walking.' },
    'cinder.boss':  { who: 'pip',  text: 'A Cinder Titan. Shield pylons will power it. Break them, then break it.' },
    'hive.start':   { who: 'skarn', text: 'INTRUDER ON THE FINAL PATH. ALL BROOD TO THE GATES.' },
    'hive.mid':     { who: 'mara', text: 'I can hear them. The colonists. They are singing.' },
    'hive.boss':    { who: 'zhar', text: 'A tiny spider has walked this far? Come, little one. Let me see how you break.' },
    // boss phases
    'gk2':  { who: 'pip',  text: 'Its plating is blown off. It is faster now, and it will charge.' },
    'st2':  { who: 'pip',  text: 'The Strider is calling reinforcements. Drop pods incoming.' },
    'st3':  { who: 'pip',  text: 'Core exposed! Hit it while it glows. It also fires a beam now. Jump the stomp waves.' },
    'lv2':  { who: 'pip',  text: 'It is whipping up a blizzard and calling drones.' },
    'lv3':  { who: 'pip',  text: 'It is frenzied. It will burrow again and again. Move, move, move.' },
    'ti2':  { who: 'pip',  text: 'Two shield pylons online. The Titan is immune until both are down.' },
    'ti3':  { who: 'pip',  text: 'Meltdown! The arena floor is turning to lava. Keep moving and shoot the glowing core.' },
    'wl2':  { who: 'zhar', text: 'Not bad. Pylons! Brood! Show it what the Hive does to walkers.' },
    'wl3':  { who: 'pip',  text: 'It has opened the Hive Engine. Missiles and a sweeping beam. Stay mobile.' },
    'wl4':  { who: 'zhar', text: 'IMPOSSIBLE. You were a survey walker! Then I will burn this whole camp down with you in it!' },
    // events
    'pod1':   { who: 'colon', text: 'We are free! Thank you, thank you! Take our scrap, take whatever you can!' },
    'pod2':   { who: 'tomas', text: 'Another cage open. Go on, Mara. We will keep the hangar lit for you.' },
    'lowhp':  { who: 'pip',  text: 'Armour critical. Use cover or grab a repair kit.' },
    'bossdown': { who: 'pip', text: 'Target destroyed. The path is open.' },
};

export const LEVEL_END = {
    ruin:   'The Gatekeeper is scrap. Behind it, the road to Sporefen opens. Colonist engineers wave from the pods and start bolting new plating onto MITE.',
    fen:    'Through the marsh at last. The engineers hand over everything they salvaged: more upgrades are ready.',
    rift:   'The Strider is down and the canyon is quiet. MITE is not so small any more.',
    ice:    'The Leviathan lies still in the cracked ice. Ahead, the glow of the forge-fields.',
    cinder: 'The Titan collapses into its own furnace. One walk left.',
};

export const ENDING = {
    high: ['The Warlord falls and the Hive goes quiet. The pens swing open, and nearly everyone you freed along the way is there to greet the rest.', 'Commander Okafor counts: 312 colonists, together again. MITE, once a puny survey walker, stands taller than the Hive gate.', 'PIP, quietly: "I have stopped counting, Mara. The number is right."'],
    mid:  ['The Warlord falls and the pens swing open. Not every cage was reached on the road, but the Hive\'s own cells hold the rest.', 'Commander Okafor counts the survivors and weeps. Haven\'s Rest will be rebuilt.', 'PIP: "We will find every last one."'],
    low:  ['The Warlord falls and the pens swing open. You walked past too many cages on the way, and the colony will not forget it.', 'Still, they are free. Haven\'s Rest will be rebuilt, and MITE will guard it.', 'PIP: "Next time, Mara, we open every cage."'],
};
