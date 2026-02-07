// Input.js - Keyboard input handling

export class Input {
    constructor(game) {
        this.game = game;
        this.keyMap = {
            // Arrow keys
            'ArrowUp': { dx: 0, dy: -1 },
            'ArrowDown': { dx: 0, dy: 1 },
            'ArrowLeft': { dx: -1, dy: 0 },
            'ArrowRight': { dx: 1, dy: 0 },
            
            // WASD
            'w': { dx: 0, dy: -1 },
            's': { dx: 0, dy: 1 },
            'a': { dx: -1, dy: 0 },
            'd': { dx: 1, dy: 0 },
            'W': { dx: 0, dy: -1 },
            'S': { dx: 0, dy: 1 },
            'A': { dx: -1, dy: 0 },
            'D': { dx: 1, dy: 0 },
            
            // Diagonal movement (numpad-style)
            'q': { dx: -1, dy: -1 }, // Up-left
            'e': { dx: 1, dy: -1 },  // Up-right
            'z': { dx: -1, dy: 1 },  // Down-left
            'c': { dx: 1, dy: 1 },   // Down-right
            'Q': { dx: -1, dy: -1 },
            'E': { dx: 1, dy: -1 },
            'Z': { dx: -1, dy: 1 },
            'C': { dx: 1, dy: 1 },
            
            // Wait/rest
            ' ': { dx: 0, dy: 0 },
            '.': { dx: 0, dy: 0 }
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    handleKeyDown(event) {
        const key = event.key;

        // Handle save game (Ctrl+S or Cmd+S)
        if ((event.ctrlKey || event.metaKey) && (key === 's' || key === 'S')) {
            event.preventDefault();
            this.game.saveGame();
            return;
        }

        // Handle inventory controls
        if (key === 'i' || key === 'I') {
            event.preventDefault();
            this.game.toggleInventory();
            return;
        }

        if (key === 'g' || key === 'G') {
            event.preventDefault();
            this.game.handlePickup();
            return;
        }

        if (key === 'd' || key === 'D') {
            event.preventDefault();
            this.game.handleDrop();
            return;
        }

        // Handle spell casting
        if (key === 'f' || key === 'F') {
            event.preventDefault();
            this.game.castFireball();
            return;
        }

        // Handle ranged attack
        if (key === 'r' || key === 'R') {
            event.preventDefault();
            this.game.shootArrow();
            return;
        }

        // Handle stairs
        if (key === '>' || (event.shiftKey && key === '.')) {
            event.preventDefault();
            this.game.descendStairs();
            return;
        }

        if (key === '<' || (event.shiftKey && key === ',')) {
            event.preventDefault();
            this.game.ascendStairs();
            return;
        }

        // Handle number keys for inventory items
        if (this.game.showInventory) {
            const num = parseInt(key);
            if (!isNaN(num) && num >= 1 && num <= 9) {
                event.preventDefault();
                this.game.handleInventoryAction(num - 1);
                return;
            }
        }
        
        // Handle movement
        if (this.keyMap[key]) {
            event.preventDefault();
            const { dx, dy } = this.keyMap[key];
            this.game.handlePlayerMove(dx, dy);
        }
    }
}
