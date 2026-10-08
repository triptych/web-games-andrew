/**
 * Game data configuration
 * Each game object contains all the information needed to render a game card.
 *
 * `genre` decides which path of the 3D garden launcher (index.html) the game's
 * statue stands on. Known genres: arcade, puzzle, dungeon, rpg, story, strategy,
 * cozy (see garden/js/genres.js). A game without one is placed by its tags.
 */
const games = [
    {
        id: 'game-001',
        title: 'Space Shooter',
        description: 'Classic arcade space shooter! Steer with the arrow keys or A/D and hold Space to fire, or on a phone drag anywhere to steer and hold to fire. Survive as long as you can and beat your saved best score.',
        icon: '🚀',
        folder: 'game-001',
        version: '1.3.0',
        cssClass: 'space-shooter',
        genre: 'arcade',
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
        version: '1.3.1',
        cssClass: 'match-3',
        genre: 'puzzle',
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
        version: '1.7.1',
        cssClass: 'roguelike',
        genre: 'dungeon',
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
        version: '1.8.1',
        cssClass: 'tower-defense',
        genre: 'strategy',
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
        version: '1.6.1',
        cssClass: 'bullet-heaven',
        genre: 'rpg',
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
        version: '1.12.1',
        cssClass: 'dungeon-fps',
        genre: 'dungeon',
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
        version: '1.5.1',
        cssClass: 'interactive-fiction',
        genre: 'story',
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
        genre: 'strategy',
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
        version: '1.9.1',
        cssClass: 'ember-crown',
        genre: 'rpg',
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
        version: '1.10.1',
        cssClass: 'tiny-town',
        genre: 'cozy',
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
        version: '1.4.1',
        cssClass: 'nonogram-fleet',
        genre: 'puzzle',
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
        version: '1.5.1',
        cssClass: 'arcana-pull',
        genre: 'strategy',
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
        version: '1.2.1',
        cssClass: 'petal-purse',
        genre: 'cozy',
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
        version: '1.5.1',
        cssClass: 'trackrunner',
        genre: 'arcade',
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
        genre: 'cozy',
        tags: [
            { emoji: '🐾', label: 'Virtual Pet' },
            { emoji: '📱', label: 'Mobile-Friendly' },
            { emoji: '🌸', label: 'Cozy' }
        ]
    },
    {
        id: 'game-016',
        title: 'Crate Pusher',
        description: 'A Sokoban-style puzzle game: push every crate onto a target across 8 hand-made levels. Swipe or use the arrow keys, undo any move, and pick up where you left off with saved progress and best move counts per level.',
        icon: '📦',
        folder: 'game-016',
        version: '1.2.0',
        cssClass: 'crate-pusher',
        genre: 'puzzle',
        tags: [
            { emoji: '🧩', label: 'Puzzle' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '💡', label: 'Strategy' }
        ]
    },
    {
        id: 'game-017',
        title: 'Pixel Picross',
        description: 'Classic nonogram puzzles: use the row and column clues to fill in the grid and reveal pixel art. Fill and mark with the mouse, or tap with the Fill / Mark tool on a phone. Your solved puzzles are saved.',
        icon: '🖼️',
        folder: 'game-017',
        version: '1.2.0',
        cssClass: 'pixel-picross',
        genre: 'puzzle',
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
        version: '1.10.1',
        cssClass: 'wandering-blade',
        genre: 'rpg',
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
        genre: 'arcade',
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
        genre: 'story',
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
        genre: 'dungeon',
        tags: [
            { emoji: '🏰', label: 'Dungeon' },
            { emoji: '⌨️', label: 'Keyboard' },
            { emoji: '⚔️', label: 'RPG' }
        ]
    },
    {
        id: 'game-022',
        title: 'Depths Unknown',
        description: 'A Motherload-style 2D mining game blending fantasy and sci-fi. Pilot AXIOM-7, a drill machine, through 7 depth tiers — from surface soil to the mysterious Void Layer. Collect 16 ore types, manage fuel and hull integrity, and spend credits on 38 upgrades across 7 categories. Uncover the fate of the lost Delverhaven colony, and bring the Singing Vein home to end the mission.',
        icon: '⛏️',
        folder: 'game-022',
        version: '1.4.0',
        cssClass: 'depths-unknown',
        genre: 'rpg',
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
        version: '1.3.1',
        cssClass: 'synthwave-invaders',
        genre: 'arcade',
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
        genre: 'arcade',
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
        genre: 'dungeon',
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
        version: '1.10.1',
        cssClass: 'crypt-of-the-forgotten',
        genre: 'dungeon',
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
        genre: 'puzzle',
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
        version: '1.4.1',
        cssClass: 'echoes-of-aethermoor',
        genre: 'story',
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
        genre: 'rpg',
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
        version: '1.1.1',
        cssClass: 'coppergate-lane',
        genre: 'rpg',
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
        version: '1.4.1',
        cssClass: 'grimhold-abyss',
        genre: 'dungeon',
        tags: [
            { emoji: '\u{1F5FA}\uFE0F', label: 'Dungeon Crawler' },
            { emoji: '\u{1F3B2}', label: 'Procedural' },
            { emoji: '\u2328\uFE0F', label: 'Keyboard' }
        ]
    },
    {
        id: 'game-032',
        title: 'Ironhollow Depths',
        description: "An 80's-style top-down 8-bit dungeon crawler in the vein of classic CRT-era action-RPGs. Guide a pixel-art knight through torch-lit brick dungeons, hack down monsters with your sword, grab gold treasure, and descend ten procedurally generated floors past slimes, bats and bone-throwing skeletons to claim the Hollow Crown. Touch controls included.",
        icon: '🗡️',
        folder: 'game-032',
        version: '1.2.0',
        cssClass: 'ironhollow-depths',
        genre: 'dungeon',
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
        version: '1.9.1',
        cssClass: 'hearthbound',
        genre: 'story',
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
        genre: 'dungeon',
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
        genre: 'arcade',
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
        genre: 'story',
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
        genre: 'dungeon',
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
        genre: 'rpg',
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
        genre: 'arcade',
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
        genre: 'arcade',
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
        genre: 'strategy',
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
        genre: 'arcade',
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
        genre: 'cozy',
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
        genre: 'story',
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
        genre: 'arcade',
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
        genre: 'dungeon',
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
        genre: 'strategy',
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
        genre: 'strategy',
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
        genre: 'dungeon',
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
        genre: 'rpg',
        tags: [
            { emoji: '\uD83D\uDC8E', label: 'Match-3 RPG' },
            { emoji: '\uD83C\uDFE1', label: 'Idle Town' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-051',
        title: 'Sigilborn',
        description: "A fantasy gacha auto-battler in three.js with toon shading. Claim the shattered Sigil Throne as the Overlord \u2014 built in a deep character creator \u2014 and summon heroes who are each procedurally generated: ten races, twelve classes, five elements, rarity from Common to Mythic, rolled stats with a grade, traits, a skill kit and a full chibi 3D look, with a one-in-fifty Radiant variant. Summon with pity and a weekly featured pair, then fight Summoners War-style ATB battles on auto or by hand, with Overlord spells, element advantage and 20 status effects. Push eight campaign regions and their bosses, farm elemental Rifts, climb the Endless Spire with roguelite blessings, and duel rival Overlords in the Arena. Gear up with six-slot Sigilstones (12 sets, random substats, risky +15 enhancing, reforging, crafting). Between fights your floating citadel works on its own: the Treasury, Training Grounds, a diggable Mine with idle miners, a real-time Farm and Kitchen, a Forge, an expedition board, daily quests, a rotating Market and a Fortune Wheel. Every model, face, icon and sound is generated in code.",
        icon: '\u2728',
        folder: 'game-051',
        version: '1.0.0',
        cssClass: 'sigilborn',
        genre: 'strategy',
        tags: [
            { emoji: '\uD83C\uDFB2', label: 'Gacha' },
            { emoji: '\u2694\uFE0F', label: 'Auto Battler' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-052',
        title: 'Nightline',
        description: "A lo-fi synthwave night drive through an endless, rain-soaked, Blade Runner-style city, in three.js. No goals and nothing to crash into: set a cruise speed, change lanes (the blinker waits for a gap), and let the city slide past \u2014 downtown towers hung with neon and animated billboards, a paper-lantern night market, an elevated skyway nineteen metres above the lit grid, a harbour of cranes and black water, dense residential heights. Every kilometre or so there is somewhere to pull over: a noodle bar, an all-night diner, a charging station, a skyway overlook, a konbini, a record shop, an arcade, a motel, a laundromat, a pier. Park, sit in the rain while a few lines of description drift past, order a bowl or play one credit, then drive on. Wet streets reflect every sign and tail light, spinners cross the sky, a patrol spinner sweeps its searchlight, steam rises from the manholes, and the whole thing is rendered at 240 lines with dithering and scanlines. Three generative radio stations \u2014 synthwave, lo-fi hip-hop and slow analogue ambient \u2014 with invented track names, plus drift mode where the car drives itself, four cameras, photos and a night log. Keyboard or touch.",
        icon: '\uD83C\uDF03',
        folder: 'game-052',
        version: '1.0.0',
        cssClass: 'nightline',
        genre: 'cozy',
        tags: [
            { emoji: '\uD83D\uDE97', label: 'Night Drive' },
            { emoji: '\uD83C\uDF27\uFE0F', label: 'Synthwave' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-053',
        title: 'Legend of the Jade Wyrm',
        description: "A Legend of the Green Dragon-style browser RPG that simulates the whole online experience with no server. Every day you get a handful of forest fights in the Gloamwood: hunt creatures (about a hundred, each with its own weapon and death line) for gold and experience, stumble into 24 forest events (fairies, an old man's guessing game, an outhouse, mimics, a toll goblin, standing stones), beat your master at the Proving Yard to level up, and at level 15 seek out the Jade Wyrm \u2014 slay it and you start again at level 1 with a permanent gift and a new title. Hollowmere has it all: weapon and armour shops whose stock changes as you earn respect, a bank with interest, loans and transfers, a healer, the Crooked Antler (drinks and drunkenness, gossip, the bard, flirting with and marrying Willa or Corwin, a room so nobody can kill you in your sleep, a bounty broker), stables, a fortune teller's tent with potions, gardens, the Wyrmslayers' Standing Stone, guilds, a Lodge of deeds, the Herald, the Hall of Heroes and raven mail. Die and you wander the Pale Shore, tormenting souls for the Ferryman's favour. The server is simulated: 60 other players with personalities and real-clock schedules log in and out, chat in the square (and answer you), fight, level up, slay the Wyrm, marry, form guilds, place bounties and attack you if you sleep in the fields. Text-first pages with LoGD colour codes and hotkeys, framed in three.js: an oak header beam with crossed swords and a painted shield, a timber window onto a low-poly village the camera flies around, torches, a sky that follows the game clock, and 3D foes that lunge and fall. Three save slots, export and import, two day-pacing modes, phone-friendly.",
        icon: '\uD83D\uDC09',
        folder: 'game-053',
        version: '1.0.0',
        cssClass: 'jadewyrm',
        genre: 'rpg',
        tags: [
            { emoji: '\uD83D\uDCDC', label: 'Text RPG' },
            { emoji: '\uD83D\uDC65', label: 'Simulated MMO' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-054',
        title: 'Pale Engine',
        description: "A DOOM-style first-person shooter in three.js, set on Io in 2291. The Hadal Consortium's deep-mantle station has gone silent, its Pale Engine drilled through the bottom of everything, and you are the last Warden standing \u2014 with the station AI VESPER in your ear and its own reasons for wanting you at the bottom. Ten levels across three episodes (Tartarus Station, the Sulfur Deep, the Underneath) are generated from a seed: rooms, stairs, lava pits, crates and courtyards from per-cell heights, blue, yellow and red keycard doors, secret walls, exploding barrels, ambushes that teleport in, data terminals that tell the story, and a validator that plays every level before you do. Every run rolls its own monster species \u2014 names, colours, horns, eyes, voices \u2014 across ten archetypes that sight, hear, chase, infight, stagger and get executed, plus three guardians: Overseer Kell's mech, the Furnace Mother and the Archon on the Pale Throne, who shields itself with Engine pylons. Nine weapons from the Arc Blade and a self-charging pistol to the Twin Reaper, the Rail Driver and the Singularity Cannon, modelled in code with working pumps and break-actions; Berserk, Overdrive, Haste, an inverted-colour Aegis Field, a Phase Cloak and a Hazard Suit. Baked lightmaps plus live muzzle-flash light, bump-mapped procedural textures, four skies, bloom and a post pass for every powerup, a generative industrial-metal score, an automap, a helmet portrait that bleeds, intermission tallies with par times, and Endless Descent after the credits. Mouse and keyboard, or full touch controls.",
        icon: '\uD83D\uDD25',
        folder: 'game-054',
        version: '1.0.0',
        cssClass: 'pale-engine',
        genre: 'arcade',
        tags: [
            { emoji: '\uD83D\uDD2B', label: 'FPS' },
            { emoji: '\uD83D\uDC79', label: 'Procedural Demons' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-055',
        title: 'Rotorstorm',
        description: "A top-down helicopter bullet-hell shooter in vanilla JavaScript and hand-written WebGL2, with no libraries and no asset files. It is 2061 on the Shattered Coast: MERIDIAN, the AI built to steer storms away from the cities, has started steering them at them, and you fly the AH-77 Kestrel, the last experimental gunship of Task Force HALYARD. Six operations over procedural terrain (an archipelago at dawn, a monsoon jungle river, a sandstorm highway, a breaking ice shelf, a neon city at midnight under a superstorm, and a volcano that ends on MERIDIAN's own platform) are written as you fly by a director that sends drones, jets, gunships, bombers, carriers, mines, tanks, flak, SAM sites, gunboats, icebreakers and fuel convoys where the ground suits them, with elite storm-charged waves, a Warhawk mid-boss, salvage caches and stranded civilians to winch up. Six multi-phase bosses fight with named spell cards: the dreadnought Tidewarden, the walker Mantis and its laser scythes, a burrowing Sandwyrm, the Bastion behind orbiting shield plates and frost bullets that stop and re-aim, the crowned gunship Seraph flown by your captured wingman Ash, and MERIDIAN's core, with Ash on your wing for the last phase. Graze bullets to charge Overdrive, wipe the screen with a Thunderclap EMP, chain kills for a multiplier, and spend salvage in the hangar on a 28-node skill tree: a fan-spread chin gun, an Ion Lance, homing missiles, rocket pods, wingman drones, an Arc Caster, armour, a deflector, Phoenix Protocol and Storm Breaker. Terrain baked by shaders with animated water and lava, craters and tank treads stamped into the ground, falling wrecks, layered explosions, shockwaves, HDR bloom, weather, a night searchlight, a generative soundtrack per operation, radio portraits, an ending shaped by the survivors you saved, the endless Stormfront mode, and touch controls built for phones.",
        icon: '🚁',
        folder: 'game-055',
        version: '1.0.0',
        cssClass: 'rotorstorm',
        genre: 'arcade',
        tags: [
            { emoji: '🚁', label: 'Helicopter Shmup' },
            { emoji: '💥', label: 'Bullet Hell' },
            { emoji: '✨', label: 'Vanilla WebGL2' }
        ]
    },
    {
        id: 'game-056',
        title: 'Keepfire',
        description: "A castle-defence take on Plants vs. Zombies with an incremental heart, in three.js. Emberhold is the last keep in Aldmere and starts as one squat tower with a single archer on it; waves of procedurally generated fantasy monsters march in from the right along five lanes. Every kill pays gold, spent mid-wave on a party you place on the tower platforms or out in the bailey (archers, gold-brewing alchemists, knights and palisades, pyromancers throwing fireballs, a frost witch, dwarf bombardiers lobbing exploding barrels, clerics, a ballista, a druid that roots foes in thorns, and a storm caller whose lightning leaps between lanes), each levelling to 10 with perks. Grow the castle itself: towers rise floor by floor, walls go from logs to banded stone, the bailey widens, and the Forge, Treasury, Spiked Ramparts and the Keepfire beacon (a firestorm down a whole lane) appear. Tap falling embers for gold and glowing orbs for powerups (meteor, frost nova, thunderstorm, rally horn, arrow rain, earthquake), and pick one of three procedurally generated relics after every wave. Six regions (meadows, fens, a volcanic pass, frozen wastes, a necropolis and Dragonspire) each end in a boss: a warg king, the Mire Mother, Warlord Skarn, the Rime Colossus, Morvane the Lich and Vael the Black Sun, then the endless Long Night. Every monster species is rolled per run (bodies, colours, horns, weapons, names) with elite affixes; lose a wave and you keep the gold for a retry, or Rekindle for Embers that buy permanent upgrades. Generative medieval music, mouse, keyboard or touch, portrait or landscape.",
        icon: '\uD83C\uDFF0',
        folder: 'game-056',
        version: '1.0.0',
        cssClass: 'keepfire',
        genre: 'strategy',
        tags: [
            { emoji: '\uD83C\uDFF0', label: 'Castle Defence' },
            { emoji: '\uD83D\uDCC8', label: 'Incremental' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-057',
        title: 'Hivebreaker',
        description: "A twin-stick shooter in the spirit of Enter the Gungeon and Alien Breed, in three.js. Fort Kessler, a black-site base under the ice of Erebus, has gone silent, and the President's daughter Ellie Calder is somewhere below. You are Warden, one Colonial Marine with a pulse rifle and a flashlight, going down through five procedurally generated sectors (Hangar Deck, Barracks & Armory, Bio-Research Labs, Reactor Core and the Hive). Doors seal when you enter a room and the bug-like Brood pours out of the vents in waves and swarms of hundreds: skitters, lunging drones, acid spitters, bloaters, burrowers, armoured brutes, infested soldiers, wasps, cloaked stalkers and brood sacs, with glowing alphas. Dodge-roll through bullet patterns, throw grenades, erase bullets with the Shock Pulse, and carry four of nine guns (pulse rifle, scattergun, flamethrower, smartgun, arc caster, rail lance, grenade launcher, minigun, plasma cannon) upgraded to Mk III with Mod Chips. Timed power-ups, a supply depot, med bays, data logs that tell the story, and a field upgrade after every boss: the Ravager, the Goliath walker, Specimen Zero, the Magma Widow and the Brood Mother. Then cut Ellie free and run for the dropship before the base self-destructs. Shaders everywhere (procedural deck plates and hive creep, a baked lightmap, flashlight shadows, GPU particles, fireballs, bloom), a generative synth score, Horde Mode, mouse and keyboard, gamepad or touch twin-sticks.",
        icon: '\uD83D\uDC1C',
        folder: 'game-057',
        version: '1.0.0',
        cssClass: 'hivebreaker',
        genre: 'arcade',
        tags: [
            { emoji: '\uD83D\uDD2B', label: 'Twin-stick' },
            { emoji: '\uD83D\uDC1C', label: 'Swarms' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-058',
        title: 'Bumble Basket',
        description: "A light, cosy fruit-picking puzzle in three.js with a new kind of matching: drag a little bumblebee along a trail from fruit to fruit, where every hop only has to share something with the fruit before it — the same kind, colour, size or family. So a trail wanders like a word ladder: a red apple to a green apple, to a lime, to a lemon, to a banana. The bee starts out sensing only kind, and each of the four gardens (Sunny Orchard, Berry Patch, Giant's Garden, Tropic Tops) ends in a Set level that teaches it a new sense, while more kinds, colours and sizes of fruit crowd onto the blanket. Matching fruit pours into a jar for each sense; a full set earns a power-up — the Honey Dipper, Paint Pollen, the Buzz Bomb and Rainbow Wings. Trails of seven grow golden fruit that links to anything; leaf piles and frosted fruit get in the way. Thirty levels, an endless Picnic mode, and a Fruit Album with 81 stamps to collect. Sixteen kinds of chubby fruit with faces, all built in code, on a gingham blanket in a meadow, with plucky generative music. Nothing is timed and running out of moves offers five more for free. Touch or mouse, portrait or landscape.",
        icon: '🐝',
        folder: 'game-058',
        version: '1.1.0',
        cssClass: 'bumble-basket',
        genre: 'puzzle',
        tags: [
            { emoji: '🍓', label: 'Trait chains' },
            { emoji: '🐝', label: 'Casual' },
            { emoji: '🧊', label: 'three.js' }
        ]
    },
    {
        id: 'game-059',
        title: 'Sister Circuit',
        description: "A neon beat-'em-up in the spirit of Double Dragon, Streets of Rage and Turtles in Time, in three.js with no asset files. Port Solace, 2089: Aurex Dynamics owns the city and has taken Juno Vega's little sister Mika, the one mind that fits its VANTA neural-link program. Juno steals the VANTA-7 prototype combat suit, whose sarcastic AI ECHO turns out to have been trained on Mika's own brain scans, and fights north to the Aurex Spire through seven stages: rainy Neon Row, the Line 9 maglev (inside and on the roof, ducking signal gantries), the Lantern Market and its rooftops, the Ironwharf docks (forklifts, steam vents), Aurex Biolabs behind laser gates, an express elevator up the Spire, and the Zenith penthouse at dawn. A real 3D street drawn into a 240-pixel render target with bloom and scanlines, and every fighter is pixel art generated from a 2D skeleton rig with palette swaps. A deep move list: four-hit chains, launchers and juggles, backfists, dash knees, flying kicks and dive stomps, grabs with knees, throws, suplexes and vaults, pickup pipes, katanas, shock batons and knives, plus suit specials (Arc Burst, Rail Dash, Meteor Drop) and an Overdrive meter. Eleven enemy types with crowd AI that flanks and takes turns (punks, knife throwers, bruisers that charge and grab, shield guards, gunners, kunoichi that dodge, pouncing rippers, synth troopers that block, acid-spitting husks, drones, tick mines) and seven bosses with phase changes: Jackhammer Malone, Viper and her mirages, Kuroda the Oni and his counter stance, the Bulwark mech, Specimen G-7, Mika herself under neural control, and CEO Magnus Hale with his Ascendant exo-frame, with Mika fighting at your side. Story with portraits and a full ending, a safehouse to upgrade the suit between stages, ranks, continues, three difficulties, Arcade, Boss Rush, Survival and playable Mika to unlock, generative synthwave per stage, and touch controls for phones.",
        icon: '\uD83D\uDC4A',
        folder: 'game-059',
        version: '1.0.0',
        cssClass: 'sister-circuit',
        genre: 'arcade',
        tags: [
            { emoji: '\uD83D\uDC4A', label: "Beat 'em up" },
            { emoji: '\uD83C\uDF03', label: 'Cyberpunk' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-060',
        title: 'BRICKVADERS',
        description: "Breakout meets Space Invaders in a 1983 arcade cabinet, in three.js with no asset files. The Brick Armada, aliens built out of living bricks, marches down on Earth in formation, and you fly the STRIKER: half Breakout paddle, half laser base. Bounce the plasma ball into the formation, shoot lasers between bounces, chain hits for up to x5 and catch Arkanoid-style capsules (Laser, Expand, Catch, Multi-ball, Fireball, Slow, Barrier, Nova Bomb, 1UP). Everything is a voxel pixel drawn into a 240x320 vertical monitor with bloom, phosphor trails and a curved CRT, so invaders shed pixels as you hit them, every kill bursts into tumbling cubes that fly at the glass, and each wave assembles itself from flying bricks. The march is the bassline and speeds up as the formation thins. Nine invader types (tanks that crater your shields, splitters, mirrors that bounce lasers back, builders that lay new bricks, Galaga-style divers, and captors whose tractor beams steal your ball), rainbow, silver, gold, TNT and prize bricks, erodible shields, drifting asteroids and the mystery ship. Five sectors (the Moon, a neon nebula, an asteroid belt, a synthwave Synth City and the inside of the mothership) with five giant brick bosses to dig through to their glowing cores: King Krabbo, the Saucerator, Rockjaw, the Phantom Queen and the Overmind. Galaga-style challenging stages, an attract mode with a demo, high scores with initials, CADET and ARCADE modes, continues, endless loops, and a touch control deck with a spinner pad for phones.",
        icon: '\uD83D\uDC7E',
        folder: 'game-060',
        version: '1.0.1',
        cssClass: 'brickvaders',
        genre: 'arcade',
        tags: [
            { emoji: '\uD83D\uDC7E', label: 'Arcade' },
            { emoji: '\uD83E\uDDF1', label: 'Breakout' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-061',
        title: 'STARWRIGHT',
        description: "A procedurally generated space sim in three.js with no asset files: 230 star systems, planets, asteroid belts, stations, ships, eight alien species (with faces, languages, tastes and grudges) and their missions all grow from one seed you can type in and share. You are a newly licensed Wright with a tiny skiff and a derelict outpost called Hearth. Fly in third person, cut asteroids with a mining beam, scoop fuel from stars and Helium-3 from gas giants, scan planets for survey data, salvage derelicts and study anomalies. Trade at alien stations whose prices react to what you sell, take procedural missions (deliveries, bounties, surveys, salvage, raider nests, envoys), and fight off Reaver raiders and the hostile Swarm. Bring it home to build Hearth module by module (refinery, shipyard, research lab, fabricator, drones, hydroponics, trade depot, defences, warp beacon) and watch the station grow; upgrade your procedurally generated ship through five hull classes and eleven components, including the warp drive that opens the galaxy. Cruise autopilot, an Elite-style 3D scanner, galaxy and system maps, a generative score, and an eleven-chapter story about the Lattice Signal at the galactic core. Keyboard and mouse, gamepad or touch.",
        icon: '\uD83D\uDE80',
        folder: 'game-061',
        version: '1.0.0',
        cssClass: 'starwright',
        genre: 'strategy',
        tags: [
            { emoji: '\uD83D\uDE80', label: 'Space sim' },
            { emoji: '\u26CF\uFE0F', label: 'Mine & build' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-062',
        title: 'Rotten to the Core',
        description: "A light, silly Diablo with fruit, in three.js with no asset files. Something rotten has crawled up from under the town of Tristrawberry: grow a fruit hero (sixteen fruits, colours, eyes, mouths and twelve hats) as a Melon Knight, Seed Ranger or Citromancer, take a butter knife down the cellar stairs and squash your way through twelve procedurally generated levels in three acts (the Root Cellar, the sticky Jam Catacombs and the Rotten Core with its rivers of boiling fruit punch) to Durian the Diabolical. Click to walk and whack, eighteen skills (Big Slice, Blender, Pip Spray, Peel Trap, Raisin Rain, Brain Freeze, Chain Lime-ning, Melon Meteor…), fourteen kinds of rotten fruit and pests with their own tricks (shamans that revive their friends, worms in bowler hats, exploding tomatoes, mimic pies) plus champion and named elites, and three bosses: The Juicer, Mangophisto the Chutney Lord and Durian. Everything bursts into juice that stays on the floor. Loot is kitchenware in four rarities up to Golden uniques; Health is Freshness, mana is Juice, gold is Sugar and town portals are pies. Deckard Cane (a candy cane) identifies your loot and asks you to stay a while and glisten; Granny Smith heals, Grapeswold forges, Olivia sells magic, Kiwirt sells mystery smoothies. Six quests, waypoints, a stash, three difficulties, fog of war, an automap, generative music and gibberish-talking townsfolk. Mouse and keyboard or touch.",
        icon: '\uD83C\uDF4E',
        folder: 'game-062',
        version: '1.0.2',
        cssClass: 'rotten-to-the-core',
        genre: 'dungeon',
        tags: [
            { emoji: '\uD83C\uDF53', label: 'Action RPG' },
            { emoji: '\uD83D\uDDE1\uFE0F', label: 'Loot' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-063',
        title: 'Tee & Sorcery',
        description: "A fantasy golf RPG in three.js with no asset files. Lord Bogey, a sorcerer who never once made par, shatters the Golden Tee and curses every hole in Fairhaven; Pip, a clumsy caddie who pulled a talking sand wedge called Wedgewick out of a stone, sets off to win back the five Tee Shards. Twenty holes in five storybook realms, each playing differently: Meadowmere's windmill and spring mushrooms, the Sandsea's quicksand, island greens and strong winds, Frostpeak's sheet ice and frozen lake, Cinder Caldera's lava rivers and geysers that fling the ball skywards, and the Sky Citadel's floating islands over the void. Real 3D golf with a three-press swing meter, four clubs, wind, backspin, bounces and rolls, PERFECT strikes, hooks and slices, a preview arc and an overhead view. Every realm ends in a boss hole where the cup is sealed until you beat the boss with your ball: Grubbins the Gopher King, the sandworm Duneborn, Big Frosty behind his ice walls, the two-headed ogre Double Bogey on his ledge, and Lord Bogey, who becomes the three-headed Triple Bogey. Bonk slimes, scarabs, penguin knights, imps and wisps for XP; roll through coins, gems and mana orbs; level up and spend stat points on Power, Control, Luck and Magic; buy club sets, balls and charms at Old Man Eagle's Pro Shop; cast Mulligan, Gust Ward, Fireball, Frost Step and Seeker; and use Rocket Tees, Sticky, Spring and Ghost balls. Chibi characters with painted faces and toon outlines, a storybook terrain shader with mown stripes and inked edges, a floating-island world map with tilt-shift, a short funny story with rendered portraits, procedural music for every realm, and touch controls for phones.",
        icon: '\u26F3',
        folder: 'game-063',
        version: '1.0.0',
        cssClass: 'tee-sorcery',
        genre: 'rpg',
        tags: [
            { emoji: '\u26F3', label: 'Golf' },
            { emoji: '\uD83E\uDDD9', label: 'Fantasy RPG' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-064',
        title: "Kraken's Gambit",
        description: "Chess on the high seas, in three.js with no asset files, where the sea plays too. The Royal Navy and the Pirates fight with procedurally modelled, cel-shaded fleets: Dinghies for pawns, seahorse-prowed Longships for knights, Schooners for bishops, Lighthouses on rocky islets for rooks, a two-deck Man-o'-War for the queen and a crowned Flagship for the king, on a chequered patch of toon sea framed by a rope-and-piling dock. The chess is exact (castling, en passant, promotion, every draw rule) against five AI captains from Cabin Boy to Captain, or a friend on the same screen. Between moves the sea may act: the Kraken drags a ship under, a mermaid lures one away, a storm drives every ship a square downwind, a whirlpool spins a ring of them, dolphins push a pawn (sometimes all the way to promotion), a ghost ship scatters a rank, salvage divers raise a sunk piece, and a sea serpent swaps two ships. Pick the sea state from Mirror Calm to Tempest and switch events on or off. The sea is wild but fair: it never takes a Flagship, never leaves a side illegally in check, and never ends the game by itself. Cannon fire, sinking ships, a squeezebox shanty, undo, hints, autosave, mouse, touch or keyboard.",
        icon: '\uD83D\uDC19',
        folder: 'game-064',
        version: '1.0.0',
        cssClass: 'krakens-gambit',
        genre: 'strategy',
        tags: [
            { emoji: '\u265F\uFE0F', label: 'Chess' },
            { emoji: '\uD83C\uDFF4\u200D\u2620\uFE0F', label: 'Pirates' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-065',
        title: 'Worldroot',
        description: "An idle clicker in a magical forest, in three.js with no asset files. A seed of light lies in a sleeping clearing: touch it to gather motes, and grow it, level by level, from a sprout into the World Tree. The tree is one procedural model that really grows: trunk, limbs, roots and canopy appear on their own schedules, the bark is veined with pulsing light, and the camera pulls back as it towers over the forest. Twelve kinds of spirit gather motes for you, and each lives in the clearing as you buy it: swarms of fireflies, rings of glowcaps, dew sprites, lantern moths, fox spirits with foxfire tails, moonwells with beams of light, a rune henge, walking treants, white stags, the aurora, a dancing dryad court and orbiting star seeds. 143 upgrades (tier, synergy, click, radiance, wisp and sap), milestones every fifty owned, golden wisps to catch for frenzies and lucky gifts, five spells powered by sap, four seasons that change the bonuses and the whole palette (spring blossom, autumn gold, winter snow), 138 achievements, a heartwood rebirth layer with thirteen lasting gifts including automation, six trials with permanent rewards, and the nine Norse realms to bind to the World Tree as floating islands. Around it all, the Wilds: spirit kinship, expeditions into the Deepwood, 24 relics in four sets, a moonpetal garden, rotating whispers, an amber peddler with spark colours, fourteen tiered badges, 28 titles, 97 feats and a codex of spirit lore. Offline progress (automation keeps working while you sleep), a generative ambient score, save export, and touch controls for phones.",
        icon: '\uD83C\uDF33',
        folder: 'game-065',
        version: '1.2.1',
        cssClass: 'worldroot',
        genre: 'cozy',
        tags: [
            { emoji: '\uD83D\uDCA4', label: 'Idle' },
            { emoji: '\u2728', label: 'Incremental' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-066',
        title: 'Scrapwright',
        description: "A steampunk COM-bot adventure in three.js with no asset files. On Midden, the junk planet where the galaxy dumps its dead starships, a scrap kid from Cinderwick finds, repairs, builds and evolves COM-bots (Companion Mechanoids): 250 of them in 126 lines across 16 types, each assembled from procedural parts (boiler drums, treads, spider legs, hover jets, saw arms, smokestacks, dish antennas) in its own palette. Evolving installs new parts, a new trait and the techniques those parts bring. Catch wild bots with Reboot Spikes, weld dormant wrecks back to life in a timing minigame, or build them from blueprints at the workbench. Turn-based battles with 170 techniques, statuses, atmospheres and traits, against 79 trainers, eight Forgemasters, the Rust Syndicate, the Furnace Four and Champion Vex, across 64 maps of scrap drifts, crashed ships, a refinery, frozen wrecks, a sky station and an airship. Win the championship and the Starward Ticket off-world. Bloom, sepia grade, heat haze, a gear-iris wipe, synthesised music, autosave, keyboard or touch.",
        icon: '\uD83E\uDD16',
        folder: 'game-066',
        version: '1.0.3',
        cssClass: 'scrapwright',
        genre: 'rpg',
        tags: [
            { emoji: '\u2699\uFE0F', label: 'Steampunk' },
            { emoji: '\uD83E\uDD16', label: 'Robots' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-067',
        title: 'Tootle Isles',
        description: "A cozy toy-train sandbox in the spirit of LEGO Loco, in three.js with no asset files, and everything unlocked. Choose one of eight islands (Sunny Cove, Pine Peaks, Twin Isles, Coral Ring, Blossom Bay, Maple Hollow, Snowdrop Isle or a Big Baseplate), each reshaped by a seed, and start blank or with a little town and a train already running. Drag to lay track: curves, crossings and switches come from the shape you draw, track over water becomes a bridge and track through a hill becomes a tunnel. Add station platforms and the residents of every home walk over, wait and climb aboard. Design your own trains in the Workshop (steam, little tank engine with a friendly face, diesel, bullet train or tram, and up to ten coaches, boxcars, tankers, log cars, sheep wagons, ice cream cars, circus cars and more, in sixteen toy colours) and keep them in a Train Shed shared by every island. Build from 80 pieces: homes, shops, a town hall, a fire station, a castle, a Ferris wheel, a carousel, a windmill, a lighthouse, farms, trees, boats and a friendly whale. Trains never crash: they brake for each other, stop at stations and shunt out of dead ends. Tap anything: trains toot, people wave, sheep baa, windmills whirl, points switch. Ride along in the driver's view, change the time of day, collect stickers, undo anything, save as many islands as you like with thumbnails and share codes. A studded baseplate, chunky bricks, minifig people, cotton-wool steam, a shore-foam sea, snow, petals and falling leaves, night lamps and fireflies, tilt-shift, synthesised music and touch controls for phones.",
        icon: '\uD83D\uDE82',
        folder: 'game-067',
        version: '1.0.1',
        cssClass: 'tootle-isles',
        genre: 'cozy',
        tags: [
            { emoji: '\uD83D\uDE82', label: 'Trains' },
            { emoji: '\uD83C\uDFDD\uFE0F', label: 'Sandbox' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-068',
        title: 'Haven Road',
        description: "A tower defense turned around: you heal the people instead of hurting the monsters. The dead have taken the valley and the living are walking out of it, hurt, down a winding road to the Haven. Build aid stations beside the road: a Medic Tent bandages wounds and revives the collapsed, a Remedy Lab cures the blight, a Field Kitchen feeds the starving and gives temporary health, a Warming Fire drives out the cold, a Splint Post sets broken legs, a Song Circle calms fear and builds courage, a Stretcher Crew carries the fallen, Lantern Posts slow the dead and a Signal Bell lures them away. Twelve procedurally generated roads in three acts (autumn Maple Hollow, snowy Frostford, rainy Lantern City at night), five kinds of dead, families, elders, children and handcarts. Everyone who arrives thriving joins the volunteers, and in the three boss levels they walk back out to fight with the cure: firefighters' hoses, herb bombs, floodlights and lullabies turn the dead back into people, who walk home and join them. Letters from the people you saved, written about the care they got; a journal that remembers every name; an endless Open Road. Three.js with no asset files, synthesised hopeful music, and touch controls for phones.",
        icon: '\uD83C\uDFEE',
        folder: 'game-068',
        version: '1.0.0',
        cssClass: 'haven-road',
        genre: 'strategy',
        tags: [
            { emoji: '\uD83C\uDFE5', label: 'Healing' },
            { emoji: '\uD83D\uDDFC', label: 'Tower Defense' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-069',
        title: 'Dirt Crown',
        description: "A dirt-track racing RPG in three.js with no asset files. Grandpa Gus pulls a tarp off his first racer, the Bucket: a tiny, primer-grey off-roader without a single feature. Win races for coins and bolt on parts that all show on the car (exhausts, a hood scoop, a supercharger, wings, bigger tyres on better rims, coil springs, a bull bar, a roll cage, a light bar, riveted armour and nitro bottles), across six upgrade lines and a paint shop with liveries and race numbers. Race in third person on 20 tracks in seven places: farm ovals on Dustwater Flats, misty logging roads in Pinecrest Woods, big jumps in Redrock Canyon at sunset, lantern-lit mud and water in Gatorback Bayou, snow and sheet ice on Frostbite Pass, stadium supercross under the Thunderdome's floodlights, and the Crown Run on Ravenwood Mesa, with figure eights that cross on bridges. Sliding dirt physics, drifts that fill your nitro, tabletops, kickers and whoops, mud, water, gravel, sand, ice and oil, slipstreams, and computer drivers that pass. 26 events (races, eliminations, time trials and duels), six champions to beat, and a story: Ravenwood Motors has bought every track in the county, and whoever wins the Dirt Crown sets the rules. Face your rival Colt Ravenwood in the ultimate race. Painted portraits, a county map, bloom and colour grading, a synthesised engine and score, autosave, keyboard, gamepad or touch.",
        icon: '\uD83C\uDFC1',
        folder: 'game-069',
        version: '1.0.1',
        cssClass: 'dirt-crown',
        genre: 'rpg',
        tags: [
            { emoji: '\uD83C\uDFCE\uFE0F', label: 'Racing' },
            { emoji: '\uD83D\uDD27', label: 'Upgrades' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-070',
        title: 'PHOSPHOR PATROL',
        description: "A 1982 vector-monitor planet-defence shooter in three.js with no asset files, in the spirit of Defender with Asteroids meteor storms and Galaga dart squadrons. The Reapers are harvesting the colony world Lumen: snatchers grab colonists and carry them up, and one that reaches the top of the sky becomes a ravager. Fly the SENTRY around a planet eight screens wide that wraps at its ends, with inertia, an instant turnaround, a long-range scanner, lasers, smart bombs and hyperspace. Shoot a snatcher to drop its colonist, catch them in the air and fly them down to the ground; lose every colonist and the planet explodes and you fight on in open space until it's rebuilt. Nine kinds of Reaper (snatchers, ravagers, minelayers and their mines, tumbling wireframe hives that burst into stingers, hunters that come if you dawdle, diving dart squadrons and meteors that split in two), fifteen attack waves per loop and three bosses: the Harvester, a ring saucer with a tractor beam; the Leviathan, a segmented serpent; and the Overseer, an eye in a cage of shield plates with a sweeping beam. Everything is drawn as glowing beams by one instanced shader, with phosphor persistence, bloom and curved glass; explosions throw the destroyed shape's own lines at the screen. A thump-thump heartbeat that speeds up as the wave goes on, attract mode with a bot demo, high scores with initials, CADET and ARCADE modes, continues, endless loops, gamepads and a touch deck with a flight stick.",
        icon: '\uD83D\uDE80',
        folder: 'game-070',
        version: '1.0.0',
        cssClass: 'phosphor-patrol',
        genre: 'arcade',
        tags: [
            { emoji: '\uD83D\uDD79\uFE0F', label: 'Arcade' },
            { emoji: '\u2728', label: 'Vector' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-071',
        title: 'FROSTMARCH',
        description: "An open-world fantasy RPG in three.js with no asset files: Saga of the Stormsworn. A courier carrying a sealed letter reaches Hollowmere Keep on the night the dead walk out of the barrows and a black dragon splits the sky; struck by its lightning, you live, scarred with the shapes of the storm. Explore a frozen province three kilometres across, with five towns, villages, forts, barrows, caves, mines, clockwork ruins, totems and sigil stones, under a sky with weather, auroras and a full day and night. Trace the Storm Sigils (gale, stride, embers, rime, earthbind, stillness, veil) with rings learned from the stones, and absorb the embers of the dragons you kill. Fight with swords, axes, maces, bows, shields and four schools of magic; sneak, pick locks and pockets; forge, hone, smelt and tan; brew potions by discovering ingredients; inscribe runes with creature essences. Eleven main quests to the Eye of the Storm with a choice on Hrimgard's summit, guild lines for the Hunters' Lodge, the Frostspire Academy and the Lampless, town quests, bounties, a house to buy, followers, guards and fines, fast travel, books to read. Twenty-one generated dungeon levels with traps, star-dial puzzles and bosses. Skinned procedural characters, beasts and dragons, PBR terrain, water, grass and forests, bloom and god rays; a synthesised score and ambience; saves, keyboard, gamepad or touch.",
        icon: '\uD83D\uDC09',
        folder: 'game-071',
        version: '1.0.4',
        cssClass: 'frostmarch',
        genre: 'rpg',
        tags: [
            { emoji: '\u2694\uFE0F', label: 'Open world' },
            { emoji: '\uD83D\uDC09', label: 'Dragons' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    }
];

export default games;
