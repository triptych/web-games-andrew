/**
 * Game data configuration
 * Each game object contains all the information needed to render a game card
 */
const games = [
    {
        id: 'game-001',
        title: 'Space Shooter',
        description: 'Classic arcade space shooter! Control your spaceship with arrow keys and shoot enemies with the space bar. Survive as long as you can and rack up the highest score!',
        icon: '🚀',
        folder: 'game-001',
        version: '1.2.0',
        cssClass: 'space-shooter',
        tags: [
            { emoji: '🎯', label: 'Arcade' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '🔫', label: 'Action' }
        ]
    },
    {
        id: 'game-002',
        title: 'Match-3 Puzzle',
        description: 'Match three or more gems of the same color to score points! You have 30 moves to get the highest score possible. Strategic puzzle fun!',
        icon: '💎',
        folder: 'game-002',
        version: '1.3.0',
        cssClass: 'match-3',
        tags: [
            { emoji: '🧩', label: 'Puzzle' },
            { emoji: '🖱️', label: 'Mouse' },
            { emoji: '💡', label: 'Strategy' }
        ]
    },
    {
        id: 'game-003',
        title: 'NetHack Roguelike',
        description: 'Classic dungeon crawler with procedurally generated levels! Explore infinite depths, battle monsters, collect loot, cast spells, and talk to NPCs. Features permadeath, turn-based combat, and ASCII graphics. Can you survive the dungeon?',
        icon: '⚔️',
        folder: 'game-003',
        version: '1.7.0',
        cssClass: 'roguelike',
        tags: [
            { emoji: '🏰', label: 'Dungeon' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '🎲', label: 'Roguelike' }
        ]
    },
    {
        id: 'game-004',
        title: 'Tower Defense',
        description: 'Strategic tower defense with 5 unique tower types! Place Archer, Cannon, Mage, Tesla, and Sniper towers to defend against waves of enemies. Features splash damage, slow effects, chain lightning, and more. 10 progressive waves with increasing difficulty!',
        icon: '🗼',
        folder: 'game-004',
        version: '1.8.0',
        cssClass: 'tower-defense',
        tags: [
            { emoji: '🎯', label: 'Strategy' },
            { emoji: '🖱️', label: 'Mouse' },
            { emoji: '⚡', label: 'Action' }
        ]
    },
    {
        id: 'game-005',
        title: 'Bullet Heaven',
        description: 'Survive endless waves in this bullet heaven shooter! Choose from 3 RPG classes (Warrior, Ranger, Mage) and face 8 unique enemy types with distinct AI behaviors. Auto-shoot, collect XP, level up, and choose powerful upgrades. Features orbiting, teleporting, and splitting enemies!',
        icon: '🎆',
        folder: 'game-005',
        version: '1.6.0',
        cssClass: 'bullet-heaven',
        tags: [
            { emoji: '🎮', label: 'Action' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '⚔️', label: 'RPG' }
        ]
    },
    {
        id: 'game-006',
        title: 'Dungeon Crawler FPS',
        description: 'Retro-inspired first-person dungeon crawler with raycasting visuals. Explore procedurally generated floors, manage weapons and resources, and survive enemies in a fast-paced labyrinth adventure.',
        icon: '🏰',
        folder: 'game-006',
        version: '1.12.0',
        cssClass: 'dungeon-fps',
        tags: [
            { emoji: '🏰', label: 'Dungeon' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '🔫', label: 'FPS' }
        ]
    },
    {
        id: 'game-007',
        title: 'The Forgotten Temple',
        description: 'Classic text adventure set in an ancient temple. Explore 20 interconnected rooms, solve puzzles, manage your inventory, and uncover the mystery of the Crystal of Light. Features NPCs with dialogue, hidden passages, dark rooms, and a full save/load system.',
        icon: '📜',
        folder: 'game-007',
        version: '1.5.0',
        cssClass: 'interactive-fiction',
        tags: [
            { emoji: '📖', label: 'Interactive Fiction' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '🧩', label: 'Puzzle' }
        ]
    },
    {
        id: 'game-008',
        title: 'Centipede Tower Defense',
        description: 'Classic Centipede arcade action meets tower defense strategy! Shoot descending centipede segments from your spaceship, place and upgrade 6 unique tower types on designated slots, and survive 20 escalating waves. Features fleas, spiders, scorpions, boss waves, and a full gold economy.',
        icon: '🐛',
        folder: 'game-008',
        version: '1.11.0',
        cssClass: 'centipede-td',
        tags: [
            { emoji: '🎯', label: 'Strategy' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '👾', label: 'Arcade' }
        ]
    },
    {
        id: 'game-009',
        title: 'Chronicles of the Ember Crown',
        description: 'Classic turn-based RPG in the vein of early Final Fantasy. Lead a party of four heroes — Warrior, Mage, Healer, and Rogue — through 12 escalating battles. Manage MP, use status effects, level up your party, and defeat the Lich King.',
        icon: '👑',
        folder: 'game-009',
        version: '1.9.0',
        cssClass: 'ember-crown',
        tags: [
            { emoji: '🎲', label: 'Turn-Based' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '⚔️', label: 'RPG' }
        ]
    },
    {
        id: 'game-010',
        title: 'Tiny Town',
        description: 'A cozy city builder sandbox where you place roads, houses, parks, and shops on a grid to grow a small town. Manage your gold budget, drag-paint roads, and design the neighbourhood of your dreams.',
        icon: '🏘️',
        folder: 'game-010',
        version: '1.10.0',
        cssClass: 'tiny-town',
        tags: [
            { emoji: '🏙️', label: 'City Builder' },
            { emoji: '🖱️', label: 'Mouse' },
            { emoji: '🌿', label: 'Sandbox' }
        ]
    },
    {
        id: 'game-011',
        title: 'Nonogram Fleet',
        description: 'Solve nonogram puzzles to reveal hidden enemy spaceships, then fire torpedoes to sink the fleet. Limited shots per level — every deduction counts!',
        icon: '📡',
        folder: 'game-011',
        version: '1.4.0',
        cssClass: 'nonogram-fleet',
        tags: [
            { emoji: '🧩', label: 'Puzzle' },
            { emoji: '🖱️', label: 'Mouse' },
            { emoji: '🎯', label: 'Strategy' }
        ]
    },
    {
        id: 'game-012',
        title: 'Arcana Pull',
        description: 'Collect tarot cards through a gacha pull system and field them as fighters in wave-based auto battler combat. Build a four-card party from the 78-card tarot deck — harness the power of the Major Arcana to conquer all 10 waves and defeat The World.',
        icon: '🔮',
        folder: 'game-012',
        version: '1.5.0',
        cssClass: 'arcana-pull',
        tags: [
            { emoji: '🃏', label: 'Card Game' },
            { emoji: '⚔️', label: 'Auto Battler' },
            { emoji: '✨', label: 'Gacha' }
        ]
    },
    {
        id: 'game-013',
        title: 'Petal & Purse',
        description: 'A cozy flower shop sim — buy seeds, grow blooms in your pots, and sell them for gold. Upgrade your pots and soil to grow rarer flowers faster. Low stakes, endlessly relaxing.',
        icon: '🌷',
        folder: 'game-013',
        version: '1.2.0',
        cssClass: 'petal-purse',
        tags: [
            { emoji: '🌸', label: 'Cozy' },
            { emoji: '🖱️', label: 'Mouse' },
            { emoji: '🪴', label: 'Idle Sim' }
        ]
    },
    {
        id: 'game-014',
        title: 'Trackrunner',
        description: 'Endless three-lane runner in a neon cyberpunk world. Dodge obstacles, blast cyber bugs, collect Overdrive power-ups for a speed burst, and take down boss bugs for a permanent speed boost. How far can you run?',
        icon: '🏎️',
        folder: 'game-014',
        version: '1.5.0',
        cssClass: 'trackrunner',
        tags: [
            { emoji: '🏁', label: 'Endless Runner' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '🔫', label: 'Action' }
        ]
    },
    {
        id: 'game-015',
        title: 'Tamagoji',
        description: 'Raise your very own emoji pet! Hatch an egg, feed and nurture your companion through four life stages, and watch it grow from baby to adult. Choose from 5 species, manage hunger, happiness, energy, and health — and collect new eggs from the shop.',
        icon: '🥚',
        folder: 'game-015',
        version: '1.3.0',
        cssClass: 'tamagoji',
        tags: [
            { emoji: '🐾', label: 'Virtual Pet' },
            { emoji: '📱', label: 'Mobile-Friendly' },
            { emoji: '🌸', label: 'Cozy' }
        ]
    },
    {
        id: 'game-016',
        title: 'Crate Pusher',
        description: 'Classic Sokoban-style puzzle game! Push crates onto their targets without getting stuck. Features 8 hand-crafted puzzles of increasing difficulty, an undo system, and a move counter. Can you solve them all?',
        icon: '📦',
        folder: 'game-016',
        version: '1.1.0',
        cssClass: 'crate-pusher',
        tags: [
            { emoji: '🧩', label: 'Puzzle' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '💡', label: 'Strategy' }
        ]
    },
    {
        id: 'game-017',
        title: 'Pixel Picross',
        description: 'Classic nonogram puzzle game! Use number clues to fill in a grid and reveal hidden pixel art. Five hand-crafted puzzles scale from a tiny 5×5 Heart to a 10×10 Rocket. Left-click to fill, right-click to mark — drag to paint whole rows at once!',
        icon: '🖼️',
        folder: 'game-017',
        version: '1.1.0',
        cssClass: 'pixel-picross',
        tags: [
            { emoji: '🧩', label: 'Puzzle' },
            { emoji: '🖱️', label: 'Mouse' },
            { emoji: '💡', label: 'Logic' }
        ]
    },
    {
        id: 'game-018',
        title: 'Village of the Wandering Blade',
        description: 'Explore a 3D countryside, slay monsters for resources, and return to build and develop your village. Fight slimes, goblins, wolves, and trolls — then spend your loot on a blacksmith, healer, market, watchtower, and tavern. Grow stronger. Build further.',
        icon: '🗡️',
        folder: 'game-018',
        version: '1.10.0',
        cssClass: 'wandering-blade',
        tags: [
            { emoji: '⚔️', label: 'Action RPG' },
            { emoji: '🏘️', label: 'Village Builder' },
            { emoji: '🖱️', label: 'Mouse + Keys' }
        ]
    },
    {
        id: 'game-019',
        title: 'Synthwave Breakout',
        description: 'Neon-drenched retro breakout with synthwave aesthetics! Smash 8 rows of vivid neon bricks, build combo multipliers, and catch explosive powerups — wide paddle, multiball, laser cannon, and slow-mo. Particle explosions and a perspective grid backdrop set the mood.',
        icon: '🧱',
        folder: 'game-019',
        version: '1.1.0',
        cssClass: 'synthwave-breakout',
        tags: [
            { emoji: '🕹️', label: 'Arcade' },
            { emoji: '🖱️', label: 'Mouse' },
            { emoji: '🌈', label: 'Synthwave' }
        ]
    },
    {
        id: 'game-020',
        title: 'The River',
        description: 'A retired warrior sails their last adventure down a winding river. Invite fellow travelers at the end of their journeys, gather ingredients along the bank, and arrive at the Dark Lord\'s tower for a grand dinner. Every run is different — and the tower sends daily magical hints about what the lord desires at the feast.',
        icon: '⛵',
        folder: 'game-020',
        version: '1.3.0',
        cssClass: 'the-river',
        tags: [
            { emoji: '📖', label: 'Narrative' },
            { emoji: '🎲', label: 'Roguelite' },
            { emoji: '🍽️', label: 'Cozy' }
        ]
    },
    {
        id: 'game-021',
        title: 'Dungeon Blobber',
        description: 'A 3D first-person dungeon crawler with raycasting visuals and classic blobber stepwise movement. Navigate procedurally generated floors, fight monsters in turn-based combat, collect loot, level up, and descend 5 floors to escape the dungeon.',
        icon: '🧭',
        folder: 'game-021',
        version: '1.7.0',
        cssClass: 'dungeon-blobber',
        tags: [
            { emoji: '🏰', label: 'Dungeon' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '⚔️', label: 'RPG' }
        ]
    },
    {
        id: 'game-022',
        title: 'Depths Unknown',
        description: 'A Motherload-style 2D mining game blending fantasy and sci-fi. Pilot AXIOM-7, a drill machine, through 7 depth tiers — from surface soil to the mysterious Void Layer. Collect 16 ore types, manage fuel and hull integrity, and spend credits on 38 upgrades across 7 categories. Uncover the fate of the lost Delverhaven colony.',
        icon: '⛏️',
        folder: 'game-022',
        version: '1.3.0',
        cssClass: 'depths-unknown',
        tags: [
            { emoji: '⛏️', label: 'Mining' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '🚀', label: 'Sci-Fi/Fantasy' }
        ]
    },
    {
        id: 'game-023',
        title: 'Synthwave Invaders',
        description: 'Retro Space Invaders in a neon synthwave world! 2D pixel-art invaders march toward you across a glowing perspective grid with a retrowave sunset. Shoot them down before they reach you — each wave faster than the last.',
        icon: '👾',
        folder: 'game-023',
        version: '1.3.0',
        cssClass: 'synthwave-invaders',
        tags: [
            { emoji: '🕹️', label: 'Arcade' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '🌈', label: 'Synthwave' }
        ]
    },
    {
        id: 'game-024',
        title: 'Neon Vanguard',
        description: 'A top-down arcade shoot-\'em-up rendered in Three.js with custom shaders. Blast through endless waves of enemies that swarm in choreographed movement patterns — dive, weave, orbit, and swoop — all wrapped in a colorful neon-retro aesthetic with a glowing animated grid.',
        icon: '🛸',
        folder: 'game-024',
        version: '1.7.0',
        cssClass: 'neon-vanguard',
        tags: [
            { emoji: '🔫', label: 'Shmup' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '🌈', label: 'Neon Retro' }
        ]
    },
    {
        id: 'game-025',
        title: 'Crypt Crawler',
        description: 'A top-down Gauntlet-style dungeon crawler in Three.js. Pick one of four classes, fight through retro 3D mazes, and blast endless monsters streaming from nests. Grab food to survive, snatch treasure for score, and hunt keys to open doors gating the level exit. Descend through harder levels until you escape the crypt — with crunchy 8-bit sound effects throughout.',
        icon: '💀',
        folder: 'game-025',
        version: '1.8.0',
        cssClass: 'crypt-crawler',
        tags: [
            { emoji: '🗡️', label: 'Dungeon Crawler' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '👾', label: 'Retro' }
        ]
    },
    {
        id: 'game-026',
        title: 'Crypt of the Forgotten',
        description: 'A first-person grid-based dungeon crawler (blobber) with turn-based combat, built in Three.js. Step tile by tile and turn in 90° increments through a fog-shrouded crypt lit by a flickering lantern. Fight monsters in tactical turn-based battles, search for hidden switches and loot, and descend ever deeper to uncover the crypt\'s secret.',
        icon: '🏚️',
        folder: 'game-026',
        version: '1.10.0',
        cssClass: 'crypt-of-the-forgotten',
        tags: [
            { emoji: '🧭', label: 'Blobber' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '🎲', label: 'Turn-Based' }
        ]
    },
    {
        id: 'game-027',
        title: "Alchemist's Lattice",
        description: 'A drag-and-drop block-placement puzzle (1010!-style) with an alchemy twist, built in Phaser 4. Drag clusters of 1-4 connected blocks onto a 9x9 lattice and fill a full row or column to clear it. Pieces are dealt in sets of 3 from a finite supply and never rotate, so plan ahead - fill the board with no legal move left and the lattice jams. Chain clears for combos and streaks. (Phase 1: the core puzzle.)',
        icon: '⚗️',
        folder: 'game-027',
        version: '1.10.0',
        cssClass: 'alchemists-lattice',
        tags: [
            { emoji: '🧩', label: 'Puzzle' },
            { emoji: '🖱️', label: 'Drag & Drop' },
            { emoji: '💡', label: 'Strategy' }
        ]
    },
    {
        id: 'game-028',
        title: 'Echoes of Aethermoor',
        description: 'A Phaser 4 visual novel fantasy RPG. Lead a party of four heroes — mage, knight, ranger, warlock — through four chapters of branching dialogue, turn-based battles, tile-based maps, quests, and a deep storyline. Uncover the truth of the Lich of Aethermoor before the ancient seals break for good.',
        icon: '📖',
        folder: 'game-028',
        version: '1.4.0',
        cssClass: 'echoes-of-aethermoor',
        tags: [
            { emoji: '⚔️', label: 'RPG' },
            { emoji: '📖', label: 'Visual Novel' },
            { emoji: '🎲', label: 'Turn-Based' }
        ]
    },
    {
        id: 'game-029',
        title: "Wayfarer's Path",
        description: 'An endless procedurally generated road RPG built in three.js. Walk forever, fight monsters with your sword, and loot coins and gear along the way. New weapons and armor pop up in a side-by-side comparison panel against your current gear — up/down arrows show every stat change — so you can equip or sell on the spot. Rest at towns to cash in coins and sell extra loot before the road gets harder.',
        icon: '🥾',
        folder: 'game-029',
        version: '1.6.0',
        cssClass: 'wayfarers-path',
        tags: [
            { emoji: '⚔️', label: 'RPG' },
            { emoji: '🎲', label: 'Procedural' },
            { emoji: '⌨️', label: 'Keyboard' }
        ]
    },
    {
        id: 'game-030',
        title: 'Coppergate Lane',
        description: "A cozy-fantasy RPG-Maker-style adventure. Explore Coppergate Lane, the Whistling Wilds, and Gutter Gully, help the townsfolk with quests, battle clockwork critters in turn-based combat, and recover the Mayor's stolen Golden Gear from the brute Big Bertha.",
        icon: '⚙️',
        folder: 'game-030',
        version: '1.1.0',
        cssClass: 'coppergate-lane',
        tags: [
            { emoji: '🗺️', label: 'Adventure' },
            { emoji: '🎲', label: 'Turn-Based' },
            { emoji: '⌨️', label: 'Keyboard' }
        ]
    },
    {
        id: 'game-031',
        title: 'Grimhold Abyss',
        description: "A retro first-person dungeon crawler in the style of early-90s DOS shareware. Grid-locked steps, 90-degree turns and a hand that throws fireballs, rendered by a custom software 3D engine written from scratch for this game - a 320x200 palette-indexed framebuffer, perspective-correct textured wall columns, dithered EGA distance shading and billboard sprites, with no WebGL and no 3D library. Every floor of the dungeon is procedurally generated.",
        icon: '\u{1F52E}',
        folder: 'game-031',
        version: '1.4.0',
        cssClass: 'grimhold-abyss',
        tags: [
            { emoji: '\u{1F5FA}\uFE0F', label: 'Dungeon Crawler' },
            { emoji: '\u{1F3B2}', label: 'Procedural' },
            { emoji: '\u2328\uFE0F', label: 'Keyboard' }
        ]
    },
    {
        id: 'game-032',
        title: 'Ironhollow Depths',
        description: "An 80's-style top-down 8-bit dungeon crawler in the vein of classic CRT-era action-RPGs. Guide a pixel-art knight through torch-lit brick dungeons, hack down green slimes with your sword, grab gold treasure, and survive as the depths grow harder — all under a chunky retro status-bar HUD.",
        icon: '🗡️',
        folder: 'game-032',
        version: '1.1.0',
        cssClass: 'ironhollow-depths',
        tags: [
            { emoji: '🏰', label: 'Dungeon Crawler' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '👾', label: '8-Bit' }
        ]
    },
    {
        id: 'game-033',
        title: 'Hearthbound',
        description: "A cozy fantasy visual novel built with a hand-crafted vanilla JS engine (no game library) - DOM for the story layer, canvas for battles. Inherit a rundown countryside apothecary and spend a season running it: brew remedies to order for your neighbours, forage, trade with a travelling peddler, and work out why the wood at the edge of the village has gone so quiet since your aunt died. Roughly an hour of story across 195 branching nodes and 13 endings, with inventory, equippable trinkets and charms, leveling, a quest journal, and affinity-gated branches that decide who walks into the dark with you.",
        icon: '🌿',
        folder: 'game-033',
        version: '1.9.0',
        cssClass: 'hearthbound',
        tags: [
            { emoji: '📖', label: 'Visual Novel' },
            { emoji: '🖱️', label: 'Mouse' },
            { emoji: '🌸', label: 'Cozy' }
        ]
    },
    {
        id: 'game-034',
        title: 'Idle Delve',
        description: "A party of heroes auto-battles through a procedurally generated dungeon, even while you're away. Bank the gold they find and spend it in Town on new recruits, stat training, and a deeper starting floor, then send them back down stronger. Built with vanilla HTML/CSS/JS and a raw canvas renderer - every room, hero, and monster is drawn with procedural shapes, no image assets.",
        icon: '⏳',
        folder: 'game-034',
        version: '1.1.0',
        cssClass: 'idle-delve',
        tags: [
            { emoji: '🏰', label: 'Dungeon' },
            { emoji: '💤', label: 'Idle' },
            { emoji: '🖱️', label: 'Mouse' }
        ]
    },
    {
        id: 'game-035',
        title: 'N2 Overdrive',
        description: "A tube-shooter tribute to N2O: Nitrous Oxide (PS1, 1998) built with Phaser 4. Steer your ship around the rim of a psychedelic, neon tunnel that rushes toward you, blasting insect swarms, shooting mushrooms to ripen them into shields, and grabbing coins to build your multiplier. Kill enemies to speed up the tunnel, collect 5 bonus stars to trigger a bonus round, and survive as the tube gets more hectic the longer you last. Fully playable with touch controls on mobile.",
        icon: '🌀',
        folder: 'game-035',
        version: '1.1.0',
        cssClass: 'n2-overdrive',
        tags: [
            { emoji: '🕹️', label: 'Tube Shooter' },
            { emoji: '📱', label: 'Touch' },
            { emoji: '💫', label: 'Retro PS1' }
        ]
    },
    {
        id: 'game-036',
        title: 'Island Walker',
        description: "A first-person walking simulator on a wholly procedural island, rendered by a 3D engine built from scratch — no three.js, no WebGL, just JavaScript transforming and shading triangles into a 2D canvas. Every tree, hill, stream, cave, cloud and building is generated from a seed, so each reload is a new island. Wander the forest, sea cave, lighthouse point, cemetery, garden and ancient ruins to recover 10 lost books and 8 artifacts, then carry them home: the Library's shelves and the Museum's pedestals visibly fill up with everything you return. No enemies, no failing — just exploring.",
        icon: '🏝️',
        folder: 'game-036',
        version: '1.4.0',
        cssClass: 'island-walker',
        tags: [
            { emoji: '🚶', label: 'Exploration' },
            { emoji: '🌱', label: 'Procedural' },
            { emoji: '🖥️', label: 'Software 3D' }
        ]
    },
    {
        id: 'game-037',
        title: 'Lanternwake',
        description: "A turn-based tile game about a lantern-keeper walking a country where the lights have been going out. The overworld grows once from a seed and then remembers you \u2014 the same valleys, the same villages, the same people with the same griefs \u2014 while the Hollows underneath re-knit themselves every time you go down. Explore like a Zelda game (six tools that each open a kind of door you could already see) and fight like a roguelike (grid-tactical turns, real oil and weight pressure, unidentified loot). You cannot die: you wake, and lose the light you had and the hours you had left. Vanilla HTML/CSS/JS with no assets at all \u2014 every sprite is drawn in code, every sound is synthesised, and the whole thing works offline.",
        icon: '\uD83C\uDFEE',
        folder: 'game-037',
        version: '1.2.0',
        cssClass: 'lanternwake',
        tags: [
            { emoji: '\uD83C\uDFB2', label: 'Roguelike' },
            { emoji: '\uD83C\uDF31', label: 'Procedural' },
            { emoji: '\uD83D\uDCF1', label: 'Touch' }
        ]
    },
    {
        id: 'game-038',
        title: 'Emberbrood',
        description: "An 8-bit procedurally generated dragon battler. The Emberlines that hold the sky together are going out and the dragons that tended them are forgetting their own names \u2014 so fight them, bind them, raise them, and breed them back. Final Fantasy-shaped turn-based battles (a party of three, turn order by speed, MP, eleven statuses, an eight-element chart) sit on top of a genome that decides a dragon's stats, skills, temperament AND its 32\u00d732 sprite, so a dragon you bred visibly resembles its parents. 87 items, 18 main quests across five acts, generated notice-board work, a forge, roost dungeons, and three endings gated on what your brood can actually prove. Vanilla HTML/CSS/JS with no libraries and no asset files whatsoever: every sprite is drawn in code, every sound synthesised, and the whole country grows from one seed. Built for a phone.",
        icon: '\uD83D\uDC09',
        folder: 'game-038',
        version: '1.2.0',
        cssClass: 'emberbrood',
        tags: [
            { emoji: '\u2694\uFE0F', label: 'Turn-based RPG' },
            { emoji: '\uD83E\uDDEC', label: 'Procedural' },
            { emoji: '\uD83D\uDCF1', label: 'Touch' }
        ]
    },
    {
        id: 'game-039',
        title: 'Wakeform',
        description: "An Atari 2600-style arcade game built on one original idea: you have no weapon. Your probe can do exactly one thing — invert its own polarity — and as you fly you shed echoes: frozen copies of yourself that keep whatever polarity you had at that instant. Those echoes are not a trail. They push and pull the drifting motes exactly like you do, so you defend the reactor core by drawing a working machine out of your own movement history. Lay a wall to steer motes, funnel them into a knot of opposite echoes that holds them orbiting, then fly in and harvest the whole cluster in one enormous chain. Every echo and every flip costs flux, and flying back through your own past reclaims it, so good play is a loop: build, harvest, reclaim, rebuild. Five mote classes each attack a different weakness in your lattice. Every sprite, colour, backdrop and sound is generated from a run seed — no asset files at all. Three save slots plus autosave.",
        icon: '◉',
        folder: 'game-039',
        version: '1.0.0',
        cssClass: 'wakeform',
        tags: [
            { emoji: '🕹️', label: 'Arcade' },
            { emoji: '⚡', label: 'Novel Mechanic' },
            { emoji: '🌱', label: 'Procedural' }
        ]
    },
    {
        id: 'game-040',
        title: 'Starcadet',
        description: "A vertical bullet-hell shmup in three.js with a rescue mechanic at its centre. The Chorus takes Halcyon Flight Academy mid-examination and you are Cadet Theo Vance, the worst shot in your class, flying the only thing left: a trainer with practice cannons and a tow hook rated for target drones. Two hundred and eleven classmates are in escape pods. Shooting is how you survive; hooking pods is how you win, and a pod that falls past you is gone for the rest of the run. Six levels with distinct backdrops, 14 enemy archetypes with their own shooting patterns, a 12-pattern bullet-hell library, four weapons, flares, graze-fed Overdrive, and six multi-phase bosses \u2014 including one with destructible turrets that each remove an attack from its cycle, and a finale that opens one safe lane for every named classmate you brought back. Every ship, bullet, backdrop, portrait and sound is generated in code: no asset files.",
        icon: '\uD83D\uDEF0\uFE0F',
        folder: 'game-040',
        version: '1.5.0',
        cssClass: 'starcadet',
        tags: [
            { emoji: '\uD83D\uDCA5', label: 'Bullet Hell' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' },
            { emoji: '\uD83D\uDCF1', label: 'Touch' }
        ]
    },
    {
        id: 'game-041',
        title: 'Burrowguard',
        description: "An 8-bit arcade fusion of a digging game, a tower defence and a maze chase. Monsters come in off the surface and walk to the crystal core through the tunnels \u2014 and the tunnels are yours: every cell you dig pays gold and becomes part of the maze they walk, so a careless shortcut hands them the core. Build four kinds of tower into the dirt beside their route, pump monsters with a harpoon until they pop, drop boulders on them, and eat a power gem to turn every one of them blue and chase them down. Grubs, skitters, fire-breathing drakes, stalkers that phase through dirt as a pair of eyes, borers that drill their own shortcuts, and a crowned king every sixth wave. Vanilla JS with a hand-written WebGL renderer: a sprite batcher with sharp pixel-art scaling, neon tunnel edges, bloom and scanlines. No libraries, no asset files. Built for a phone: drag anywhere to dig, thumb the PUMP button, tap the tray to build.",
        icon: '\u26CF\uFE0F',
        folder: 'game-041',
        version: '1.0.0',
        cssClass: 'burrowguard',
        tags: [
            { emoji: '\uD83D\uDD79\uFE0F', label: 'Arcade' },
            { emoji: '\uD83C\uDFF0', label: 'Tower Defense' },
            { emoji: '\uD83D\uDCF1', label: 'Touch' }
        ]
    },
    {
        id: 'game-042',
        title: 'Popgun Pip',
        description: "An 8-bit platformer that crosses Mario-shaped worlds with Metroid-style unlocks. King Grumblewort stomped on the Sun and his goons stole Grandma Pip's inventions; hop, stomp and pop your way across five procedurally generated islands \u2014 25 levels of ? blocks, pipes, springs, lifts, firebars and lava \u2014 and win the gadgets back from the island bosses: Spring Boots, a Frost Ray that turns enemies and bubble blocks into ice you can stand on, Sticky Mitts for wall-jumping and a Rocket Popper that blasts red rock. Every level is generated with shelves, shafts, vaults and basements you can see but can't reach yet, so each new gadget reopens the map; a validator runs the real player physics to prove every level's route is beatable with the moves you have. Twelve enemy types, five multi-phase bosses, Sun Shards, heart containers, a chiptune composer that writes each level its own song, and not a single asset file. Built for a phone (handheld-style controls in portrait, floating controls in landscape) and fine on a keyboard or gamepad.",
        icon: '\uD83D\uDC23',
        folder: 'game-042',
        version: '1.1.0',
        cssClass: 'popgunpip',
        tags: [
            { emoji: '\uD83C\uDF44', label: 'Platformer' },
            { emoji: '\uD83D\uDD13', label: 'Metroidvania' },
            { emoji: '\uD83D\uDCF1', label: 'Touch' }
        ]
    },
    {
        id: 'game-043',
        title: 'Glimmerglen',
        description: "A cozy village builder in a forest that remembers magic \u2014 Stardew Valley meets Zelda. You inherit an overgrown glen with a split, leafless Heartwood tree and one resident: the Mayor of a village of one. Farm through four seasons, raise chickens, cows and sheep, forage, mine and chop; cook recipes you discover across the land and refine goods at forges, mills, looms and dairies. Rebuild the Job Board and travellers arrive \u2014 a carpenter, a farmer, a blacksmith, a cook and more \u2014 each needing a home and shop that fits their trade; every villager contributes something daily, has a three-part personal story, and can be sent on board postings or brought along as a companion. As the village grows, the Glen's sleeping magic wakes: sealed dungeons open, faded shrines, fairy rings and treasures shimmer back into sight, and each dungeon's relic opens the next land. Turn-based battles with telegraphed enemy intents and elements. The land, its five regions, dungeons, monsters, villagers, job postings, every sprite and every song are generated from one seed you choose in the character creator. Three save slots plus autosave and file export. Built for a phone.",
        icon: '\uD83C\uDF33',
        folder: 'game-043',
        version: '1.2.0',
        cssClass: 'glimmerglen',
        tags: [
            { emoji: '\uD83C\uDFE1', label: 'Village Sim' },
            { emoji: '\u2694\uFE0F', label: 'Adventure' },
            { emoji: '\uD83D\uDCF1', label: 'Touch' }
        ]
    },
    {
        id: 'game-044',
        title: 'The Story Thief of Greymantle',
        description: "A point-and-click fairy-tale adventure in the spirit of King's Quest and The Warlock of Firetop Mountain. On the longest night of the year the stories of Brackenford are vanishing \u2014 Gran's Book of Tales has gone blank, and she has forgotten your name \u2014 and a light is burning in the Warlock's tower. Walk, look, use and talk your way across ten hand-painted scenes: pay a troll's toll, trade with a magpie, answer a stone face's riddles, get past a hound who loves you far too much, and find out what the Warlock is really looking for. Light inventory puzzles, Sierra-style deaths you can undo with a turn of the page, a book that writes your adventure as you play it, and three endings. Vanilla JS, no libraries, no asset files.",
        icon: '\uD83D\uDCD6',
        folder: 'game-044',
        version: '1.1.0',
        cssClass: 'storythief',
        tags: [
            { emoji: '\uD83D\uDDB1\uFE0F', label: 'Point & Click' },
            { emoji: '\uD83D\uDCDC', label: 'Story' },
            { emoji: '\uD83E\uDDE9', label: 'Puzzle' }
        ]
    },
    {
        id: 'game-045',
        title: "PINBREAK '86",
        description: 'A flashy synthwave pinball table whose upper half is a breakout brick wall. Plunge, flip, nudge and pop bumpers like pinball, but smash every brick to clear the wave: explosive bricks set off chain reactions, and power-ups (multiball, fireball, flipper lasers, a drain shield, wide flippers, double score) fall down the table to be caught with your flippers. Three.js with bloom, chrome balls, neon trails, shards, shockwaves, hit-stop, slow-mo and a beat-synced synthwave soundtrack.',
        icon: '\uD83D\uDD79\uFE0F',
        folder: 'game-045',
        version: '1.0.0',
        cssClass: 'pinbreak',
        tags: [
            { emoji: '\uD83C\uDFB0', label: 'Pinball' },
            { emoji: '\uD83E\uDDF1', label: 'Breakout' },
            { emoji: '\uD83C\uDF08', label: 'Synthwave' }
        ]
    },
    {
        id: 'game-046',
        title: 'Quiverspire',
        description: "An Archero-style roguelite archer in three.js. Stand still and your archer fires on the nearest enemy; move and you stop shooting, so every room is a rhythm of dodge, plant your feet, loose arrows, dodge again. Climb ten chapters of twelve procedurally generated rooms each (120 in all, plus an Endless mode that never stops climbing): mirrored obstacle layouts of rock, water, lava, chasms and spike traps, twelve enemy types that all telegraph their attacks, elite champions, and five multi-phase bosses who come back Ascended in the later chapters. Level up mid-run and choose from 29 abilities that stack into real builds — Multishot, Front Arrow, Ricochet, Piercing, Bouncy Wall, fire, frost, poison and lightning arrows, orbiting flame circles, spirit wisps, an Extra Life — pray at angel shrines, and strike deals with the Devil for a slice of your max HP. Coins buy permanent talents between runs. Every room, texture, model and song is generated in code: ten distinct biomes from a mossy glade to a void crown, and no asset files at all. Keyboard, gamepad, or a one-thumb floating joystick on a phone.",
        icon: '\uD83C\uDFF9',
        folder: 'game-046',
        version: '1.2.0',
        cssClass: 'quiverspire',
        tags: [
            { emoji: '\uD83C\uDFF9', label: 'Roguelite' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' },
            { emoji: '\uD83D\uDCF1', label: 'Touch' }
        ]
    },
    {
        id: 'game-047',
        title: 'Ashes & Aces',
        description: "Slay the Spire meets poker solitaire in a dark high-fantasy three.js roguelite. Every fight is played on a 5×5 table: place cards from your hand, and whenever a row, column or diagonal fills it fires as a poker hand — the hand sets the multiplier and the suits decide what it does (♠ Blades strike your target, ♣ Staves hit every enemy, ♦ Coins raise Ward, ♥ Hearts heal). Plan crosses where lines meet, dodge monsters that seal cells, steal your best card, frost the table or shuffle dead Ash into your deck, and build your deck with enchanted cards, 22 Arcana spells, 52 relics (nine of them Warden crowns) and 8 elixirs. Ten realms of ten levels — 100 in all — each with its own procedurally built landscape, bestiary, music and Crowned Warden, on branching maps of battles, elites, mysteries, merchants, campfires and treasure. An epic authored story (The Last Hand) with three endings, plus a Chronicle the run writes for you. Three Cardbound heroes whose names and looks are generated per run. Every card face, monster, realm, portrait and note of music is generated in code — no asset files. Saves after every step; fall and you can rekindle at the start of the realm. Mouse, touch or keyboard.",
        icon: '\uD83C\uDCCF',
        folder: 'game-047',
        version: '1.0.0',
        cssClass: 'ashesaces',
        tags: [
            { emoji: '\uD83C\uDCCF', label: 'Deckbuilder' },
            { emoji: '\u2660\uFE0F', label: 'Poker Solitaire' },
            { emoji: '\uD83C\uDFF0', label: 'Fantasy' }
        ]
    },
    {
        id: 'game-048',
        title: 'SPINFRAME',
        description: "A turn-based sci-fi mech RPG where your weapons are a slot machine. You are a cadet at the Halcyon Flight Academy, and your training frame runs on a Probability Engine: every turn you SPIN its reels and every symbol that lands fires \u2014 Blades, Cannons, Missiles that hit every enemy, Arcs that chain lightning between them, Shields, Repairs, Energy and Scrap. Three of a kind from the left on a payline hits far harder, every extra line in the same spin is a link in a multiplying chain, Overclock wilds stand in for anything, three Cores start an Overdrive and five hit the Jackpot. Spend energy to nudge, respin, hold or purge reels, because the Determinant \u2014 a machine mind that hates chance \u2014 jams your reels and writes Glitches into your strips. Upgrading your mech rewrites the machine: up to five reels and four rows, from 3 to 16 paylines, new weapon symbols, a bigger reactor, more wilds and cores; 18 modules bend the rules (cascades, expanding and sticky wilds, mirror lines, clusters\u2026), and three skill trees shape your pilot. Seven procedurally generated sectors with elites, Signals, salvage, depots and bosses, an authored story of a cadet, a rival and an instructor taken by the enemy, contracts, a Refinery that earns while you are away, an endless Sim Ladder and Threat levels. Big chains, cascades, hit-stop, coin showers and MEGA WINs. Vanilla JS, no libraries, no asset files.",
        icon: '\uD83C\uDFB0',
        folder: 'game-048',
        version: '1.0.0',
        cssClass: 'spinframe',
        tags: [
            { emoji: '\uD83C\uDFB0', label: 'Slots' },
            { emoji: '\uD83E\uDD16', label: 'Mechs' },
            { emoji: '\uD83D\uDCC8', label: 'Incremental' }
        ]
    },
    {
        id: 'game-049',
        title: 'Lanterndeep',
        description: "A turn-based 3D roguelike in three.js. Lastlight's lamps are going out: take your missing teacher's lantern and descend the Hundred Stairs \u2014 100 procedurally generated floors through ten buried worlds (cellars, a glowing grotto, a drowned library, a dwarven forge, crystal hollows, an ossuary, a clockwork machine, a frozen abyss, a vault among the stars and the Heart of Night), with a multi-phase Warden on every 10th floor whose attacks are telegraphed on the grid. Your lantern is your light radius and your clock: it burns oil every turn, and in the dark the Hush gathers. Play a Warden, Ranger or Emberwitch with four skills each and a perk choice every level; find procedural loot (magic, rare and relic gear with 25 affixes), chests, mimics, vaults, shrines and merchants; take procedural quests from Wayfarers (bounties, rescues that fight beside you, lost heirlooms, nests, braziers to relight); and collect Maren's ten journal pages for the true ending of three. Fog of war that peels back smoothly, dynamic torch and lantern light, animated water and lava, 70 procedurally modelled monster species plus elite affixes, and a generative score per world \u2014 every texture, model and sound is generated in code. Tap-to-move, auto-explore and big buttons on phones; keyboard on desktop. Saves every floor; Lantern mode lets you rekindle at the start of a world, Ironwick is permadeath.",
        icon: '\uD83C\uDFEE',
        folder: 'game-049',
        version: '1.0.1',
        cssClass: 'lanterndeep',
        tags: [
            { emoji: '\uD83D\uDDDD\uFE0F', label: 'Roguelike' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' },
            { emoji: '\uD83D\uDCF1', label: 'Touch' }
        ]
    },
    {
        id: 'game-050',
        title: 'Tomebound',
        description: "A vivid match-3 fantasy RPG with an idle village, in three.js. The Great Library of Lumenhall has been unwritten: a smudge of living ink scattered its thirteen greatest books into the Library's wings. As a brand-new Mage or Warrior, duel procedurally generated monsters Puzzle Quest-style on a shared 8\u00d78 board of 3D gems \u2014 match fire, water, leaf and spark for mana, skulls to hit, coins for gold and stars for XP, and every gem you take is one the monster can't. Matches of four give extra turns and make Line gems, L and T shapes make Bombs, five in a row makes a Prism. Cast 19 spells (ranked up at the Mage Tower), drink potions you brewed yourself, and wear procedural gear with 17 affixes. Six procedurally mapped wings plus a finale, each with battles, elites, treasure, shrines, events, a Keeper and a Guardian holding a lost book; monsters are assembled from 14 families, nine modifiers and a seeded 3D body. Back home, a floating island village rebuilds itself in real time, even while the game is closed: 13 buildings on 13 plots \u2014 lumber camp, market, quarry, herb garden, forge, training yard, alchemist, crystal mine, mage tower, scriptorium, clocktower and more \u2014 unlocked by your level and by the books you return. Every book grants a permanent bonus and raises every building's level cap, and the Library visibly heals as they come home. Procedural quests, an upbeat authored story with Professor Hootsworth the owl, an Endless Stacks mode after the ending, a generative soundtrack, and no asset files at all. Mouse, keyboard or touch.",
        icon: '\uD83D\uDCD6',
        folder: 'game-050',
        version: '1.0.0',
        cssClass: 'tomebound',
        tags: [
            { emoji: '\uD83D\uDC8E', label: 'Match-3 RPG' },
            { emoji: '\uD83C\uDFE1', label: 'Idle Town' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    }
];

export default games;
