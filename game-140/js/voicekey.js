// Which recorded voice clip a line plays: a short hash of speaker and text (from game-127). Lines with the
// apprentice's name in them, and the apprentice's own lines, are never voiced. Shared by the game and dev/audio/voices.mjs.

/** FNV-1a 32-bit of `who|text`, as 8 hex digits. */
export function voiceKey(who, text) {
    let h = 0x811c9dc5;
    const s = who + '|' + text;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}

/** Whether a line can have a recording: not the player, no names filled in at runtime. */
export function voiceable(who, text) {
    return who !== 'you' && !text.includes('{') && /[a-z]/i.test(text);
}
