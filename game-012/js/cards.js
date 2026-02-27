// ============================================================
// Arcana Pull — Card Definitions
// Derived from res/tarot/tarot-images.json
//
// Each card has:
//   id        — unique string key (e.g. 'm00', 'c01', 'w14')
//   name      — display name
//   suit      — 'major' | 'cups' | 'swords' | 'wands' | 'pentacles'
//   number    — card number within suit (0–21 for major, 1–14 for minor)
//   arcana    — 'major' | 'minor'
//   img       — sprite key (matches k.loadSprite key in main.js)
//   keywords  — array of flavour keyword strings
//   element   — thematic element for battle archetype
//   rarity    — 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY'
//
// Battle stats (base values, scale by rarity / card number):
//   hp, atk, spd, def
// ============================================================

import { RARITY, SUITS } from './config.js';

// --------------- helpers ---------------

function minorStats(suit, num) {
    // Scale stats 1-14; court cards (11-14) get a boost
    const isCourt = num >= 11;
    const base = isCourt ? 60 + (num - 11) * 10 : 30 + (num - 1) * 3;
    switch (suit) {
        case 'wands':     return { hp: base,      atk: base + 15, spd: base - 5,  def: base - 10 };
        case 'cups':      return { hp: base + 20,  atk: base - 5,  spd: base,      def: base + 5  };
        case 'swords':    return { hp: base - 5,   atk: base + 10, spd: base + 15, def: base - 10 };
        case 'pentacles': return { hp: base + 15,  atk: base - 5,  spd: base - 10, def: base + 20 };
        default:          return { hp: base,        atk: base,      spd: base,      def: base      };
    }
}

function majorStats(num) {
    // Major arcana scale 0-21; all are powerful
    const base = 60 + num * 3;
    return { hp: base + 20, atk: base + 10, spd: base, def: base + 5 };
}

function minorRarity(num) {
    if (num <= 3)  return 'COMMON';
    if (num <= 7)  return 'UNCOMMON';
    if (num <= 10) return 'RARE';
    return 'UNCOMMON'; // court cards are uncommon/rare
}

function majorRarity(num) {
    // High-number majors are rarer
    if (num <= 7)  return 'RARE';
    if (num <= 15) return 'RARE';
    return 'LEGENDARY'; // 16-21: Tower, Star, Moon, Sun, Judgement, World
}

// --------------- Major Arcana (22 cards) ---------------

const MAJOR_CARDS = [
    { num: 0,  name: 'The Fool',       keywords: ['freedom','faith','inexperience','innocence'],        element: 'Air'   },
    { num: 1,  name: 'The Magician',   keywords: ['capability','empowerment','activity'],               element: 'Air'   },
    { num: 2,  name: 'High Priestess', keywords: ['intuition','reflection','purity','initiation'],      element: 'Water' },
    { num: 3,  name: 'The Empress',    keywords: ['fertility','growth','nature','nurturing'],            element: 'Earth' },
    { num: 4,  name: 'The Emperor',    keywords: ['authority','regulation','direction','structure'],     element: 'Fire'  },
    { num: 5,  name: 'The Hierophant', keywords: ['tradition','conformance','education','blessing'],    element: 'Earth' },
    { num: 6,  name: 'The Lovers',     keywords: ['love','union','attraction','choice'],                element: 'Air'   },
    { num: 7,  name: 'The Chariot',    keywords: ['advancement','victory','triumph','control'],         element: 'Water' },
    { num: 8,  name: 'Strength',       keywords: ['discipline','boldness','self-discipline','power'],   element: 'Fire'  },
    { num: 9,  name: 'The Hermit',     keywords: ['solitude','guidance','wisdom','humility'],           element: 'Earth' },
    { num: 10, name: 'Wheel of Fortune',keywords: ['luck','randomness','cycles','destiny'],             element: 'Fire'  },
    { num: 11, name: 'Justice',        keywords: ['balance','truth','objectivity','cause and effect'],  element: 'Air'   },
    { num: 12, name: 'The Hanged Man', keywords: ['sacrifice','contemplation','perspective','reversal'],element: 'Water' },
    { num: 13, name: 'Death',          keywords: ['endings','completion','transition','passage'],        element: 'Water' },
    { num: 14, name: 'Temperance',     keywords: ['balance','moderation','synthesis','healing'],        element: 'Fire'  },
    { num: 15, name: 'The Devil',      keywords: ['shadow','materialism','bondage','addiction'],        element: 'Earth' },
    { num: 16, name: 'The Tower',      keywords: ['chaos','ruin','dramatic change','collapse'],         element: 'Fire'  },
    { num: 17, name: 'The Star',       keywords: ['hope','faith','renewal','abundance'],                element: 'Air'   },
    { num: 18, name: 'The Moon',       keywords: ['mystery','madness','deception','dreams'],            element: 'Water' },
    { num: 19, name: 'The Sun',        keywords: ['joy','brilliance','vitality','wholeness'],           element: 'Fire'  },
    { num: 20, name: 'Judgement',      keywords: ['resurrection','evaluation','renewal','reflection'],  element: 'Fire'  },
    { num: 21, name: 'The World',      keywords: ['completion','integration','wholeness','perfection'], element: 'Earth' },
];

// --------------- Minor Arcana helpers ---------------

const SUIT_NAMES = ['wands', 'cups', 'swords', 'pentacles'];

const MINOR_NAMES = {
    1:  'Ace',   2:  'Two',    3:  'Three', 4:  'Four',
    5:  'Five',  6:  'Six',    7:  'Seven', 8:  'Eight',
    9:  'Nine',  10: 'Ten',    11: 'Page',  12: 'Knight',
    13: 'Queen', 14: 'King',
};

const MINOR_KEYWORDS = {
    wands:     {
        1: ['creativity','energy','initiation','capacity'],
        2: ['planning','boldness','confidence','exploration'],
        3: ['contribution','collaboration','overseas','travel'],
        4: ['celebration','harmony','homecoming','refuge'],
        5: ['competition','conflict','disagreement','opportunity'],
        6: ['victory','acclaim','triumph','recognition'],
        7: ['bravery','resolve','determination','guarding'],
        8: ['speed','action','movement','swiftness'],
        9: ['persistence','stamina','resilience','opposition'],
        10:['exhaustion','excess','overdoing','accomplishment'],
        11:['enthusiasm','adventure','passage','excitement'],
        12:['haste','passion','action','impulsiveness'],
        13:['authority','confidence','intuition','leadership'],
        14:['authority','experience','stability','integrity'],
    },
    cups:      {
        1: ['intuition','spirituality','affection','motivation'],
        2: ['union','attraction','conjunction','affection'],
        3: ['celebration','expression','friendship','community'],
        4: ['boredom','apathy','contemplation','indifference'],
        5: ['loss','grief','sorrow','disappointment'],
        6: ['nostalgia','sharing','past','innocence'],
        7: ['confusion','fantasy','imagination','wishful thinking'],
        8: ['longing','abandonment','withdrawal','walking away'],
        9: ['satisfaction','comfort','fulfillment','reward'],
        10:['joy','satisfaction','family','completion'],
        11:['enthusiasm','imagination','sensitivity','dreaming'],
        12:['romanticism','idealism','pursuit','wooing'],
        13:['intuition','creativity','empathy','mystery'],
        14:['mastery','patience','maturity','calm'],
    },
    swords:    {
        1: ['victory','clarity','insight','mental acuity'],
        2: ['denial','debate','delay','choice'],
        3: ['variance','sorrow','heartbreak','grief'],
        4: ['meditation','introspection','rest','withdrawal'],
        5: ['defeat','shame','dishonor','conflict'],
        6: ['transition','leaving','finding calm','moving on'],
        7: ['stealth','independence','cunning','strategy'],
        8: ['restriction','limitations','trapping','feeling stuck'],
        9: ['anguish','anxiety','despair','suffering'],
        10:['exhaustion','ruin','surrender','ending'],
        11:['vigilance','curiosity','preparation','spying'],
        12:['haste','action','ambition','cutting'],
        13:['critical thinking','perception','clarity','objectivity'],
        14:['objectivity','authority','judgment','precision'],
    },
    pentacles: {
        1: ['wealth','practicality','groundedness','new opportunity'],
        2: ['change','balance','dexterity','juggling'],
        3: ['ability','teamwork','reputation','mastery'],
        4: ['control','security','conservation','possessiveness'],
        5: ['hardship','loss','insecurity','destitution'],
        6: ['charity','sharing','giving','prosperity'],
        7: ['patience','investment','cultivation','waiting'],
        8: ['diligence','skill','apprenticeship','hard work'],
        9: ['elegance','discipline','luxury','accomplishment'],
        10:['legacy','inheritance','stability','family wealth'],
        11:['diligence','practice','perfectionism','study'],
        12:['dependability','caution','method','efficiency'],
        13:['grace','beauty','nurture','prosperity'],
        14:['abundance','authority','practicality','stability'],
    },
};

// ============================================================
// Build the full card list
// ============================================================

export const CARD_DEFS = [];

// --- Major Arcana ---
for (const m of MAJOR_CARDS) {
    const id = `m${String(m.num).padStart(2, '0')}`;
    CARD_DEFS.push({
        id,
        name:     m.name,
        suit:     'major',
        number:   m.num,
        arcana:   'major',
        img:      id,           // sprite key (loaded in main.js)
        keywords: m.keywords,
        element:  m.element,
        rarity:   majorRarity(m.num),
        ...majorStats(m.num),
    });
}

// --- Minor Arcana ---
for (const suit of SUIT_NAMES) {
    const prefix = suit[0]; // w, c, s, p
    for (let num = 1; num <= 14; num++) {
        const id = `${prefix}${String(num).padStart(2, '0')}`;
        const cardName = num <= 10
            ? `${MINOR_NAMES[num]} of ${suit.charAt(0).toUpperCase() + suit.slice(1)}`
            : `${MINOR_NAMES[num]} of ${suit.charAt(0).toUpperCase() + suit.slice(1)}`;
        CARD_DEFS.push({
            id,
            name:     cardName,
            suit,
            number:   num,
            arcana:   'minor',
            img:      id,
            keywords: MINOR_KEYWORDS[suit][num] ?? [],
            element:  suit === 'wands' ? 'Fire' : suit === 'cups' ? 'Water' : suit === 'swords' ? 'Air' : 'Earth',
            rarity:   minorRarity(num),
            ...minorStats(suit, num),
        });
    }
}

// Convenience lookup by id
export const CARD_BY_ID = Object.fromEntries(CARD_DEFS.map(c => [c.id, c]));

// Weighted pull pool (excludes legendary — those come via pity)
export const PULL_POOL = CARD_DEFS.filter(c => c.rarity !== 'LEGENDARY');
export const LEGENDARY_POOL = CARD_DEFS.filter(c => c.rarity === 'LEGENDARY');