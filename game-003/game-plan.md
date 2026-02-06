# NetHack-Style Roguelike Game Plan

## Game Overview
A browser-based roguelike dungeon crawler inspired by NetHack, featuring procedurally generated dungeons, turn-based combat, permanent death, and ASCII/tile-based graphics.

## Core Features

### 1. Dungeon Generation
- **Procedural Generation**: Random dungeon layouts using BSP (Binary Space Partitioning) or cellular automata
- **Multi-level Dungeons**: 10-20 floors with increasing difficulty
- **Room Types**:
  - Standard rooms
  - Treasure vaults
  - Monster lairs
  - Shops
  - Shrines
  - Secret rooms
- **Corridors**: Connecting passages between rooms
- **Stairs**: Up/down stairs for level traversal

### 2. Player Character
- **Classes**: Warrior, Mage, Rogue, Cleric
- **Attributes**:
  - Strength (melee damage, carry capacity)
  - Dexterity (dodge, accuracy)
  - Intelligence (magic power)
  - Constitution (health points)
- **Stats**:
  - HP (Hit Points)
  - MP (Mana Points)
  - Level & Experience
  - Hunger system
- **Permadeath**: Character deletion on death

### 3. Combat System
- **Turn-Based**: Player moves, then enemies move
- **Melee Combat**: Adjacent tile attacks
- **Ranged Combat**: Bows, throwing weapons, wands
- **Magic System**: Spells with mana cost
- **Status Effects**: Poison, confusion, blindness, paralysis
- **Critical Hits**: Random chance for extra damage

### 4. Inventory & Items
- **Equipment Slots**:
  - Weapon (main hand)
  - Off-hand (shield, secondary weapon)
  - Armor (body, helmet, gloves, boots)
  - Accessories (rings, amulets)
- **Item Categories**:
  - Weapons (swords, axes, bows, wands)
  - Armor (leather, chain, plate)
  - Potions (healing, mana, buffs)
  - Scrolls (teleport, identify, enchant)
  - Food (bread, rations, corpses)
  - Keys and quest items
- **Item Identification**: Unknown items must be identified
- **Weight/Encumbrance**: Limited carrying capacity

### 5. Monsters & AI
- **Enemy Types**:
  - Animals (rats, snakes, bats)
  - Humanoids (orcs, goblins, trolls)
  - Undead (zombies, skeletons, ghosts)
  - Dragons and bosses
- **AI Behaviors**:
  - Wandering
  - Aggressive (chase on sight)
  - Defensive (flee when low HP)
  - Pack behavior
- **Line of Sight**: Enemies only react when player is visible
- **Difficulty Scaling**: Stronger monsters on deeper floors

### 6. Field of View & Fog of War
- **FOV Algorithm**: Shadowcasting or raycasting
- **Fog of War**: Explored areas remain visible but dimmed
- **Light Sources**: Torches, spells affect vision radius
- **Dark Rooms**: Reduced vision in unlit areas

### 7. User Interface
- **Main View**: Dungeon display (ASCII or tiles)
- **Status Bar**: HP, MP, Level, Depth, Hunger
- **Message Log**: Combat feedback, events
- **Inventory Screen**: Item management
- **Character Sheet**: Stats and equipment
- **Help/Commands Menu**: Keybindings reference

### 8. Controls
- **Movement**: Arrow keys or numpad (8 directions + wait)
- **Actions**:
  - `i` - Inventory
  - `e` - Equipment
  - `g` - Pick up item
  - `d` - Drop item
  - `u` - Use item
  - `<` / `>` - Stairs up/down
  - `s` - Search for secrets
  - `?` - Help
  - `Q` - Quit/Save

## Technical Implementation

### Architecture
```
game-003/
├── index.html          # Main game file
├── manifest.json       # Game metadata
├── gemcore.config.json # Configuration
├── game-plan.md        # This file
└── assets/             # (Future) Sprites, sounds
    ├── tiles/
    └── sounds/
```

### Technologies
- **Rendering**: HTML5 Canvas or terminal-style div grid
- **State Management**: JavaScript classes/modules
- **Data Structures**:
  - 2D arrays for dungeon maps
  - Entity-Component system for game objects
  - Priority queue for turn order
- **Algorithms**:
  - Dijkstra/A* for pathfinding
  - BSP/Cellular Automata for generation
  - Shadowcasting for FOV

### Core Classes
```javascript
class Game { }          // Main game loop
class Map { }           // Dungeon data and generation
class Player { }        // Player character
class Monster { }       // Enemy entities
class Item { }          // Items and equipment
class FOV { }           // Field of view calculator
class UI { }            // User interface
class MessageLog { }    // Message history
```

## Development Phases

### Phase 1: Core Engine (MVP)
- [x] Basic dungeon generation (rooms + corridors)
- [x] Player movement (4-8 directions)
- [x] Simple rendering (ASCII characters)
- [x] Collision detection (walls)
- [x] Turn-based system

### Phase 2: Combat & Enemies
- [x] Monster spawning
- [x] Basic AI (chase player)
- [x] Melee combat
- [x] HP/damage system
- [x] Death/game over

### Phase 3: Items & Inventory
- [ ] Item entities on map
- [ ] Pick up/drop items
- [ ] Inventory UI
- [ ] Equipping weapons/armor
- [ ] Stat bonuses from equipment

### Phase 4: Advanced Features
- [ ] Magic system
- [ ] Ranged combat
- [ ] Field of View
- [ ] Fog of war
- [ ] Multiple dungeon levels
- [ ] Stairs navigation

### Phase 5: Polish & Content
- [ ] More monster types
- [ ] More items/equipment
- [ ] Status effects
- [ ] Hunger system
- [ ] Save/load system
- [ ] High scores
- [ ] Sound effects
- [ ] Tile graphics (optional)

## Game Balance Considerations
- **Difficulty Curve**: Gradual increase over 10-20 floors
- **Resource Management**: Limited healing/mana forces strategic play
- **Risk vs Reward**: Deeper dungeons have better loot
- **Build Variety**: Multiple viable character builds
- **No Grinding**: XP balanced to discourage excessive farming

## Inspirations & References
- NetHack (classic roguelike depth)
- Brogue (elegant simplicity)
- Dungeon Crawl Stone Soup (modern roguelike design)
- Pixel Dungeon (mobile-friendly interface)

## Success Metrics
- Player reaches dungeon floor 5+ (retention)
- Average play session: 15-30 minutes
- Death feels fair, not frustrating
- Players want to try "one more run"

## Future Expansion Ideas
- Multiple character races
- Skill trees
- Crafting system
- Quest system
- Daily challenge mode
- Online leaderboards
- Permadeath optional "story mode"
