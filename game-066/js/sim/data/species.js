// The 250 COM-bots of Midden, as 126 evolution lines.
//
// L(tier, names, types, parts, palette, evolution, traits, entries)
//   tier       e early · m mid · l late · S starter · P pseudo-titan · T titan · X the First Bot
//   names      'Stage1/Stage2/Stage3'
//   types      per stage, '|'-separated; a stage without its own entry keeps the previous one
//   parts      per stage, '|'-separated; each stage ADDS or replaces parts on the one before
//              (slot:key — c chassis, l drive, a arms, b back rig, h head, t crest, o overgrowth, e eyes)
//   palette    'main trim' finishes (see js/view/botgen.js)
//   evolution  one token per evolution: a level ('16'), a kit ('kit:furnace-heart') or 'sync'
//   traits     one per stage; a stage has every trait up to its own
//   entries    registry text, one per stage
// The registry number of each bot is its position in this list.

export const LINES = [];
function L(tier, names, types, parts, pal, evo, traits, entries, opts = {}) {
    LINES.push({ tier, names: names.split('/'), types: types.split('|').map((t) => t.split(' ')), parts: parts.split('|'), pal: pal.split(' '), evo: evo ? evo.split(' ') : [], traits: traits.split(' '), entries, ...opts });
}

// ===================================================================== starters (Ma Bellows' workshop)
L('S', 'Embrit/Furnacle/Infernaut', 'blaze|blaze|blaze piston',
    'c:boiler l:legs2 e:twin b:stack|a:pistons h:box|a:hammers b:furnace t:horn', 'iron brass', '16 36', 'hot-plating redline overdrive', [
    'A pot-bellied stove that toddles after anyone carrying coal. Its grate glows brighter when it is happy.',
    'Its new piston fists stoke its own firebox mid-fight. A Furnacle that skips a meal goes cold and sulks.',
    'A walking foundry. Its hammer fists strike at forge heat, and the furnace on its back can be seen for miles.']);
L('S', 'Bubblet/Pumpkett/Torrentank', 'hydro|hydro|hydro iron',
    'c:bell l:wheels e:single|a:nozzles b:tank|l:treads a:cannons t:valve', 'copper verdigris', '16 36', 'bilge-pump field-emitter cloudseeder', [
    'A diving bell no bigger than a kettle. It hums to itself and fills its porthole with bubbles when curious.',
    'It draws water from the dregs of puddles and fires it through brass nozzles hard enough to dent iron.',
    'A tracked water cannon that can put out a refinery fire on its own. It rains on its enemies for good measure.']);
L('S', 'Mossbit/Thicketron/Verdigrand', 'moss|moss|moss gear',
    'c:orb l:legs4 e:twin o:moss|a:tendrils h:dome|b:gear a:saws t:antenna', 'verdigris bronze', '16 36', 'photosynth-skin self-repair honed-edges', [
    'A seed pod of a bot that let the planet\'s moss grow over it. It basks in any patch of light it can find.',
    'Cable tendrils woven through with living moss. It roots itself to scrap heaps and drinks the rain off them.',
    'A walking garden around a turning drive cog. Its saw-arms prune anything that threatens its grove.']);

// ===================================================================== early routes
L('e', 'Bolty/Boltrat/Boltbaron', 'scrap',
    'c:egg l:wheels e:twin|a:claws t:antenna|b:tank l:legs4 h:jaw', 'steel rust', '14 30', 'scavenger momentum-engine hot-swap', [
    'Swarms through the scrap drifts looking for loose bolts. It rolls into a ball and clatters away when spooked.',
    'Its claws can strip a bolt from a hull plate in a second. A colony of Boltrats can unbolt a whole shack overnight.',
    'The fat king of a scrapyard. It hoards bolts in its belly tank and bites anyone who tries to count them.']);
L('e', 'Tinwing/Brasswing/Gildhawk', 'aero|scrap aero',
    'c:egg l:legs2 h:beak e:twin b:wings|t:fin|b:turbine a:claws', 'steel brass', '14 32', 'lens-array scavenger turbo', [
    'A tin bird stamped out of ration cans. It chirps like a rusty hinge at dawn.',
    'It patrols its territory in wide circles, diving on anything shiny with its riveted beak.',
    'A jet-boosted raptor of polished brass. It has been clocked outrunning cargo zeppelins.']);
L('e', 'Sparkit/Sparkat/Voltigar', 'volt',
    'c:pod l:legs4 e:visor t:antenna|a:claws b:coil|h:jaw t:horn', 'yellow gunmetal', '15 30', 'static-hull insulated storm-rider', [
    'A little four-legged capacitor that crackles when petted. Its antenna twitches toward lightning.',
    'It stores lightning in the tower on its back and releases it through its claws in one bright slash.',
    'The apex hunter of the Sparkmarsh. Its jaws snap shut with a thunderclap.']);
L('e', 'Cogling/Sprocketeer/Clockwerk', 'gear',
    'c:orb l:legs2 e:single b:gear|a:pincers h:box|a:pistons t:valve', 'brass bronze', '16 34', 'fine-tuning gyro-stabilizer locked-gauges', [
    'A ball of meshing cogs that ticks softly in its sleep. Wind it up and it will follow you anywhere.',
    'It counts everything. Its pincers can reset a clock to the second without opening the case.',
    'A clockwork guardian of the old foundries. It never hurries and never misses a beat.']);
L('e', 'Drillbit/Drillhorn/Tunnelord', 'grit|grit|grit iron',
    'c:cone l:treads e:visor|a:drills t:horn|h:jaw b:spikes', 'gunmetal orange', '18 34', 'carbide-bits sand-skimmer thick-plating', [
    'It burrows through scrap heaps nose first. Miners follow its tunnels to find buried engines.',
    'The drill on its head spins at nine thousand turns a minute. It bores through hull plating like sand.',
    'It has dug tunnels under every town on Midden. Its plating is scarred from a thousand cave-ins.']);
L('e', 'Seedling/Shrubot/Arborlith', 'moss|moss|moss iron',
    'c:pod l:legs2 e:twin o:moss|a:tendrils t:antenna|c:tank a:shields b:sail', 'bronze green', '18 38', 'self-repair photosynth-skin thick-plating', [
    'A sprouting capsule bot. The moss on its head turns toward the sun even when it is asleep.',
    'It stands still in the scrap drifts for days, pretending to be a bush, and whips anyone who steps on it.',
    'An iron tree that walks. Travellers shelter under its solar sails during acid rain.']);
L('e', 'Punchkin/Pummelor/Hydraulix', 'piston',
    'c:frame l:legs2 e:goggles a:pistons|h:box b:tank|a:hammers b:stack t:horn', 'red iron', '20 40', 'hydraulics overdrive momentum-engine', [
    'It practises punching scrap all day. You can hear its pistons hiss from three heaps away.',
    'The pressure tank on its back powers a punch that can flatten a boiler.',
    'A champion brawler. Its sledge-fists are rated to forty tonnes and it has never lost a shoving match.']);
L('e', 'Kettlet/Teakettler/Samovaruk', 'steam',
    'c:kettle l:legs2 e:twin t:whistle|a:nozzles b:stack|c:boiler l:legs4 b:tank a:pistons', 'copper brass', '18 34', 'heat-sink smokestack hot-swap', [
    'It whistles when it is about to boil over. Never pick one up by the handle.',
    'Polite to a fault, it offers scalding tea to every visitor. Accepting is not optional.',
    'A great walking samovar. Whole villages gather around one on cold nights to keep warm.']);
L('e', 'Gurglet/Siphoon/Maelstrom', 'hydro',
    'c:orb l:pontoon e:twin|a:nozzles b:tank|a:tendrils l:hover t:fin', 'blue brass', '17 36', 'bilge-runner bilge-pump damper', [
    'It bobs in sludge puddles, gurgling. If you hear a happy gurgle in a drain, there is a Gurglet down there.',
    'It siphons whole ponds into its tank and blasts them back out as a typhoon.',
    'Where a Maelstrom hovers, the sea itself turns in a slow spiral.']);
L('e', 'Canbot/Canister', 'scrap',
    'c:barrel l:wheels e:twin|a:grabbers t:valve', 'steel red', 'kit:brass-heart', 'rustproof reinforced', [
    'A tin can on wheels that collects other tin cans. It is surprisingly hard to dent.',
    'It stores everything it finds inside its body and never forgets where it put anything.']);
L('e', 'Junkpup/Scrapwolf', 'scrap|scrap piston',
    'c:pod l:legs4 h:jaw e:twin|a:claws b:spikes', 'gunmetal rust', 'sync', 'menacing-grind momentum-engine', [
    'A loyal scrap hound. It buries bolts like bones and growls at Syndicate boots.',
    'Packs of Scrapwolves hunt the dune wastes at night. Their howl is a grinding of gears.']);
L('e', 'Bulbit/Lumibulb', 'volt',
    'c:bulb l:legs2 e:single|a:tesla t:lamp', 'brass yellow', 'kit:storm-capacitor', 'glow-lamp field-emitter', [
    'A lightbulb that refuses to burn out. It wanders at night and leads lost travellers to safety… mostly.',
    'Its filament glows hot enough to read by a mile away. It holds lightning the way a lantern holds flame.']);
L('e', 'Clankle/Clanklord', 'scrap|scrap piston',
    'c:frame l:legs2 e:visor h:box|a:pistons t:crown', 'iron brass', '26', 'overdrive hydraulics', [
    'It makes a racket with every step. It thinks it is very sneaky.',
    'It crowned itself king of a scrapyard and challenges every visitor to a fistfight.']);
L('e', 'Hissling/Valvador', 'steam',
    'c:pod l:legs2 e:single t:valve|a:nozzles b:tank', 'bronze cream', 'kit:pressure-valve', 'heat-sink damper', [
    'It hisses at strangers through its relief valve. The hiss is all bluster.',
    'A master of pressure. It can open any valve on Midden, and close it just as fast.']);
L('e', 'Cinderpup/Scorchound', 'blaze',
    'c:pod l:legs4 h:jaw e:twin|b:furnace t:horn', 'black orange', 'kit:furnace-heart', 'menacing-grind heat-rider', [
    'A loyal hearth-hound. It curls up in fireplaces and keeps whole families warm.',
    'It runs so hot that its footprints smoulder. It guards foundries with fierce devotion.']);
L('e', 'Spigot/Faucetor', 'hydro',
    'c:pod l:legs2 e:twin a:nozzles|b:tank t:valve', 'chrome blue', 'kit:hydro-pump', 'bilge-pump fine-tuning', [
    'It leaks constantly and is constantly apologising for it.',
    'It controls water pressure with a twist of its valve, from a trickle to a jet that cuts stone.']);
L('e', 'Siftle/Sieverd', 'grit',
    'c:dome l:spider e:twin|a:grabbers b:tank', 'bronze orange', 'kit:grit-auger', 'scavenger sand-skimmer', [
    'It sifts sand through its shell looking for anything valuable. It always finds something.',
    'Prospectors follow Sieverds through the canyons. Where they dig, there is treasure.']);
L('e', 'Grabbit/Grapplord', 'piston',
    'c:frame l:legs2 e:goggles a:grabbers|b:tank t:horn', 'red brass', 'kit:hydraulic-ram', 'overdrive hydraulics', [
    'It grabs things. It does not let go. It is very proud of this.',
    'A master of the hold. It once pinned a Dozerhulk for an entire afternoon.']);
L('e', 'Jabber/Uppercog', 'piston|piston gear',
    'c:orb l:legs2 e:twin a:pistons|b:gear h:box', 'blue brass', 'sync', 'fine-tuning second-gear', [
    'Quick little fists and quicker feet. It never stops bouncing.',
    'Its clockwork uppercut is timed to the tick. It has never been knocked down.']);
L('e', 'Coilspring/Jackspring', 'gear|gear piston',
    'c:box l:none e:twin|a:pistons h:skull', 'red gold', '28', 'second-gear hydraulics', [
    'A box with a spring inside. It pops out to scare people and is delighted every single time.',
    'It springs out of its box with a punch that can knock a door off its hinges.']);
L('e', 'Screenie/Telescreen', 'signal',
    'c:box l:legs2 e:visor h:screen|a:tendrils b:dish', 'cream teal', 'sync', 'glow-lamp amplifier', [
    'It plays cartoons on its face to make children laugh.',
    'It hypnotises its foes with spiralling patterns on its screen.']);
L('e', 'Sporelet/Sporeking', 'moss|moss toxic',
    'c:dome l:none e:twin o:moss|l:legs4 b:vats t:crown', 'violet green', '28', 'acid-weep photosynth-skin', [
    'A mushroom-capped bot. It puffs sleepy spores when startled.',
    'It crowned itself ruler of the fungus caves under Fumehollow and rules with gentle, drowsy cruelty.']);
L('e', 'Pottle/Greenhaus', 'moss|moss steam',
    'c:kettle l:legs2 e:twin o:moss|c:lantern b:stack', 'verdigris cream', 'kit:seed-vault', 'photosynth-skin heat-sink', [
    'A flowerpot bot that waters itself with its own steam.',
    'A walking greenhouse. Its steam keeps a tropical garden alive behind its glass, even on the Frostline.']);
L('e', 'Weldit/Weldrake', 'blaze|blaze volt',
    'c:pod l:spider e:goggles a:claws|b:coil h:visor', 'gunmetal orange', '30', 'honed-edges static-hull', [
    'It welds anything it finds to anything else it finds. Its best work is the railings of Gasket Gulch.',
    'Its arc-welder claws reach five thousand degrees. Foundries hire them to stitch hull plates.']);
L('e', 'Gadgetto', 'scrap', 'c:box l:wheels e:goggles a:grabbers t:antenna b:tank', 'red brass', '', 'fine-tuning scavenger', [
    'A pocket workshop on wheels. It can run almost any program card ever punched.'], { anyCard: true });

// ===================================================================== the middle of the Circuit
L('m', 'Gunklet/Gunkgut/Gunkolossus', 'toxic',
    'c:barrel l:none e:twin|a:nozzles b:vats l:legs2|l:treads a:grabbers t:valve', 'green rust', '22 38', 'acid-weep smog-lungs smokestack', [
    'A leaky barrel that came to life in a pool of sludge. It burps fumes when it is content.',
    'It drinks sludge from refinery drains and sprays it back out of its vats, stronger.',
    'A walking waste plant. Wherever it rests the ground turns green, and nothing grows there but more Gunklets.']);
L('m', 'Bleeplet/Blipwave/Broadcastor', 'signal',
    'c:bulb l:hover e:single t:antenna|h:screen a:tesla|b:dish c:disc', 'cream teal', '22 38', 'glow-lamp amplifier field-emitter', [
    'It bleeps in a pattern nobody has decoded. Some say it is still talking to a satellite that fell long ago.',
    'It shows pictures of far-off places on its screen. Nobody knows where it gets them.',
    'Its dish can reach every receiver on the planet. During storms it reads the news to the whole of Midden.']);
L('m', 'Geysprite/Geyserion/Vulcanvent', 'steam|steam grit',
    'c:cone l:none e:slit b:stack|a:nozzles t:valve l:legs2|l:legs4 b:furnace h:jaw', 'rust bronze', '24 40', 'sand-skimmer furnace-core redline', [
    'It sleeps under hot sand and erupts without warning. Prospectors use it to find underground boilers.',
    'It vents scalding steam through its relief valve on a timer you could set a watch by.',
    'A walking volcano vent. The ground around its den is baked into glass.']);
L('m', 'Ingot/Ingotank/Foundryx', 'iron',
    'c:box l:none e:visor|l:treads a:shields|b:furnace a:hammers h:helm', 'iron steel', '24 42', 'thick-plating reinforced hot-plating', [
    'A solid block of iron with eyes. It is very hard to hurt and very easy to trip over.',
    'It rumbles forward on treads behind its arm shields and does not stop for anything.',
    'A walking forge. It casts new plating for itself from any metal it swallows.']);
L('m', 'Tickit/Tocktick/Chronograf', 'gear|gear signal',
    'c:lantern l:legs2 e:single|a:pincers t:antenna|b:gear h:screen', 'gold black', '24 40', 'lens-array second-gear gyro-stabilizer', [
    'A pocket-watch bot that ticks exactly sixty times a minute. It panics if it runs a second late.',
    'It keeps time for a whole village and rings its pincers like bells on the hour.',
    'It records every moment it witnesses on brass drums. Some keep records older than the towns they live in.']);
L('m', 'Paddler/Sternwheel/Dreadnaut', 'hydro|hydro steam',
    'c:barrel l:pontoon e:goggles b:propeller|b:gear t:whistle|c:tank a:cannons b:stack', 'red cream', '22 38', 'bilge-runner smokestack thick-plating', [
    'A toy boat that got lost in the sludge and grew up. It paddles in circles when excited.',
    'Its great wheel churns the sludge rivers. Dock children ride on its deck for luck.',
    'A battleship that walks out of the sea on its hull. Its cannons fire boiling water.']);
L('m', 'Chillit/Rimefang/Cryodon', 'frost',
    'c:box l:legs4 e:twin o:frost|h:jaw a:claws|c:tank b:tank t:spikes', 'white blue', '26 42', 'rime-plating honed-edges reinforced', [
    'An icebox that sneaks into kitchens to steal coolant. Its breath frosts every window it passes.',
    'Its fangs are hollow and pump coolant into whatever they bite.',
    'A huge cryo-beast with tusks of frozen coolant. It hibernates inside crashed refrigeration ships.']);
L('m', 'Wickit/Lampyre/Chandelor', 'blaze|blaze rust',
    'c:lantern l:hover e:single|a:tendrils t:lamp|b:stack h:skull', 'black gold', '24 kit:grave-relic', 'glow-lamp heat-sink redline', [
    'A lantern that floats through derelict ships at night. Its flame grows when it is near a dying machine.',
    'It lures scavengers deeper into wrecks with its light. Few follow it twice.',
    'A haunted chandelier from a crashed luxury liner. It still waits for the ball to begin.']);
L('m', 'Scoopit/Backhoe/Excavaurus', 'grit|grit|grit iron',
    'c:box l:treads e:visor a:grabbers|b:gear t:lamp|l:legs4 h:jaw b:spikes', 'yellow gunmetal', '22 42', 'scavenger thick-plating menacing-grind', [
    'It digs holes for fun and fills them in again. Construction crews find it endearing and useless.',
    'It works the Grindstone mines from dawn to dusk and rumbles home happy.',
    'A digging rig that grew into a great beast. It can level a hill in an afternoon.']);
L('m', 'Coilette/Teslarch/Teslatron', 'volt|volt signal',
    'c:bulb l:legs2 e:single a:tesla|b:coil t:antenna|h:dome l:hover', 'copper chrome', '28 44', 'insulated storm-coil amplifier', [
    'A wobbly little coil that sparks when it giggles.',
    'It builds charge on its tower for days, then releases it all at once in a dazzling arc.',
    'A hovering tesla engine. The air around it smells of ozone and hums with power.']);
L('m', 'Whirlet/Rotorhawk/Skyreaper', 'aero|aero|aero iron',
    'c:egg l:prop e:twin|a:claws h:beak|b:turbine a:blades c:frame', 'chrome red', '20 40', 'turbo targeting-optics honed-edges', [
    'A tiny gyrocopter that buzzes around people\'s heads until it is given a snack.',
    'It hunts from above, hovering perfectly still before it drops on its prey.',
    'A jet-driven blade of the upper winds. Zeppelin crews pray never to see one.']);
L('m', 'Pistup/Pavestomper', 'steam|steam iron',
    'c:barrel l:wheel1 e:visor|l:treads a:hammers b:stack', 'iron red', '30', 'thick-plating overdrive', [
    'It rolls flat anything left in its path, including its owner\'s breakfast.',
    'Boilerburg\'s roads were all laid by Pavestompers. They still patrol them at night, flattening potholes.']);
L('m', 'Chuggle/Chuggernaut', 'steam',
    'c:boiler l:wheels e:twin b:stack|l:treads a:grabbers t:whistle', 'black red', '30', 'turbo smokestack', [
    'A little locomotive that chugs in circles. It has never once been on time.',
    'Once it gets going nothing can stop it, including itself.']);
L('m', 'Whistlet/Calliopex', 'steam|steam signal',
    'c:kettle l:legs2 e:single t:whistle|b:horn a:tendrils', 'gold cream', 'kit:signal-array', 'amplifier glow-lamp', [
    'It plays one note very loudly, very often.',
    'A walking steam organ. Its music can rouse a sleeping town or lull a raging one to sleep.']);
L('m', 'Smeltling/Crucibrute', 'blaze iron',
    'c:kettle l:legs2 e:twin|a:grabbers b:furnace l:legs4', 'iron orange', '32', 'hot-plating thick-plating', [
    'A walking crucible. It melts down scrap in its belly and pours out bright metal.',
    'It pours molten metal over its own plating to repair it. The result is lumpy but very strong.']);
L('m', 'Flarefly/Blazewing', 'blaze aero',
    'c:bulb l:prop e:twin|b:wings a:claws', 'brass orange', '30', 'heat-rider lens-array', [
    'Swarms of Flareflies drift over the furnace towns at dusk, like sparks that forgot to go out.',
    'Its brass wings glow red-hot in flight. It dives through smoke to catch other fliers.']);
L('m', 'Bellowsnout/Forgemaw', 'blaze',
    'c:box l:legs4 e:twin h:jaw|b:furnace a:hammers', 'iron copper', '32', 'furnace-core hydraulics', [
    'Its snout is a working bellows. It huffs on coals until they roar.',
    'It eats ore, smelts it in its belly and spits out finished ingots. Foundries treat them like royalty.']);
L('m', 'Clampet/Clampress', 'hydro iron',
    'c:dome l:legs4 e:twin a:pincers|a:grabbers b:spikes', 'teal iron', '30', 'thick-plating shell-plating', [
    'It clamps onto pier pilings and waits for anything to swim by.',
    'Its grip is measured in tonnes. Dockhands use it to hold ships still in storms.']);
L('m', 'Periscopa/Periscorp', 'hydro|hydro signal',
    'c:pod l:slither e:single t:antenna|a:claws b:dish', 'teal brass', '32', 'lens-array bilge-runner', [
    'It hides under the sludge with only its periscope showing and watches everything.',
    'It spies for the harbour masters of Port Brackwater and stings smugglers with its tail.']);
L('m', 'Dynamole/Dynamaul', 'volt grit',
    'c:cone l:legs4 e:goggles a:claws|a:drills b:coil', 'yellow rust', '28', 'ground-wire carbide-bits', [
    'It digs for copper and chews the wire into springs.',
    'A generator that walks. It drills deep, drinks the planet\'s static and lets it out in sparks.']);
L('m', 'Joltfin/Ampereel', 'volt hydro',
    'c:serpent l:slither e:twin t:fin|a:tendrils b:coil', 'blue yellow', '30', 'static-hull bilge-runner', [
    'It zips through sludge rivers leaving glowing wakes.',
    'A single Ampereel can light a harbour. Dock crews respect it and give it room.']);
L('m', 'Fuzebox/Breakerjaw', 'volt|volt iron',
    'c:box l:legs2 e:visor|h:jaw b:coil', 'gunmetal yellow', '32', 'static-hull thick-plating', [
    'A fusebox that flips its own switches for fun. Do not let it near the lights.',
    'When it bites, its jaw closes a circuit. The result is extremely loud.']);
L('m', 'Sandhopper/Dunestrider', 'grit|grit aero',
    'c:egg l:legs2 e:goggles|b:sail l:legs4', 'orange cream', '26', 'sand-skimmer turbo', [
    'It hops between dunes on its spring legs, never touching hot sand for long.',
    'It sails across the dune seas on its solar sails, steering by the stars.']);
L('m', 'Gravelgut/Quarrion', 'grit|grit piston',
    'c:barrel l:legs2 e:twin|a:hammers h:box', 'rust iron', '31', 'thick-plating hydraulics', [
    'It swallows gravel to grind its gears smooth. Its belly rattles when it walks.',
    'A quarry in walking form. It smashes boulders into gravel with its bare hammer-fists.']);
L('m', 'Postling/Couriercrest', 'aero|aero signal',
    'c:box l:prop e:goggles|b:dish h:beak', 'red cream', '30', 'turbo lens-array', [
    'A mail-drone that still tries to deliver letters from ships that crashed a century ago.',
    'The fastest messenger on Midden. It has never lost a letter, though it has lost several towns.']);
L('m', 'Draftling/Galeforce', 'aero',
    'c:orb l:hover e:twin b:propeller|b:turbine t:fin', 'teal chrome', 'kit:jet-turbine', 'hover turbo', [
    'A ventilation fan that blew itself loose. It loves breezes and hates still air.',
    'Its turbine can knock a Scrapwolf off its feet from fifty paces.']);
L('m', 'Flutterbolt/Ornithopter', 'aero|aero gear',
    'c:egg l:legs2 e:goggles b:wings|a:claws t:fin h:beak', 'brass verdigris', 'kit:clockwork-heart', 'gyro-stabilizer turbo', [
    'Its clockwork wings flap a thousand times a minute. It has to be wound twice a day.',
    'A clockwork bird of prey built by some forgotten genius. It never tires and never forgets a face.']);
L('m', 'Magnetiq/Magnetron', 'iron|iron volt',
    'c:orb l:hover e:single a:grabbers|b:coil t:antenna', 'steel red', '30', 'hover static-hull', [
    'A floating magnet with a single eye. It sticks to ships\' hulls and refuses to let go.',
    'Its fields can drag a crashed shuttle across a mile of sand.']);
L('m', 'Nailfin/Hammershark', 'iron hydro',
    'c:serpent l:slither e:slit t:fin|h:jaw a:hammers', 'steel blue', '34', 'menacing-grind hydraulics', [
    'Its fin is a row of sharpened nails. It circles under the docks of Port Brackwater.',
    'It rams boats with its hammer-head. Harbour crews hang its old teeth as trophies.']);
L('m', 'Shieldbug/Aegistag', 'iron|iron moss',
    'c:dome l:spider e:twin|a:shields t:horn o:moss', 'green iron', '33', 'shell-plating thick-plating', [
    'A beetle of riveted plate. It rolls into a ball at the slightest noise.',
    'A stag beetle with an iron hide and a moss garden on its back. It defends its grove with its horn.']);
L('m', 'Anvilet/Anvilox', 'iron|iron grit',
    'c:box l:none e:visor|l:legs4 h:jaw t:horn', 'iron rust', 'kit:tempered-plate', 'reinforced menacing-grind', [
    'A tiny anvil that likes to be hit. The harder you strike it, the happier it is.',
    'A charging bull of forged iron. It rams down walls and keeps going.']);
L('m', 'Winderkin/Windlord', 'gear',
    'c:frame l:legs2 e:twin b:gear|a:cannons t:spikes', 'red gold', 'kit:clockwork-heart', 'gyro-stabilizer second-gear', [
    'A wind-up toy soldier that marches until its key runs down, then waits patiently for someone to wind it.',
    'A giant toy soldier with a cannon arm. It marches the walls of old towns, still on guard after centuries.']);
L('m', 'Gyrolet/Gyrosaur', 'gear|gear aero',
    'c:orb l:wheel1 e:single b:gear|l:legs2 b:propeller h:jaw', 'brass chrome', '34', 'gyro-stabilizer turbo', [
    'It balances on one wheel thanks to the gyroscope spinning inside it.',
    'A clockwork raptor that runs on gyroscopes. It never falls over, however hard you shove.']);
L('m', 'Pendulum/Pendulance', 'gear|gear iron',
    'c:lantern l:legs2 e:single|a:blades b:gear', 'gold black', '35', 'second-gear honed-edges', [
    'It swings back and forth, back and forth, until its foes are dizzy.',
    'A clock-mantis. Its pendulum blades strike exactly once a second, and they never miss the beat.']);
L('m', 'Fumewing/Smogwing', 'toxic aero',
    'c:egg l:prop e:goggles b:stack|b:wings h:beak', 'green black', '30', 'smog-lungs smokestack', [
    'A sooty flier that roosts in chimneys.',
    'It flies through refinery smoke and comes out stronger. Its wingbeats spread a choking haze.']);
L('m', 'Vatling/Alembix', 'toxic|toxic steam',
    'c:kettle l:legs4 e:twin|b:vats a:nozzles t:valve', 'copper green', 'kit:toxin-vat', 'acid-weep smog-lungs', [
    'A bubbling chemistry set on legs. It mixes whatever it finds just to see what happens.',
    'A walking distillery. The tonics it brews are either miracles or disasters, never in between.']);
L('m', 'Corrodent/Acidrake', 'toxic|toxic rust',
    'c:pod l:legs4 h:jaw e:slit|b:vats t:spikes', 'green rust', '34', 'rustproof siphon-fangs', [
    'It gnaws on pipes until they leak, then drinks what comes out.',
    'Its acid breath can strip a hull to bare rivets in seconds.']);
L('m', 'Acidcell/Leadacid', 'toxic volt',
    'c:box l:legs4 e:twin|a:tesla b:vats', 'green yellow', '35', 'static-hull acid-weep', [
    'A battery that leaks. It is cheerful, warm and dangerous to hug.',
    'A great walking battery. It powers the lights of Fumehollow and keeps the change.']);
L('m', 'Lichenbot/Lichenaut', 'moss rust',
    'c:dome l:legs2 e:goggles o:moss|h:helm b:tank', 'rust green', 'sync', 'self-repair rustproof', [
    'An old diving suit overgrown with lichen. Something lives inside now.',
    'It walks the wrecks of the old fleet, slowly turning them into gardens.']);
L('m', 'Vinewire/Creepercable', 'moss volt',
    'c:serpent l:slither e:twin o:moss|a:tendrils b:coil', 'green yellow', '34', 'static-hull self-repair', [
    'A copper cable grown through with vines. It plugs itself into old sockets to drink power.',
    'It creeps through derelict stations and wraps around generators until they hum again.']);
L('m', 'Snaptrap/Snapmaw', 'moss|moss piston',
    'c:pod l:legs2 h:jaw e:twin o:moss|a:pistons t:spikes', 'green red', '32', 'siphon-fangs hydraulics', [
    'A flytrap bot. It waits with its jaw open and snaps at anything that buzzes.',
    'It has piston arms to hold its meal still while its jaw does the rest.']);
L('m', 'Jackhop/Jackhammer', 'piston grit',
    'c:cone l:legs2 e:visor|a:drills b:tank', 'yellow iron', '30', 'carbide-bits hydraulics', [
    'It hops on its one piston leg, pounding holes in the road.',
    'It breaks up rock faster than a whole mining crew.']);
L('m', 'Kickstand/Kickstorm', 'piston|piston aero',
    'c:frame l:wheel1 e:visor|l:legs2 b:turbine', 'chrome red', '33', 'turbo momentum-engine', [
    'A motorbike stand that learned to kick. It balances on one wheel while it does it.',
    'Its jet-boosted kicks break the sound barrier. You hear the bang after you\'ve been hit.']);
L('m', 'Hookshot/Wreckball', 'piston|piston iron',
    'c:frame l:treads e:visor a:grabbers|b:gear a:hammers', 'yellow iron', '36', 'hydraulics reinforced', [
    'A crane bot that flings its hook at anything it wants, then reels it in.',
    'It swings an iron ball through anything in its way. Demolition crews love it.']);
L('m', 'Dishling/Arraydish', 'signal|signal iron',
    'c:dome l:legs4 e:single b:dish|t:antenna a:tesla', 'chrome white', '34', 'amplifier field-emitter', [
    'It turns its dish to the sky and listens to the stars.',
    'A walking radio array. It can hear a whisper on the other side of the planet.']);
L('m', 'Clackey/Typewright', 'signal|signal gear',
    'c:box l:legs4 e:twin|a:pincers b:gear', 'black gold', '33', 'fine-tuning lens-array', [
    'A typewriter bot that clacks out stories nobody asked for.',
    'It writes the official record of every Circuit match. Its keys have never jammed.']);
L('m', 'Phonopup/Gramophant', 'signal',
    'c:pod l:legs4 e:twin t:antenna|b:horn c:barrel', 'gold red', 'kit:signal-array', 'amplifier menacing-grind', [
    'It records sounds it likes and plays them back at the worst possible moments.',
    'A great walking gramophone with a horn for a trunk. Its blast can shatter windows in three towns.']);
L('m', 'Scaretin/Scarecrank', 'rust|rust moss',
    'c:frame l:none e:slit h:skull o:moss|l:legs2 a:blades', 'rust cream', '30', 'menacing-grind siphon-fangs', [
    'It stands in junk fields to scare off scavengers. Sometimes it moves when you are not looking.',
    'It walks the dune farms at night with a scythe in each hand. Farmers leave it oil as an offering.']);
L('m', 'Wreckling/Derelictus', 'rust hydro',
    'c:barrel l:pontoon e:slit|b:stack h:skull t:lamp', 'rust black', '36', 'glow-lamp siphon-fangs', [
    'A wrecked lifeboat that drifts back to shore every night, however far out it is towed.',
    'A ghost ship. Its lamps flicker on lonely nights, and sailors who follow them are never seen again.']);
L('m', 'Drumlet/Hazdrum', 'toxic|toxic iron',
    'c:barrel l:legs2 e:twin|a:nozzles b:spikes', 'yellow black', '32', 'acid-weep thick-plating', [
    'A dented chemical drum that waddled off a dump barge. The skull stencil on its side is a warning, not a face.',
    'It plates itself with the lids of other drums. Whatever is sloshing inside has eaten through three of them.']);
L('m', 'Spadelet/Gravedigger', 'rust|rust grit',
    'c:pod l:legs2 e:slit a:grabbers|h:skull b:spikes l:legs4', 'rust iron', '34', 'scavenger menacing-grind', [
    'It digs graves for broken machines in the junk fields, and stands beside them for a while afterwards.',
    'It buries the fallen of every battle it sees. Syndicate grunts are afraid to cross its path.']);
L('m', 'Hollowhelm/Husklord', 'rust iron',
    'c:frame l:legs2 e:slit h:helm|a:blades b:spikes', 'iron rust', 'kit:grave-relic', 'shell-plating menacing-grind', [
    'An empty suit of armour. The rattle inside is the only proof it is not alone.',
    'A knight of rust that still guards a long-gone queen. Its blades remember every duel.']);
L('m', 'Dozertin/Dozerhulk', 'scrap',
    'c:barrel l:treads e:slit|a:shields h:box', 'yellow iron', '34', 'thick-plating self-repair', [
    'A sleepy bulldozer that wakes only to eat scrap. It can sleep through an explosion.',
    'It once slept across the main road out of Grindstone for six days. Nobody could move it.']);
L('m', 'Emberoll', 'blaze', 'c:orb l:wheel1 e:slit b:furnace', 'black orange', '', 'turbo hot-plating', [
    'A ball of glowing coals in a cage. It rolls downhill forever, looking for something to burn.']);
L('m', 'Pressurion', 'steam', 'c:boiler l:legs4 e:goggles b:tank a:nozzles t:valve', 'copper iron', '', 'redline heat-sink', [
    'A runaway pressure vessel that learned to hold itself together out of sheer stubbornness.']);
L('m', 'Patchwork', 'scrap rust', 'c:frame l:legs2 e:twin a:claws h:skull b:stack', 'rust copper', '', 'hot-swap self-repair', [
    'Stitched together from parts of a dozen different COM-bots. Each of its arms remembers being someone else.']);
L('m', 'Junktopus', 'scrap hydro', 'c:orb l:slither e:twin a:tendrils h:helm', 'copper verdigris', '', 'scavenger bilge-runner', [
    'It drags itself through sludge harbours on eight cable arms, collecting anything that gleams.']);
L('m', 'Bilgeworm', 'hydro toxic', 'c:serpent l:slither e:slit h:jaw', 'green rust', '', 'acid-weep bilge-runner', [
    'It lives in the bilges of wrecked ships and eats whatever drips down.']);
L('m', 'Amperoo', 'volt piston', 'c:pod l:legs2 e:twin a:pistons b:coil', 'red yellow', '', 'hydraulics static-hull', [
    'A boxing bot with spring legs. It charges its gloves with every hop.']);
L('m', 'Cementine', 'grit', 'c:barrel l:wheels e:twin b:tank', 'cream gunmetal', '', 'reinforced thick-plating', [
    'A cement-mixer bot. It patches cracked walls by spitting mortar into them.']);
L('m', 'Lullabox', 'gear signal', 'c:box l:none e:twin b:horn', 'pink gold', '', 'amplifier muffled', [
    'A music box that plays a lullaby so sweet even Syndicate grunts nod off.']);
L('m', 'Hazmite', 'toxic', 'c:pod l:legs2 e:goggles b:tank t:valve', 'yellow black', '', 'rustproof smokestack', [
    'It wears its own hazard suit. Inside, something glows green.']);
L('m', 'Sumobot', 'piston steam', 'c:barrel l:legs2 e:slit a:pistons b:stack', 'cream red', '', 'thick-plating overdrive', [
    'A massive wrestling bot. It vents steam before every bout and stamps hard enough to crack the ground.']);
L('m', 'Analytix', 'signal', 'c:box l:legs2 e:triple h:screen a:pincers', 'teal black', '', 'lens-array targeting-optics', [
    'A calculating engine that predicts its foe\'s next move. It is right about nine times in ten.']);
L('m', 'Tombot', 'rust signal', 'c:box l:none e:single h:screen t:lamp', 'black teal', '', 'glow-lamp locked-gauges', [
    'A memorial terminal that still plays the last messages of a crashed ship\'s crew.']);
L('m', 'Mossbulk', 'moss grit', 'c:barrel l:legs4 e:twin o:moss a:hammers', 'green bronze', '', 'self-repair thick-plating', [
    'A boulder of moss and scrap that sleeps for decades and wakes up very hungry.']);
L('m', 'Dustdevil', 'grit rust', 'c:cone l:hover e:slit o:rust', 'rust cream', '', 'dust-maker sand-skimmer', [
    'A whirling column of grit around a rusted core. Its howl is the canyon wind.']);

// ===================================================================== the far side of the planet
L('l', 'Rustling/Oxidrake/Ruinmaw', 'rust|rust|rust void',
    'c:serpent l:slither e:slit o:rust|h:jaw a:claws|b:wings t:spikes', 'rust black', '30 46', 'flaking-plates siphon-fangs menacing-grind', [
    'A rusted cable that slithered off a crashed ship and never stopped moving. It hisses through flaking jaws.',
    'A rust dragon. Metal it bites turns orange and crumbles within a week.',
    'Ancient and enormous, it nests in the wrecks of starships and gnaws on their engines.']);
L('l', 'Quarklet/Quasarc/Pulsarch', 'void|void signal',
    'c:egg l:hover e:triple o:crystal|a:tendrils t:antenna|b:crystal h:visor c:disc', 'violet chrome', '32 48', 'hover field-emitter amplifier', [
    'It fell out of the sky inside a meteor of scrap. Its crystals pulse with a rhythm like a slow heartbeat.',
    'It sends coded flashes to the night sky. Astronomers in Aetherton swear something answers.',
    'Its crystal array focuses starlight into a beam that cuts hull plating. It drifts in silence above old craters.']);
L('l', 'Icebox/Freezerk', 'frost|frost iron',
    'c:box l:legs2 e:twin|a:pistons t:spikes', 'white steel', 'kit:cryo-core', 'rime-plating hydraulics', [
    'It keeps its insides at exactly freezing. Fishers pay well to borrow one.',
    'When it loses its temper, frost spreads over its knuckles and it punches until the anger cools.']);
L('l', 'Rimeling/Rimewraith', 'frost rust',
    'c:lantern l:hover e:single o:frost|a:tendrils h:skull', 'white black', '38', 'rime-plating siphon-fangs', [
    'A frozen lantern that floats over the Frostline. Those who follow its pale light feel the cold in their bones.',
    'It haunts the crashed cryo-ships and freezes intruders where they stand.']);
L('l', 'Plowlet/Snowdozer', 'frost grit',
    'c:barrel l:skis e:visor|a:shields l:treads', 'yellow white', '36', 'sand-skimmer thick-plating', [
    'It clears snow from Rimehaven\'s streets every morning and expects no thanks.',
    'It shoves glaciers of coolant slush aside to open the Frostline passes.']);
L('l', 'Sleetle/Blizzarrow', 'frost aero',
    'c:egg l:legs2 e:twin b:wings|b:turbine t:fin h:beak', 'white teal', '36', 'lens-array turbo', [
    'A little ice bird that hops between icicles.',
    'It flies so fast it leaves a trail of frost hanging in the air.']);
L('l', 'Kitebit/Kitewyrm', 'aero|aero void',
    'c:disc l:prop e:single|c:serpent b:sail t:fin', 'red cream', 'sync', 'hover storm-rider', [
    'A box kite that came loose in a storm and decided to stay up.',
    'A serpentine kite-dragon with sails of starship fabric. It never comes down to land.']);
L('l', 'Blimpet/Zeppelord', 'aero|aero steam',
    'c:pod l:prop e:twin b:balloon|a:cannons t:fin', 'cream brass', '38', 'hover smokestack', [
    'A little balloon bot that floats wherever the wind takes it, which is usually into trouble.',
    'A grand airship that rules the skies over Aetherton. It fires steam cannons at anything that flies too close.']);
L('l', 'Lockbox/Vaultguard', 'iron|iron signal',
    'c:box l:legs2 e:single|a:shields h:screen t:lamp', 'gunmetal gold', '38', 'locked-gauges field-emitter', [
    'It locks itself whenever anyone approaches. Nobody knows the combination, including the Lockbox.',
    'It guards the treasury of Aetherton. It has opened only once, and never again.']);
L('l', 'Shacklet/Chainwraith', 'rust|rust void',
    'c:pod l:hover e:slit a:tendrils|h:skull o:crystal', 'black violet', '40', 'hover siphon-fangs', [
    'A broken shackle that drags its chain after it. It wants to bind something, anything.',
    'It wraps its chains around its prey and drags them into the dark between stars.']);
L('l', 'Probelet/Probehedron', 'void|void gear',
    'c:orb l:hover e:triple t:antenna|b:crystal a:tendrils', 'chrome violet', '40', 'hover lens-array', [
    'A probe sent by someone who never came back for it. It is still sending its reports.',
    'It folds and unfolds like geometry from a dream. It measures everything, including you.']);
L('l', 'Saucerling/Mothership', 'void aero',
    'c:disc l:hover e:single|b:crystal a:tendrils t:lamp', 'chrome teal', '42', 'hover glow-lamp', [
    'A tiny saucer that beams up small objects and never gives them back.',
    'It hovers over the Aetherton plains at night. Saucerlings return to it carrying stolen spoons.']);
L('l', 'Shardlet/Prismatar', 'void|void frost',
    'c:egg l:legs4 e:twin o:crystal|b:crystal t:spikes', 'white violet', 'kit:singularity-seed', 'field-emitter damper', [
    'A crystal fragment from a fallen star-engine. It chimes softly when it walks.',
    'It splits light into beams that freeze and burn at once.']);
L('l', 'Coolantis', 'frost hydro', 'c:serpent l:legs4 e:triple a:blades t:fin', 'blue white', '', 'honed-edges bilge-runner', [
    'A coolant mantis. Its blades are kept so cold they shatter steel on contact.']);
L('l', 'Glacigear', 'frost gear', 'c:orb l:legs4 e:single b:gear o:frost t:spikes', 'white brass', '', 'rime-plating locked-gauges', [
    'A frozen gearbox that keeps on turning, slowly, through the coldest nights.']);
L('l', 'Plasmite', 'volt void', 'c:bulb l:hover e:triple o:crystal', 'violet yellow', '', 'hover storm-coil', [
    'A ball of plasma in a glass shell that fell from orbit. It drifts toward lightning storms.']);
L('l', 'Gliderine', 'aero moss', 'c:egg l:prop e:twin b:sail o:moss', 'green cream', '', 'hover photosynth-skin', [
    'A moss-covered glider that rides thermals for weeks, seeding moss wherever it lands.']);
L('l', 'Ramparton', 'iron gear', 'c:tank l:legs4 e:visor a:cannons b:gear t:lamp', 'iron brass', '', 'thick-plating reinforced', [
    'A walking fortress tower. Old soldiers still salute it.']);
L('l', 'Orrerin', 'gear void', 'c:orb l:hover e:triple a:tendrils o:crystal', 'gold violet', '', 'hover lens-array', [
    'A living orrery. The little planets on its arms track real stars that nobody else can see.']);
L('l', 'Hololark', 'signal void', 'c:bulb l:prop e:single o:crystal t:antenna', 'violet cream', '', 'hover amplifier', [
    'A bird of light projected from a crystal. Touch it and your hand goes right through.']);
L('l', 'Clattergeist', 'rust', 'c:orb l:hover e:triple a:claws o:rust', 'rust violet', '', 'hover flaking-plates', [
    'A swirling storm of loose bolts and nails. It throws things at night and laughs like falling cutlery.']);
L('l', 'Gravitum', 'void', 'c:orb l:hover e:single o:crystal b:gear', 'black violet', '', 'hover damper', [
    'A tiny black sphere of impossible weight. Loose bolts orbit it.']);
L('l', 'Driftsuit', 'void rust', 'c:frame l:hover e:visor h:helm b:tank', 'white rust', '', 'hover self-repair', [
    'An empty spacesuit that drifted down from orbit. It still waves at passing ships.']);

// ===================================================================== pseudo-titans
L('P', 'Voidling/Riftcoil/Singulatron', 'void|void volt',
    'c:egg l:hover e:single o:crystal|a:tendrils b:coil|b:crystal a:cannons h:visor t:horn', 'black violet', '30 55', 'hover storm-coil damper', [
    'It hatched from a meteor of alien metal. It eats light and grows a little each night.',
    'Lightning arcs between its tendrils and the sky. Where it passes, compasses spin for days.',
    'A war engine from beyond the stars. Its cannons fire bolts of collapsed light. Only champions keep one.']);
L('P', 'Rivetpup/Bulwarg/Juggernaught', 'iron|iron piston',
    'c:pod l:legs4 e:twin h:jaw|a:pistons b:spikes|c:tank a:hammers t:horn b:furnace', 'iron gold', '30 50', 'reinforced thick-plating momentum-engine', [
    'A puppy of riveted plate. It chews on girders to sharpen its teeth.',
    'It charges shoulder-first through walls. Its piston arms can lift a locomotive.',
    'An unstoppable war machine with a loyal heart. Nothing on Midden has ever pushed it back a step.']);
L('P', 'Zephlit/Galecutter/Stormwright', 'aero|aero gear|aero volt',
    'c:egg l:prop e:goggles t:fin|b:wings a:blades|b:turbine a:tesla h:visor', 'chrome teal', '30 52', 'turbo honed-edges storm-rider', [
    'A tiny rotor-bot that rides the winds of the Skyrail. It can hover in a gale.',
    'Its clockwork wings cut the air into blades. It slices clouds in half for fun.',
    'It builds storms. Its turbine drives the wind, and its tesla rods call down the lightning.']);

// ===================================================================== titans and the First Bot
L('T', 'Thermopylon', 'steam blaze', 'c:boiler l:legs4 e:visor a:pistons b:stack t:crown', 'gold red', '', 'furnace-core heat-sink prime-engine', [
    'The Titan of the Boilers. Legend says the first towns were built around the heat of its sleeping body.'], { sig: 'titans-boiler' });
L('T', 'Glaciarch', 'frost iron', 'c:tank l:legs4 e:triple a:shields b:crystal t:crown o:frost', 'white steel', '', 'rime-plating reinforced prime-engine', [
    'The Titan of the Coolant Seas. It froze the Frostline in a single night to stop a war.'], { sig: 'absolute-zero' });
L('T', 'Tempestor', 'volt aero', 'c:disc l:hover e:triple a:tesla b:coil t:crown', 'yellow chrome', '', 'storm-coil storm-rider prime-engine', [
    'The Titan of the Storm Pylons. When it wakes, every pylon on Midden sings.'], { sig: 'pylon-storm' });
L('T', 'Leviacore', 'void steam', 'c:boiler l:hover e:single a:tendrils b:crystal t:crown o:crystal', 'black gold', '', 'event-horizon perpetual prime-engine', [
    'The engine that drove the dreadnought Leviathan across the stars. It woke when the ship died, and it is still angry.'], { sig: 'engine-roar' });
L('X', 'Omnicog', 'gear signal', 'c:orb l:hover e:single b:gear a:tendrils t:crown', 'gold cream', '', 'perpetual specialist prime-engine', [
    'The first COM-bot ever built on Midden. Every bot that has ever lived carries a copy of its pattern.'], { sig: 'first-turning' });
