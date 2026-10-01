/**
 * looks.js — the appearance vocabulary shared by the hero generator, the
 * character creator and the 3D character builder.
 */

export const EYE_STYLES = ['Bright', 'Sharp', 'Sleepy', 'Round', 'Fierce', 'Gentle', 'Cat', 'Starry', 'Closed', 'Hollow'];
export const BROWS = ['Soft', 'Straight', 'Angry', 'Worried', 'Thick'];
export const MOUTHS = ['Smile', 'Grin', 'Neutral', 'Open', 'Smirk', 'Fang', 'Frown', 'Cat'];
export const MARKS = ['None', 'Freckles', 'War Paint', 'Tribal', 'Star', 'Tear Marks', 'Runes', 'Stripes'];
export const SCARS = ['None', 'Cheek', 'Eye'];
export const HAIR_STYLES = ['Short', 'Spiky', 'Bob', 'Long', 'Ponytail', 'Twin Tails', 'Bun', 'Mohawk', 'Wild Mane', 'Braid', 'Swept', 'Curly', 'Pigtail Buns', 'Hime', 'Undercut', 'Bald'];
export const EAR_TYPES = ['human', 'elf', 'cat', 'wolf', 'fox', 'bunny', 'fin', 'none'];
export const EAR_NAME = { human: 'Round', elf: 'Pointed', cat: 'Cat', wolf: 'Wolf', fox: 'Fox', bunny: 'Bunny', fin: 'Fins', none: 'None' };
export const HORNS = ['None', 'Nubs', 'Curved', 'Ram', 'Unicorn', 'Demon', 'Antlers'];
export const TAILS = ['None', 'Cat', 'Fox', 'Dragon', 'Demon'];
export const WINGS = ['None', 'Bat', 'Feather', 'Fairy', 'Dragon'];
export const BEARDS = ['None', 'Stubble', 'Full', 'Braided'];
export const CAPES = ['None', 'Short', 'Long', 'Tattered'];
export const SHOULDERS = ['None', 'Pauldrons', 'Spiked'];
export const AURAS = ['None', 'Sparkles', 'Flames', 'Frost', 'Shadow', 'Holy'];
export const BUILDS = { min: 0.85, max: 1.3 };

export const HAIR_COLORS = ['#2a2230', '#5a3a26', '#8a5a32', '#e8c66a', '#f4e6b0', '#c4402a', '#ff8a3a', '#f0f0f8', '#b0b8c8', '#ff8ac8', '#5a8aff', '#3ac0a0', '#8a5aff', '#2a3a6a', '#d02a4a', '#7ae05a'];
export const EYE_COLORS = ['#5a3a20', '#3a8aff', '#3ac06a', '#ffb02a', '#ff3a4a', '#a05aff', '#ffd84a', '#8ae8ff', '#ff6ab0', '#e0e0e0'];
export const METALS = ['#c8d0da', '#e8c060', '#b87a4a', '#6a7280', '#3a3a48', '#e8f0ff', '#d0a0ff'];

/** outfit palettes by element: [primary, secondary, accent] candidates */
export const ELEMENT_PALETTE = {
    fire:  { c1: ['#d8402a', '#e8662a', '#b8282a', '#f08a3a'], c2: ['#4a2a22', '#3a2a2a', '#5a3a2a', '#2a2228'], c3: ['#ffc84a', '#ffe08a', '#e8a040'] },
    water: { c1: ['#2a7ad8', '#3aa0e8', '#2a5ab8', '#4ac0d8'], c2: ['#e8f0f8', '#2a3a5a', '#c8d8e8', '#1a2a48'], c3: ['#c8e8ff', '#e8f0ff', '#9fe0ff'] },
    wind:  { c1: ['#3aa04a', '#5ac05a', '#2a8a5a', '#8ac04a'], c2: ['#6a4a2a', '#e8e0c8', '#4a3a2a', '#2a3a2a'], c3: ['#e8d88a', '#c8f0a0', '#ffe8a0'] },
    light: { c1: ['#f4f0e4', '#ffe8a0', '#f8f8ff', '#ffd870'], c2: ['#c8a050', '#8ab0e0', '#e8d8b0', '#b89050'], c3: ['#ffd84a', '#fff4c0', '#ffb84a'] },
    dark:  { c1: ['#5a2a8a', '#3a2a5a', '#7a2a6a', '#2a2a3a'], c2: ['#1a1622', '#2a2230', '#3a2a3a', '#14101a'], c3: ['#d080ff', '#ff4a8a', '#a0a0c0'] },
};

export const GLOW_COLORS = ['#ff6a3d', '#3da5ff', '#4fd36a', '#ffd84a', '#a65cff', '#ffffff', '#ff4ad0', '#4af0e0'];
