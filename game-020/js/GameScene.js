/**
 * GameScene — Main river journey for The River.
 *
 * Flow:
 *   1. Show current river segment / location name
 *   2. Present an encounter (traveler to invite, ingredient to collect, or event)
 *   3. Player chooses: Invite / Take / Pass / Skip
 *   4. Advance river; repeat until segment = RIVER_SEGMENTS
 *   5. Transition to dinner evaluation (inline)
 *
 * Communicates with UIScene via EventBus (events.js).
 * All game logic lives here or in imported modules.
 */

import { state }  from './state.js';
import { events } from './events.js';
import {
    GAME_WIDTH, GAME_HEIGHT, COLORS,
    COMPANION_TYPES, INGREDIENT_TYPES,
    RIVER_SEGMENTS, MAX_COMPANIONS,
    DINNER_THRESHOLDS,
    LORD_PREFERENCES, CRAFTING_RECIPES, ALTERNATE_ENDINGS,
} from './config.js';
import {
    initAudio,
    playRiverMove,
    playCompanionJoin,
    playCompanionDecline,
    playPickup,
    playNewsAlert,
    playSuccess,
    playFailure,
    startAmbientDrone,
    stopAmbientDrone,
} from './sounds.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }
function rgb(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

// River location names (one per segment)
const RIVER_LOCATIONS = [
    'The Mossy Shallows',
    'Millbrook Ford',
    'The Old Willow Bend',
    "Fisherman's Cove",
    'The Sunken Bridge',
    'Rushwater Village',
    'The Heronwood Shore',
    'Black Rock Narrows',
    'The Amber Falls',
    'The Shadow Gate',
];

// Tower news hints — tied to run seed; 8 entries map to seed-derived index offsets
const TOWER_NEWS = [
    "Tower Broadcast: 'The lord has been practicing his tasting notes all week.'",
    "Tower Broadcast: 'The great hall has been stripped bare — it thirsts for color.'",
    "Tower Broadcast: 'Our lord grows nostalgic for the songs of his youth.'",
    "Tower Broadcast: 'Wise counsel is scarce in these halls — bring someone learned.'",
    "Tower Broadcast: 'Fresh river fish would delight the kitchen staff tremendously.'",
    "Tower Broadcast: 'A tale of distant adventure would silence the room tonight.'",
    "Tower Broadcast: 'The lord has procured a new wine cellar — rare spices pair best.'",
    "Tower Broadcast: 'Flowers from the road would warm our cold stone corridors.'",
];

// Unique dialogue lines per companion archetype (shown on their encounter card)
const COMPANION_DIALOGUE = {
    chef:        '"My knives are dull and my hands are old — but I still know the secret to a proper broth."',
    gardener:    '"I have grown the last of my prize roses. Perhaps they deserve a grander table."',
    bard:        '"Every song I know ends in farewell. One more audience would make a fine epilogue."',
    merchant:    '"My ledgers are balanced. My debts paid. I seek only honest company now."',
    farmer:      '"Forty harvests I\'ve seen come and go. This one I\'d like to taste somewhere new."',
    innkeeper:   '"I kept the hearth lit for strangers my whole life. I\'d like to be the stranger for once."',
    weaver:      '"These old hands have threaded a thousand looms. One last tapestry, somewhere worthy."',
    fisherman:   '"The river has fed me for sixty years. It seems only fair I follow it to its end."',
    knight:      '"I have fought in seven wars and won none of them. I prefer a good meal to a good battle."',
    herbalist:   '"The river plants whisper if you know how to listen. I have been listening for sixty years."',
    painter:     '"I burned my last canvas. I carry only memory now — and one good brush."',
    sailor:      '"I have sailed every river worth sailing. This one calls me back for reasons I cannot name."',
    scribe:      '"I have written down the history of four kingdoms. No one has read any of it. I should like to tell the stories instead."',
    candlemaker: '"Every candle I made was for someone else\'s darkness. I thought I\'d carry one of my own for a while."',
    hunter:      '"I can still read the forest better than any map. The tower is a fine quarry for a last hunt."',
    monk:        '"I have prayed in silence for thirty years. I find I am ready for the noise of a feast."',
    alchemist:   '"My greatest experiment is complete. Its name is retirement."',
    sculptor:    '"Stone does not argue. Stone does not leave. I find I miss conversation after all."',
    oracle:      '"I foresaw this moment seventeen years ago. I packed accordingly."',
    troubadour:  '"They exiled me for singing the wrong song. I intend to sing it one more time — at a finer venue."',
    brewmaster:  '"I have brewed ale for kings and beggars alike. The dark lord\'s cellar is a puzzle I\'ve always wanted to solve."',
    mapmaker:    '"Every river on my maps leads here eventually. I thought I should see it for myself."',
};

// Incompatible companion pairs: [id_a, id_b, reason]
const INCOMPATIBLE_PAIRS = [
    ['knight',     'merchant',   'The knight bristles at the merchant\'s easy smiles. Old resentments die hard.'],
    ['alchemist',  'herbalist',  'They argue about remedies before the card is even shown.'],
    ['bard',       'troubadour', 'Two wandering musicians share a boat with considerable tension.'],
    ['oracle',     'merchant',   'The oracle refuses to share a vessel with someone who "sells futures."'],
    ['monk',       'brewmaster', 'The monk eyes the brewmaster\'s casks with undisguised disapproval.'],
    ['scribe',     'sailor',     'The scribe\'s meticulous notes drive the sailor to distraction.'],
    ['hunter',     'gardener',   'The hunter and the gardener have very different opinions on what the forest is for.'],
];

// Additional event card types for Phase 2
const RIVER_EVENTS = [
    {
        name: 'Calm Waters',
        emoji: '🌊',
        text: 'The river runs smooth and quiet. You take a moment to rest.',
        effect: null,
    },
    {
        name: 'Sudden Storm',
        emoji: '⛈️',
        text: 'Dark clouds roll in fast. Rain hammers the deck. You batten down the hatches and push through.',
        effect: null,
    },
    {
        name: 'Floating Debris',
        emoji: '🪵',
        text: 'Half-submerged timber blocks the channel. It costs time to navigate around. No one is hurt, but the mood is subdued.',
        effect: null,
    },
    {
        name: 'Foraging Stop',
        emoji: '🍄',
        text: 'A clearing in the reeds reveals wild mushrooms and river mint. You spend a quiet hour gathering.',
        effect: { type: 'ingredient_bonus' },
    },
    {
        name: 'River Festival',
        emoji: '🎪',
        text: 'A small village celebrates the harvest on the banks. Lanterns bob on the water. Spirits lift aboard.',
        effect: null,
    },
    {
        name: 'Morning Fog',
        emoji: '🌫️',
        text: 'Thick fog holds you at anchor until noon. Conversations drift naturally in the stillness.',
        effect: null,
    },
    {
        name: 'Tower Raven',
        emoji: '🦅',
        text: 'A raven from the dark tower lands on the prow, studies you, and flies back the way it came.',
        effect: null,
    },
];

export class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    create() {
        state.reset();

        // Seeded RNG (simple LCG so encounters vary per run)
        this._rng = this._makeRng(state.runSeed);

        this._phase = 'encounter';  // 'encounter' | 'result' | 'dinner'

        // Build encounter queue for this run
        this._encounters = this._buildEncounters();

        // Determine this run's news order from the seed
        this._newsSequence = this._buildNewsSequence();
        this._newsIndex    = 0;

        // Lord's secret preference (seed-derived; revealed only at dinner)
        const prefIdx = this._rng() % LORD_PREFERENCES.length;
        state.lordPreference = LORD_PREFERENCES[prefIdx];
        this._lordHintDelivered = false;  // raven hint fires once mid-journey

        // Render initial state
        this._buildLayout();
        this._showEncounter();

        // Key bindings
        this._keys = this.input.keyboard.addKeys({
            confirm:  Phaser.Input.Keyboard.KeyCodes.SPACE,
            left:     Phaser.Input.Keyboard.KeyCodes.LEFT,
            right:    Phaser.Input.Keyboard.KeyCodes.RIGHT,
            restart:  Phaser.Input.Keyboard.KeyCodes.R,
            escape:   Phaser.Input.Keyboard.KeyCodes.ESC,
        });

        this._offGameOver = events.on('gameOver', () => this._handleGameOver());

        // Periodic tower news broadcasts
        this._newsTimer  = 0;
        this._nextNewsAt = 40;  // seconds into the run for first hint

        // Start ambient drone
        startAmbientDrone();
    }

    // --------------------------------------------------------
    // Layout
    // --------------------------------------------------------

    _buildLayout() {
        const CX = GAME_WIDTH  / 2;
        const CY = GAME_HEIGHT / 2;

        // Background
        this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, rgb(COLORS.bg));

        // ---- Scrolling river parallax ----
        // Far layer: dark water tone, slow scroll
        this._riverFar  = this._createRiverLayer(0x0f2a45, 0.5, 0.4);
        // Mid layer: mid-blue, medium scroll
        this._riverMid  = this._createRiverLayer(0x1a4a6a, 0.65, 0.9);
        // Near layer: lighter ripple highlights, fast scroll
        this._riverNear = this._createRiverLayer(0x2a6090, 0.35, 1.8);

        // Location label (updated per segment)
        this._locationLabel = this.add.text(CX, 30, '', {
            fontSize: '14px',
            color: hex(COLORS.gold),
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Progress bar background
        this.add.rectangle(CX, 70, 600, 12, 0x1a2a3a).setOrigin(0.5);
        this._progressBar = this.add.rectangle(CX - 300, 70, 0, 12, rgb(COLORS.accent)).setOrigin(0, 0.5);
        this._progressLabel = this.add.text(CX, 88, '', {
            fontSize: '11px',
            color: '#506050',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Encounter card area
        this._cardGroup = this.add.group();

        // Choice buttons (Invite/Take and Pass/Skip)
        this._btnA = this._makeButton(CX - 140, CY + 200, 'INVITE', () => this._chooseA());
        this._btnB = this._makeButton(CX + 140, CY + 200, 'PASS',   () => this._chooseB());

        // Warning text for incompatibility
        this._warningText = this.add.text(CX, CY + 162, '', {
            fontSize: '12px',
            color: hex(COLORS.danger),
            fontFamily: 'monospace',
            wordWrap: { width: 500 },
            align: 'center',
        }).setOrigin(0.5);

        // News ticker at bottom
        this._newsTicker = this.add.text(CX, GAME_HEIGHT - 18, '', {
            fontSize: '12px',
            color: hex(COLORS.gold),
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Companions strip (bottom-left)
        this._companionLabels = [];
    }

    // Creates a strip of tiled rectangles to simulate a water layer
    _createRiverLayer(color, alpha, speed) {
        const stripH = 100;
        const y = GAME_HEIGHT - 50;

        // Use a Graphics object to draw a ripple strip
        const g = this.add.graphics();
        g.fillStyle(color, alpha);
        g.fillRect(0, y - stripH / 2, GAME_WIDTH * 2, stripH);

        // Draw subtle ripple lines on the near/mid layers
        if (speed > 0.5) {
            g.lineStyle(1, 0xffffff, 0.04);
            for (let rx = 0; rx < GAME_WIDTH * 2; rx += 40) {
                g.beginPath();
                g.moveTo(rx, y - 15);
                g.lineTo(rx + 20, y);
                g.lineTo(rx + 40, y - 8);
                g.strokePath();
            }
        }

        g._riverSpeed  = speed;
        g._riverStartX = g.x;
        return g;
    }

    _makeButton(x, y, label, onClick) {
        const btn = this.add.text(x, y, `[ ${label} ]`, {
            fontSize: '20px',
            color: hex(COLORS.accent),
            fontFamily: 'monospace',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover',  () => btn.setColor(hex(COLORS.gold)));
        btn.on('pointerout',   () => btn.setColor(hex(COLORS.accent)));
        btn.on('pointerdown',  onClick);
        return btn;
    }

    // --------------------------------------------------------
    // Encounter generation
    // --------------------------------------------------------

    _makeRng(seed) {
        let s = seed;
        return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return Math.abs(s); };
    }

    // Build seed-determined news order for this run
    _buildNewsSequence() {
        const indices = TOWER_NEWS.map((_, i) => i);
        // Seeded shuffle (Fisher-Yates using the RNG)
        for (let i = indices.length - 1; i > 0; i--) {
            const j = this._rng() % (i + 1);
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        return indices;
    }

    _buildEncounters() {
        const encounters = [];
        const companions  = [...COMPANION_TYPES];
        const ingredients = [...INGREDIENT_TYPES];

        for (let i = 0; i < RIVER_SEGMENTS; i++) {
            const roll = this._rng() % 10;
            if (roll < 5) {
                // Companion encounter
                const idx = this._rng() % companions.length;
                encounters.push({ type: 'companion', data: companions[idx] });
            } else if (roll < 8) {
                // Ingredient encounter
                const idx = this._rng() % ingredients.length;
                encounters.push({ type: 'ingredient', data: ingredients[idx] });
            } else {
                // River event (now from the expanded RIVER_EVENTS pool)
                const idx = this._rng() % RIVER_EVENTS.length;
                encounters.push({ type: 'event', data: RIVER_EVENTS[idx] });
            }
        }
        return encounters;
    }

    // --------------------------------------------------------
    // Incompatibility check
    // --------------------------------------------------------

    _incompatibilityReason(candidateId) {
        const onBoat = state.companions.map(c => c.id);
        for (const [a, b, reason] of INCOMPATIBLE_PAIRS) {
            if (candidateId === a && onBoat.includes(b)) return reason;
            if (candidateId === b && onBoat.includes(a)) return reason;
        }
        return null;
    }

    // --------------------------------------------------------
    // Encounter display
    // --------------------------------------------------------

    _showEncounter() {
        this._cardGroup.clear(true, true);
        this._warningText.setText('');

        const seg = state.riverSegment;
        const loc = RIVER_LOCATIONS[Math.min(seg, RIVER_LOCATIONS.length - 1)];
        this._locationLabel.setText(`Stop ${seg + 1} of ${RIVER_SEGMENTS}  —  ${loc}`);

        // Progress bar
        const pct = seg / RIVER_SEGMENTS;
        this._progressBar.width = 600 * pct;
        this._progressLabel.setText(`${seg} / ${RIVER_SEGMENTS} river segments`);

        // Companions in boat strip
        this._updateCompanionStrip();

        if (seg >= RIVER_SEGMENTS) {
            this._startDinner();
            return;
        }

        const enc = this._encounters[seg];
        const CX  = GAME_WIDTH  / 2;
        const CY  = GAME_HEIGHT / 2;

        // Card background
        const card = this.add.rectangle(CX, CY, 560, 290, 0x0d1e30, 0.95).setStrokeStyle(1, rgb(COLORS.accent), 0.5);
        this._cardGroup.add(card);

        if (enc.type === 'companion') {
            this._showCompanionCard(enc.data, CX, CY);
        } else if (enc.type === 'ingredient') {
            this._showIngredientCard(enc.data, CX, CY);
        } else {
            this._showEventCard(enc.data, CX, CY);
        }

        this._currentEnc = enc;
    }

    _showCompanionCard(companion, CX, CY) {
        const canInvite  = state.companionCount < MAX_COMPANIONS;
        const conflict   = this._incompatibilityReason(companion.id);
        const blocked    = canInvite && conflict !== null;

        const emoji = this.add.text(CX, CY - 90, companion.emoji, { fontSize: '48px' }).setOrigin(0.5);
        this._cardGroup.add(emoji);

        const name = this.add.text(CX, CY - 30, companion.name, {
            fontSize: '24px',
            color: '#dcdcf0',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
        }).setOrigin(0.5);
        this._cardGroup.add(name);

        const rarity = this.add.text(CX, CY + 5, `Rarity: ${companion.rarity}`, {
            fontSize: '12px',
            color: companion.rarity === 'rare' ? hex(COLORS.gold) : '#606070',
            fontFamily: 'monospace',
        }).setOrigin(0.5);
        this._cardGroup.add(rarity);

        const skills = this.add.text(CX, CY + 28, `Skills: ${companion.skills.join(', ')}`, {
            fontSize: '13px',
            color: hex(COLORS.accent),
            fontFamily: 'monospace',
        }).setOrigin(0.5);
        this._cardGroup.add(skills);

        // Unique dialogue per archetype
        const dialogue = COMPANION_DIALOGUE[companion.id] || '"One more journey," they say.';
        const flavor = this.add.text(CX, CY + 75, dialogue, {
            fontSize: '12px',
            color: '#8a8aa0',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            align: 'center',
            wordWrap: { width: 480 },
        }).setOrigin(0.5);
        this._cardGroup.add(flavor);

        // Show incompatibility warning if relevant
        if (conflict) {
            this._warningText.setText(conflict);
        }

        if (!canInvite) {
            this._btnA.setText('[ FULL ]').setColor('#444455');
        } else if (blocked) {
            this._btnA.setText('[ INVITE ]').setColor(hex(COLORS.danger));
        } else {
            this._btnA.setText('[ INVITE ]').setColor(hex(COLORS.accent));
        }
        this._btnB.setText('[ PASS ]').setColor(hex(COLORS.accent));
        this._btnA.setVisible(true);
        this._btnB.setVisible(true);
    }

    _showIngredientCard(ingredient, CX, CY) {
        const emoji = this.add.text(CX, CY - 80, ingredient.emoji, { fontSize: '48px' }).setOrigin(0.5);
        this._cardGroup.add(emoji);

        const name = this.add.text(CX, CY - 20, ingredient.name, {
            fontSize: '24px',
            color: '#dcdcf0',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
        }).setOrigin(0.5);
        this._cardGroup.add(name);

        const cat = this.add.text(CX, CY + 15, `Category: ${ingredient.category}`, {
            fontSize: '13px',
            color: hex(COLORS.accent),
            fontFamily: 'monospace',
        }).setOrigin(0.5);
        this._cardGroup.add(cat);

        const flavor = this.add.text(CX, CY + 60, 'You spot this along the riverbank.\nTake it for the feast?', {
            fontSize: '13px',
            color: '#808090',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            align: 'center',
        }).setOrigin(0.5);
        this._cardGroup.add(flavor);

        this._btnA.setText('[ TAKE ]').setColor(hex(COLORS.accent));
        this._btnB.setText('[ LEAVE ]').setColor(hex(COLORS.accent));
        this._btnA.setVisible(true);
        this._btnB.setVisible(true);
    }

    _showEventCard(evt, CX, CY) {
        if (evt.emoji) {
            const emojiTxt = this.add.text(CX, CY - 70, evt.emoji, { fontSize: '40px' }).setOrigin(0.5);
            this._cardGroup.add(emojiTxt);
        }

        const name = this.add.text(CX, CY - 20, evt.name, {
            fontSize: '26px',
            color: hex(COLORS.dusk),
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
        }).setOrigin(0.5);
        this._cardGroup.add(name);

        const body = this.add.text(CX, CY + 45, evt.text, {
            fontSize: '14px',
            color: '#a0a0b0',
            fontFamily: 'Georgia, serif',
            align: 'center',
            wordWrap: { width: 480 },
        }).setOrigin(0.5);
        this._cardGroup.add(body);

        // Effect hint if applicable
        if (evt.effect && evt.effect.type === 'ingredient_bonus') {
            const bonus = this.add.text(CX, CY + 105, 'You collect some foraged goods.', {
                fontSize: '12px',
                color: hex(COLORS.accent),
                fontFamily: 'monospace',
            }).setOrigin(0.5);
            this._cardGroup.add(bonus);

            // Check for crafting opportunity
            const recipe = this._findAvailableRecipe();
            if (recipe) {
                const craftHint = this.add.text(CX, CY + 125,
                    `Craft available: ${recipe.input[0]} + ${recipe.input[1]} → ${recipe.output.name}`, {
                    fontSize: '11px',
                    color: hex(COLORS.gold),
                    fontFamily: 'monospace',
                }).setOrigin(0.5);
                this._cardGroup.add(craftHint);

                this._btnA.setText('[ CRAFT ]').setColor(hex(COLORS.gold)).setVisible(true);
                this._currentCraftRecipe = recipe;
            } else {
                this._btnA.setVisible(false);
                this._currentCraftRecipe = null;
            }
        } else {
            this._btnA.setVisible(false);
            this._currentCraftRecipe = null;
        }

        this._btnB.setText('[ CONTINUE ]').setColor(hex(COLORS.accent)).setVisible(true);
    }

    // Return the first crafting recipe whose inputs are both in inventory, or null
    _findAvailableRecipe() {
        const heldIds = state.ingredients.map(i => i.id);
        for (const recipe of CRAFTING_RECIPES) {
            const [a, b] = recipe.input;
            if (heldIds.includes(a) && heldIds.includes(b)) return recipe;
        }
        return null;
    }

    // --------------------------------------------------------
    // Choices
    // --------------------------------------------------------

    _chooseA() {
        const enc = this._currentEnc;
        if (!enc) return;

        if (enc.type === 'companion') {
            if (state.companionCount < MAX_COMPANIONS) {
                state.addCompanion(enc.data);
                playCompanionJoin();
            }
        } else if (enc.type === 'ingredient') {
            state.addIngredient(enc.data);
            playPickup();
        } else if (enc.type === 'event' && this._currentCraftRecipe) {
            // Crafting: consume inputs, add crafted result
            this._applyCraft(this._currentCraftRecipe);
            this._currentCraftRecipe = null;
        }

        this._advance();
    }

    _applyCraft(recipe) {
        // Remove one of each input ingredient from inventory
        const inv = state.ingredients;
        const toRemove = [...recipe.input];
        const remaining = [...inv];
        for (const id of toRemove) {
            const idx = remaining.findIndex(i => i.id === id);
            if (idx !== -1) remaining.splice(idx, 1);
        }
        // Rebuild inventory: clear and re-add
        state._ingredients = remaining;
        // Add crafted item
        state.addIngredient(recipe.output);
        playPickup();
    }

    _chooseB() {
        const enc = this._currentEnc;
        if (!enc) return;

        if (enc.type === 'companion') {
            events.emit('companionDeclined', enc.data);
            playCompanionDecline();
        }

        this._advance();
    }

    _advance() {
        // Apply any pending event effects before clearing enc
        if (this._currentEnc && this._currentEnc.type === 'event') {
            const eff = this._currentEnc.data.effect;
            if (eff && eff.type === 'ingredient_bonus') {
                // Grant a random ingredient as bonus
                const idx  = this._rng() % INGREDIENT_TYPES.length;
                state.addIngredient(INGREDIENT_TYPES[idx]);
                playPickup();
            }
        }

        state.advanceRiver();
        playRiverMove();
        this._showEncounter();
    }

    // --------------------------------------------------------
    // Companion strip
    // --------------------------------------------------------

    _updateCompanionStrip() {
        this._companionLabels.forEach(t => t.destroy());
        this._companionLabels = [];

        const companions = state.companions;
        const startX = 12;
        const y = GAME_HEIGHT - 48;

        companions.forEach((c, i) => {
            const lbl = this.add.text(startX + i * 44, y, c.emoji, { fontSize: '28px' }).setOrigin(0, 0.5);
            this._companionLabels.push(lbl);
        });

        if (companions.length === 0) {
            const lbl = this.add.text(startX, y, '(no companions yet)', {
                fontSize: '12px',
                color: '#404050',
                fontFamily: 'monospace',
            }).setOrigin(0, 0.5);
            this._companionLabels.push(lbl);
        }
    }

    // --------------------------------------------------------
    // Dinner evaluation
    // --------------------------------------------------------

    _startDinner() {
        stopAmbientDrone();

        this._cardGroup.clear(true, true);
        this._btnA.setVisible(false);
        this._btnB.setVisible(false);
        this._warningText.setText('');

        const CX = GAME_WIDTH  / 2;
        const CY = GAME_HEIGHT / 2;

        // Calculate dinner score
        const score = this._calcDinnerScore();
        const outcome = this._dinnerOutcome(score);

        // Check for alternate ending
        const companions  = state.companions;
        const ingredients = state.ingredients;
        let altEnding = null;
        for (const ending of ALTERNATE_ENDINGS) {
            if (ending.condition(companions, score, ingredients)) {
                altEnding = ending;
                break;
            }
        }

        state.setDinnerResult(score, outcome, altEnding);

        // Show result
        const title = this.add.text(CX, CY - 180, 'THE FEAST AT THE DARK TOWER', {
            fontSize: '26px',
            color: hex(COLORS.gold),
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
        }).setOrigin(0.5);
        this._cardGroup.add(title);

        // Alternate ending label (if any) shown above the outcome
        const displayLabel = altEnding ? altEnding.label : outcome.label;
        const displayText  = altEnding ? altEnding.text  : outcome.text;
        const displayColor = altEnding ? COLORS.gold : (score >= 50 ? COLORS.success : COLORS.danger);

        const outcomeTxt = this.add.text(CX, CY - 130, displayLabel, {
            fontSize: altEnding ? '32px' : '44px',
            color: hex(displayColor),
            fontFamily: 'Georgia, serif',
            fontStyle: altEnding ? 'italic' : 'normal',
        }).setOrigin(0.5);
        this._cardGroup.add(outcomeTxt);

        const desc = this.add.text(CX, CY - 68, displayText, {
            fontSize: '13px',
            color: hex(COLORS.text),
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            wordWrap: { width: 680 },
            align: 'center',
        }).setOrigin(0.5);
        this._cardGroup.add(desc);

        // Lord's secret preference reveal
        const pref = state.lordPreference;
        if (pref) {
            const prefReveal = this.add.text(CX, CY + 15,
                `The lord's secret passion: ${pref.label}`, {
                fontSize: '13px',
                color: hex(COLORS.gold),
                fontFamily: 'monospace',
            }).setOrigin(0.5);
            this._cardGroup.add(prefReveal);
        }

        const scoreTxt = this.add.text(CX, CY + 50, `Feast Score: ${score}`, {
            fontSize: '22px',
            color: hex(COLORS.gold),
            fontFamily: 'monospace',
        }).setOrigin(0.5);
        this._cardGroup.add(scoreTxt);

        const breakdown = this._scoreBreakdown();
        const brkTxt = this.add.text(CX, CY + 95, breakdown, {
            fontSize: '11px',
            color: '#606070',
            fontFamily: 'monospace',
            align: 'center',
        }).setOrigin(0.5);
        this._cardGroup.add(brkTxt);

        // High-score line
        const hi = state.getHighScore();
        const hiTxt = this.add.text(CX, CY + 135, `Best run: ${hi}`, {
            fontSize: '12px',
            color: score >= hi ? hex(COLORS.success) : '#484858',
            fontFamily: 'monospace',
        }).setOrigin(0.5);
        this._cardGroup.add(hiTxt);

        const restart = this.add.text(CX, CY + 185, 'Press R to sail again  |  ESC for title', {
            fontSize: '14px',
            color: hex(COLORS.accent),
            fontFamily: 'monospace',
        }).setOrigin(0.5);
        this._cardGroup.add(restart);

        if (score >= 50) {
            playSuccess();
        } else {
            playFailure();
        }

        state.addScore(score);
        this._phase = 'dinner';
    }

    _calcDinnerScore() {
        let score = 0;

        // Cooking: companions with cooking + cooking ingredients
        const cookingCompanions   = state.skillCount('cooking');
        const cookingIngredients  = state.countIngredientsByCategory('cooking');
        score += cookingCompanions * 6 + cookingIngredients * 4;

        // Decorating: companions with decorating + decorating ingredients
        const decorCompanions    = state.skillCount('decorating');
        const decorIngredients   = state.countIngredientsByCategory('decorating');
        score += decorCompanions * 5 + decorIngredients * 4;

        // Entertainment: music + stories companions
        score += state.skillCount('music')    * 5;
        score += state.skillCount('stories')  * 4;

        // Wisdom: wisdom companions add a multiplier feel
        score += state.skillCount('wisdom')   * 3;

        // Strength: minor contribution
        score += state.skillCount('strength') * 2;

        // Crafted ingredient bonus: +6 each
        score += state.ingredients.filter(i => i.crafted).length * 6;

        // Companion diversity bonus (variety is valued)
        score += Math.min(state.companionCount, MAX_COMPANIONS) * 2;

        // Incompatibility penalty: each clashing pair docks 8 points
        const onBoat = state.companions.map(c => c.id);
        let clashes = 0;
        for (const [a, b] of INCOMPATIBLE_PAIRS) {
            if (onBoat.includes(a) && onBoat.includes(b)) clashes++;
        }
        score -= clashes * 8;

        // Lord's secret preference multiplier (1.5× for the preferred skill)
        const pref = state.lordPreference;
        if (pref) {
            const prefScore = this._skillScore(pref.id);
            score += Math.round(prefScore * (pref.multiplier - 1));
        }

        return Math.max(0, Math.min(score, 150));
    }

    // Calculate raw points for a single skill (used by preference multiplier)
    _skillScore(skill) {
        switch (skill) {
            case 'cooking':    return state.skillCount('cooking')    * 6 + state.countIngredientsByCategory('cooking')    * 4;
            case 'decorating': return state.skillCount('decorating') * 5 + state.countIngredientsByCategory('decorating') * 4;
            case 'music':      return state.skillCount('music')    * 5;
            case 'stories':    return state.skillCount('stories')  * 4;
            case 'wisdom':     return state.skillCount('wisdom')   * 3;
            case 'strength':   return state.skillCount('strength') * 2;
            default: return 0;
        }
    }

    _dinnerOutcome(score) {
        if (score >= DINNER_THRESHOLDS.legendary) {
            return { label: 'Legendary Feast!', text: 'The dark lord weeps with joy. Songs will be sung of this dinner for a hundred years. You are forever welcome at the tower.' };
        } else if (score >= DINNER_THRESHOLDS.great) {
            return { label: 'A Grand Success', text: 'The hall erupts in applause. The dark lord is genuinely moved. He offers you a standing invitation to return.' };
        } else if (score >= DINNER_THRESHOLDS.good) {
            return { label: 'A Fine Evening', text: 'The dinner is warmly received. A few courses are memorable. The lord nods with satisfaction.' };
        } else if (score >= DINNER_THRESHOLDS.adequate) {
            return { label: 'Passable', text: 'The meal is edible and the company adequate. The lord seems distracted. You leave without incident.' };
        } else if (score >= DINNER_THRESHOLDS.poor) {
            return { label: 'A Disappointing Affair', text: 'The hall is quiet in the wrong way. The lord politely declines a second course. You slip away at the earliest opportunity.' };
        } else {
            return { label: 'Catastrophe', text: 'The soup is cold, the hall is dark, and the lord retires early. Everyone pretends not to notice your exit.' };
        }
    }

    _scoreBreakdown() {
        const cooking  = state.skillCount('cooking')    + ' cooking';
        const decor    = state.skillCount('decorating') + ' decorating';
        const music    = state.skillCount('music')      + ' music';
        const stories  = state.skillCount('stories')    + ' stories';
        const ci       = state.countIngredientsByCategory('cooking')    + ' cooking ingredient(s)';
        const di       = state.countIngredientsByCategory('decorating') + ' decorating ingredient(s)';
        const crafted  = state.ingredients.filter(i => i.crafted).length;
        const craftStr = crafted > 0 ? `  •  ${crafted} crafted` : '';
        const pref     = state.lordPreference ? `  •  pref: ${state.lordPreference.id}` : '';
        return `${cooking}  •  ${decor}  •  ${music}  •  ${stories}\n${ci}  •  ${di}${craftStr}  •  ${state.companionCount} companion(s)${pref}`;
    }

    // --------------------------------------------------------
    // Update
    // --------------------------------------------------------

    update(time, delta) {
        if (state.isGameOver) return;
        if (state.isPaused)   return;

        const dt = delta / 1000;

        // Animate river parallax layers
        if (this._riverFar)  this._riverFar.x  = (this._riverFar.x  - this._riverFar._riverSpeed  * dt * 60) % 60;
        if (this._riverMid)  this._riverMid.x  = (this._riverMid.x  - this._riverMid._riverSpeed  * dt * 60) % 60;
        if (this._riverNear) this._riverNear.x = (this._riverNear.x - this._riverNear._riverSpeed * dt * 60) % 60;

        // Tower news timer (seed-tied order)
        if (this._phase === 'encounter') {
            this._newsTimer += dt;
            if (this._newsTimer >= this._nextNewsAt) {
                this._newsTimer  = 0;
                this._nextNewsAt = 30 + (this._rng() % 20);
                const newsIdx = this._newsSequence[this._newsIndex % this._newsSequence.length];
                this._newsIndex++;
                const news = TOWER_NEWS[newsIdx];
                state.addNews(news);
                this._newsTicker.setText(news);
                playNewsAlert();
            }

            // Lord's raven hint fires once after segment 4 (mid-journey)
            if (!this._lordHintDelivered && state.riverSegment >= 4) {
                this._lordHintDelivered = true;
                const hint = state.lordPreference.hint;
                state.addNews(hint);
                this._newsTicker.setText(hint);
                playNewsAlert();
            }
        }

        // Key handling (keyboard alternative to buttons)
        if (Phaser.Input.Keyboard.JustDown(this._keys.left)    && this._phase === 'encounter') this._chooseA();
        if (Phaser.Input.Keyboard.JustDown(this._keys.right)   && this._phase === 'encounter') this._chooseB();
        if (Phaser.Input.Keyboard.JustDown(this._keys.confirm) && this._phase === 'encounter') this._chooseA();

        if (Phaser.Input.Keyboard.JustDown(this._keys.restart)) this._restart();
        if (Phaser.Input.Keyboard.JustDown(this._keys.escape))  this._goToMenu();
    }

    // --------------------------------------------------------
    // Game over / restart
    // --------------------------------------------------------

    _handleGameOver() {
        // Placeholder — state tracks lives but the core loop doesn't use them yet
    }

    _restart() {
        stopAmbientDrone();
        events.clearAll();
        this.scene.restart();
        this.scene.get('UIScene').scene.restart();
    }

    _goToMenu() {
        stopAmbientDrone();
        events.clearAll();
        this.scene.stop('UIScene');
        this.scene.start('SplashScene');
    }

    shutdown() {
        stopAmbientDrone();
        if (this._offGameOver) this._offGameOver();
    }
}
