// Traits: passive abilities. A COM-bot has one trait per evolution stage it has reached — a
// stage-1 bot has its line's first trait, and each evolution adds the next, so an evolved bot keeps
// everything it had and gains more. The battle engine (js/sim/battle.js) checks them by id.

export const TRAITS = {
    // ---- absorb a type
    'ground-wire':    { name: 'Ground Wire',     desc: 'Volt techniques are drawn into the ground: they heal 25% Hull instead of hurting.' },
    'heat-sink':      { name: 'Heat Sink',       desc: 'Blaze techniques are soaked up and heal 25% Hull. Cannot overheat.' },
    'bilge-pump':     { name: 'Bilge Pump',      desc: 'Hydro techniques are pumped away and heal 25% Hull.' },
    'hover':          { name: 'Hover',           desc: 'Floats above the ground. Immune to Grit techniques and Scrap Shards.' },
    // ---- contact
    'static-hull':    { name: 'Static Hull',     desc: 'Kinetic attackers that touch it may be short-circuited (30%).' },
    'hot-plating':    { name: 'Hot Plating',     desc: 'Kinetic attackers that touch it may overheat (30%).' },
    'acid-weep':      { name: 'Acid Weep',       desc: 'Kinetic attackers that touch it may be corroded (30%).' },
    'spiked-plating': { name: 'Spiked Plating',  desc: 'Kinetic attackers that touch it take 1/8 of their Hull.' },
    'rime-plating':   { name: 'Rime Plating',    desc: 'Kinetic attackers that touch it may seize up (10%).' },
    // ---- defence
    'thick-plating':  { name: 'Thick Plating',   desc: 'Takes 20% less damage from kinetic techniques.' },
    'field-emitter':  { name: 'Field Emitter',   desc: 'Takes 20% less damage from energy techniques.' },
    'damper':         { name: 'Damper',          desc: 'Super-effective hits deal 25% less damage.' },
    'reinforced':     { name: 'Reinforced',      desc: 'At full Hull, survives any single hit with 1 Hull left.' },
    'shell-plating':  { name: 'Shell Plating',   desc: 'Takes half damage while at full Hull.' },
    'locked-gauges':  { name: 'Locked Gauges',   desc: 'Its stats cannot be lowered by the opponent.' },
    'rustproof':      { name: 'Rustproof',       desc: 'Cannot be corroded.' },
    'insulated':      { name: 'Insulated',       desc: 'Cannot be short-circuited.' },
    'gyro-stabilizer':{ name: 'Gyro Stabilizer', desc: 'Cannot be staggered or glitched.' },
    // ---- offence
    'redline':        { name: 'Redline',         desc: 'Techniques of its own types hit 50% harder when its Hull is below a third.' },
    'specialist':     { name: 'Specialist',      desc: 'Same-type bonus is ×1.75 instead of ×1.5.' },
    'hydraulics':     { name: 'Hydraulics',      desc: 'Punching techniques hit 25% harder.' },
    'honed-edges':    { name: 'Honed Edges',     desc: 'Cutting and clawing techniques hit 25% harder.' },
    'carbide-bits':   { name: 'Carbide Bits',    desc: 'Drilling techniques hit 30% harder.' },
    'amplifier':      { name: 'Amplifier',       desc: 'Sound and signal techniques hit 30% harder.' },
    'targeting-optics':{ name: 'Targeting Optics', desc: 'Lands critical hits far more often.' },
    'fine-tuning':    { name: 'Fine Tuning',     desc: 'Techniques of 60 power or less hit 50% harder.' },
    'overbuilt':      { name: 'Overbuilt Pistons', desc: 'Torque is boosted by 50%.' },
    'overdrive':      { name: 'Overdrive',       desc: 'Torque rises 50% while suffering a status condition.' },
    'lens-array':     { name: 'Lens Array',      desc: 'Accuracy of its techniques is raised by 30%.' },
    'second-gear':    { name: 'Second Gear',     desc: 'Hits 30% harder when it moves after the target.' },
    'momentum-engine':{ name: 'Momentum Engine', desc: 'Knocking out a foe raises its Torque.' },
    'siphon-fangs':   { name: 'Siphon Fangs',    desc: 'Biting techniques heal it by 25% of the damage dealt.' },
    'menacing-grind': { name: 'Menacing Grind',  desc: 'On entry, the grinding noise lowers the foe\'s Torque.' },
    // ---- sustain / tempo
    'self-repair':    { name: 'Self-Repair',     desc: 'Restores 1/16 of its Hull at the end of every turn.' },
    'hot-swap':       { name: 'Hot Swap',        desc: 'Restores a third of its Hull when recalled.' },
    'auto-reset':     { name: 'Auto-Reset',      desc: 'Status conditions clear when recalled.' },
    'flaking-plates': { name: 'Flaking Plates',  desc: '30% chance each turn to shake off a status condition.' },
    'turbo':          { name: 'Turbo',           desc: 'Clock rises one stage at the end of every turn.' },
    'photosynth-skin':{ name: 'Chlorophyll Coat', desc: 'Restores 1/16 Hull each turn while the sky is clear (no atmosphere).' },
    // ---- atmospheres
    'smokestack':     { name: 'Smokestack',      desc: 'On entry, belches Smog over the field for five turns.' },
    'furnace-core':   { name: 'Furnace Core',    desc: 'On entry, sets off a Heatwave for five turns.' },
    'cloudseeder':    { name: 'Cloudseeder',     desc: 'On entry, brings Acid Rain for five turns.' },
    'dust-maker':     { name: 'Dust Maker',      desc: 'On entry, whips up a Dust Storm for five turns.' },
    'storm-coil':     { name: 'Storm Coil',      desc: 'On entry, starts a Static Storm for five turns.' },
    'bilge-runner':   { name: 'Bilge Runner',    desc: 'Clock doubles in Acid Rain.' },
    'sand-skimmer':   { name: 'Sand Skimmer',    desc: 'Clock doubles in a Dust Storm; immune to its damage.' },
    'heat-rider':     { name: 'Heat Rider',      desc: 'Clock doubles in a Heatwave.' },
    'storm-rider':    { name: 'Storm Rider',     desc: 'Clock doubles in a Static Storm.' },
    'smog-lungs':     { name: 'Smog Lungs',      desc: 'Arc rises 50% in Smog, and Smog never blinds it.' },
    // ---- field (work outside battle while it leads the team)
    'scavenger':      { name: 'Scavenger',       desc: 'Sometimes digs a material out of the wreckage after a battle.' },
    'glow-lamp':      { name: 'Glow Lamp',       desc: 'Its light draws wild COM-bots: more encounters while it leads.' },
    'muffled':        { name: 'Muffled',         desc: 'Runs so quietly that wild COM-bots appear half as often while it leads.' },
    // ---- titans and the First Bot
    'prime-engine':   { name: 'Prime Engine',    desc: 'All of its stats are boosted by 10%.' },
    'perpetual':      { name: 'Perpetual Motion', desc: 'Restores 1/8 Hull and gains Clock at the end of every turn.' },
    'event-horizon':  { name: 'Event Horizon',   desc: 'Foes cannot raise their stats while it is in the field.' },
};

export function traitName(id) { return TRAITS[id] ? TRAITS[id].name : id; }
