/**
 * Sound System
 * Web Audio API sound generation for weapon effects
 */

// Audio context
let audioContext;
let masterVolume = 0.3; // 30% volume by default

/**
 * Initialize audio context
 */
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('Audio context initialized');
    }
    return audioContext;
}

/**
 * Play a synthesized sound effect
 */
export function playSound(soundType, options = {}) {
    const ctx = initAudio();

    // Resume audio context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const now = ctx.currentTime;
    const { volume = 1.0 } = options;

    switch (soundType) {
        case 'fire_pistol':
            playPistolSound(ctx, now, volume);
            break;
        case 'fire_machinegun':
            playMachineGunSound(ctx, now, volume);
            break;
        case 'fire_shotgun':
            playShotgunSound(ctx, now, volume);
            break;
        case 'fire_rocket':
            playRocketSound(ctx, now, volume);
            break;
        case 'explosion':
            playExplosionSound(ctx, now, volume);
            break;
        case 'emptyClick':
            playEmptyClickSound(ctx, now, volume);
            break;
        case 'weaponSwitch':
            playWeaponSwitchSound(ctx, now, volume);
            break;
        case 'weaponPickup':
            playPickupSound(ctx, now, volume, 800);
            break;
        case 'ammoPickup':
            playPickupSound(ctx, now, volume, 600);
            break;
        case 'playerHurt':
            playPlayerHurtSound(ctx, now, volume);
            break;
        default:
            console.warn('Unknown sound type:', soundType);
    }
}

/**
 * Pistol shot sound - sharp crack
 */
function playPistolSound(ctx, startTime, volume) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Sharp, quick burst
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(200, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, startTime + 0.05);

    // Quick decay
    gainNode.gain.setValueAtTime(volume * masterVolume * 0.3, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.1);
}

/**
 * Machine gun sound - rapid fire burst
 */
function playMachineGunSound(ctx, startTime, volume) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Buzzy, rapid sound
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(40, startTime + 0.06);

    // High-pass filter
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(100, startTime);

    // Very quick decay
    gainNode.gain.setValueAtTime(volume * masterVolume * 0.25, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.08);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.08);
}

/**
 * Shotgun sound - deep boom
 */
function playShotgunSound(ctx, startTime, volume) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Deep, powerful sound
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(120, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(30, startTime + 0.15);

    // Low-pass filter for bass
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, startTime);
    filter.frequency.exponentialRampToValueAtTime(200, startTime + 0.15);

    // Longer decay
    gainNode.gain.setValueAtTime(volume * masterVolume * 0.4, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.2);
}

/**
 * Rocket launcher sound - whoosh and launch
 */
function playRocketSound(ctx, startTime, volume) {
    // Launch sound
    const oscillator1 = ctx.createOscillator();
    const gainNode1 = ctx.createGain();

    oscillator1.connect(gainNode1);
    gainNode1.connect(ctx.destination);

    oscillator1.type = 'sawtooth';
    oscillator1.frequency.setValueAtTime(80, startTime);
    oscillator1.frequency.exponentialRampToValueAtTime(200, startTime + 0.1);

    gainNode1.gain.setValueAtTime(volume * masterVolume * 0.3, startTime);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

    oscillator1.start(startTime);
    oscillator1.stop(startTime + 0.15);

    // Whoosh
    const oscillator2 = ctx.createOscillator();
    const gainNode2 = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    oscillator2.connect(filter);
    filter.connect(gainNode2);
    gainNode2.connect(ctx.destination);

    oscillator2.type = 'whitenoise' in oscillator2 ? 'whitenoise' : 'sawtooth';
    oscillator2.frequency.setValueAtTime(600, startTime + 0.05);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, startTime + 0.05);

    gainNode2.gain.setValueAtTime(volume * masterVolume * 0.2, startTime + 0.05);
    gainNode2.gain.linearRampToValueAtTime(0, startTime + 0.3);

    oscillator2.start(startTime + 0.05);
    oscillator2.stop(startTime + 0.3);
}

/**
 * Explosion sound - big boom
 */
function playExplosionSound(ctx, startTime, volume) {
    // Low boom
    const oscillator1 = ctx.createOscillator();
    const gainNode1 = ctx.createGain();

    oscillator1.connect(gainNode1);
    gainNode1.connect(ctx.destination);

    oscillator1.type = 'sine';
    oscillator1.frequency.setValueAtTime(50, startTime);
    oscillator1.frequency.exponentialRampToValueAtTime(20, startTime + 0.3);

    gainNode1.gain.setValueAtTime(volume * masterVolume * 0.5, startTime);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

    oscillator1.start(startTime);
    oscillator1.stop(startTime + 0.4);

    // Crackling
    const oscillator2 = ctx.createOscillator();
    const gainNode2 = ctx.createGain();

    oscillator2.connect(gainNode2);
    gainNode2.connect(ctx.destination);

    oscillator2.type = 'sawtooth';
    oscillator2.frequency.setValueAtTime(800, startTime + 0.05);
    oscillator2.frequency.exponentialRampToValueAtTime(100, startTime + 0.25);

    gainNode2.gain.setValueAtTime(volume * masterVolume * 0.3, startTime + 0.05);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

    oscillator2.start(startTime + 0.05);
    oscillator2.stop(startTime + 0.3);
}

/**
 * Empty click sound - weapon out of ammo
 */
function playEmptyClickSound(ctx, startTime, volume) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(100, startTime);

    gainNode.gain.setValueAtTime(volume * masterVolume * 0.1, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.05);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.05);
}

/**
 * Weapon switch sound
 */
function playWeaponSwitchSound(ctx, startTime, volume) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, startTime + 0.1);

    gainNode.gain.setValueAtTime(volume * masterVolume * 0.2, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.15);
}

/**
 * Pickup sound (ammo, weapons, items)
 */
function playPickupSound(ctx, startTime, volume, frequency) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, startTime + 0.1);

    gainNode.gain.setValueAtTime(volume * masterVolume * 0.3, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.2);
}

/**
 * Player hurt sound
 */
function playPlayerHurtSound(ctx, startTime, volume) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(300, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, startTime + 0.2);

    gainNode.gain.setValueAtTime(volume * masterVolume * 0.4, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.25);
}

/**
 * Set master volume
 */
export function setMasterVolume(volume) {
    masterVolume = Math.max(0, Math.min(1, volume));
    console.log('Master volume set to:', masterVolume);
}

/**
 * Get master volume
 */
export function getMasterVolume() {
    return masterVolume;
}
