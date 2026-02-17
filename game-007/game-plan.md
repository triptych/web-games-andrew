# Game 007: Interactive Fiction Text Adventure

## Genre Definition
A retro-style text adventure game with interactive fiction elements, featuring clickable text progression, inventory management, and an authentic old-school terminal aesthetic. Built with Kaplay for text rendering and UI management.

## Core Concept
Players navigate through a narrative-driven adventure by reading descriptive text and making choices via clickable options. The game features parser-style commands (implemented through UI buttons/clicks), inventory management, puzzle-solving, and multiple story branches with a classic terminal/monospace font presentation.

---

## Visual Design & Aesthetic

### Old School Terminal Look
- **Monospace Font**: Courier New, Consolas, or DOS-like bitmap font
- **Color Scheme**:
  - Primary text: Green (#00FF00) or Amber (#FFB000) on black
  - Alternate: White (#FFFFFF) or Cyan (#00FFFF) on dark blue
  - Clickable links: Yellow (#FFFF00) or bright cyan
  - Error/danger text: Red (#FF0000)
  - System messages: Gray (#808080)
  
- **Visual Effects**:
  - Typewriter text reveal (15-30ms per character)
  - Cursor blink animation (500ms interval)
  - Scanline overlay (optional for CRT effect)
  - Slight text glow/bloom for authenticity
  - Terminal border/frame design

- **Layout**:
  - Full screen terminal window
  - Text area (scrollable)
  - Command/choice area at bottom
  - Inventory sidebar (collapsible)
  - Status bar at top (location, score, moves)

---

## Phase 1: Core Text Engine

### Text Rendering System
- **Text Display**
  - Kaplay text rendering with monospace font
  - Word wrap at 80 characters (classic terminal width)
  - Scrollable text buffer (last 100 lines)
  - Auto-scroll to newest content
  - Manual scroll with mouse wheel or scroll bar

- **Typewriter Effect**
  - Character-by-character reveal
  - Adjustable speed (10-50ms per character)
  - Skip animation on click/key press
  - Instant display option in settings
  - Pause on punctuation (periods, commas)

- **Text Formatting**
  - **Bold** for emphasis (brighter color)
  - *Italic* for thoughts (slanted or different color)
  - `Code/items` (different color, e.g., cyan)
  - ~~Strikethrough~~ for crossed-out text
  - Links/clickable text (underlined, colored)

### Input System
- **Interaction Modes**:
  - Click on highlighted choices (modern)
  - Type commands (classic parser mode)
  - Both modes available simultaneously
  - Keyboard shortcuts for common actions

- **Parser Commands**:
  - **Movement**: NORTH, SOUTH, EAST, WEST, UP, DOWN, IN, OUT
  - **Actions**: LOOK, EXAMINE, TAKE, DROP, USE, OPEN, CLOSE
  - **Inventory**: INVENTORY (or I), EQUIP, UNEQUIP
  - **Communication**: TALK TO, ASK ABOUT, TELL ABOUT
  - **Meta**: SAVE, LOAD, HELP, QUIT, SCORE

- **Command Aliases**:
  - N/S/E/W for directions
  - L for LOOK
  - X for EXAMINE
  - G for GET/TAKE
  - INV for INVENTORY

### Game State Management
- **Core State**:
  - Current room/location
  - Player inventory (items)
  - Room states (visited, modified)
  - NPC states (talked to, gave item, etc.)
  - Quest/puzzle progress flags
  - Game statistics (moves, turns, score)

- **Save System**:
  - LocalStorage for browser saves
  - Multiple save slots (3-5)
  - Auto-save on room transition
  - Save metadata (time, location, turns)
  - Import/export saves as JSON

---

## Phase 2: World & Location System

### Room Structure
```javascript
const room = {
  id: "cave_entrance",
  name: "Cave Entrance",
  description: "You stand before a dark, foreboding cave entrance. Moss-covered rocks frame the opening, and a cold breeze emanates from within.",
  longDescription: "...", // Shown on first visit or LOOK
  shortDescription: "...", // Shown on revisit
  exits: {
    north: "forest_path",
    east: "rocky_outcrop",
    in: "cave_interior"
  },
  items: ["rusty_sword", "old_torch"],
  npcs: ["hermit"],
  visited: false,
  locked: false, // or { direction: "in", requiresKey: "iron_key" }
  dark: false, // Requires light source
  events: [] // Triggered on enter/exit
};
```

### Location Features
- **Room Descriptions**:
  - Long description on first visit
  - Short description on subsequent visits
  - LOOK command shows full description again
  - Dynamic descriptions based on game state

- **Exits**:
  - Standard compass directions (N, S, E, W, NE, NW, SE, SW)
  - Special exits (UP, DOWN, IN, OUT)
  - Hidden exits (revealed by examining objects)
  - Locked exits (require keys or solving puzzles)

- **Lighting System**:
  - Dark rooms require light source
  - Torches, lanterns, magical lights
  - Limited duration for consumable lights
  - "It is pitch black. You are likely to be eaten by a grue."

### Interactive Objects
- **Examinable Objects**:
  - Described in room text
  - Can be examined for more detail
  - Some reveal hidden items or clues
  - Clickable in text or via EXAMINE command

- **Containers**:
  - Chests, boxes, cabinets
  - Can be opened/closed
  - May be locked (require keys)
  - Contain items

- **Interactive Scenery**:
  - Levers, buttons, switches
  - Paintings, books, inscriptions
  - Environmental puzzles

---

## Phase 3: Inventory & Items

### Item System
```javascript
const item = {
  id: "rusty_sword",
  name: "Rusty Sword",
  description: "An old, rusty sword. Despite its appearance, it still has some edge to it.",
  type: "weapon", // weapon, tool, key, consumable, quest
  takeable: true,
  equippable: true,
  equipped: false,
  usable: true,
  useWith: ["wooden_door", "locked_chest"], // Items it can be used with
  useEffect: function() { /* Custom effect */ },
  weight: 3,
  value: 10
};
```

### Item Categories
- **Weapons**:
  - Swords, daggers, clubs
  - Affect combat encounters
  - Can be equipped
  - Some have special abilities

- **Tools**:
  - Lockpicks, crowbars, rope
  - Used to solve puzzles
  - Multi-use or consumable
  - Required for specific actions

- **Keys**:
  - Physical keys for locks
  - Magical keys
  - One-time use or reusable
  - Specific to certain locks

- **Consumables**:
  - Potions, food, scrolls
  - Single-use items
  - Restore health, provide buffs
  - Solve specific puzzles

- **Quest Items**:
  - Story-critical items
  - Cannot be dropped
  - Used to progress narrative
  - Often combine with other items

### Inventory Management
- **Inventory Display**:
  - List items in sidebar or dedicated screen
  - Clickable for more info
  - Drag-and-drop (optional)
  - Weight/capacity limit (optional)

- **Item Actions**:
  - EXAMINE item - See detailed description
  - USE item - Use item in context
  - USE item ON target - Combine items
  - DROP item - Remove from inventory
  - EQUIP/UNEQUIP - Change equipped items

- **Combining Items**:
  - USE item1 WITH item2
  - Creates new items
  - Solving puzzle mechanics
  - Recipe/crafting system (optional)

---

## Phase 4: NPCs & Dialogue

### NPC System
```javascript
const npc = {
  id: "hermit",
  name: "Old Hermit",
  description: "A weathered old man with a long gray beard.",
  location: "cave_entrance",
  dialogue: {
    greeting: "Hello, traveler. What brings you to these parts?",
    topics: {
      "cave": "Ah, the cave... I wouldn't go in there if I were you.",
      "sword": "That old thing? Found it years ago. You can have it.",
      "quest": "If you're looking for adventure, seek the Crystal of Light."
    },
    farewell: "Safe travels, friend."
  },
  inventory: ["healing_potion"],
  tradeable: true,
  questGiver: true,
  state: "idle" // idle, talking, hostile, dead
};
```

### Dialogue System
- **Conversation Interface**:
  - TALK TO [NPC] - Initiate conversation
  - ASK [NPC] ABOUT [topic] - Ask about specific topic
  - GIVE [item] TO [NPC] - Trade items
  - Show available topics after greeting

- **Dialogue Trees**:
  - Branching conversations
  - Multiple choice responses
  - Choices affect NPC disposition
  - Can unlock new topics or quests

- **Trading**:
  - NPCs have their own inventories
  - Can buy/sell items
  - Barter system (no currency) or gold-based
  - Some items trigger special reactions

### NPC Behaviors
- **States**:
  - Idle: Default state
  - Friendly: Willing to help
  - Hostile: Will attack or refuse to talk
  - Dead: No longer interactive

- **Memory**:
  - NPCs remember past interactions
  - Affects future dialogue options
  - Can hold grudges or reward kindness

---

## Phase 5: Puzzles & Challenges

### Puzzle Types
- **Key & Lock**:
  - Find keys to unlock doors/chests
  - Hidden keys in environment
  - Some keys are obtained from NPCs

- **Item Combination**:
  - Combine items to create solutions
  - Example: Rope + Hook = Grappling Hook
  - Trial and error or logic-based

- **Environmental**:
  - Manipulate objects in room
  - Push/pull/rotate objects
  - Levers and switches
  - Light and shadow puzzles

- **Riddles**:
  - Text-based riddles
  - Type or select answer
  - Clues scattered in world
  - Guard riddles (classic)

- **Sequence Puzzles**:
  - Enter correct order of items/actions
  - Musical patterns
  - Color/symbol sequences

- **Inventory Puzzles**:
  - Use correct item on object
  - Give correct item to NPC
  - Multi-step item interactions

### Hint System
- **Built-in Hints**:
  - HINT command provides subtle clues
  - Progressive hints (get more specific)
  - Cost: Reduces score or limited uses
  - Can be disabled for hardcore mode

- **Environmental Clues**:
  - Examine objects for hints
  - NPC dialogue contains clues
  - Books, notes, inscriptions
  - Visual cues in descriptions

---

## Phase 6: Combat System (Optional/Light)

### Simple Combat
- **Turn-Based**:
  - ATTACK [enemy] - Basic attack
  - DEFEND - Reduce incoming damage
  - USE [item] - Use consumable
  - RUN - Attempt to escape

- **Stats**:
  - Health Points (HP)
  - Attack power (based on weapon)
  - Defense (based on armor)
  - Luck (affects hit chance)

- **Outcomes**:
  - Victory: Enemy defeated, possible loot
  - Defeat: Game over or respawn
  - Escape: Return to previous room

### Alternative: Text-Based Combat
- **Choice-Based**:
  - Multiple action choices presented
  - Outcomes based on equipped items/stats
  - No random numbers, deterministic
  - Focus on strategy over luck

- **Puzzle-Combat Hybrid**:
  - Use correct item/action to defeat enemy
  - More like boss puzzle than combat
  - Example: Use fire spell on ice creature

---

## Phase 7: Story & Narrative

### Story Structure
- **Three-Act Structure**:
  - **Act 1**: Introduction, inciting incident
  - **Act 2**: Exploration, gathering items/info
  - **Act 3**: Climax, final puzzle/challenge, resolution

- **Multiple Endings**:
  - Choices throughout game affect ending
  - Good, neutral, bad endings
  - Hidden "best" ending
  - Ending summary with stats

### Narrative Elements
- **World Building**:
  - Rich environmental descriptions
  - Consistent lore and history
  - Interconnected locations
  - Hidden backstory for curious players

- **Character Development**:
  - Player choices shape character
  - NPCs have personalities and motives
  - Relationships develop over time
  - Optional character background

- **Atmosphere**:
  - Mood-appropriate descriptions
  - Suspenseful pacing in tense moments
  - Humor and lightheartedness when appropriate
  - Environmental storytelling

---

## Technical Implementation

### Technology Stack
- **Kaplay** (`../lib/kaplay/kaplay.js`) - Rendering engine
- **ES6 Modules** - Code organization
- **LocalStorage** - Save system
- **JSON** - Data storage format

### Project Structure
```
game-007/
├── index.html              # Entry point
├── game-plan.md            # This file
├── styles.css              # Terminal styling
├── js/
│   ├── main.js             # Game initialization and loop
│   ├── config.js           # Constants and settings
│   ├── textEngine.js       # Text display and formatting
│   ├── parser.js           # Command parsing
│   ├── world.js            # Room and location management
│   ├── inventory.js        # Item and inventory system
│   ├── npc.js              # NPC logic and dialogue
│   ├── puzzles.js          # Puzzle mechanics
│   ├── combat.js           # Combat system (if included)
│   ├── story.js            # Narrative progression
│   ├── saveload.js         # Save/load functionality
│   └── ui.js               # UI management and rendering
├── data/
│   ├── rooms.js            # Room definitions
│   ├── items.js            # Item database
│   ├── npcs.js             # NPC definitions
│   ├── dialogues.js        # Dialogue trees
│   └── story.js            # Story flags and events
└── assets/
    └── fonts/              # Monospace/DOS fonts
```

### Core Systems

#### Text Engine (textEngine.js)
```javascript
class TextEngine {
  constructor(kaplay) {
    this.k = kaplay;
    this.buffer = [];
    this.maxLines = 100;
    this.typewriterSpeed = 20; // ms per character
    this.scrollPosition = 0;
  }

  print(text, options = {}) {
    // Add text to buffer with typewriter effect
  }

  clear() {
    // Clear text buffer
  }

  scroll(direction) {
    // Scroll text up/down
  }

  render() {
    // Render visible text lines using Kaplay
  }
}
```

#### Parser (parser.js)
```javascript
class Parser {
  constructor(world, inventory) {
    this.world = world;
    this.inventory = inventory;
    this.commands = this.initCommands();
    this.synonyms = {
      'n': 'north',
      's': 'south',
      'e': 'east',
      'w': 'west',
      // ... more synonyms
    };
  }

  parse(input) {
    // Tokenize input
    // Match against commands
    // Execute command
    // Return result text
  }

  initCommands() {
    return {
      'look': this.look.bind(this),
      'go': this.go.bind(this),
      'take': this.take.bind(this),
      'examine': this.examine.bind(this),
      // ... more commands
    };
  }
}
```

#### World (world.js)
```javascript
class World {
  constructor(roomData) {
    this.rooms = new Map();
    this.currentRoom = null;
    this.initRooms(roomData);
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  move(direction) {
    // Check if exit exists
    // Handle locked doors
    // Change current room
    // Return description
  }

  examineObject(objectId) {
    // Get object from current room
    // Return detailed description
  }
}
```

---

## Development Roadmap

### Phase 1: Core Engine (Week 1)
- [ ] Project setup with Kaplay
- [ ] Text rendering system
- [ ] Typewriter effect
- [ ] Basic parser (move, look, examine)
- [ ] Room system (3-5 test rooms)
- [ ] Terminal visual styling
- [ ] Scrollable text buffer

### Phase 2: Inventory & Items (Week 1)
- [ ] Item data structure
- [ ] Inventory system
- [ ] Take/drop items
- [ ] Examine items
- [ ] Use items
- [ ] Item combining
- [ ] Inventory UI display

### Phase 3: World Building (Week 2)
- [ ] Create 15-20 rooms
- [ ] Write detailed descriptions
- [ ] Place items in world
- [ ] Implement locked doors
- [ ] Dark rooms and lighting
- [ ] Hidden areas
- [ ] Map connections

### Phase 4: NPCs & Dialogue (Week 1)
- [ ] NPC data structure
- [ ] Dialogue system
- [ ] TALK TO command
- [ ] ASK ABOUT topics
- [ ] Trading system
- [ ] NPC memory/state
- [ ] Quest giving

### Phase 5: Puzzles (Week 2)
- [ ] Design 5-8 major puzzles
- [ ] Implement key & lock puzzles
- [ ] Item combination puzzles
- [ ] Environmental puzzles
- [ ] Riddle system
- [ ] Hint system
- [ ] Puzzle progression tracking

### Phase 6: Combat (Optional - Week 1)
- [ ] Simple turn-based combat
- [ ] Combat stats
- [ ] Weapon/armor effects
- [ ] Combat animations (text)
- [ ] Enemy AI (basic)
- [ ] Victory/defeat handling

### Phase 7: Story & Polish (Week 1)
- [ ] Write main story narrative
- [ ] Add story flags and triggers
- [ ] Multiple endings implementation
- [ ] Opening sequence
- [ ] Ending sequences
- [ ] Victory conditions
- [ ] Story integration with puzzles

### Phase 8: Save/Load & UI (Week 1)
- [ ] Save system (LocalStorage)
- [ ] Multiple save slots
- [ ] Load system
- [ ] Auto-save functionality
- [ ] Settings menu
- [ ] Help/commands list
- [ ] Score/stats tracking
- [ ] UI polish and animations

---

## Design Pillars

1. **Authentic Retro Feel**: Capture the essence of 80s text adventures (Zork, Colossal Cave)
2. **Readable Text**: Clear, high-contrast monospace font
3. **Smooth Interaction**: Responsive commands and clickable text
4. **Engaging Narrative**: Rich descriptions and compelling story
5. **Fair Puzzles**: Challenging but logical with available clues
6. **Atmospheric**: Immersive world with consistent tone

---

## Sample Game Opening

```
========================================
     THE FORGOTTEN TEMPLE
        An Interactive Fiction
========================================

[Press SPACE or CLICK to continue]

You wake with a start, the sound of dripping water echoing in your ears. Your head throbs, and your memories are hazy. Looking around, you find yourself in a damp, stone chamber lit by a single flickering torch mounted on the wall.

The last thing you remember is... what was it? Something about an expedition? A map? It's all so foggy.

One thing is certain: you need to find a way out of here.

> _

[Commands: LOOK, EXAMINE, TAKE, INVENTORY, GO (direction), HELP]
[Click on highlighted words to interact]
```

---

## Reference Games

### Classic Text Adventures
- **Zork Series** (Infocom) - Complex puzzles, rich world
- **Colossal Cave Adventure** - Original text adventure
- **Hitchhiker's Guide to the Galaxy** - Humor and difficulty
- **Planetfall** (Infocom) - Strong characterization

### Modern Interactive Fiction
- **Anchorhead** - Horror atmosphere
- **Photopia** - Emotional storytelling
- **Spider and Web** - Clever puzzle design
- **Counterfeit Monkey** - Word manipulation mechanics

---

## Success Metrics

- Player completes tutorial section without confusion
- Average playtime: 1-2 hours for first playthrough
- Puzzle solutions are discovered through logical thinking
- Multiple ending variations are found by players
- Text is readable and atmospheric
- Commands are intuitive and responsive
- Save/load system works reliably

---

## Sample Puzzle Example

### The Ancient Lock Puzzle
**Location**: Temple Inner Chamber

**Description**: 
"Before you stands an ornate door covered in strange symbols. In the center is a circular lock with four rotating rings, each inscribed with different symbols: Sun, Moon, Star, and Comet."

**Clues Scattered in World**:
- Book in Library: "The heavens align when the comet follows the moon."
- Inscription in Garden: "First light of day guides the way."
- NPC Hermit: "The star is always in the middle of the celestial order."

**Solution**: 
Rotate rings to: Sun - Moon - Star - Comet (top to bottom)

**Commands**:
```
> EXAMINE door
> EXAMINE lock
> TURN first ring to sun
> TURN second ring to moon
> TURN third ring to star
> TURN fourth ring to comet
> OPEN door
```

---

## Accessibility Features

- **Adjustable text speed**: Instant to slow typewriter
- **High contrast modes**: Multiple color schemes
- **Font size options**: Small, medium, large, extra-large
- **Screen reader support**: Semantic HTML structure
- **Keyboard-only mode**: Full keyboard navigation
- **Clickable text mode**: Full mouse interaction
- **Command history**: Up arrow for previous commands
- **Undo last action**: Limited undo system

---

## Future Expansion Ideas

- **Sound effects**: Ambient sounds and action feedback
- **Music**: Atmospheric background music
- **ASCII art**: Location illustrations
- **Achievements**: Hidden challenges and goals
- **Multiple storylines**: Different starting scenarios
- **Difficulty modes**: Easy (more hints) to Hard (permadeath)
- **Custom stories**: Player-created adventures
- **Multiplayer**: Text-based multiplayer adventures
- **Mobile version**: Touch-optimized interface

---

## Next Steps

1. Set up project structure with Kaplay
2. Implement basic text rendering with typewriter effect
3. Create parser for essential commands (LOOK, GO, TAKE)
4. Build 3-5 test rooms with items
5. Test movement and item interaction
6. Begin iterative development following roadmap

**Let's craft an engaging text adventure! 📖✨**
