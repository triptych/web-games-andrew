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
        version: '1.0.6',
        cssClass: 'frostmarch',
        genre: 'rpg',
        tags: [
            { emoji: '\u2694\uFE0F', label: 'Open world' },
            { emoji: '\uD83D\uDC09', label: 'Dragons' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-072',
        title: 'Frosty Fling',
        description: "A Christmas launch arcade game in vanilla HTML, CSS and JavaScript with Three.js r128. Build a procedural snowman, pull back the slingshot and fling through a toy-box winter village, timing the power needle for a perfect launch. Slam mid-air, bounce through gifts and candy canes, chase distance and coins, buy upgrades, and drop into Snowball Bonanza bonus rounds with arrow-key, drag or touch controls. Procedural snowman forms, props, characters, sky, aurora, mountains, biomes, particles, synthesized audio, pause, upgrades, saves and phone-friendly input are bundled into a single playable HTML file, with the readable source kept in src/.",
        icon: '\u26C4',
        folder: 'game-072',
        version: '1.0.0',
        cssClass: 'frosty-fling',
        genre: 'arcade',
        tags: [
            { emoji: '\u26C4', label: 'Snowman' },
            { emoji: '\uD83C\uDF84', label: 'Christmas' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-073',
        title: 'RUNEBORE',
        description: "A high-fantasy Motherload-style digging game in three.js with no asset files: The Delve of Old Thimble. In the hill-town of Emberwick you inherit your vanished grandmother's digging automaton, a brass barrel on treads with an auger for a nose and a cracked rune-core for a heart. Drill down through six strata (the Rootloam, the Greystone Halls, the Glimmerdeep, sunken Kharadun, the Emberdeep and the Gloam), manage aether and hull, dodge bogwind, falling boulders, magma, heat and gloam-wisps, sell ore and finds, and upgrade seven lines at the Forge. Seven relics lie in dwarven vaults: each slots into Thimble's heartcore, wakes a power (ore-sight, featherfall, a faster auger, a bigger hold, heat immunity, self-repair, a star-iron lance) and restores a memory, until you learn who is really inside the automaton. An eleven-chapter story with painted portraits, a rival to rescue, Guild contracts, waystones, a codex, the Gloamwyrm to free at the root of the world and an ending you choose. Procedural tiles, models, music and sound; saves; keyboard, gamepad or touch.",
        icon: '\u26CF\uFE0F',
        folder: 'game-073',
        version: '1.0.3',
        cssClass: 'runebore',
        genre: 'story',
        tags: [
            { emoji: '\u26CF\uFE0F', label: 'Digging' },
            { emoji: '\uD83D\uDC8E', label: 'Relics' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-074',
        title: 'CINDERWING',
        description: "A side-scrolling shooter in three.js in the spirit of R-Type and Gradius, with no asset files: An Angel's Ascent from the Pit. When the war in Heaven ended, the last morning star fell into the Pit, and in the ashes a young angel with white wings opened his eyes. Guided by Vesper, a fallen angel in chains, Cael learns to fight his way up through seven circles of Hell to his true home. Win the Halo from the demons' reliquaries: it rides in front of you, swallows bullets and burns what it touches, and you can cast it ahead or call it home to your front or back. Hold to charge the Radiance beam, sing the Halo red, blue or gold, gather Wings, Echoes, Seeker Feathers and the Aegis, and break whole squadrons for their relics. Seven fixed, learnable circles (a lava sea, an orchard of bones, a weeping foundry, the drowned choir of the Styx, a living labyrinth, the frozen betrayal and the gate of dawn) with lava geysers, crushers, bone gates and flesh walls, and seven wardens from Gorrmaw to Malphas, Lord of the Pit. A staged 3D story between circles, three trials, checkpoints and continues. Procedural models, skies, terrain, shaders, bloom, music and sound; keyboard, gamepad or touch.",
        icon: '🕊️',
        folder: 'game-074',
        version: '1.0.1',
        cssClass: 'cinderwing',
        genre: 'arcade',
        tags: [
            { emoji: '🚀', label: 'Shmup' },
            { emoji: '👼', label: 'Angel' },
            { emoji: '🧊', label: 'three.js' }
        ]
    },
    {
        id: 'game-075',
        title: 'CHROME CHALICE',
        description: "Atari's Adventure (1979) remade as a 1988 synthwave coin-op, in vanilla JavaScript with no asset files: Quest of the Neon Square. CHROMAGON, a dragon of liquid metal, has stolen the Chrome Chalice that keeps the sun rising over the Grid, and SQUIRE, a square of light, must carry it home through six realms. Adventure's rules are all here: carry one thing at a time, held where you touched it; keys open castles; the sword slays dragons; the magnet pulls things through walls; the bridge crosses what you can't; a dragon that catches you swallows you whole; BYTE the bat swaps what it carries for what you hold; and somewhere there is a grey dot. A decade of arcade games is added on top: score, lives, credits, continues, high scores with initials and an attract mode with a bot-played demo; a sword slash and an invulnerable dash; six dragons with health, fire and ice breath, lunges and twin blinks; the lamp, the crystal shield and plasma charges; dark catacombs, data rivers, laser galleries, teleporters and cracked walls; THE NULL, a hole of static that hunts you through walls if you dawdle; chrome shards, a three-phase boss and a collapsing Citadel to escape. ARCADE and REMIX modes (every REMIX shuffle proved solvable by a planner), NOVICE and EXPERT skill, loops, a Sound Test unlocked by cassettes. The monitor sits in a lit arcade cabinet with a joystick that tilts as you play, in a dark arcade full of other glowing machines; the screen is pixel art at 3× with neon glow, through a hand-written WebGL CRT (curvature, scanlines, bloom, phosphor trails), and every note of the synthwave soundtrack is generated. Keyboard, gamepad, or the cabinet's own stick and buttons on a phone.",
        icon: '\uD83C\uDFC6',
        folder: 'game-075',
        version: '1.0.1',
        cssClass: 'chrome-chalice',
        genre: 'arcade',
        tags: [
            { emoji: '\uD83D\uDC09', label: 'Dragons' },
            { emoji: '\uD83D\uDD79\uFE0F', label: 'Arcade' },
            { emoji: '\uD83C\uDF05', label: 'Synthwave' }
        ]
    },
    {
        id: 'game-076',
        title: 'TALEWRIGHT',
        description: "An RPG maker that is also a game, in vanilla HTML, CSS and JavaScript with no asset files: The Atelier of Unwritten Worlds. You are the new apprentice in the workshop where every story was once drafted, and a grey nothing called the Blot has smudged its tools away. Quillon, an old enchanted quill, and Mott, an ink-moth who lives in the lamp, restore them chapter by chapter as you use them on your own project: a pencil and a meadow, then events and Show Text, items and chests, more maps and doors, choices, switches and variables, battles, shops and companions, cutscenes, wandering NPCs, music and the Sprite Forge, and finally the Glyph of Binding, which exports your game as one HTML file that runs anywhere. It is a real editor: a layered tile map with pencil, rectangle, fill, eraser and eyedropper; ten generated tilesets; an RPG Maker-style event editor with pages, conditions, triggers, movement and 27 commands in a branching tree; a Database of heroes, items, skills, enemies, troops, switches and system settings; quick templates; playtest from anywhere; undo, autosave, download and import. Quests check your real project and what really happens in playtests; you earn Ink, twenty Maker Ranks and forty trophies, and spend Ink at Mott's Emporium on tilesets, monster packs, songs, window skins, Atelier themes and a hat for Quillon. The runtime plays front-view battles, menus, shops and saves, and ships with a sample game, The Lantern of Fernhollow. Story Mode or Free Mode; mouse, keyboard or touch.",
        icon: '\u2712\uFE0F',
        folder: 'game-076',
        version: '1.0.0',
        cssClass: 'talewright',
        genre: 'rpg',
        tags: [
            { emoji: '\uD83D\uDEE0\uFE0F', label: 'Game maker' },
            { emoji: '\uD83D\uDCDC', label: 'Story' },
            { emoji: '\uD83C\uDFF0', label: 'RPG' }
        ]
    },
    {
        id: 'game-077',
        title: 'CUE VICE',
        description: "Metal Gear on a pool table, in three.js with no asset files: Miami, 1986. Detective Rico Vega's partner died on a bust somebody sold out, and the trail runs from a Coconut Grove marina to a kingpin called the Shark. Every member of the squad is a round, rolling character: pull back and let go like a cue, and they slide, bank off walls, rebound off neon bumpers and clack into each other with real billiard physics. Time only moves while something rolls, so every shot is also a turn against the patrols. Guards have ray-cast vision cones, suspicion, noise and Metal Gear-style alarm phases (alert, evasion, caution); hit one from behind and he goes down, bank first for style, bowl him into another for a combo, and sink him in the bay or a manhole before his friends find the body. Recruit seven teammates with their own billiard tricks: Rico's second shot, Lola's banking tranquilliser darts, Doc's healing touch, Dex's explosions, Jinx's ghost mode and hacking, Big Tito's three-times-the-mass wrecking ball and Roxy's boombox that makes guards dance. Ten episodes (a marina, a nightclub, a hospital escort where the witness is the object ball, a chop shop, a TV station, the port, a Star Island mansion with a boss in the pool, your own precinct with no alarms allowed, a causeway in live traffic and the Shark's island in a hurricane), a story told over a synthwave causeway with painted portraits and radio chatter, grades, Vice Tapes, a Garage of upgrades and VHS Instant Replay. Procedural characters, cars, palms, neon signs, a synthwave soundtrack and sound; mouse, keyboard, gamepad or touch.",
        icon: '\uD83C\uDFB1',
        folder: 'game-077',
        version: '1.0.1',
        cssClass: 'cue-vice',
        genre: 'story',
        tags: [
            { emoji: '\uD83C\uDFB1', label: 'Billiards' },
            { emoji: '\uD83D\uDD75\uFE0F', label: 'Stealth' },
            { emoji: '\uD83C\uDF34', label: 'Miami 1986' }
        ]
    },
    {
        id: 'game-078',
        title: 'Sugarplum Drop',
        description: "A cozy Christmas merge puzzle with physics, in vanilla JavaScript and Canvas 2D with no asset files. Drop small candies into a glass jar on a snowy night: when two of the same treat touch, they merge into the next one up, and the new one is checked again, so one drop can set off a whole cascade. Peppermints become gumdrops, lollipops and truffles, then gingerbread men, holly wreaths, ornaments, presents, snow globes, gingerbread houses and finally the golden Jingle Bell; two Jingle Bells make a Christmas Miracle. Treats roll, tumble and stack with real disc physics; merges in quick succession make chains; let the pile sit over the candy-cane line for three seconds and the jar is full. An aim guide, a merge ladder that lights up as you go, a bot playing a demo behind the title, saves and a best score, falling snow and twinkling lights, and a music box playing Jingle Bells and We Wish You a Merry Christmas. Every treat, sparkle and note is generated in code; mouse, touch, keyboard or gamepad.",
        icon: '\uD83C\uDF6C',
        folder: 'game-078',
        version: '1.0.0',
        cssClass: 'sugarplum-drop',
        genre: 'puzzle',
        tags: [
            { emoji: '\uD83C\uDF6D', label: 'Merge puzzle' },
            { emoji: '\uD83C\uDF84', label: 'Christmas' },
            { emoji: '\uD83D\uDD8C\uFE0F', label: 'Canvas 2D' }
        ]
    },
    {
        id: 'game-079',
        title: 'VENDETTA OVERDRIVE',
        description: "An 80s action-movie revenge shooter in the spirit of Duke Nukem 3D, in three.js with no asset files. Neo Angeles, 1987: the Xerxid Hegemony burned the Sunset Strip, and Colonel Jack \"Ironjaw\" Kane died holding it. His daughter Roxy picks up his shotgun and goes through every alien between her and the mothership to find out who killed him. Five procedurally generated levels (neon city streets, a dead shopping mall, hive sewers, the mothership and the brain core) with keycard doors, ambushes and three bosses. Every gun is rolled from a seed: seven archetypes from hand cannons to disc slingers and tesla coils, five makers, rarities from Common to Legendary, parts and fire, shock, cryo and acid elements, with a stat card to compare and a loot beam on the floor. Kick, pipe bombs, a jetpack, combos and one-liners, and a Fury bar for OVERDRIVE: eight seconds of slow motion in which every kill heals you. Fifteen VHS tapes tell the story of what really happened to Jack. Procedural GLSL textures, baked neon lighting, bloom and a VHS filter, gibs that bounce, and a synthwave score; mouse and keyboard, gamepad or touch.",
        icon: '\uD83D\uDCA5',
        folder: 'game-079',
        version: '1.0.2',
        cssClass: 'vendetta-overdrive',
        genre: 'arcade',
        tags: [
            { emoji: '\uD83D\uDD2B', label: 'FPS' },
            { emoji: '\uD83C\uDF06', label: '80s action' },
            { emoji: '\uD83C\uDFB2', label: 'Procedural guns' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-080',
        title: 'EMBERLEAF',
        description: "A cozy top-down adventure in vanilla Canvas 2D with no asset files. You are Vellumvale's new magical librarian, and the Lantern Library is empty: its twelve grimoires fled the night it fell and ran a little wild. With Wick, the fire sprite who lives in the hearth, walk a kingdom of 63 hand-planned regions (farms and woods, a castle town, misty moors, snowy peaks, a fishing port, a mouse village, a lake with a sunken archive and floating sky isles), calm the runaway books in gentle turn-based squabbles where nothing is ever hurt and every foe turns back into a book for your shelves, and bring the grimoires home. Each one lends you a power that opens a new part of the world, Metroid-style: light for dark caves, wind for fog, warmth for brambles, frost for rivers, swimming, shrinking through mouse doors, vines up cliffs, words for ghostly gates and rune seals, floating over chasms. Twelve dungeons with guardians, shops and inns, eighty people with side quests and overdue books, 48 books to reshelve, and a library that wakes up lamp by lamp as Wick remembers who she used to be.",
        icon: '\uD83D\uDD6F\uFE0F',
        folder: 'game-080',
        version: '1.2.1',
        cssClass: 'emberleaf',
        genre: 'cozy',
        tags: [
            { emoji: '\uD83D\uDCDA', label: 'Cozy adventure' },
            { emoji: '\uD83D\uDDDD\uFE0F', label: 'Metroidvania' },
            { emoji: '\uD83D\uDD25', label: 'Gentle battles' },
            { emoji: '\uD83D\uDD8C\uFE0F', label: 'Canvas 2D' }
        ]
    },
    {
        id: 'game-081',
        title: 'Salve & Scale',
        description: "A first-person monster-healer adventure in three.js with no asset files. You run the Lantern Clinic in Gloamhollow, the kingdom under the hills: walk the clinic, greet goblins with thorns in their feet, slimes with curdled cores and skeletons with hexes carved on their ribs, send them to the exam table and look inside them through the Lumen Lens. Treatment is a puzzle with Bumble Basket's trail rules: the patient's silhouette fills with glowing afflictions, and you drag a trail where every hop shares something you can sense — the same form, aura, depth or nature — to purge venoms, mend wounds, dispel hexes and soothe blights before your Focus runs out. Each act teaches a new sense. Between clinic days you ride out on emergency calls to a bramble-choked forest hollow, a drowned crypt, a dragon's forge and the Overlord's citadel, treating monsters where they fell, disarming the traps of the Gilded Company and gathering the evidence of what they've done. The Overlord isn't evil: he is sick, and the last patient is Grimwald himself, three boards deep in adventurer-made madness. Fourteen species built in code with physical materials, shell fur and an X-ray shader, a skill tree of fifteen nodes, remedies, relics and clinic upgrades, a mimic receptionist, a skeleton nurse, a wisp who lives in the Lens, and a soundtrack sequenced in code.",
        icon: '\u2695\uFE0F',
        folder: 'game-081',
        version: '1.0.4',
        cssClass: 'salve-and-scale',
        genre: 'rpg',
        tags: [
            { emoji: '\uD83E\uDE7A', label: 'Monster healer' },
            { emoji: '\uD83E\uDDE9', label: 'Trail puzzle' },
            { emoji: '\uD83D\uDEB6', label: 'First person' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-082',
        title: 'BUBBLE NEBULA',
        description: "Bubble Bobble in space, in three.js with no asset files. The Void Baron, a round purple villain in a top hat and monocle, has bottled every star in the Bubble Nebula, and Pip, a baby star-dragon in a fishbowl helmet, climbs his station one sector at a time to get them back. Blow bubbles to trap his crew (wind-up Blips, springy Sparks, see-through Gloopers, Grunts with blasters, Comet Moths and little Saucers), then pop them to send them spinning off as loot; bubbles touching each other pop together and every enemy in a chain doubles the prize, from Star Candy up to a 64,000-point Singularity. Jump up through platforms, bounce on bubbles, fall out of the floor and drop back in from the ceiling. Trapped enemies break out angry, HURRY UP! brings the Void Wraith through the walls, zap bubbles fire lightning, nova bubbles set the floor alight, N-E-B-U-L-A letter bubbles give an extra life and skip a sector, and six power-ups include Rocket Boots, a Stasis Clock and a Wormhole. 24 sectors in five neon zones, each scrolling up into the next, then the Baron's Core, where only homing lightning can hurt him. A painted nebula, thin-film bubbles, a bouncy chiptune score that speeds up when you dawdle, a bot playing a demo behind the title, continues and a high-score table; keyboard, gamepad or touch.",
        icon: '\uD83E\uDEE7',
        folder: 'game-082',
        version: '1.0.0',
        cssClass: 'bubble-nebula',
        genre: 'arcade',
        tags: [
            { emoji: '\uD83E\uDEE7', label: 'Bubble Bobble' },
            { emoji: '\uD83C\uDF0C', label: 'Space' },
            { emoji: '\uD83D\uDC7E', label: 'Arcade platformer' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-083',
        title: 'WYRMZONE',
        description: "A dragon who has lost its wings walks home through a kingdom at war with dragons, in the vector graphics of 1980s arcades, in three.js with no asset files. The first half is Battlezone on foot: a green wireframe plain seen through the dragon's eyes, jagged mountains and the smoking volcano of home on the horizon, a radar with a sweep, ENEMY IN RANGE, standing stones and ruins to hide behind. Breathe fireballs at footmen with spears, ballistae that hunt you like tanks, lancers charging in a zig-zag, wizards who teleport and cast homing orbs, three-hit trolls, war wagons and a will-o-wisp worth 5000, over four marches to the Dragonbane, a siege tower with a giant crossbow that holds the ward on your wings. Break it and the camera rises off the plain: the second half is Star Wars on the wing, in colour, with a targeting cross that fire converges on and that the dragon steers by. Bring down griffon knights and their firebolts in the open sky, burn the crystals on the mage towers over the ramparts, and fly the Gorge of Chains, climbing and diving under bridges, to shoot the ward stone at its end and fly home; then round the kingdom again, fiercer. Phosphor trails and curved glass, a periscope view on a portrait phone, procedural sound with a war march and a soaring flight theme, saves and continues; keyboard, mouse, gamepad or touch.",
        icon: '\uD83D\uDC09',
        folder: 'game-083',
        version: '1.1.1',
        cssClass: 'wyrmzone',
        genre: 'arcade',
        tags: [
            { emoji: '\uD83D\uDC09', label: 'Dragon' },
            { emoji: '\uD83D\uDCE1', label: 'Battlezone' },
            { emoji: '\u2728', label: 'Vector' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-084',
        title: 'ROMANCER',
        description: "A game about making games, in three.js with no asset files. Tycho Station, the Moon, 3126: nobody makes games any more, because the Stream generates them, and a salvage crate from Old Earth holds the VESTA-8, an 8-bit console from 1983, with nine cartridges. Eight are corrupted toy versions of games that made history: RALLY after Pong, BRICKBREAK after Breakout, INVASION after Space Invaders, MAZE MUNCH after Pac-Man, ROAD HOP after Frogger, GIRDER CLIMB after Donkey Kong, SCROLL RUN after Super Mario Bros. and DUNGEON KEY after Zelda. As the Lumen Institute's new researcher you repair each one on the Workbench with the console's own tools: a pixel editor, a level maker with layers of levels, an object inspector with a dozen movement presets, VESTA SCRIPT (a small Lua-like language with event handlers), a sound designer and a three-voice music tracker. Then you play it on a curved, glowing CRT in a moonlit lab. Every restored cartridge gives VESTA back a memory and a piece of its hardware: colours, the sound chip, music, scrolling maps, more levels. The ninth cartridge is handwritten and empty, so the last game is yours. The Studio is the same toolkit with no checklist: make any 2D game, save and load cart files, and export it as one HTML file that plays anywhere, offline. A story with a dry curator, a console that talks in capitals and a Stream auditor, fourteen commendations, and bots that prove every cartridge winnable.",
        icon: '\uD83D\uDCFC',
        folder: 'game-084',
        version: '1.0.1',
        cssClass: 'romancer',
        genre: 'story',
        tags: [
            { emoji: '\uD83D\uDEE0\uFE0F', label: 'Game maker' },
            { emoji: '\uD83D\uDD79\uFE0F', label: 'Gaming history' },
            { emoji: '\uD83D\uDCFA', label: 'Retro-futurist' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-085',
        title: 'WanderQuest',
        description: "An idle caravan RPG for phones, in vanilla Canvas 2D with no asset files. Your grandmother's wagon carries the last lit lantern in a realm whose Waystones went dark, and it drives itself: from town to town along a pseudo-3D road that curves and climbs to the horizon, trading goods whose prices rise and fall with what you buy and sell, fighting wolves, sand raiders, bog trolls, yetis and hollow knights in auto-battles staged on the verge beside the wagons, resting at inns, camping by the road and taking quests from notice boards, all while the game is closed. Come back each day to a chronicle of what happened, open the morning post, and spend what the road earned. Take on travellers who bring carts of their own: a Cook turns meat into rations, a Smith forges gear, an Alchemist brews potions, a Healer patches the party up, a Trader haggles, a Scout finds caches and a Bard plays every town for coin. Level the caravan for room and better carts, upgrade the wagon's wheels, hold, larder, banner and the Great Lantern that keeps it travelling while you're away, set standing orders or a course on the map, and challenge the six Wardens to light the Waystones, from the Thornback at Thistlecross to the Hollow King at Starhaven. A scrapbook of taped polaroids keeps everyone you've met, every monster and Warden, every piece of gear, every town and every road driven. Letters from Grandmother Odessa, day and night, six regions with their own weather, a plucked travelling tune, and the endless Night Roads after the ending.",
        icon: '\uD83D\uDC02',
        folder: 'game-085',
        version: '1.3.0',
        cssClass: 'wanderquest',
        genre: 'rpg',
        tags: [
            { emoji: '\uD83C\uDFEE', label: 'Idle' },
            { emoji: '\uD83D\uDC02', label: 'Caravan RPG' },
            { emoji: '\u2696\uFE0F', label: 'Trading' },
            { emoji: '\uD83C\uDFA8', label: 'Canvas 2D' }
        ]
    },
    {
        id: 'game-086',
        title: 'Colorverse',
        description: "A pixel colour-by-number adventure for phones and desktops, in vanilla Canvas 2D with no asset files. The Grey Hush has washed five little worlds to grey: zoom in until you can see every pixel's number, pick a colour, and tap or drag to paint them back. Pinch, scroll or drag with two fingers to move around mosaics from 16×16 to 56×56. Sail the Prism, a lighthouse that learned to sail, through The Lighthouse Ship, Moonberry Grove, Starship Sprout and Cloudtop Castle, meeting Wick the lamplighter, Mira the very purple dragon, Captain Fern, Bolt the gardener and Lady Aurelle, until you finally meet the Hush itself. Then Book Two, The Far Shore, sails off the edge of the chart: a reef of lantern jellies, a volcano that bakes bread, a tundra under the northern lights, a clockwork carnival, and the Blank Page where the Hush began, ending in a 56×56 finale. 35 mosaics in all. Every pixel leaves Glimmer to spend in the Constellation, a skill tree of 21 stars: wider smart brushes, Paint Pour, Starburst and Supernova, a Seeker Wisp, Lantern Light for the last few pixels, a Star Map, True Hand, Final Flourish, streaks, a Gilded Frame, a Freestyle Studio to repaint anything, time-lapse replays and six bonus pages. Saves as you go; share your mosaics as crisp PNGs.",
        icon: '🎨',
        folder: 'game-086',
        version: '2.1.0',
        cssClass: 'colorverse',
        genre: 'cozy',
        tags: [
            { emoji: '🎨', label: 'Pixel Coloring' },
            { emoji: '📖', label: 'Story' },
            { emoji: '✨', label: 'Skill Tree' },
            { emoji: '📱', label: 'Touch & Zoom' }
        ]
    },
    {
        id: 'game-087',
        title: 'Quillsworn',
        description: "A storytellers’ guild RPG that is also a real tool for writing a fantasy novel, in vanilla JS with no asset files. You climb the stair to the Guild of the Quillsworn in the hill city of Vellmere, where every lamp is lit by a finished story and half of them have gone dark, and Master Thalion Silverquill, a handsome, six-hundred-year-old and slightly vain elf, takes you on as an apprentice. Choose a pen name, a sigil and a calling (Bard, Heartseer, Loremaster or Weaver), then walk the guild’s twelve-quest road from the Spark to the Last Page: found your novel in the Charter, write in the Scriptorium (chapters, scenes, a parchment page, word counts, drafts, find and replace), flesh out your cast in the Hall of Faces, shape the plot on the Loom (six structures, from the Hero’s Journey to Kishōtenketsu, and threads woven across chapters), build the world and pin it on a generated parchment map in the Cartographer’s Loft, and draw names, twists, magic systems and prophecies from the Muse’s Well. Every new word is experience: level up through nine guild ranks, raise five attributes, spend points on twenty talents (the Scribe’s Lens reads your prose for adverbs, echoes, clichés and rhythm), wear relics, and win ink duels, timed sprints against the Procrastination Imp, the Wraith of the Blank Page, the Mire-Hydra of the Sagging Middle and the Inner Critic. Thirty-nine lessons of craft in Thalion’s voice, daily bounties, side quests, laurels and a finale for your finished book; then bind it in the Bindery as a web page, an EPUB or a print-ready PDF, with drop caps, a map plate, a Dramatis Personae and a glossary. Saves as you write.",
        icon: '🪶',
        folder: 'game-087',
        version: '1.0.0',
        cssClass: 'quillsworn',
        genre: 'story',
        tags: [
            { emoji: '✍️', label: 'Novel writing' },
            { emoji: '🧝', label: 'Fantasy RPG' },
            { emoji: '📚', label: 'EPUB & PDF' },
            { emoji: '🎨', label: 'Vanilla JS' }
        ]
    },
    {
        id: 'game-088',
        title: 'Curio Cove',
        description: "A cozy match-3 museum game in three.js with no asset files. Fresh from university, you inherit your great-aunt Marigold's tumbledown seaside museum on Puffin Isle (she has sailed off round the world), and you fill it by digging: every level is a dig at the site on the hill, where you swap amphorae, gold coins, leaf fossils, ammonites, amethysts and bones to dig away dirt, uncover fossils, crack boulders, break crusted sand and lift relics out. Line up four for a Trowel, an L for a Pickaxe, a square for a Scarab that flies to where it is needed, five for a Sunstone, and swap two specials together for combos. Every first win turns up a find for the collection (60 in all, from a fisherman's jug and a golden mask to a megalodon tooth) or a dinosaur bone, and stars pay for restoring the halls one cozy scene at a time: hire Moss the badger caretaker and his mop Duchess, Penny Quill the owl administrator, Tobias Ledger the tortoise accountant, Kit the fox tour guide and Rosa the raccoon restorer, stand up a Triceratops, a Plesiosaur and a Tyrannosaurus, and open the doors for the Grand Reopening. 60 story digs in five chapters, endless Night Digs, a till that fills while you are away, decorations for the island, and a 3D island with a wave shader, wandering visitors, bloom, particles, beams and procedural music.",
        icon: '🦴',
        folder: 'game-088',
        version: '1.1.3',
        cssClass: 'curio-cove',
        genre: 'puzzle',
        tags: [
            { emoji: '💎', label: 'Match-3' },
            { emoji: '🏛️', label: 'Cozy museum' },
            { emoji: '🦕', label: 'Dinosaurs' },
            { emoji: '🧊', label: 'three.js' }
        ]
    },
    {
        id: 'game-089',
        title: 'Dragonroll',
        description: "A 3D board game RPG in three.js with no asset files: Monopoly meets Final Fantasy. Pyrrhax the Ember Wyrm sleeps in the crater of Mount Ember, and when the laps run out he wakes. Pick a Knight, a Ranger or a Mage, then roll the dice round Emberwyld Isle, a cel-shaded island board of forty tiles across sunny Meadowvale, mushroom-lit Whisperwood, the white sands of Glimmer Coast and snowy Frostfang Peaks. Encounters and wandering monsters swirl into turn-based battles in the Final Fantasy style, with a turn-order bar, skills, items, elemental weaknesses and a Valor gauge for big Bursts. Stop at towns to shop, rest, forge gear from monster materials and hire companions (Pip the halfling cleric, Sylva the elven archer, Captain Bram the pirate and Grumli the dwarf rune-smith); raid four dungeons whose bosses guard the Dragonbane Shards; buy and upgrade deeds so the rival adventurers Baron Goldbuckle and Mirabel Moonshade pay you tolls; draw Fate cards, open chests (mind the mimics), and use the Shrine, the Fountain of Fortune and the Wyrm Portal. Twenty monsters, four bosses, thirteen forge recipes, a two-phase dragon fight in his crater, toon outlines, bloom, a battle swirl, and seven original tunes. Three game lengths, Auto battle, saves as you go.",
        icon: '🐉',
        folder: 'game-089',
        version: '1.0.0',
        cssClass: 'dragonroll',
        genre: 'rpg',
        tags: [
            { emoji: '🎲', label: 'Board game' },
            { emoji: '⚔️', label: 'Turn-based RPG' },
            { emoji: '🐉', label: 'Dragon slaying' },
            { emoji: '🧊', label: 'three.js' }
        ]
    },
    {
        id: 'game-090',
        title: 'Verdant Protocol',
        description: "A press-turn RPG of recoding corrupted daemons in a healing, post-apocalyptic world, in three.js with a PS2-style look and no asset files. Two hundred years after Meridian, the machine that ran the world's weather and magic, went wrong, the earth is quietly healing and you are a Warden with a Grafter that can talk a corrupted Hex back into a loyal daemon. Explore six generated zones in real time (strike a Hex first for an ambush), then fight Shin Megami Tensei-style Press Turn battles: hit a weakness and act again, knock every foe down for an All-Out Attack. Recode Hexes through eight personalities and four scripts, splice your daemons in the Greenhouse across eight races with skill inheritance, follow the moon's tide, deepen Bonds with Wren, Marshal Dov, Ilsa, Maple and Quill, and choose what Meridian becomes: Reboot, Purge or Graft. Fifty-six daemons, seven guardians, a hundred skills, a Hex Rift to farm, twelve original tunes, a custom dither-and-glitch post chain and a touch-friendly angular UI.",
        icon: '🌿',
        folder: 'game-090',
        version: '1.0.0',
        cssClass: 'verdant-protocol',
        genre: 'rpg',
        tags: [
            { emoji: '⚔️', label: 'Press Turn RPG' },
            { emoji: '🧬', label: 'Recode & splice' },
            { emoji: '🌱', label: 'Post-apocalypse' },
            { emoji: '🧊', label: 'three.js' }
        ]
    },
    {
        id: 'game-091',
        title: 'STARSPIN',
        description: "A space fantasy slot machine roguelike in three.js with custom shaders and no asset files. The House, a casino station at the end of space, has stolen the stars, and your ship's weapon is the Fortune Engine: a chrome one-armed bandit whose every payline symbol fires. SPIN, then spend Energy to nudge a reel up or down or respin it, watching the symbols just off the line, then FIRE: Starblades strike your target, Comets hit everything, Hex Moons burn, Aegis blocks, Nova Mend repairs and Ion Charge powers your next turn, and matching symbols multiply each other up to five of a kind. Enemies show their intents Slay the Spire style and jam Static into your reels. After every win add a symbol to every reel (your reels are your deck) and light a star on the Constellation, a generated skill tree shaped like a Slay the Spire map where each star must join the last, with keystones such as Extra Reel, Jackpot Core and Twin Suns. Three sectors, Waystations and three bosses: Croupier Δ, the Nebula Wyrm and The House. An outrun sky shader with a striped sun and neon grid, shader-drawn reels that blur and land, hologram enemies, bloom and a CRT pass, and synthwave music for every sector.",
        icon: '🎰',
        folder: 'game-091',
        version: '1.0.0',
        cssClass: 'starspin',
        genre: 'strategy',
        tags: [
            { emoji: '🎰', label: 'Slot machine RPG' },
            { emoji: '✨', label: 'Skill constellation' },
            { emoji: '🌆', label: 'Retro-futurist' },
            { emoji: '🧊', label: 'three.js' }
        ]
    },
    {
        id: 'game-092',
        title: 'NEONFALL',
        description: "An 80s synthwave remake of Pitfall!, the Atari 2600 jungle run, in vanilla JavaScript on Canvas 2D with no asset files. You have 20 minutes, three lives and a ring of 96 jungle screens to find 24 treasures: money bags, silver and gold bars, diamond rings. Run, leap rolling logs, cobras and fire, swing across tar pits and quicksand on a vine (jump into the rope, jump again to let go), step across crocodiles only while their jaws are shut, and drop down ladders into the tunnels, where every screen you cross is three on the surface and brick walls say otherwise. Logs cost points and a stumble; everything else costs a life. Treasure in a row builds a streak bonus and every sixth gives an extra life. The juice: a striped outrun sun, wireframe mountains and a neon grid behind palm silhouettes, a hand-written WebGL CRT with phosphor trails, bloom and scanlines, afterimages on every swing, screen shake and hit-stop, sparks and rings on every pick-up, and a generated synthwave score that goes underground behind a wall and speeds up when time runs low. A bot that plans by running the real sim forward plays the title screen's demo and proves all 96 screens crossable in both directions.",
        icon: '🌴',
        folder: 'game-092',
        version: '1.0.0',
        cssClass: 'neonfall',
        genre: 'arcade',
        tags: [
            { emoji: '🌴', label: 'Jungle platformer' },
            { emoji: '🐊', label: 'Vines & crocodiles' },
            { emoji: '🌆', label: 'Synthwave' },
            { emoji: '🎨', label: 'Canvas 2D' }
        ]
    },
    {
        id: 'game-093',
        title: 'Dawnshard Saga',
        description: "An HD-2D fantasy JRPG in the style of Octopath Traveler and Final Fantasy, built in three.js with no asset files: pixel-art heroes and monsters stand in a real 3D diorama with tilt-shift depth of field, bloom, a day and night cycle, lamps, water, lava and drifting fireflies. The Dawn Crystal has shattered and the sun has stopped rising. Walk a seamless overmap of grasslands, forests, mountain passes, desert and ice from Emberfield to the Obsidian Spire, with five generated towns (a notice board of procedural quests, an inn, shops, a smithy and villagers who carry three-part storylines that change with every new game) and seven dungeons with visible monsters, chests that need Mira's lockpicks, cracked walls that need Brom's hammer and save crystals. Eight heroes join the party, each with a class, a weapon and a skill list of their own. Battles are turn based with shields and hidden weaknesses: strike them to Break a foe, save Boost Points to hit harder or more often, cancel a boss's charged move with a Break, steal, analyze and cover for each other, all with hit-stop, camera shots, impact flashes, elemental effects and floating numbers. A procedural score, a typewriter dialogue box, an epic story with a real choice at the end, a bot that plays the whole game headlessly to balance it, and a touch deck for phones.",
        icon: '⚔️',
        folder: 'game-093',
        version: '1.0.0',
        cssClass: 'dawnshard-saga',
        genre: 'rpg',
        tags: [
            { emoji: '⚔️', label: 'JRPG' },
            { emoji: '✨', label: 'HD-2D' },
            { emoji: '🗺️', label: 'Overmap & towns' },
            { emoji: '🧊', label: 'three.js' }
        ]
    },
    {
        id: 'game-094',
        title: 'The Long Helix',
        description: "A text adventure for a Hercules monochrome card, in vanilla JavaScript with no asset files. You are Dr. Alix Navarro, the only geneticist left at Halcyon Outpost on the planet Vesper, sixty-one light-years from help, and the sequencer has just told you that every living thing on the planet shares one genome. Read each passage as it types out to the clack of a keyboard, look at the 1-bit dithered picture drawn line by line to the chatter of a floppy drive, and pick from numbered choices. Check your character sheet (four attributes, health, clarity, and a genome-decoded meter for the mystery), manage a six-slot pack that cannot hold everything the locker offers, roll 2d6 against your attributes, and keep a journal of what the valley is telling you across the Moss Flats, the Sump, the Chorus Ridge, the Spires and the Lattice under them. Seven endings, from signing the Seed with your own hand to burning it, via a clock that ends the story on day 60 whether you have decided or not. Choose amber, green or paper-white phosphor, scanlines and flicker on or off, and how fast the typewriter goes. A bot that plays the whole story on every seed proves there is never a dead end.",
        icon: '🧬',
        folder: 'game-094',
        version: '1.0.0',
        cssClass: 'the-long-helix',
        genre: 'story',
        tags: [
            { emoji: '📟', label: 'Text adventure' },
            { emoji: '🧬', label: 'Genetics & mystery' },
            { emoji: '🖥️', label: 'Hercules monochrome' },
            { emoji: '🎨', label: 'DOM & Canvas 2D' }
        ]
    },
    {
        id: 'game-095',
        title: 'Hauntly Manor',
        description: "A lighthearted point-and-click Halloween mystery, drawn entirely in code with three.js. Four friends stay the night in a haunted house on Hollow Hill: Maya with her notebook, nervous Theo with his thermometer, June the artist, and Dev the joker. Doors slam, a music box tinkles by itself, something giggles. Raccoon, drafty pipes, a prankster... or something else? Search six cut-away dioramas (the foyer, parlor, kitchen, library, attic and ballroom, each built and textured by procedural code), tap things to look and take, carry items in your pack, combine ink with a quill, crack a pantry lock from three clues, pull books in the order a rhyme gives, play a lullaby on a music box, bake a cake, and collect evidence in your journal until you can name the culprit on the case board. The culprit is Winnie, a shy eleven-year-old ghost whose birthday party nobody came to a hundred and thirty years ago, and the last act is throwing it: cake, streamers, music and an invitation, then a talk with her where every choice is kind. Spooky but never scary, with no way to lose an item or get stuck; a hint button that gets clearer each time you ask; a shy little ghost hiding in every room; a seeded house that changes the key's hiding place, the codes, the books and the melody each game; a procedural music-box waltz; touch, mouse, keyboard and gamepad. A bot plays every seed to the end and proves there is never a dead end.",
        icon: '👻',
        folder: 'game-095',
        version: '1.0.0',
        cssClass: 'hauntly-manor',
        genre: 'story',
        tags: [
            { emoji: '🔍', label: 'Mystery' },
            { emoji: '🎃', label: 'Halloween' },
            { emoji: '👆', label: 'Point & click' },
            { emoji: '🧊', label: 'three.js' }
        ]
    },
    {
        id: 'game-096',
        title: 'Homeward Hop',
        description: "A whimsical 3D platformer in the spirit of Crash Bandicoot and Sly Cooper, drawn and scored entirely in code with three.js. Pinch is a budding-inventor hermit crab whose Shell Swap Day gadget went off with a bang and washed him away from Ma, Pa, little Dot and Granny Whelk. Hop home across five worlds and fourteen levels: Sunny Shallows, Coconut Cove, Rustwater Docks, Sandcastle Kingdom and Stormbreak Point, past fleas, starfish, coconut-throwing monkeys, cannons, armoured sand knights and a gull who loves anything shiny. Swap between five shells to change what Pinch can do: the Spiral Shell rolls and roll-jumps, the Coconut Shell blocks coconuts and cannonballs and sends them back, the Peach-Can Shell ground-pounds iron crates and big switches, the Sail Shell glides over wide gaps and rides bubble vents, and the Spring Shell squashes down for a towering boing. Smash crates, collect pearls, find three hidden found-things in every level, then build ten gadgets in Pinch's workshop (a Bottle-Cap Boater, Rubber-Band Boots, a Cork Lifebuoy, Sea-Glass Specs and more) and wear three at a time. Run from a grumpy wave toward the screen, fire yourself across a bay in barrels, cross crumbling sand, and beat three bosses, each only to be beaten by the shell its world just taught: Big Coco, Sir Sandy and Captain Squawk. Camera-relative controls with quarter-turn corners, coyote time and jump buffering, squash and stretch, toon shading with ink outlines, shadow blobs, a procedural sea, and a generative band in every world; touch, mouse, keyboard and gamepad. A bot follows the route the level builder proves is crossable and plays every level and every boss on every seed.",
        icon: '🦀',
        folder: 'game-096',
        version: '1.0.0',
        cssClass: 'homeward-hop',
        genre: 'arcade',
        tags: [
            { emoji: '🦀', label: '3D platformer' },
            { emoji: '🐚', label: 'Shell powers' },
            { emoji: '🛠️', label: 'Inventions' },
            { emoji: '🧊', label: 'three.js' }
        ]
    },
    {
        id: 'game-097',
        title: 'Hollow Gambit',
        description: "A gothic tactics RPG where chess meets Fire Emblem, drawn and scored entirely in code with three.js. Every piece in your party moves like a different chess piece, fairy chess included: a Rook slides, a Knight leaps, a Grasshopper vaults a piece and lands beyond it, a Cannon fires only over a screen, a Nightrider keeps riding a knight line, a Queen goes anywhere, and the Pawn of the roster can only creep forward and strike on the diagonal. Each of the sixteen pieces you can summon from the Hollow has its own movement, a special ability (heal, bolt, ward, rally, blink, hook, shove, swap, hex, hellfire, encore, drain, bulwark) and an elemental affinity (Ember, Thorn, Tide, with Umbra and Lumen locked in mutual enmity). Move onto an enemy and the board gives way to a Fire Emblem duel: a cut to a candlelit arena under a stained-glass rose window, with strike and counter, hit, crit and a follow-up for the faster piece, after a forecast that shows exactly what you are risking. The winner takes the square; a survivor drives the attacker back. Summon with soul shards (pity guarantees a 5-star every 40 pulls, duplicates raise a Bond), level your party, set the five who march, and fight six chapters from the Chapel Yard to the Vesper Throne across crypts of chasms, altars and walls, with bosses that hold their ground and two that join you when slain. Tap, click, keyboard or gamepad; a threat map and a movement diagram for every piece; and a bot that plays the whole campaign on every seed through the same brain the dead use.",
        icon: '♟️',
        folder: 'game-097',
        version: '1.0.0',
        cssClass: 'hollow-gambit',
        genre: 'strategy',
        tags: [
            { emoji: '♟️', label: 'Chess tactics' },
            { emoji: '⚔️', label: 'Duels' },
            { emoji: '🎲', label: 'Summoning' },
            { emoji: '🧊', label: 'three.js' }
        ]
    },
    {
        id: 'game-098',
        title: 'Wyrmbond',
        description: 'An Advance Wars-meets-dragon-raising tactics RPG, drawn and scored entirely in code with three.js in a bright painterly cartoon style. You are Kestrel, the last apprentice of the last free roost in the Skyreach Isles, where the Obsidian Empress has collared every dragon with the Chain. Choose your first egg, then fight across twelve chapters in four acts, from the hill-village of Emberfall over the Gale Coast, Mirewood and the Frostpeaks to the Obsidian Throne, with painted portraits and a full story told in scenes. Battles play like Advance Wars: a tiled map with terrain stars where fliers get no cover, villages and roosts you claim for income and healing, roosts you call reinforcements from with gold, an enemy that musters soldiers at its keeps, commander powers (your Wyrmsong grows with the story), and HP badges in tenths; every attack cuts to a close-up head-to-head fight on painted terrain islands, with element breath, crits and counters after a forecast. Wear a collared dragon down, stand Kestrel beside it and sing it free: it changes sides on the spot and joins your stable. Between battles, the roost: eggs hatch in incubators in real time, even while you are away, and warm faster when you tap them; feed and train your dragons, collect their hoard, shop the market, and breed adults to pass on genes and traits, with five hybrid species that only breeding can make. 22 procedural dragon species with skills, traits, genes and growth stages, endless generated Wild Hunts, generative music, touch, mouse, keyboard and gamepad, and a bot that plays the whole campaign on every seed.',
        icon: '🐉',
        folder: 'game-098',
        version: '1.0.0',
        cssClass: 'wyrmbond',
        genre: 'strategy',
        tags: [
            { emoji: '🐉', label: 'Dragon tactics' },
            { emoji: '🥚', label: 'Hatch & breed' },
            { emoji: '📖', label: 'Story campaign' },
            { emoji: '🧊', label: 'three.js' }
        ]
    },
    {
        id: 'game-099',
        title: 'Fablecart',
        description: 'A pocket fantasy console that is itself a retro game, and a fantasy RPG maker where you never write code. Power it on and you walk a little workshop as the Tinker: the Shelf holds your cartridges, the Stage is where you stick characters into scenes, the Press is where you make stickers, and the TV plays the cart. Stickers are alive: a Princess, a Knight, a Dragon, a Castle, a chest, a door, a goblin hut. Each carries a few rules, like when I touch a hero, hurt it, or every few seconds shoot a fireball if a hero is near, and nothing else tells them what to do, so a Princess, a Dragon and a Castle in one scene become a game by themselves. Rules are written as coloured blocks you drag or tap into a stack, with events, movement, fighting, effects, making and changing stickers, items, doors between up to four scenes, if/otherwise, loops and variables. Every built-in sticker is made of the same blocks, so you can open the Dragon and change its fireball, draw new stickers on a 12x12 grid in the console palette, watch them live on a test stage while you build, and share a whole cartridge as a text code. Comes with Dragon\'s Hoard, a two-scene adventure to play or remix. Pixel art, chiptune and everything else drawn in code on Canvas 2D; touch, mouse, keyboard and gamepad; and a bot that plays the starter cart at three skill levels.',
        icon: '🕹️',
        folder: 'game-099',
        version: '1.0.0',
        cssClass: 'fablecart',
        genre: 'rpg',
        tags: [
            { emoji: '🧩', label: 'Block scripting' },
            { emoji: '🎨', label: 'Game maker' },
            { emoji: '🐉', label: 'Living stickers' },
            { emoji: '🖼️', label: 'Canvas 2D' }
        ]
    },
    {
        id: 'game-100',
        title: 'Glitterball Groove',
        description: "A 70s disco party match-3 on a glowing CRT, in three.js with no asset files. Swap neighbouring tokens on a dance floor of glass tiles (records, mirrorballs, stars, hearts, daisies and gems, all built in code) while a giant mirrorball turns, spotlights sweep a sunburst wall and a chasing floor of lit tiles runs off to the horizon. It is real time: tokens fall and slide on the sim's own clock and you can keep swapping while the rest of the board is still moving, so fast hands make big combos. Line up four for a Funk Beam that clears a whole row or column, an L or T for a Boom Box, five for a Glitterball that wipes out a colour, and swap specials together for crosses, 5\u00d75 blasts and a cleared floor. Fill the groove meter for Disco Fever: double points, a rainbow room, specials raining down and the band modulating up a tone. Play Dance-Off against a 60-second clock that every special, level and Fever adds to, or Slow Jam's 30 relaxed moves, through five rooms from Sunset Strip to Hot Tub Funk. The whole picture, board and HUD and menus, is one low-res canvas inside a CRT tube with curvature, scanlines, aperture grille, bloom and glitches; the game opens like a console with a power screen, a BIOS boot, an arcade attract loop with demo play and a Hall of Fame, and takes three-letter initials. Two dancers in bell-bottoms boogie beside the menus, and a procedural funk band (four-on-the-floor kick, octave bass, wah guitar, electric piano, strings and brass, side-chain pumped) drives the dance floor's pulse. Mouse, touch, keyboard or gamepad; a bot plays it in the attract mode.",
        icon: '\uD83E\uDEA9',
        folder: 'game-100',
        version: '1.0.0',
        cssClass: 'glitterball-groove',
        genre: 'puzzle',
        tags: [
            { emoji: '\uD83E\uDEA9', label: 'Match-3' },
            { emoji: '\uD83D\uDD7A', label: '70s disco' },
            { emoji: '\uD83D\uDCFA', label: 'CRT arcade' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-101',
        title: 'PixelCrypt',
        description: "A first-person dungeon crawler in sixteen EGA colours, in three.js with no asset files: lead up to six adventurers one square at a time through a dungeon with no bottom. The 3D view is drawn the way a 1987 PC would have drawn it, a 320\u00d7200 picture whose every pixel is snapped to the EGA palette with an ordered dither, so torchlight falls off in checkerboards of grey. Every floor is generated (a maze with rooms, doors, loops, secret doors you have to search for, traps, springs, shrines, gathering points and strangers), every fifth floor ends in a named guardian, and the monsters (20 families, 17 variants, levels that lean on yours) and loot (weapons, armour, charms, potions, scrolls, wands, tomes and collectibles in five rarities, some of them cursed) have no ceiling. Fight Etrian-style rounds with six classes, find your way on an automap that fills in as you see, and keep a journal that counts everything you meet, beat, find, buy and sell. Back in town, a night square of eight buildings: the Item Shop, Weaponsmith, Magic Emporium, an Inn that rests and recruits, a Church that raises the fallen and lifts curses, a Tavern, and the Guild, where you can buy a stake in every shop to earn gold each day (even while the tab is closed) and a discount where it counts. Quests, a procedural chiptune score, touch and gamepad support, and a bot that plays the whole game. Deeper still: 18 unique artifacts with effects no generated item has (lifesteal, vorpal blows, thorns, a relic that drags you back from a killing blow), 52 achievements, an optional nine-chapter saga told by the Chronicler at the Guild with lore tablets in the walls and named guardians, 34 monster families, 16 floor themes in four layouts (mazes, caverns, great halls, warrens) with pitch-black floors, and battles staged in a hall built from the floor's own stone.",
        icon: '\uD83D\uDDDD\uFE0F',
        folder: 'game-101',
        version: '1.2.0',
        cssClass: 'pixelcrypt',
        genre: 'dungeon',
        tags: [
            { emoji: '\uD83D\uDDE1\uFE0F', label: 'Dungeon crawler' },
            { emoji: '\uD83D\uDFE6', label: 'EGA 16 colours' },
            { emoji: '\uD83D\uDCB0', label: 'Idle town' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-102',
        title: 'STARSLING',
        description: 'Angry Birds in a retro-futurist space sunset. Pull the sling back and fling asteroids at floating space stations to scrap every robot aboard. Rock, Iron, Ice and Nova asteroids each have a tap-in-flight special; glass shatters, hull topples, fuel cells blow, and black holes bend your shots. Six sectors with stars, rigid-body physics with sleeping, a synthwave sun on a neon grid, and a bot that proves every sector can be cleared.',
        icon: '\uD83E\uDE90',
        folder: 'game-102',
        version: '1.0.0',
        cssClass: 'starsling',
        genre: 'arcade',
        tags: [
            { emoji: '\uD83C\uDFAF', label: 'Physics' },
            { emoji: '\uD83C\uDF06', label: 'Synthwave' },
            { emoji: '\uD83E\uDDCA', label: 'three.js' }
        ]
    },
    {
        id: 'game-103',
        title: 'Crown & Crumpet',
        description: 'A cosy Final Fantasy Tactics-style adventure in vanilla Canvas 2D. Princess Pip is training to become the next queen at Thistlewick Academy of Magic & Marching, and she is brave, determined and very clumsy: now and then she trips, and now and then she stumbles into a lucky double hit. Lead a party of friends you rescue along the way (a shy knight, a footnote-loving mage, a calm herbalist, a prickly rooftop archer and a hungry clay golem) through six isometric battles with height, cover, speed-based turns, skills and a picnic basket. The enemy is a reluctant Dread Lord who, in the end, just wants to be a chef; the last scene is the opening day of their cooking school. Every picture, tune and word is made in code.',
        icon: '\uD83D\uDC51',
        folder: 'game-103',
        version: '1.2.0',
        cssClass: 'crown-and-crumpet',
        genre: 'cozy',
        tags: [
            { emoji: '\uD83C\uDFF0', label: 'Tactics RPG' },
            { emoji: '\uD83C\uDF70', label: 'Cozy story' },
            { emoji: '\uD83D\uDDBC\uFE0F', label: 'Canvas 2D' }
        ]
    },
    {
        id: 'game-104',
        title: 'Hemlock Hollow',
        description: 'An intense, suspenseful gothic mystery in black and white, in the manner of a Sierra On-Line text adventure. You are Elspeth, a hedge witch\'s apprentice, and your mentor Marga has been kidnapped. With a second apprentice, Bryony, you learn herbs, healing and a handful of spells, and uncover a plot by the town\'s Governor to seize every hedge witch and healer so that the farmers and townsfolk must pay ruinous fees to his hospital and his shop. Type commands to a real parser (or tap shortcuts on a phone), brew cures with the kettle, hide when you hear boots, and gather proof before midnight on the Hollow Moon. Twenty-six rooms in six chapters, one-bit dithered pictures, a typewriter transcript in blackletter and candlelight, sixteen characters, five spells, three endings and a great many absurd deaths. A bot plays the whole story in Node and proves it can be won. Every picture, tune and word is made in code.',
        icon: '\uD83C\uDF3F',
        folder: 'game-104',
        version: '1.0.0',
        cssClass: 'hemlock-hollow',
        genre: 'story',
        tags: [
            { emoji: '\uD83D\uDD6F\uFE0F', label: 'Gothic mystery' },
            { emoji: '\u2328\uFE0F', label: 'Text adventure' },
            { emoji: '\uD83D\uDDBC\uFE0F', label: 'Canvas 2D' }
        ]
    }
];

export default games;
