// NPC.js - Non-Player Character class

export class NPC {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;

        // Set NPC properties based on type
        this.setStatsFromType(type);

        this.lastSpokenTurn = -1; // Track when NPC last spoke
        this.dialogueIndex = 0; // Track which dialogue to show next
    }

    setStatsFromType(type) {
        const npcTypes = {
            'merchant': {
                char: 'M',
                color: '#FFD700',
                name: 'Merchant',
                dialogues: [
                    "Welcome, traveler! I have wares for sale!",
                    "These dungeons are dangerous. You'll need good equipment.",
                    "I've been trading here for years. The deeper you go, the more treasure you find!",
                    "Watch out for the trolls on the lower levels!",
                    "Business has been slow lately. Not many adventurers make it back..."
                ]
            },
            'guard': {
                char: 'G',
                color: '#4169E1',
                name: 'Guard',
                dialogues: [
                    "Halt! State your business!",
                    "These dungeons are off limits to civilians.",
                    "I've seen many brave souls venture into these depths. Few return.",
                    "Stay alert. The monsters grow stronger with each level.",
                    "My watch ends soon, but the danger never sleeps."
                ]
            },
            'wizard': {
                char: 'W',
                color: '#9370DB',
                name: 'Wizard',
                dialogues: [
                    "Ah, another seeker of arcane knowledge!",
                    "The magic in these depths is ancient and powerful.",
                    "Beware the shadows - they hunger for the unwary.",
                    "I sense great potential in you, adventurer.",
                    "The stars align in your favor... for now."
                ]
            },
            'hermit': {
                char: 'h',
                color: '#8B4513',
                name: 'Hermit',
                dialogues: [
                    "Leave me be! I seek only solitude.",
                    "The world above has nothing for me anymore.",
                    "These caves are my home now.",
                    "You're braver than you look, coming down here.",
                    "I've seen things in these depths that would drive most mad..."
                ]
            },
            'healer': {
                char: 'H',
                color: '#90EE90',
                name: 'Healer',
                dialogues: [
                    "Your wounds look serious. Rest here a moment.",
                    "I tend to those who brave these dangerous halls.",
                    "May the light guide your path through the darkness.",
                    "Every adventurer needs someone to patch them up.",
                    "Be careful out there. I can only do so much..."
                ]
            }
        };

        const stats = npcTypes[type] || npcTypes['merchant'];
        this.char = stats.char;
        this.color = stats.color;
        this.name = stats.name;
        this.dialogues = stats.dialogues;
    }

    speak() {
        // Get next dialogue in rotation
        const dialogue = this.dialogues[this.dialogueIndex];
        this.dialogueIndex = (this.dialogueIndex + 1) % this.dialogues.length;
        return dialogue;
    }

    getRandomDialogue() {
        // Get a random dialogue (for ambient speech)
        const index = Math.floor(Math.random() * this.dialogues.length);
        return this.dialogues[index];
    }

    getPosition() {
        return { x: this.x, y: this.y };
    }

    serialize() {
        return {
            x: this.x,
            y: this.y,
            type: this.type,
            dialogueIndex: this.dialogueIndex,
            lastSpokenTurn: this.lastSpokenTurn
        };
    }

    static deserialize(data) {
        const npc = new NPC(data.x, data.y, data.type);
        npc.dialogueIndex = data.dialogueIndex || 0;
        npc.lastSpokenTurn = data.lastSpokenTurn || -1;
        return npc;
    }
}
