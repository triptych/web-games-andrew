// Sound system using Web Audio API
let audioContext = null;
let masterGain = null;
let soundEnabled = true;

export function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.3; // Master volume
        masterGain.connect(audioContext.destination);
    }
    return audioContext;
}

export function toggleSound() {
    soundEnabled = !soundEnabled;
    return soundEnabled;
}

export function isSoundEnabled() {
    return soundEnabled;
}

// Helper function to create oscillator-based sounds
function playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!soundEnabled || !audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gainNode.gain.value = volume;
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// Helper function for more complex sounds using multiple frequencies
function playChord(frequencies, duration, type = 'sine', volume = 0.2) {
    if (!soundEnabled || !audioContext) return;

    frequencies.forEach(freq => {
        playTone(freq, duration, type, volume / frequencies.length);
    });
}

// Sound effects
export const sounds = {
    // Tower placement sound
    placeTower() {
        playChord([440, 554, 659], 0.15, 'square', 0.3);
    },

    // Tower shooting sound
    shoot() {
        if (!soundEnabled || !audioContext) return;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.connect(gainNode);
        gainNode.connect(masterGain);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    },

    // Enemy hit sound
    enemyHit() {
        playTone(150, 0.08, 'square', 0.15);
    },

    // Enemy death sound
    enemyDeath() {
        if (!soundEnabled || !audioContext) return;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);

        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.connect(gainNode);
        gainNode.connect(masterGain);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    },

    // Coin collect sound
    collectCoin() {
        playChord([523, 659, 784], 0.2, 'sine', 0.25);
    },

    // Wave start sound
    waveStart() {
        if (!soundEnabled || !audioContext) return;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.4);

        gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

        oscillator.connect(gainNode);
        gainNode.connect(masterGain);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
    },

    // Wave complete sound
    waveComplete() {
        playChord([523, 659, 784, 1047], 0.4, 'sine', 0.3);
    },

    // Game over sound
    gameOver() {
        if (!soundEnabled || !audioContext) return;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 1);

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

        oscillator.connect(gainNode);
        gainNode.connect(masterGain);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 1);
    },

    // Victory sound
    victory() {
        if (!soundEnabled || !audioContext) return;

        const notes = [523, 587, 659, 784];
        notes.forEach((freq, i) => {
            setTimeout(() => {
                playTone(freq, 0.3, 'sine', 0.25);
            }, i * 150);
        });
    },

    // UI click sound
    uiClick() {
        playTone(600, 0.05, 'square', 0.15);
    },

    // Error/invalid action sound
    error() {
        playTone(100, 0.15, 'sawtooth', 0.2);
    }
};
