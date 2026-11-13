// Every written scene by id: the main story, the heart events, the endings and their epilogues. Pure data lookup.

import { STORY } from './data/story.js';
import { HEARTS } from './data/hearts.js';
import { ENDINGS, EPILOGUES } from './data/endings.js';

const ALL = new Map();
for (const s of STORY) ALL.set(s.id, s);
for (const who in HEARTS) for (const s of HEARTS[who]) ALL.set(s.id, { ...s, kind: 'heart', who });
for (const e of ENDINGS) ALL.set('end_' + e.id, { id: 'end_' + e.id, title: e.title, kind: 'ending', lines: e.lines });
for (const who in EPILOGUES) ALL.set('epi_' + who, { id: 'epi_' + who, title: EPILOGUES[who].title, kind: 'epilogue', lines: EPILOGUES[who].lines });

export function sceneDef(id) {
    const s = ALL.get(id);
    if (!s) throw new Error('no scene ' + id);
    return s;
}
export const ALL_SCENES = [...ALL.values()];
export { STORY };
