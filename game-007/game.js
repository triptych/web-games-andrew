// Combined game file for Phase 1

// ========================================
// CONFIG
// ========================================
const CONFIG = {
    // Display settings
    SCREEN_WIDTH: 900,
    SCREEN_HEIGHT: 600,
    
    // Text settings
    FONT_SIZE: 16,
    LINE_HEIGHT: 24,
    MAX_LINE_WIDTH: 80,
    MAX_BUFFER_LINES: 100,
    
    // Typewriter effect
    TYPEWRITER_SPEED: 20,
    TYPEWRITER_ENABLED: true,
    PAUSE_ON_PUNCTUATION: 50,
    
    // Colors
    COLORS: {
        BACKGROUND: [0, 0, 0],
        TEXT_PRIMARY: [0, 255, 0],
        TEXT_SECONDARY: [0, 200, 0],
        TEXT_HIGHLIGHTED: [255, 255, 0],
        TEXT_ERROR: [255, 0, 0],
        TEXT_SYSTEM: [128, 128, 128],
        CURSOR: [0, 255, 0],
        LINK: [0, 255, 255]
    },
    
    // UI Layout
    UI: {
        PADDING: 20,
        STATUS_BAR_HEIGHT: 30,
        INPUT_HEIGHT: 40,
        SCROLL_SPEED: 3,
        HELP_PANEL_WIDTH: 180
    },
    
    // Command aliases
    ALIASES: {
        'n': 'north', 's': 'south', 'e': 'east', 'w': 'west',
        'ne': 'northeast', 'nw': 'northwest', 'se': 'southeast', 'sw': 'southwest',
        'u': 'up', 'd': 'down', 'l': 'look', 'x': 'examine',
        'i': 'inventory', 'inv': 'inventory', 'g': 'take', 'get': 'take'
    }
};

// ========================================
// ROOM DATA
// ========================================
const ROOMS = [
    {
        id: "damp_chamber",
        name: "Damp Chamber",
        description: "You wake with a start, the sound of dripping water echoing in your ears. Your head throbs, and your memories are hazy. Looking around, you find yourself in a damp, stone chamber lit by a single flickering torch mounted on the wall. The walls are covered in moss and ancient carvings you can't quite make out.",
        shortDescription: "You are in a damp stone chamber. A flickering torch provides dim light.",
        exits: { north: "narrow_corridor", east: "storage_room" },
        items: ["old torch"],
        dark: false
    },
    {
        id: "narrow_corridor",
        name: "Narrow Corridor",
        description: "A narrow corridor stretches before you, carved from rough stone. The air is musty and stale. Ancient stone bricks line the walls, some crumbling with age. You can hear water dripping somewhere in the distance. The corridor continues to the west, and you can return south to the damp chamber.",
        shortDescription: "A narrow stone corridor. It continues west.",
        exits: { south: "damp_chamber", west: "temple_entrance" },
        items: [],
        dark: false
    },
    {
        id: "storage_room",
        name: "Storage Room",
        description: "This appears to be an old storage room. Rotting wooden crates and broken pottery litter the floor. Dust covers everything, and cobwebs hang from the ceiling. Against one wall, you notice a rusty sword leaning against a crate. There's a small alcove to the north that looks darker than the rest of the room.",
        shortDescription: "An old storage room filled with debris and broken crates.",
        exits: { west: "damp_chamber", north: "dark_alcove" },
        items: ["rusty sword", "wooden crate"],
        dark: false
    },
    {
        id: "dark_alcove",
        name: "Dark Alcove",
        description: "You step into a small, dark alcove. Even with your torch, you can barely see anything. The walls feel damp to the touch, and you can see something glinting in the darkness.",
        shortDescription: "A dark alcove. Your torch barely illuminates it.",
        exits: { south: "storage_room" },
        items: ["iron key"],
        dark: false
    },
    {
        id: "temple_entrance",
        name: "Temple Entrance",
        description: "You stand before a grand entrance to what appears to be an ancient temple. Massive stone columns rise on either side, carved with intricate hieroglyphics and symbols depicting forgotten gods and long-dead kings. The entrance itself is an imposing archway, beyond which lies darkness. A heavy wooden door to the north is locked with an iron lock.",
        shortDescription: "The grand entrance to an ancient temple. A locked door stands to the north.",
        exits: { east: "narrow_corridor", north: "inner_sanctum" },
        items: ["stone tablet"],
        locked: { direction: "north", requiresKey: "iron key" },
        dark: false
    },
    {
        id: "inner_sanctum",
        name: "Inner Sanctum",
        description: "You have entered the inner sanctum of the ancient temple. The air here feels heavy with age and mystery. In the center of the room stands a stone pedestal, upon which rests a magnificent crystal that pulses with an inner light. Ancient murals cover the walls, telling stories of a civilization long forgotten. You feel you have reached something important.",
        shortDescription: "The inner sanctum. A glowing crystal rests on a pedestal.",
        exits: { south: "temple_entrance" },
        items: ["crystal of light"],
        dark: false
    }
];

// ========================================
// TEXT ENGINE
// ========================================
class TextEngine {
    constructor(k) {
        this.k = k;
        this.buffer = [];
        this.maxLines = CONFIG.MAX_BUFFER_LINES;
        this.scrollOffset = 0;
        this.currentlyTyping = false;
        this.typewriterQueue = [];
        this.currentText = '';
        this.currentIndex = 0;
        this.lastTypeTime = 0;
        this.canSkip = false;
    }

    print(text, options = {}) {
        const color = options.color || CONFIG.COLORS.TEXT_PRIMARY;
        const instant = options.instant || !CONFIG.TYPEWRITER_ENABLED;
        const lines = this.wordWrap(text, CONFIG.MAX_LINE_WIDTH);
        
        if (instant) {
            lines.forEach(line => this.addLineToBuffer(line, color));
            this.scrollToBottom();
        } else {
            this.typewriterQueue.push({ lines, color, lineIndex: 0 });
            if (!this.currentlyTyping) this.startTypewriter();
        }
    }

    printColored(text, colorName, instant = false) {
        const color = CONFIG.COLORS[colorName] || CONFIG.COLORS.TEXT_PRIMARY;
        this.print(text, { color, instant });
    }

    printError(text) {
        this.printColored(text, 'TEXT_ERROR', true);
    }

    printSystem(text) {
        this.printColored(text, 'TEXT_SYSTEM', true);
    }

    wordWrap(text, maxWidth) {
        // Adjust max width to account for help panel and padding
        const adjustedWidth = 65; // Increased to give more space for text
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            if (testLine.length <= adjustedWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        });

        if (currentLine) lines.push(currentLine);
        return lines.length > 0 ? lines : [''];
    }

    addLineToBuffer(text, color) {
        this.buffer.push({ text, color, timestamp: Date.now() });
        if (this.buffer.length > this.maxLines) this.buffer.shift();
    }

    startTypewriter() {
        if (this.typewriterQueue.length === 0) {
            this.currentlyTyping = false;
            return;
        }
        this.currentlyTyping = true;
        this.canSkip = true;
        const current = this.typewriterQueue[0];
        if (current.lineIndex < current.lines.length) {
            this.currentText = current.lines[current.lineIndex];
            this.currentIndex = 0;
            this.lastTypeTime = Date.now();
        }
    }

    updateTypewriter() {
        if (!this.currentlyTyping || this.typewriterQueue.length === 0) return;

        const current = this.typewriterQueue[0];
        const now = Date.now();
        const timeSinceLastChar = now - this.lastTypeTime;
        let speed = CONFIG.TYPEWRITER_SPEED;
        
        if (this.currentIndex > 0) {
            const lastChar = this.currentText[this.currentIndex - 1];
            if ('.!?'.includes(lastChar)) {
                speed += CONFIG.PAUSE_ON_PUNCTUATION;
            }
        }

        if (timeSinceLastChar >= speed) {
            this.currentIndex++;
            this.lastTypeTime = now;

            if (this.currentIndex >= this.currentText.length) {
                this.addLineToBuffer(this.currentText, current.color);
                this.scrollToBottom();
                current.lineIndex++;
                
                if (current.lineIndex < current.lines.length) {
                    this.currentText = current.lines[current.lineIndex];
                    this.currentIndex = 0;
                } else {
                    this.typewriterQueue.shift();
                    if (this.typewriterQueue.length > 0) {
                        this.startTypewriter();
                    } else {
                        this.currentlyTyping = false;
                        this.currentText = '';
                        this.currentIndex = 0;
                    }
                }
            }
        }
    }

    skipTypewriter() {
        if (!this.canSkip || !this.currentlyTyping) return;
        while (this.typewriterQueue.length > 0) {
            const current = this.typewriterQueue.shift();
            for (let i = current.lineIndex; i < current.lines.length; i++) {
                this.addLineToBuffer(current.lines[i], current.color);
            }
        }
        this.currentlyTyping = false;
        this.currentText = '';
        this.currentIndex = 0;
        this.scrollToBottom();
    }

    clear() {
        this.buffer = [];
        this.scrollOffset = 0;
        this.typewriterQueue = [];
        this.currentlyTyping = false;
        this.currentText = '';
        this.currentIndex = 0;
    }

    scroll(direction) {
        const maxScroll = Math.max(0, this.buffer.length - this.getVisibleLines());
        this.scrollOffset = Math.max(0, Math.min(maxScroll, 
            this.scrollOffset + direction * CONFIG.UI.SCROLL_SPEED));
    }

    scrollToBottom() {
        const maxScroll = Math.max(0, this.buffer.length - this.getVisibleLines());
        this.scrollOffset = maxScroll;
    }

    getVisibleLines() {
        const availableHeight = CONFIG.SCREEN_HEIGHT - CONFIG.UI.STATUS_BAR_HEIGHT - 
            CONFIG.UI.INPUT_HEIGHT - (CONFIG.UI.PADDING * 3);
        return Math.floor(availableHeight / CONFIG.LINE_HEIGHT) - 2; // Reserve space for typing and padding
    }

    render() {
        const startY = CONFIG.UI.STATUS_BAR_HEIGHT + CONFIG.UI.PADDING;
        const visibleLines = this.getVisibleLines();
        const startLine = Math.floor(this.scrollOffset);
        const endLine = Math.min(this.buffer.length, startLine + visibleLines);
        
        // Calculate max Y position to avoid overlapping with input
        const maxY = CONFIG.SCREEN_HEIGHT - CONFIG.UI.INPUT_HEIGHT - CONFIG.UI.PADDING;

        for (let i = startLine; i < endLine; i++) {
            const line = this.buffer[i];
            const y = startY + ((i - startLine) * CONFIG.LINE_HEIGHT);
            
            // Only render if within bounds
            if (y + CONFIG.FONT_SIZE < maxY) {
                this.k.drawText({
                    text: line.text,
                    pos: this.k.vec2(CONFIG.UI.PADDING, y),
                    size: CONFIG.FONT_SIZE,
                    color: this.k.rgb(...line.color),
                    font: 'monospace'
                });
            }
        }

        if (this.currentlyTyping && this.currentText) {
            const displayText = this.currentText.substring(0, this.currentIndex);
            const typingY = startY + ((endLine - startLine) * CONFIG.LINE_HEIGHT);
            
            // Only render typing text if within bounds
            if (typingY + CONFIG.FONT_SIZE < maxY) {
                this.k.drawText({
                    text: displayText,
                    pos: this.k.vec2(CONFIG.UI.PADDING, typingY),
                    size: CONFIG.FONT_SIZE,
                    color: this.k.rgb(...this.typewriterQueue[0].color),
                    font: 'monospace'
                });
            }
        }
    }
}

// ========================================
// WORLD
// ========================================
class World {
    constructor(roomData) {
        this.rooms = new Map();
        this.currentRoomId = null;
        this.initRooms(roomData);
    }

    initRooms(roomData) {
        roomData.forEach(room => {
            this.rooms.set(room.id, {
                ...room,
                visited: false,
                items: room.items || [],
                npcs: room.npcs || []
            });
        });
    }

    setStartRoom(roomId) {
        if (this.rooms.has(roomId)) {
            this.currentRoomId = roomId;
            const room = this.rooms.get(roomId);
            room.visited = true;
            return true;
        }
        return false;
    }

    getCurrentRoom() {
        return this.rooms.get(this.currentRoomId);
    }

    getRoomDescription(forceLong = false) {
        const room = this.getCurrentRoom();
        if (!room) return "You are nowhere.";

        const useShort = room.visited && !forceLong && room.shortDescription;
        const description = useShort ? room.shortDescription : room.description;
        let fullDesc = description;

        if (room.items.length > 0) {
            fullDesc += "\n\nYou can see:";
            room.items.forEach(item => {
                fullDesc += `\n  - ${item}`;
            });
        }

        if (room.exits && Object.keys(room.exits).length > 0) {
            fullDesc += "\n\nExits:";
            const exitNames = Object.keys(room.exits).join(', ');
            fullDesc += ` ${exitNames}`;
        }

        return fullDesc;
    }

    move(direction) {
        const room = this.getCurrentRoom();
        if (!room) {
            return { success: false, message: "You are nowhere." };
        }

        if (!room.exits || !room.exits[direction]) {
            return { success: false, message: `You can't go ${direction} from here.` };
        }

        if (room.locked && room.locked.direction === direction) {
            const keyNeeded = room.locked.requiresKey;
            return {
                success: false,
                message: `The way ${direction} is locked. You need a ${keyNeeded}.`
            };
        }

        const newRoomId = room.exits[direction];
        const newRoom = this.rooms.get(newRoomId);

        if (!newRoom) {
            return {
                success: false,
                message: "Something went wrong. That room doesn't exist."
            };
        }

        this.currentRoomId = newRoomId;
        if (!newRoom.visited) {
            newRoom.visited = true;
        }

        return {
            success: true,
            message: this.getRoomDescription()
        };
    }

    addItemToRoom(itemId) {
        const room = this.getCurrentRoom();
        if (room && !room.items.includes(itemId)) {
            room.items.push(itemId);
        }
    }

    removeItemFromRoom(itemId) {
        const room = this.getCurrentRoom();
        if (room) {
            const index = room.items.indexOf(itemId);
            if (index > -1) {
                room.items.splice(index, 1);
                return true;
            }
        }
        return false;
    }

    isItemInRoom(itemId) {
        const room = this.getCurrentRoom();
        return room && room.items.includes(itemId);
    }

    unlockExit(direction) {
        const room = this.getCurrentRoom();
        if (room && room.locked && room.locked.direction === direction) {
            room.locked = null;
            return true;
        }
        return false;
    }
}

// ========================================
// PARSER
// ========================================
class Parser {
    constructor(world, textEngine) {
        this.world = world;
        this.textEngine = textEngine;
        this.inventory = [];
        this.commands = this.initCommands();
    }

    parse(input) {
        if (!input || input.trim() === '') return;

        const cleanInput = input.trim().toLowerCase();
        const tokens = cleanInput.split(/\s+/);
        const command = tokens[0];
        const args = tokens.slice(1);
        const actualCommand = CONFIG.ALIASES[command] || command;

        if (this.commands[actualCommand]) {
            this.commands[actualCommand](args);
        } else {
            this.textEngine.printError(`I don't understand "${input}".`);
            this.textEngine.printSystem("Type HELP for a list of commands.");
        }
    }

    initCommands() {
        return {
            'look': () => this.look(),
            'examine': (args) => this.examine(args),
            'north': () => this.go(['north']),
            'south': () => this.go(['south']),
            'east': () => this.go(['east']),
            'west': () => this.go(['west']),
            'up': () => this.go(['up']),
            'down': () => this.go(['down']),
            'go': (args) => this.go(args),
            'take': (args) => this.take(args),
            'drop': (args) => this.drop(args),
            'inventory': () => this.showInventory(),
            'help': () => this.showHelp(),
            'quit': () => this.quit(),
            'clear': () => this.clear()
        };
    }

    look() {
        const description = this.world.getRoomDescription(true);
        this.textEngine.print(description);
    }

    examine(args) {
        if (args.length === 0) {
            this.textEngine.printError("What do you want to examine?");
            return;
        }

        const target = args.join(' ');
        
        if (this.inventory.includes(target)) {
            this.textEngine.print(`You examine the ${target} in your inventory.`);
            return;
        }

        if (this.world.isItemInRoom(target)) {
            this.textEngine.print(`You examine the ${target} closely. It looks like something you could take.`);
            return;
        }

        this.textEngine.printError(`You don't see any ${target} here.`);
    }

    go(args) {
        if (args.length === 0) {
            this.textEngine.printError("Go where? Try: GO NORTH, GO SOUTH, etc.");
            return;
        }

        const direction = args[0];
        const result = this.world.move(direction);

        if (result.success) {
            this.textEngine.print(result.message);
        } else {
            this.textEngine.printError(result.message);
        }
    }

    take(args) {
        if (args.length === 0) {
            this.textEngine.printError("What do you want to take?");
            return;
        }

        const itemName = args.join(' ');

        if (this.world.isItemInRoom(itemName)) {
            this.world.removeItemFromRoom(itemName);
            this.inventory.push(itemName);
            this.textEngine.print(`You take the ${itemName}.`);
        } else {
            this.textEngine.printError(`You don't see any ${itemName} here.`);
        }
    }

    drop(args) {
        if (args.length === 0) {
            this.textEngine.printError("What do you want to drop?");
            return;
        }

        const itemName = args.join(' ');
        const index = this.inventory.indexOf(itemName);

        if (index > -1) {
            this.inventory.splice(index, 1);
            this.world.addItemToRoom(itemName);
            this.textEngine.print(`You drop the ${itemName}.`);
        } else {
            this.textEngine.printError(`You don't have any ${itemName}.`);
        }
    }

    showInventory() {
        if (this.inventory.length === 0) {
            this.textEngine.print("You are carrying nothing.");
            return;
        }

        this.textEngine.print("You are carrying:");
        this.inventory.forEach(item => {
            this.textEngine.print(`  - ${item}`, { instant: true });
        });
    }

    showHelp() {
        const helpText = `
========================================
AVAILABLE COMMANDS
========================================

MOVEMENT:
  NORTH, SOUTH, EAST, WEST (or N, S, E, W)
  UP, DOWN
  GO [direction]

ACTIONS:
  LOOK (or L) - Look around current room
  EXAMINE [item] (or X) - Examine something
  TAKE [item] (or GET) - Pick up an item
  DROP [item] - Drop an item
  INVENTORY (or I) - Show inventory

SYSTEM:
  HELP - Show this help
  CLEAR - Clear the screen
  QUIT - Exit the game

========================================
TIP: Click or press SPACE to skip text.
========================================
        `.trim();
        
        this.textEngine.print(helpText, { instant: true });
    }

    quit() {
        this.textEngine.print("Thanks for playing! Refresh to restart.", { instant: true });
    }

    clear() {
        this.textEngine.clear();
        this.textEngine.printSystem("Screen cleared. Type LOOK to see where you are.");
    }

    hasItem(itemName) {
        return this.inventory.includes(itemName);
    }
}

// ========================================
// MAIN GAME
// ========================================
console.log('Initializing game...');

const k = kaplay({
    width: CONFIG.SCREEN_WIDTH,
    height: CONFIG.SCREEN_HEIGHT,
    background: CONFIG.COLORS.BACKGROUND,
    crisp: true,
    global: false
});

let textEngine = new TextEngine(k);
let world = new World(ROOMS);
let parser = new Parser(world, textEngine);
let inputBuffer = '';
let cursorVisible = true;
let lastCursorBlink = 0;
const CURSOR_BLINK_INTERVAL = 500;

// Initialize game
world.setStartRoom('damp_chamber');

// Show intro
const intro = `
========================================
     THE FORGOTTEN TEMPLE
        An Interactive Fiction
========================================

Type HELP for a list of commands.
Press SPACE or click to skip text.

========================================
`;

textEngine.print(intro.trim(), { instant: true });
textEngine.print('');
textEngine.print(world.getRoomDescription(true));
textEngine.print('');

// Input handlers
k.onCharInput((char) => {
    if (char.length === 1 && !textEngine.currentlyTyping) {
        inputBuffer += char;
    }
});

k.onKeyPress('backspace', () => {
    if (inputBuffer.length > 0 && !textEngine.currentlyTyping) {
        inputBuffer = inputBuffer.slice(0, -1);
    }
});

k.onKeyPress('enter', () => {
    if (textEngine.currentlyTyping) {
        textEngine.skipTypewriter();
    } else if (inputBuffer.trim() !== '') {
        textEngine.printSystem(`> ${inputBuffer}`);
        parser.parse(inputBuffer);
        textEngine.print('', { instant: true });
        inputBuffer = '';
    }
});

k.onKeyPress('space', () => {
    if (textEngine.currentlyTyping) {
        textEngine.skipTypewriter();
    }
});

k.onClick(() => {
    if (textEngine.currentlyTyping) {
        textEngine.skipTypewriter();
    }
});

k.onScroll((delta) => {
    const direction = delta.y > 0 ? -1 : 1;
    textEngine.scroll(direction);
});

k.onKeyPress('up', () => {
    if (!textEngine.currentlyTyping) {
        textEngine.scroll(-1);
    }
});

k.onKeyPress('down', () => {
    if (!textEngine.currentlyTyping) {
        textEngine.scroll(1);
    }
});

// Main loop
k.onDraw(() => {
    textEngine.updateTypewriter();

    // Status bar
    const room = world.getCurrentRoom();
    const roomName = room ? room.name : 'Unknown';
    
    k.drawRect({
        pos: k.vec2(0, 0),
        width: CONFIG.SCREEN_WIDTH,
        height: CONFIG.UI.STATUS_BAR_HEIGHT,
        color: k.rgb(0, 50, 0)
    });

    k.drawText({
        text: roomName,
        pos: k.vec2(CONFIG.UI.PADDING, 8),
        size: CONFIG.FONT_SIZE,
        color: k.rgb(...CONFIG.COLORS.TEXT_HIGHLIGHTED),
        font: 'monospace'
    });

    k.drawText({
        text: `Items: ${parser.inventory.length}`,
        pos: k.vec2(CONFIG.SCREEN_WIDTH - CONFIG.UI.PADDING - 100, 8),
        size: CONFIG.FONT_SIZE,
        color: k.rgb(...CONFIG.COLORS.TEXT_PRIMARY),
        font: 'monospace'
    });

    // Text buffer
    textEngine.render();

    // Help panel on the right side
    const helpPanelX = CONFIG.SCREEN_WIDTH - CONFIG.UI.HELP_PANEL_WIDTH;
    const helpPanelY = CONFIG.UI.STATUS_BAR_HEIGHT;
    
    // Draw help panel background
    k.drawRect({
        pos: k.vec2(helpPanelX, helpPanelY),
        width: CONFIG.UI.HELP_PANEL_WIDTH,
        height: CONFIG.SCREEN_HEIGHT - CONFIG.UI.STATUS_BAR_HEIGHT - CONFIG.UI.INPUT_HEIGHT,
        color: k.rgb(10, 30, 10),
        outline: { width: 2, color: k.rgb(...CONFIG.COLORS.TEXT_SECONDARY) }
    });

    // Draw help text
    const helpLines = [
        "COMMANDS",
        "",
        "Move: N/S/E/W",
        "LOOK (L)",
        "EXAMINE (X)",
        "TAKE/GET",
        "DROP",
        "INVENTORY (I)",
        "",
        "CLEAR",
        "HELP",
        "QUIT",
        "",
        "Press SPACE",
        "to skip text"
    ];

    helpLines.forEach((line, index) => {
        k.drawText({
            text: line,
            pos: k.vec2(helpPanelX + 10, helpPanelY + 10 + (index * 18)),
            size: 14,
            color: k.rgb(...CONFIG.COLORS.TEXT_SECONDARY),
            font: 'monospace'
        });
    });

    // Input line
    const inputY = CONFIG.SCREEN_HEIGHT - CONFIG.UI.INPUT_HEIGHT + 10;
    
    k.drawLine({
        p1: k.vec2(0, CONFIG.SCREEN_HEIGHT - CONFIG.UI.INPUT_HEIGHT),
        p2: k.vec2(CONFIG.SCREEN_WIDTH, CONFIG.SCREEN_HEIGHT - CONFIG.UI.INPUT_HEIGHT),
        width: 2,
        color: k.rgb(...CONFIG.COLORS.TEXT_SECONDARY)
    });

    k.drawText({
        text: '> ',
        pos: k.vec2(CONFIG.UI.PADDING, inputY),
        size: CONFIG.FONT_SIZE,
        color: k.rgb(...CONFIG.COLORS.TEXT_PRIMARY),
        font: 'monospace'
    });

    k.drawText({
        text: inputBuffer,
        pos: k.vec2(CONFIG.UI.PADDING + 20, inputY),
        size: CONFIG.FONT_SIZE,
        color: k.rgb(...CONFIG.COLORS.TEXT_PRIMARY),
        font: 'monospace'
    });

    if (cursorVisible && !textEngine.currentlyTyping) {
        const cursorX = CONFIG.UI.PADDING + 20 + (inputBuffer.length * 9.6);
        k.drawRect({
            pos: k.vec2(cursorX, inputY),
            width: 10,
            height: 16,
            color: k.rgb(...CONFIG.COLORS.CURSOR)
        });
    }
});

k.onUpdate(() => {
    const now = Date.now();
    if (now - lastCursorBlink > CURSOR_BLINK_INTERVAL) {
        cursorVisible = !cursorVisible;
        lastCursorBlink = now;
    }
});

console.log('Game initialized!');
