// Web Audio API sound system

let audioContext = null;
let masterGain = null;
let soundEnabled = true;

export function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(audioContext.destination);
    }
    return audioContext;
}

export function toggleSound() {
    soundEnabled = !soundEnabled;
    return soundEnabled;
}

// Helper: Play tone with envelope
function playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!soundEnabled || !audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gainNode.gain.value = volume;
    gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + duration
    );

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// Helper: Play chord (multiple frequencies)
function playChord(frequencies, duration, type = 'sine', volume = 0.2) {
    if (!soundEnabled || !audioContext) return;
    frequencies.forEach(freq => {
        playTone(freq, duration, type, volume / frequencies.length);
    });
}

// Sound effects library
export const sounds = {
    // Player shoots
    playerShoot() {
        playTone(600, 0.08, 'square', 0.15);
    },

    // Enemy hit
    enemyHit() {
        playTone(150, 0.08, 'square', 0.15);
    },

    // Enemy death
    enemyDeath() {
        if (!soundEnabled || !audioContext) return;

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
            50,
            audioContext.currentTime + 0.3
        );

        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.3
        );

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.3);
    },

    // XP pickup
    xpCollect() {
        playChord([523, 659, 784], 0.15, 'sine', 0.2);
    },

    // Health pickup
    healthCollect() {
        playChord([440, 554, 659], 0.2, 'triangle', 0.25);
    },

    // Level up
    levelUp() {
        playChord([523, 659, 784, 1047], 0.4, 'triangle', 0.3);
    },

    // Power-up/upgrade selected
    powerUp() {
        playChord([440, 554, 659, 880], 0.3, 'square', 0.25);
    },

    // Player hurt
    playerHurt() {
        if (!soundEnabled || !audioContext) return;

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
            100,
            audioContext.currentTime + 0.2
        );

        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.2
        );

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.2);
    },

    // Boss warning
    bossWarning() {
        playTone(100, 0.5, 'triangle', 0.4);
        setTimeout(() => playTone(150, 0.5, 'triangle', 0.4), 100);
    },

    // UI click
    uiClick() {
        playChord([440, 554], 0.1, 'square', 0.2);
    },
};
