// The voiced lines that exist as files (audio/vo/<key>.mp3), written by dev/audio/voices.mjs. A line is named by
// voiceKey(who, text), a hash of the speaker and the raw script line, so an edited line loses its clip instead of
// playing the wrong one.

export const VOICED = new Set(/*VO*/['bram-1qehwxl', 'bram-1wdv225', 'bram-1xwbqb4', 'bram-ddvgxr', 'kael-1do9rls', 'kael-1jmca8l', 'kael-1u3y88v', 'kael-wl66o3', 'nyx-16vm513', 'nyx-1bxcd5h', 'nyx-1c69ler', 'nyx-yak3bz', 'ren-16s0628', 'ren-1t6nk2h', 'ren-l23kcq', 'ren-lbx8en', 'sera-1rpxyth', 'sera-1ugz87z', 'sera-ssknby', 'sera-w735qr']/*VO*/);

export function voiceKey(who, text) {
    let h = 2166136261;
    const s = who + '|' + text;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return who + '-' + (h >>> 0).toString(36);
}
