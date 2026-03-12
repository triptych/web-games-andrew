import { events } from './events.js';
import {
    STAT_MAX, STAT_MIN,
    HUNGER_DECAY, HAPPY_DECAY, ENERGY_DECAY, HEALTH_DECAY_THRESHOLD,
    STAGE_EGG_DURATION, STAGE_BABY_DURATION, STAGE_CHILD_DURATION, STAGE_TEEN_DURATION,
    PET_SPECIES,
} from './config.js';

const SAVE_KEY = 'tamagoji_save';

/**
 * Global game state for Tamagoji.
 * Handles pet lifecycle, stats, feeding, interactions.
 * Call state.reset() / state.startNewEgg() to begin.
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this._gold        = 50;
        this._uiMode      = 'main'; // main | feed | interact | shop | eggs
        this._isGameOver  = false;

        // Pet data
        this._pet = null;
        this._petAge      = 0;  // seconds since hatch
        this._stage       = 'none'; // none | egg | baby | child | teen | adult
        this._eggTimer    = 0;
        this._speciesIdx  = 0;

        // Incubating eggs (purchased, waiting to hatch)
        this._eggs = [];

        // Stats
        this._hunger = 70;
        this._happy  = 70;
        this._energy = 80;
        this._health = 100;

        // Mood derived from stats
        this._mood = 'content';

        // Animation state for pet reactions
        this._reactionEmoji  = null;
        this._reactionTimer  = 0;
    }

    // ---- Gold ----
    get gold() { return this._gold; }
    addGold(n) {
        this._gold = Math.max(0, this._gold + n);
        events.emit('goldChanged', this._gold);
    }

    // ---- UI mode ----
    get uiMode() { return this._uiMode; }
    set uiMode(v) {
        this._uiMode = v;
        events.emit('uiModeChanged', v);
    }

    // ---- Stats (clamped, emit on change) ----
    get hunger() { return this._hunger; }
    get happy()  { return this._happy;  }
    get energy() { return this._energy; }
    get health() { return this._health; }

    _setStat(key, val) {
        const clamped = Math.min(STAT_MAX, Math.max(STAT_MIN, val));
        if (this[`_${key}`] !== clamped) {
            this[`_${key}`] = clamped;
            events.emit('petStatsChanged', this.getStats());
        }
    }

    getStats() {
        return {
            hunger: this._hunger,
            happy:  this._happy,
            energy: this._energy,
            health: this._health,
        };
    }

    // ---- Stage / lifecycle ----
    get stage() { return this._stage; }
    get petAge() { return this._petAge; }

    get petEmoji() {
        const species = PET_SPECIES[this._speciesIdx];
        if (!species) return '🥚';
        if (this._stage === 'egg')   return species.egg;
        if (this._stage === 'baby')  return species.baby;
        if (this._stage === 'child') return species.child;
        if (this._stage === 'teen')  return species.teen;
        if (this._stage === 'adult') return species.adult;
        return '❓';
    }

    get petName() {
        const species = PET_SPECIES[this._speciesIdx];
        return species ? species.name : 'Unknown';
    }

    get speciesColor() {
        const species = PET_SPECIES[this._speciesIdx];
        return species ? species.color : [200, 200, 200];
    }

    // ---- Reaction ----
    get reactionEmoji()  { return this._reactionEmoji; }
    get reactionTimer()  { return this._reactionTimer; }
    set reactionTimer(v) { this._reactionTimer = v; }
    set reactionEmoji(v) { this._reactionEmoji = v; }

    // ---- Eggs queue ----
    get eggs() { return this._eggs; }

    addEgg(speciesIdx) {
        this._eggs.push({ speciesIdx, timer: 0 });
        events.emit('newEggReady');
    }

    // ---- Start a new egg ----
    startNewEgg(speciesIdx = null) {
        if (speciesIdx === null) {
            speciesIdx = Math.floor(Math.random() * PET_SPECIES.length);
        }
        this._speciesIdx = speciesIdx;
        this._stage      = 'egg';
        this._eggTimer   = 0;
        this._petAge     = 0;
        this._hunger     = 70;
        this._happy      = 70;
        this._energy     = 80;
        this._health     = 100;
        this._isGameOver = false;
        events.emit('petStageChanged', 'egg');
        events.emit('petStatsChanged', this.getStats());
    }

    // ---- Per-frame update (call with dt in seconds) ----
    tick(dt) {
        if (this._isGameOver) return;
        if (this._stage === 'none') return;

        // Egg countdown
        if (this._stage === 'egg') {
            this._eggTimer += dt;
            if (this._eggTimer >= STAGE_EGG_DURATION) {
                this._stage = 'baby';
                this._petAge = 0;
                events.emit('petHatched', PET_SPECIES[this._speciesIdx]);
                events.emit('petStageChanged', 'baby');
            }
            return;
        }

        // Age the pet
        this._petAge += dt;

        // Stage advancement
        const prevStage = this._stage;
        if (this._stage === 'baby'  && this._petAge >= STAGE_BABY_DURATION)  this._stage = 'child';
        if (this._stage === 'child' && this._petAge >= STAGE_BABY_DURATION + STAGE_CHILD_DURATION) this._stage = 'teen';
        if (this._stage === 'teen'  && this._petAge >= STAGE_BABY_DURATION + STAGE_CHILD_DURATION + STAGE_TEEN_DURATION) this._stage = 'adult';
        if (this._stage !== prevStage) {
            events.emit('petStageChanged', this._stage);
        }

        // Stat decay
        this._setStat('hunger', this._hunger - HUNGER_DECAY * dt);
        this._setStat('happy',  this._happy  - HAPPY_DECAY  * dt);
        this._setStat('energy', this._energy - ENERGY_DECAY * dt);

        // Health drops if hunger or happy are critically low
        if (this._hunger < HEALTH_DECAY_THRESHOLD || this._happy < HEALTH_DECAY_THRESHOLD) {
            this._setStat('health', this._health - 1.2 * dt);
        } else if (this._health < 100) {
            // Slow recovery when healthy
            this._setStat('health', this._health + 0.3 * dt);
        }

        // Reaction timer
        if (this._reactionTimer > 0) {
            this._reactionTimer -= dt;
            if (this._reactionTimer <= 0) this._reactionEmoji = null;
        }

        // Derive mood
        this._updateMood();

        // Death
        if (this._health <= 0) {
            this._isGameOver = true;
            events.emit('petDied');
        }
    }

    _updateMood() {
        let mood = 'content';
        if (this._health < 30)          mood = 'sick';
        else if (this._hunger < 25)     mood = 'hungry';
        else if (this._energy < 20)     mood = 'tired';
        else if (this._happy < 30)      mood = 'sad';
        else if (this._happy > 75 && this._hunger > 60) mood = 'happy';

        if (mood !== this._mood) {
            this._mood = mood;
            events.emit('moodChanged', mood);
        }
    }

    get mood() { return this._mood; }
    get isGameOver() { return this._isGameOver; }

    // ---- Feed ----
    feed(foodType) {
        if (this._stage === 'egg' || this._stage === 'none') return;
        this._setStat('hunger', this._hunger + foodType.hunger);
        this._setStat('happy',  this._happy  + (foodType.happy  || 0));
        this._setStat('energy', this._energy + (foodType.energy || 0));
        this._reactionEmoji = foodType.emoji;
        this._reactionTimer = 2;
        events.emit('feedStart', foodType.id);
    }

    // ---- Interact ----
    interact(interactionType) {
        if (this._stage === 'egg' || this._stage === 'none') return;
        if (interactionType.happy)   this._setStat('happy',  this._happy  + interactionType.happy);
        if (interactionType.energy)  this._setStat('energy', this._energy + interactionType.energy);
        if (interactionType.hunger)  this._setStat('hunger', this._hunger + interactionType.hunger);
        if (interactionType.health)  this._setStat('health', this._health + interactionType.health);
        this._reactionEmoji = interactionType.emoji;
        this._reactionTimer = 2;
        events.emit('interactStart', interactionType.id);
    }

    // ---- Persistence ----
    save() {
        const data = {
            gold:       this._gold,
            stage:      this._stage,
            speciesIdx: this._speciesIdx,
            petAge:     this._petAge,
            eggTimer:   this._eggTimer,
            hunger:     this._hunger,
            happy:      this._happy,
            energy:     this._energy,
            health:     this._health,
            mood:       this._mood,
            isGameOver: this._isGameOver,
            eggs:       this._eggs,
        };
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (_) {}
    }

    load() {
        let data;
        try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (_) {}
        if (!data) return false;

        this._gold       = data.gold       ?? 50;
        this._stage      = data.stage      ?? 'none';
        this._speciesIdx = data.speciesIdx ?? 0;
        this._petAge     = data.petAge     ?? 0;
        this._eggTimer   = data.eggTimer   ?? 0;
        this._hunger     = data.hunger     ?? 70;
        this._happy      = data.happy      ?? 70;
        this._energy     = data.energy     ?? 80;
        this._health     = data.health     ?? 100;
        this._mood       = data.mood       ?? 'content';
        this._isGameOver = data.isGameOver ?? false;
        this._eggs       = data.eggs       ?? [];
        return true;
    }

    clearSave() {
        try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
    }

    get hasSave() {
        try { return localStorage.getItem(SAVE_KEY) !== null; } catch (_) { return false; }
    }
}

export const state = new GameState();
