/**
 * skills.js — the Constellation: a skill tree bought with Glimmer. Pure.
 * x/y place each star on a 100 × 100 chart (the root sits in the middle at the bottom); the top
 * row of stars sits above it, up to SKY_TOP.
 */
import { STARBURST, SUPERNOVA, LANTERN_AT, MOONLIT_AT } from './config.js';

export const SKY_TOP = -12;

export const BRANCHES = {
    brush: { name: 'Brush', color: '#f5a8d4', blurb: 'Paint more with every touch.' },
    insight: { name: 'Insight', color: '#ffd27a', blurb: 'Find what is left, and never paint wrong.' },
    wonder: { name: 'Wonder', color: '#9ce9d2', blurb: 'More Glimmer, more pages, more play.' },
};

export const SKILLS = [
    { id: 'spark', branch: null, name: 'Keeper\'s Spark', icon: '✦', cost: 0, req: [], x: 50, y: 92,
      desc: 'Where every Colorkeeper begins: one pixel at a time.', wick: 'Everyone starts with a single spark. Even me.' },

    { id: 'soft', branch: 'brush', name: 'Soft Bristles', icon: '✚', cost: 150, req: ['spark'], x: 22, y: 78,
      desc: 'Your brush also paints the four pixels around it, but only ones with the same number.', wick: 'A wider brush that still knows its numbers.' },
    { id: 'broad', branch: 'brush', name: 'Broad Bristles', icon: '■', cost: 700, req: ['soft'], x: 8, y: 62,
      desc: 'A 3 × 3 brush. Still only paints matching numbers.', wick: 'For skies. Big, patient skies.' },
    { id: 'comet', branch: 'brush', name: 'Comet Brush', icon: '●', cost: 2000, req: ['broad'], x: 8, y: 42,
      desc: 'A round 5-wide brush that only paints matching numbers.', wick: 'Swish. Like a comet tail. Comet the cat disapproves.' },
    { id: 'pour', branch: 'brush', name: 'Paint Pour', icon: '◉', cost: 600, req: ['soft'], x: 32, y: 62,
      desc: 'A new tool: tap a pixel to pour its colour into every touching pixel with the same number.', wick: 'Tip the pot and let it find its own way.' },
    { id: 'burst', branch: 'brush', name: 'Starburst', icon: '✺', cost: 3200, req: ['comet', 'pour'], x: 22, y: 24,
      desc: `A new tool: tap to paint every matching pixel in a wide circle. Charges refill as you paint.`, wick: 'Save it for the biggest, emptiest bits.' },

    { id: 'lantern', branch: 'insight', name: 'Lantern Light', icon: '☼', cost: 120, req: ['spark'], x: 50, y: 76,
      desc: 'When a colour has only a few pixels left, they glow, even when zoomed right out.', wick: 'The last few always hide. Now they can\'t.' },
    { id: 'seeker', branch: 'insight', name: 'Seeker Wisp', icon: '➶', cost: 450, req: ['lantern'], x: 42, y: 46,
      desc: 'A new button: fly straight to the nearest pixel still waiting for this colour.', wick: 'A little wisp who loves a game of hide and seek.' },
    { id: 'truehand', branch: 'insight', name: 'True Hand', icon: '✋', cost: 900, req: ['lantern'], x: 60, y: 60,
      desc: 'Your brush skips any pixel that is not this colour\'s number. No more mistakes.', wick: 'Steady. Your hand knows the numbers now.' },
    { id: 'starmap', branch: 'insight', name: 'Star Map', icon: '⌖', cost: 1200, req: ['seeker'], x: 40, y: 28,
      desc: 'A minimap shows the whole picture, where you are looking, and where this colour is still missing.', wick: 'Every chart room needs a map.' },
    { id: 'flourish', branch: 'insight', name: 'Final Flourish', icon: '❋', cost: 3000, req: ['starmap', 'truehand'], x: 50, y: 10,
      desc: 'Once a mosaic is 90% restored, one tap paints the rest.', wick: 'Sometimes a picture just wants to be finished.' },

    { id: 'catcher', branch: 'wonder', name: 'Glimmer Catcher', icon: '❖', cost: 140, req: ['spark'], x: 78, y: 78,
      desc: '+25% Glimmer from every pixel.', wick: 'Catch the sparkles before they float off.' },
    { id: 'streak', branch: 'wonder', name: 'Streak Spark', icon: '⚡', cost: 700, req: ['catcher'], x: 92, y: 62,
      desc: 'Correct pixels in a row build a streak, up to ×1.5 Glimmer. A mistake resets it.', wick: 'Rhythm! Painting has rhythm.' },
    { id: 'studio', branch: 'wonder', name: 'Freestyle Studio', icon: '✎', cost: 800, req: ['catcher'], x: 72, y: 46,
      desc: 'Repaint any finished mosaic however you like, with any colours. No numbers, no rules.', wick: 'Who says a dragon can\'t be green?' },
    { id: 'timelapse', branch: 'wonder', name: 'Time-Lapse', icon: '◷', cost: 900, req: ['studio'], x: 70, y: 28,
      desc: 'Watch any finished mosaic repaint itself in the order you painted it.', wick: 'Look how far you\'ve come, pixel by pixel.' },
    { id: 'sketches', branch: 'wonder', name: 'Hidden Sketches', icon: '✧', cost: 1800, req: ['streak'], x: 92, y: 42,
      desc: 'Unlocks three secret bonus mosaics in the Star Chart.', wick: 'I found these tucked in the back of the logbook.' },
    { id: 'prismheart', branch: 'wonder', name: 'Prism Heart', icon: '❤', cost: 2600, req: ['sketches', 'timelapse'], x: 80, y: 10,
      desc: 'A rainbow shimmer follows your brush, and finished mosaics sparkle in the gallery.', wick: 'The ship\'s own heart, glowing for you.' },

    // the top row, for the long voyage to the Far Shore
    { id: 'supernova', branch: 'brush', name: 'Supernova', icon: '✹', cost: 9500, req: ['burst'], x: 12, y: -4,
      desc: `Starburst grows: a wider circle and up to ${SUPERNOVA.maxCharges} charges.`, wick: 'Bigger. Brighter. Mind your eyebrows.' },
    { id: 'moonlit', branch: 'insight', name: 'Moonlit Lanterns', icon: '☾', cost: 8000, req: ['flourish'], x: 36, y: -4,
      desc: `Lantern Light glows sooner, once a colour has ${MOONLIT_AT} pixels or fewer left.`, wick: 'Pip taught me this one. Lanterns are better in pairs.' },
    { id: 'gilded', branch: 'wonder', name: 'Gilded Frame', icon: '▣', cost: 7000, req: ['prismheart'], x: 64, y: -4,
      desc: 'Doubles the Glimmer for finishing a mosaic, and for finishing it without mistakes.', wick: 'A finished picture deserves a proper frame.' },
    { id: 'postcards', branch: 'wonder', name: 'Postcards', icon: '✉', cost: 6000, req: ['sketches'], x: 90, y: -4,
      desc: 'Unlocks three more bonus mosaics: postcards from the Far Shore.', wick: 'They keep floating in through the porthole.' },
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export const has = (state, id) => state.skills.includes(id);

/** 'owned' | 'available' (prerequisites met) | 'locked'. */
export function skillStatus(state, id) {
    if (has(state, id)) return 'owned';
    const s = SKILL_BY_ID[id];
    return s.req.every((r) => has(state, r)) ? 'available' : 'locked';
}

export function canBuy(state, id) {
    return skillStatus(state, id) === 'available' && state.glimmer >= SKILL_BY_ID[id].cost;
}

export function buySkill(state, id) {
    if (!canBuy(state, id)) return false;
    state.glimmer -= SKILL_BY_ID[id].cost;
    state.skills.push(id);
    return true;
}

/** 0 single, 1 plus, 2 square 3×3, 3 round 5-wide. */
export function brushLevel(state) {
    if (has(state, 'comet')) return 3;
    if (has(state, 'broad')) return 2;
    if (has(state, 'soft')) return 1;
    return 0;
}

export const burstRadius = (state) => (has(state, 'supernova') ? SUPERNOVA.radius : STARBURST.radius);
export const maxCharges = (state) => (has(state, 'supernova') ? SUPERNOVA.maxCharges : STARBURST.maxCharges);
export const lanternAt = (state) => (has(state, 'moonlit') ? MOONLIT_AT : LANTERN_AT);

export const totalSkillCost = () => SKILLS.reduce((t, s) => t + s.cost, 0);
