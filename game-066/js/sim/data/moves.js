// Techniques. cat: 'K' kinetic (Torque vs Plating), 'E' energy (Arc vs Shield), 'U' utility.
// acc 0 = never misses. pp = charges. tags link techniques to parts (see parts.js).
// fx is a tiny effect language, one clause per ';':
//   st <status> [chance]   ovh overheat · cor corrode · shc short-circuit · frz seize · pdn power down
//   glitch [chance]        confuse the target          stagger <chance>    flinch the target
//   self|foe <stat> <n> [chance]   stat stages (atk def spa spd spe acc crit)
//   recoil <frac> · drain <frac> · heal <frac> · multi <min> <max> · crit (high crit ratio)
//   atm <heat|rain|dust|static|smog> · protect · shards · siphon · rest · purge · boom
//   recharge · lowhp (stronger when hurt) · fixed (damage = level)

const MOVES = {};
function M(id, name, type, cat, pow, acc, pp, fx = '', tags = '', pri = 0, note = '') {
    MOVES[id] = { id, name, type, cat, pow, acc, pp, fx: parseFx(fx), fxText: fx, tags: tags ? tags.split(' ') : [], pri, note };
}

function parseFx(s) {
    if (!s) return [];
    return s.split(';').map((c) => c.trim()).filter(Boolean).map((c) => {
        const p = c.split(/\s+/);
        const k = p[0];
        switch (k) {
            case 'st': return { k, s: p[1], p: p[2] ? +p[2] : 100 };
            case 'glitch': case 'stagger': return { k, p: p[1] ? +p[1] : 100 };
            case 'self': case 'foe': return { k, stat: p[1], n: +p[2], p: p[3] ? +p[3] : 100 };
            case 'recoil': case 'drain': case 'heal': return { k, f: +p[1] };
            case 'multi': return { k, min: +p[1], max: +p[2] };
            case 'atm': return { k, a: p[1] };
            default: return { k };
        }
    });
}

// ------------------------------------------------------------------ Scrap
M('ram', 'Ram', 'scrap', 'K', 40, 100, 35, '', 'ram');
M('rake', 'Rake', 'scrap', 'K', 40, 100, 35, '', 'claw');
M('bolt-shot', 'Bolt Shot', 'scrap', 'E', 40, 100, 30, '', 'blast');
M('cable-whip', 'Cable Whip', 'scrap', 'K', 45, 100, 30, 'foe def -1 20', 'whip');
M('junk-toss', 'Junk Toss', 'scrap', 'K', 50, 95, 25, '', 'grab');
M('clamp', 'Clamp', 'scrap', 'K', 55, 100, 20, 'foe spe -1 50', 'grab');
M('buzzsaw', 'Buzzsaw', 'scrap', 'K', 55, 95, 25, 'crit', 'saw');
M('stomp', 'Stomp', 'scrap', 'K', 65, 100, 20, 'stagger 30', 'kick');
M('horn-ram', 'Horn Ram', 'scrap', 'K', 65, 100, 25, '', 'horn');
M('rending-claw', 'Rending Claw', 'scrap', 'K', 75, 95, 15, 'crit', 'claw');
M('scrap-cannon', 'Scrap Cannon', 'scrap', 'E', 80, 100, 15, '', 'blast');
M('scrap-slam', 'Scrap Slam', 'scrap', 'K', 85, 100, 15, 'st shc 30', 'ram');
M('full-throttle', 'Full Throttle', 'scrap', 'E', 150, 90, 5, 'recharge', 'ram');
M('core-meltdown', 'Core Meltdown', 'scrap', 'K', 200, 100, 5, 'boom', '', 0, 'The user vents its core. It shuts down afterwards.');
M('rev-up', 'Rev Up', 'scrap', 'U', 0, 0, 20, 'self atk 2');
M('clatter', 'Clatter', 'scrap', 'U', 0, 100, 30, 'foe def -1');
M('rattle', 'Rattle', 'scrap', 'U', 0, 100, 30, 'foe atk -1');
M('glare', 'Glare', 'scrap', 'U', 0, 90, 20, 'st shc', 'beam', 0, 'A blinding searchlight jams the target\'s relays.');
M('patch-up', 'Patch Up', 'scrap', 'U', 0, 0, 10, 'heal 0.5');
M('bulwark', 'Bulwark', 'scrap', 'U', 0, 0, 10, 'protect', 'guard', 4, 'Braces behind plating and blocks every attack this turn. Fails if used twice in a row.');
M('cold-restart', 'Cold Restart', 'scrap', 'U', 0, 0, 10, 'rest', '', 0, 'Shuts down for two turns to restore full Hull and clear its status.');
M('sputter', 'Sputter', 'scrap', 'K', 50, 0, 1, 'recoil 0.25', '', 0, 'Used when every charge is spent.');

// ------------------------------------------------------------------ Steam
M('vent-puff', 'Vent Puff', 'steam', 'E', 40, 100, 30, 'foe acc -1 20', 'stack');
M('steamroll', 'Steamroll', 'steam', 'K', 65, 100, 20, 'stagger 20', 'ram');
M('scald-jet', 'Scald Jet', 'steam', 'E', 65, 100, 20, 'st ovh 20', 'spray');
M('steam-whistle', 'Steam Whistle', 'steam', 'E', 60, 100, 15, 'glitch 20', 'wave');
M('smokestack-blast', 'Smokestack Blast', 'steam', 'E', 80, 100, 15, 'foe acc -1 30', 'stack');
M('steam-hammer', 'Steam Hammer', 'steam', 'K', 90, 90, 10, '', 'punch');
M('pressure-blast', 'Pressure Blast', 'steam', 'E', 90, 100, 10, '', 'spray');
M('boiler-burst', 'Boiler Burst', 'steam', 'E', 120, 85, 5, 'recoil 0.33', 'stack');
M('smokescreen', 'Smokescreen', 'steam', 'U', 0, 100, 20, 'foe acc -1', 'stack');
M('purge-vents', 'Purge Vents', 'steam', 'U', 0, 0, 20, 'purge', 'stack', 0, 'Vents every stat change on the field, both sides.');
M('build-pressure', 'Build Pressure', 'steam', 'U', 0, 0, 15, 'self spa 2', 'stack');

// ------------------------------------------------------------------ Blaze
M('ember-spit', 'Ember Spit', 'blaze', 'E', 40, 100, 25, 'st ovh 10');
M('weld-torch', 'Weld Torch', 'blaze', 'K', 60, 100, 25, 'crit', 'saw');
M('afterburner', 'Afterburner', 'blaze', 'K', 50, 100, 20, '', 'jet', 1);
M('flame-fist', 'Flame Fist', 'blaze', 'K', 75, 100, 15, 'st ovh 10', 'punch');
M('slag-hurl', 'Slag Hurl', 'blaze', 'K', 85, 90, 10, 'foe spe -1 30', 'grab');
M('firebox-blast', 'Firebox Blast', 'blaze', 'E', 90, 100, 15, 'st ovh 10');
M('furnace-blast', 'Furnace Blast', 'blaze', 'E', 110, 90, 5, 'st ovh 30', 'stack');
M('incinerate', 'Incinerate', 'blaze', 'K', 120, 100, 10, 'recoil 0.33; st ovh 10');
M('ignite', 'Ignite', 'blaze', 'U', 0, 85, 15, 'st ovh');
M('bellows-roar', 'Bellows Roar', 'blaze', 'U', 0, 100, 20, 'foe atk -1; foe spa -1');
M('stoke-furnace', 'Stoke Furnace', 'blaze', 'U', 0, 0, 5, 'atm heat');

// ------------------------------------------------------------------ Hydro
M('spritz', 'Spritz', 'hydro', 'E', 40, 100, 25, '', 'spray');
M('undertow', 'Undertow', 'hydro', 'K', 60, 100, 20, 'foe spe -1');
M('hose-blast', 'Hose Blast', 'hydro', 'E', 65, 100, 20, '', 'spray');
M('bilge-slam', 'Bilge Slam', 'hydro', 'K', 80, 100, 15, 'stagger 20', 'ram');
M('maelstrom', 'Maelstrom', 'hydro', 'E', 90, 100, 10);
M('hydraulic-press', 'Hydraulic Press', 'hydro', 'K', 95, 90, 10, '', 'punch');
M('torrent-cannon', 'Torrent Cannon', 'hydro', 'E', 110, 80, 5, '', 'blast');
M('coolant-flush', 'Coolant Flush', 'hydro', 'U', 0, 0, 10, 'heal 0.5', 'spray');
M('cloudseed', 'Cloudseed', 'hydro', 'U', 0, 0, 5, 'atm rain');

// ------------------------------------------------------------------ Frost
M('frost-puff', 'Frost Puff', 'frost', 'E', 40, 100, 25, 'st frz 10');
M('ice-skate', 'Ice Skate', 'frost', 'K', 40, 100, 30, '', 'skate', 1);
M('frostbite', 'Frostbite', 'frost', 'K', 65, 95, 15, 'st frz 10', 'bite');
M('icicle-drill', 'Icicle Drill', 'frost', 'K', 75, 95, 15, 'crit', 'drill');
M('cryo-beam', 'Cryo Beam', 'frost', 'E', 90, 100, 10, 'st frz 10', 'beam');
M('nitro-blast', 'Nitro Blast', 'frost', 'E', 110, 70, 5, 'st frz 30', 'blast');
M('glacier-crash', 'Glacier Crash', 'frost', 'K', 120, 85, 5);
M('coolant-fog', 'Coolant Fog', 'frost', 'U', 0, 95, 20, 'foe spe -2');
M('rime-armor', 'Rime Armor', 'frost', 'U', 0, 0, 15, 'self def 1; self spd 1');

// ------------------------------------------------------------------ Volt
M('spark', 'Spark', 'volt', 'E', 40, 100, 30, 'st shc 10', 'coil');
M('arc-lash', 'Arc Lash', 'volt', 'E', 65, 100, 20, 'st shc 10', 'coil');
M('shock-claw', 'Shock Claw', 'volt', 'K', 70, 100, 15, 'st shc 20', 'claw');
M('shock-whip', 'Shock Whip', 'volt', 'K', 75, 100, 15, 'st shc 10', 'whip');
M('tesla-bolt', 'Tesla Bolt', 'volt', 'E', 90, 100, 15, 'st shc 10', 'coil');
M('thunder-forge', 'Thunder Forge', 'volt', 'E', 110, 70, 10, 'st shc 30', 'coil');
M('overvolt-ram', 'Overvolt Ram', 'volt', 'K', 120, 100, 15, 'recoil 0.33; st shc 10', 'ram');
M('static-field', 'Static Field', 'volt', 'U', 0, 90, 20, 'st shc');
M('capacitor-charge', 'Capacitor Charge', 'volt', 'U', 0, 0, 20, 'self spa 1; self spd 1', 'coil');
M('storm-call', 'Storm Call', 'volt', 'U', 0, 0, 5, 'atm static');

// ------------------------------------------------------------------ Grit
M('sand-flick', 'Sand Flick', 'grit', 'U', 0, 100, 15, 'foe acc -1');
M('dust-blast', 'Dust Blast', 'grit', 'E', 50, 100, 25);
M('drill-bore', 'Drill Bore', 'grit', 'K', 60, 100, 20, '', 'drill');
M('gravel-slide', 'Gravel Slide', 'grit', 'K', 75, 90, 10, 'stagger 30');
M('drill-spiral', 'Drill Spiral', 'grit', 'K', 80, 95, 15, 'crit', 'drill');
M('sandblaster', 'Sandblaster', 'grit', 'E', 90, 100, 10, 'foe acc -1 30', 'blast');
M('seismic-stomp', 'Seismic Stomp', 'grit', 'K', 100, 100, 10, '', 'kick');
M('core-breaker', 'Core Breaker', 'grit', 'K', 120, 85, 5, '', 'drill');
M('dust-devil', 'Dust Devil', 'grit', 'U', 0, 0, 5, 'atm dust');
M('scrap-shards', 'Scrap Shards', 'grit', 'U', 0, 0, 20, 'shards', 'guard', 0, 'Scatters sharp scrap on the foe\'s side. Bots sent in after take damage (up to three layers).');

// ------------------------------------------------------------------ Aero
M('peck', 'Peck', 'aero', 'K', 35, 100, 35, '', 'peck');
M('gust', 'Gust', 'aero', 'E', 40, 100, 35, '', 'wing');
M('prop-wash', 'Prop Wash', 'aero', 'E', 65, 95, 20, '', 'wing');
M('wing-slice', 'Wing Slice', 'aero', 'K', 70, 100, 15, 'crit', 'wing');
M('riveter-beak', 'Riveter Beak', 'aero', 'K', 80, 100, 20, '', 'peck');
M('jet-ram', 'Jet Ram', 'aero', 'K', 90, 95, 10, '', 'jet');
M('cyclone', 'Cyclone', 'aero', 'E', 110, 70, 10, 'glitch 30', 'wing');
M('sky-dive', 'Sky Dive', 'aero', 'K', 120, 100, 15, 'recoil 0.33', 'wing');
M('tailwind', 'Tailwind', 'aero', 'U', 0, 0, 15, 'self spe 2', 'wing');
M('hangar-rest', 'Hangar Rest', 'aero', 'U', 0, 0, 10, 'heal 0.5', 'wing');

// ------------------------------------------------------------------ Iron
M('shrapnel', 'Shrapnel', 'iron', 'K', 40, 100, 30, '', 'blast', 1);
M('magnet-pulse', 'Magnet Pulse', 'iron', 'E', 60, 100, 20, '', 'coil');
M('shear', 'Shear', 'iron', 'K', 70, 100, 15, 'crit', 'saw');
M('iron-hammer', 'Iron Hammer', 'iron', 'K', 80, 90, 15, '', 'punch');
M('cannonade', 'Cannonade', 'iron', 'E', 80, 100, 10, 'foe spd -1 10', 'blast');
M('mirror-flare', 'Mirror Flare', 'iron', 'E', 80, 100, 10, 'foe acc -1 20', 'beam');
M('crane-slam', 'Crane Slam', 'iron', 'K', 85, 100, 10, '', 'grab');
M('wrecking-ball', 'Wrecking Ball', 'iron', 'K', 110, 90, 10, '', 'grab');
M('plate-up', 'Plate Up', 'iron', 'U', 0, 0, 15, 'self def 2', 'guard');

// ------------------------------------------------------------------ Gear
M('cog-toss', 'Cog Toss', 'gear', 'K', 40, 100, 30, '', 'gear');
M('cog-barrage', 'Cog Barrage', 'gear', 'K', 22, 95, 15, 'multi 2 5', 'gear');
M('gear-grind', 'Gear Grind', 'gear', 'K', 65, 100, 20, '', 'gear');
M('escapement', 'Escapement', 'gear', 'E', 70, 100, 15, 'self spe 1');
M('clockwork-strike', 'Clockwork Strike', 'gear', 'K', 80, 0, 15, '', '', 0, 'Timed to the tick. Never misses.');
M('mainspring-snap', 'Mainspring Snap', 'gear', 'K', 95, 90, 10, '', 'kick');
M('grand-gearwork', 'Grand Gearwork', 'gear', 'K', 120, 90, 5, '', 'gear');
M('overwind', 'Overwind', 'gear', 'U', 0, 0, 20, 'self atk 1; self spe 1', 'gear');
M('wind-up-key', 'Wind-Up Key', 'gear', 'U', 0, 0, 20, 'self spe 2');
M('grinding-halt', 'Grinding Halt', 'gear', 'U', 0, 95, 20, 'foe spe -2', 'gear');

// ------------------------------------------------------------------ Toxic
M('acid-spit', 'Acid Spit', 'toxic', 'E', 40, 100, 30, 'st cor 30', 'spray');
M('sludge-shot', 'Sludge Shot', 'toxic', 'E', 65, 100, 20, 'st cor 30', 'blast');
M('caustic-claw', 'Caustic Claw', 'toxic', 'K', 70, 100, 15, 'st cor 20', 'claw');
M('acid-fang', 'Acid Fang', 'toxic', 'K', 75, 100, 15, 'foe def -1 30', 'bite');
M('toxic-spray', 'Toxic Spray', 'toxic', 'E', 90, 100, 10, 'st cor 30', 'spray');
M('sludge-tide', 'Sludge Tide', 'toxic', 'E', 110, 85, 5, 'st cor 30');
M('corrode', 'Corrode', 'toxic', 'U', 0, 90, 15, 'st cor');
M('acid-armor', 'Acid Armor', 'toxic', 'U', 0, 0, 15, 'self def 2');
M('smog-cloud', 'Smog Cloud', 'toxic', 'U', 0, 0, 5, 'atm smog', 'stack');

// ------------------------------------------------------------------ Moss
M('vine-lash', 'Vine Lash', 'moss', 'K', 45, 100, 25, '', 'whip');
M('thorn-barrage', 'Thorn Barrage', 'moss', 'K', 25, 95, 15, 'multi 2 5', 'guard');
M('root-siphon', 'Root Siphon', 'moss', 'E', 60, 100, 15, 'drain 0.5', 'whip');
M('leaf-blades', 'Leaf Blades', 'moss', 'K', 80, 95, 15, 'crit', 'saw');
M('bloom-beam', 'Bloom Beam', 'moss', 'E', 90, 100, 10, '', 'beam');
M('overgrowth', 'Overgrowth', 'moss', 'K', 120, 85, 5, '', 'whip');
M('spore-puff', 'Spore Puff', 'moss', 'U', 0, 75, 15, 'st pdn');
M('siphon-seed', 'Siphon Seed', 'moss', 'U', 0, 90, 10, 'siphon', '', 0, 'Plants a seed that drains 1/8 of the target\'s Hull every turn to heal the user.');
M('photosynth', 'Photosynth', 'moss', 'U', 0, 0, 10, 'heal 0.5');

// ------------------------------------------------------------------ Piston
M('piston-jab', 'Piston Jab', 'piston', 'K', 40, 100, 30, '', 'punch', 1);
M('last-gasp', 'Last Gasp', 'piston', 'K', 1, 100, 15, 'lowhp', '', 0, 'The lower the user\'s Hull, the harder it hits (up to 200 power).');
M('hammer-fist', 'Hammer Fist', 'piston', 'K', 75, 100, 15, '', 'punch');
M('uppercog', 'Uppercog', 'piston', 'K', 80, 100, 15, 'stagger 20', 'punch');
M('shockwave-slam', 'Shockwave Slam', 'piston', 'E', 80, 0, 15, '', '', 0, 'A pressure wave that never misses.');
M('piston-kick', 'Piston Kick', 'piston', 'K', 85, 95, 10, '', 'kick');
M('suplex', 'Suplex', 'piston', 'K', 90, 90, 10, '', 'grab');
M('pile-driver', 'Pile Driver', 'piston', 'K', 120, 100, 5, 'self def -1; self spd -1', 'punch');
M('hydraulic-pump', 'Hydraulic Pump', 'piston', 'U', 0, 0, 20, 'self atk 1; self def 1', 'punch');

// ------------------------------------------------------------------ Signal
M('ping', 'Ping', 'signal', 'E', 40, 100, 30, '', 'wave');
M('data-spike', 'Data Spike', 'signal', 'K', 70, 100, 15, 'crit');
M('sonic-pulse', 'Sonic Pulse', 'signal', 'E', 70, 100, 15, 'glitch 10', 'wave');
M('broadcast', 'Broadcast', 'signal', 'E', 95, 100, 10, 'foe spd -1 10', 'wave');
M('overload-ray', 'Overload Ray', 'signal', 'E', 130, 90, 5, 'self spa -2', 'beam');
M('jam-signal', 'Jam Signal', 'signal', 'U', 0, 90, 15, 'glitch', 'wave');
M('recalibrate', 'Recalibrate', 'signal', 'U', 0, 0, 20, 'self spa 1; self spd 1');
M('lullaby-loop', 'Lullaby Loop', 'signal', 'U', 0, 60, 15, 'st pdn', 'wave');
M('focus-lens', 'Focus Lens', 'signal', 'U', 0, 0, 30, 'self crit 2', 'beam');

// ------------------------------------------------------------------ Rust
M('rust-flakes', 'Rust Flakes', 'rust', 'E', 40, 100, 30);
M('creeping-rust', 'Creeping Rust', 'rust', 'K', 40, 100, 30, '', '', 1);
M('rust-bite', 'Rust Bite', 'rust', 'K', 60, 100, 25, 'stagger 30', 'bite');
M('decay-ray', 'Decay Ray', 'rust', 'E', 80, 100, 15, 'foe spd -1 20', 'beam');
M('jawlock', 'Jawlock', 'rust', 'K', 80, 100, 15, 'foe def -1 20', 'bite');
M('grave-hammer', 'Grave Hammer', 'rust', 'K', 100, 90, 10, '', 'punch');
M('ruinous-wave', 'Ruinous Wave', 'rust', 'E', 110, 85, 5);
M('chain-rattle', 'Chain Rattle', 'rust', 'U', 0, 100, 20, 'foe atk -1; foe spa -1');
M('oxidize', 'Oxidize', 'rust', 'U', 0, 100, 20, 'foe def -2');

// ------------------------------------------------------------------ Void
M('void-pulse', 'Void Pulse', 'void', 'E', 40, 100, 30, '', 'beam');
M('warp-step', 'Warp Step', 'void', 'K', 60, 0, 20, '', '', 0, 'Blinks behind the target. Never misses.');
M('rift-claw', 'Rift Claw', 'void', 'K', 80, 100, 15, 'crit', 'claw');
M('aether-beam', 'Aether Beam', 'void', 'E', 80, 100, 15, '', 'beam');
M('prism-ray', 'Prism Ray', 'void', 'E', 100, 95, 10, 'glitch 10', 'beam');
M('comet-crash', 'Comet Crash', 'void', 'K', 120, 85, 5, 'recoil 0.25', 'ram');
M('event-horizon', 'Event Horizon', 'void', 'E', 130, 90, 5, 'self spa -2');
M('gravity-well', 'Gravity Well', 'void', 'U', 0, 95, 20, 'foe spe -2');
M('dark-matter', 'Dark Matter', 'void', 'U', 0, 0, 20, 'self spa 2');

// ------------------------------------------------------------------ titans and the First Bot (signature)
M('titans-boiler', "Titan's Boiler", 'steam', 'E', 120, 95, 5, 'st ovh 30', '', 0, 'Vents a whole city\'s worth of boiler pressure.');
M('absolute-zero', 'Absolute Zero', 'frost', 'E', 120, 90, 5, 'st frz 30', '', 0, 'Coolant cold enough to stop time in a gearbox.');
M('pylon-storm', 'Pylon Storm', 'volt', 'E', 120, 95, 5, 'st shc 30', '', 0, 'Calls down every bolt in the sky at once.');
M('engine-roar', 'Engine Roar', 'void', 'E', 130, 100, 5, 'foe spd -1 50', '', 0, 'The roar of the engine that once pushed a dreadnought between stars.');
M('first-turning', 'First Turning', 'gear', 'K', 100, 100, 10, 'self atk 1 30; self spa 1 30; self spe 1 30', '', 0, 'The first gear that ever turned on Midden.');

export { MOVES };

const STAT_WORD = { atk: 'Torque', def: 'Plating', spa: 'Arc', spd: 'Shield', spe: 'Clock', acc: 'accuracy', crit: 'targeting' };
const STATUS_WORD = { ovh: 'overheat', cor: 'corrode', shc: 'short-circuit', frz: 'seize', pdn: 'power down' };

/** A one-line description for menus and the registry. */
export function moveDesc(m) {
    if (m.note) return m.note;
    const parts = [];
    for (const f of m.fx) {
        const ch = f.p !== undefined && f.p < 100 ? `${f.p}% chance to ` : '';
        switch (f.k) {
            case 'st': parts.push(`${ch ? cap(ch) : m.cat === 'U' ? 'Tries to ' : 'Always '}${STATUS_WORD[f.s]} the target.`); break;
            case 'glitch': parts.push(`${ch ? cap(ch) : 'Tries to '}glitch the target (it may hit itself).`); break;
            case 'stagger': parts.push(`${cap(ch)}stagger the target (it loses its turn if slower).`); break;
            case 'self': case 'foe': {
                const who = f.k === 'self' ? "the user's" : "the target's";
                const verb = f.n > 0 ? 'raise' : 'lower';
                const tail = `${who} ${STAT_WORD[f.stat]}${Math.abs(f.n) > 1 ? ' sharply' : ''}.`;
                parts.push(ch ? `${cap(ch)}${verb} ${tail}` : `${cap(verb)}s ${tail}`);
                break;
            }
            case 'recoil': parts.push(`The user takes ${Math.round(f.f * 100)}% of the damage dealt.`); break;
            case 'drain': parts.push(`Heals the user by ${Math.round(f.f * 100)}% of the damage dealt.`); break;
            case 'heal': parts.push(`Restores ${Math.round(f.f * 100)}% of the user's Hull.`); break;
            case 'multi': parts.push(`Hits ${f.min}–${f.max} times.`); break;
            case 'crit': parts.push('High chance of a critical hit.'); break;
            case 'atm': parts.push(`Calls up ${({ heat: 'a Heatwave', rain: 'Acid Rain', dust: 'a Dust Storm', static: 'a Static Storm', smog: 'Smog' })[f.a]} for five turns.`); break;
            case 'recharge': parts.push('The user must cool down next turn.'); break;
            case 'purge': parts.push('Resets every stat change.'); break;
        }
    }
    if (m.pri > 0 && m.pri < 4) parts.push('Strikes first.');
    if (m.acc === 0 && m.cat !== 'U') parts.push('Never misses.');
    return parts.join(' ') || (m.cat === 'U' ? 'A utility technique.' : 'A straightforward attack.');
}
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

/** Technique pools for the learnset generator: per type, tiered by power. */
export function movesOfType(type) {
    return Object.values(MOVES).filter((m) => m.type === type && m.id !== 'sputter' && !SIGNATURE.has(m.id));
}
export const SIGNATURE = new Set(['titans-boiler', 'absolute-zero', 'pylon-storm', 'engine-roar', 'first-turning', 'sputter', 'core-meltdown']);
