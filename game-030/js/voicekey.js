// The name of a voice clip: who says it and a hash of exactly what they say, so editing a line makes it fall
// back to silence (and the pipeline sees it is missing) instead of playing the old words.

import { hash } from './rng.js';

export const voiceKey = (who, text) => `${who}-${hash(text.trim()).toString(36)}`;
