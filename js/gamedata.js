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
    }
];

export default games;
