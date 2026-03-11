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
        icon: '⚔️',
        folder: 'game-009',
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
        icon: '🛸',
        folder: 'game-011',
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
        cssClass: 'tamagoji',
        tags: [
            { emoji: '🐾', label: 'Virtual Pet' },
            { emoji: '📱', label: 'Mobile-Friendly' },
            { emoji: '🌸', label: 'Cozy' }
        ]
    }
];

export default games;
