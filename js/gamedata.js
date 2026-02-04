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
    }
];

export default games;
