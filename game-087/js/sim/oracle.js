// The Muse's Well: generators for names, places, story seeds, twists, quirks, magic, prophecies and titles.
// Pure and seeded: draw n of a game always gives the same result, so a reload never reshuffles the bucket.

import { makeRng, hashString } from '../rng.js';
import { hasTalent } from './progress.js';

// ------------------------------------------------------------------ names, by people

const NAMES = {
    elven: {
        label: 'Elven',
        first: ['Ae', 'Ela', 'Thal', 'Syl', 'Cael', 'Lir', 'Fae', 'Ith', 'Nim', 'Ara', 'Eir', 'Mel', 'Val', 'Ser', 'Lae', 'Ilu', 'Yav', 'Quel', 'Eren', 'Tin'],
        mid: ['', '', 'a', 'i', 'e', 'ri', 'la', 'thi', 'na', 'we', 'lo'],
        last: ['rion', 'wen', 'dril', 'thas', 'iel', 'anor', 'ndra', 'mir', 'lith', 'vanya', 'riel', 'adan', 'nor', 'wyn', 'ielle', 'is', 'ath', 'ion'],
        house: ['Silverbough', 'Moonwhisper', 'Starfall', 'Dawnreed', 'Ashleaf', 'Nightbloom', 'Willowmere', 'Frostpetal', 'Sunglade', 'Mistvale'],
    },
    dwarven: {
        label: 'Dwarven',
        first: ['Thor', 'Brun', 'Dur', 'Gim', 'Bal', 'Khaz', 'Dain', 'Grim', 'Bor', 'Hild', 'Ulf', 'Ragn', 'Thra', 'Dvor', 'Mag', 'Orl', 'Kel', 'Bryn'],
        mid: ['', '', 'a', 'i', 'o', 'ri'],
        last: ['in', 'ur', 'dek', 'grim', 'li', 'na', 'rak', 'dottir', 'rik', 'dal', 'gar', 'mund', 'ra', 'hild', 'ok'],
        house: ['Ironhand', 'Stonebeard', 'Deepdelver', 'Coppervein', 'Anvilborn', 'Hammerfell', 'Graniteheart', 'Emberforge', 'Goldvault', 'Ashenhelm'],
    },
    northern: {
        label: 'Northern (human)',
        first: ['Ed', 'Wil', 'Ros', 'Al', 'Hal', 'Os', 'Ber', 'Ead', 'Wyn', 'Mae', 'Gun', 'Sig', 'Ast', 'Bryn', 'Tor', 'Elf', 'Cyn', 'Leof'],
        mid: ['', '', 'a', 'e', 'i'],
        last: ['ric', 'mund', 'wyn', 'gar', 'frith', 'helm', 'ward', 'win', 'da', 'ith', 'ra', 'stan', 'bert', 'gith', 'ny'],
        house: ['of Highmoor', 'Blackwater', 'Thornfield', 'Ravensworth', 'Coldharbour', 'Westerly', 'Fellbrook', 'Ashby', 'Greyholt', 'Windmere'],
    },
    southern: {
        label: 'Southern (human)',
        first: ['Ama', 'Sa', 'Ka', 'Lei', 'Ji', 'Da', 'Ma', 'Na', 'Ze', 'Ro', 'Ta', 'Ye', 'Ish', 'Ku', 'Ola', 'Esi', 'Ren', 'Vey'],
        mid: ['', 'ri', 'li', 'mi', 'ra', 'zi', 'nu', 'ya'],
        last: ['ra', 'shan', 'dun', 'ya', 'mir', 'zar', 'leh', 'kai', 'ro', 'enne', 'ta', 'sha', 'ion', 'dar', 'kemi'],
        house: ['of the Seven Wells', 'Saltwind', 'Amberdune', 'Sunspire', 'of Qasr Ilun', 'Redsail', 'Palmshade', 'of the Lantern Coast', 'Goldreef', 'Cinnabar'],
    },
    orcish: {
        label: 'Orcish',
        first: ['Gro', 'Ur', 'Mog', 'Dra', 'Kro', 'Ghaz', 'Thra', 'Ruk', 'Shag', 'Bol', 'Zug', 'Yag', 'Nar', 'Grak', 'Muz'],
        mid: ['', '', 'a', 'u', 'o'],
        last: ['nak', 'ga', 'rok', 'tha', 'gul', 'mash', 'dak', 'ra', 'zog', 'bha', 'khar', 'luk'],
        house: ['Skullsplitter', 'of the Red Tusk', 'Ironjaw', 'Bonebreaker', 'of the Burning Steppe', 'Ashclaw', 'Stormhowl', 'the Unbowed', 'Dustwalker', 'of the Broken Spear'],
    },
    fae: {
        label: 'Fae',
        first: ['Pip', 'Thistle', 'Bram', 'Moth', 'Wren', 'Ash', 'Briar', 'Lark', 'Puck', 'Nettle', 'Fen', 'Quill', 'Dew', 'Rue', 'Sorrel'],
        mid: ['', '', ''],
        last: ['', 'wick', 'down', 'kin', 'thorn', 'by', 'ling', 'whistle', 'bell', 'wing'],
        house: ['of the Hollow Hill', 'Who Dances on Barrows', 'of Midsummer', 'Thrice-Named', 'of the Rotting Oak', 'Moonmilk', 'of the Silver Court', 'Never-Was', 'Foxglove', 'of the Unseelie Wood'],
    },
    draconic: {
        label: 'Draconic',
        first: ['Vor', 'Sar', 'Ixa', 'Thyr', 'Aza', 'Kael', 'Zyr', 'Ner', 'Oth', 'Valx', 'Syv', 'Rha', 'Umb', 'Ystr'],
        mid: ['a', 'e', 'i', 'o', 'ex', 'ath', 'ul'],
        last: ['thrax', 'gorath', 'mion', 'xia', 'vex', 'ryn', 'thul', 'zhar', 'nyx', 'gaul', 'ion', 'thar'],
        house: ['the Undying', 'Ash-Mother', 'Who Sleeps Beneath', 'the Gilded', 'Stormwing', 'the Hoarder of Bells', 'Old-As-Mountains', 'the Ninth Flame', 'Glass-Eyed', 'the Patient'],
    },
    halfling: {
        label: 'Halfling',
        first: ['Bil', 'Mer', 'Pip', 'Ros', 'Tam', 'Dai', 'Lob', 'Ger', 'Mil', 'Pan', 'Hob', 'Wil', 'Poll', 'Ter', 'Bel'],
        mid: ['', '', 'e', 'o', 'i'],
        last: ['bo', 'ry', 'pin', 'ie', 'my', 'sy', 'kin', 'la', 'wise', 'ber', 'ly', 'do'],
        house: ['Underhill', 'Goodbarrel', 'Applecrumb', 'Thistledown', 'Proudfoot', 'Bramblewick', 'Honeypot', 'Tealeaf', 'Butterbur', 'Greenhedge'],
    },
};
export const PEOPLE_OF_NAMES = Object.entries(NAMES).map(([id, v]) => ({ id, label: v.label }));

function makeName(rng, kind) {
    const t = NAMES[kind] || NAMES.elven;
    let first = rng.pick(t.first) + rng.pick(t.mid) + rng.pick(t.last);
    first = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    if (kind === 'fae' && first.length < 4) first += rng.pick(['wick', 'kin', 'bell']);
    return { first, full: `${first} ${rng.pick(t.house)}` };
}

// ------------------------------------------------------------------ places

const PLACE_PRE = ['Ash', 'Raven', 'Thorn', 'Salt', 'Mist', 'Frost', 'Ember', 'Gloom', 'Silver', 'Hollow', 'Wolf', 'Bramble', 'Stone', 'Storm', 'Gold', 'Bone', 'Moon', 'Star', 'Iron', 'Elder', 'Black', 'White', 'Red', 'Wyrm', 'Crown', 'Candle', 'Briar', 'Fen', 'Wild', 'Cinder'];
const PLACE_SUF = ['ford', 'mere', 'hold', 'fell', 'haven', 'reach', 'watch', 'wick', 'march', 'moor', 'deep', 'spire', 'gate', 'barrow', 'vale', 'wood', 'hollow', 'crag', 'well', 'mouth', 'cairn', 'rest', 'fall', 'shire', 'wyck'];
const PLACE_KIND = ['a walled town', 'a ruined abbey', 'a river port', 'a mountain pass', 'a drowned city', 'a forest of grey birches', 'a salt marsh', 'a crossroads inn', 'a lighthouse on black rocks', 'a market under a dead tree', 'a library cut into a cliff', 'a village on stilts', 'a frozen lake', 'a desert of glass', 'a valley of standing stones', 'a smugglers’ cove', 'the bones of a giant', 'a monastery above the clouds', 'a city on the back of a sleeping turtle', 'a goblin market'];
const PLACE_HOOK = ['where the bells ring on their own at dusk', 'where no one is allowed to speak the old king’s name', 'whose well grants one true answer a year', 'that appears only in fog', 'where every door is painted blue against something', 'that pays its taxes in songs', 'built over a sealed door no one remembers closing', 'where the dead are kept in jars of honey', 'that has been at war with the next village for three hundred years over a goat', 'where the river runs uphill on feast days', 'whose lord has not been seen in forty years', 'where the moths are messengers', 'that has no shadows at noon', 'where children are born knowing one secret', 'that was moved here, stone by stone, from somewhere else'];

// ------------------------------------------------------------------ seeds, twists, quirks, magic, prophecies, titles

const WHO = ['a disgraced knight', 'a cartographer who has never left her tower', 'a goblin accountant', 'the youngest of seven witches', 'a retired hero with a bad knee', 'a dragon’s unwilling scribe', 'a gravedigger who hears the dead', 'a runaway prince disguised as a cook', 'an apprentice to a dead wizard', 'a smuggler with a conscience', 'an elf who has forgotten her own name', 'a dwarf who is afraid of the dark', 'a bard who cannot sing', 'a thief hired to steal back her own memories', 'a priest of a god who just died', 'a beekeeper whose bees can talk', 'a tax collector in the faerie court', 'a ghost who wants to be a person again', 'a necromancer who runs an orphanage', 'a lighthouse keeper on the edge of the world'];
const FINDS = ['finds a map of a country that does not exist', 'inherits a debt owed to a mountain', 'is mistaken for the Chosen One', 'swallows a star by accident', 'is given a sword that refuses to kill', 'hears the castle walls whispering about a murder', 'wakes with someone else’s scars', 'opens a letter addressed to her, dated a hundred years from now', 'is hired to escort a coffin that knocks', 'loses a wager with the moon', 'discovers the prophecy was about the villain', 'finds an egg in the snow that is warm', 'is the only one who remembers the city that vanished last night', 'must marry a stranger to end a war', 'learns that her mentor started the war', 'catches a falling crown', 'is cursed to tell only the truth'];
const MUST = ['and must return it before the next full moon', 'and must cross the Saltwaste to set it right', 'and the only one who can help is their worst enemy', 'and has three days before the whole kingdom forgets them', 'but every step closer costs a memory', 'while hunted by a knight who was once their friend', 'and must decide whether the world deserves saving', 'but the gods are betting on the outcome', 'and the price of success is their name', 'before winter takes the last road out'];

const TWISTS = ['The mentor has been working for the enemy all along, to protect the hero from a greater one.', 'The villain is the hero’s future self, trying to stop a mistake.', 'The prophecy was mistranslated: “slay the king” meant “save the king”.', 'The quest object is a decoy; the real treasure was the person carrying it.', 'The kingdom the heroes are saving is the one that began the war.', 'The monster in the woods is the last of a people the town wiped out.', 'The hero’s magic is borrowed, and the lender is coming to collect.', 'The love interest is the spy the hero has been hunting.', 'The dead king never died; he has been ruling from the mirror.', 'Everyone at the inn is the same person, from different years.', 'The map is of the past; the road it shows has been underwater for a century.', 'The hero is the one the prophecy warned about.', 'The dragon is protecting the town from something under it.', 'The ally who died at the midpoint faked it, and for a good reason.', 'The two warring gods are a married couple in the middle of a divorce.', 'The curse can only be broken by the person who cast it, and they don’t remember.', 'The sword was never magic; the hero was.', 'The villain wins, and the story is told from the ruins.'];

const QUIRK_HABIT = ['counts everything in threes', 'never sits with their back to a door', 'hums hymns to a god they don’t believe in', 'collects the teeth of things they’ve killed', 'apologises to doors before opening them', 'keeps a pressed flower from every town', 'cannot lie, but is very good at misleading', 'eats only food they have cooked themselves', 'names their weapons after old lovers', 'talks to the moon as if it were an old friend', 'carves small birds when they are nervous', 'tells terrible jokes at funerals'];
const QUIRK_SECRET = ['is the one who set the fire', 'was once betrothed to the villain', 'can read minds, a little, and hates it', 'is not human, and is beginning to forget how to pretend', 'owes a life debt to a creature in the marsh', 'has a child no one knows about', 'deserted from the army on the eve of the battle', 'is the rightful heir and wants nothing to do with it', 'stole the face they wear', 'still writes letters to a dead sister', 'sold their shadow for a good harvest', 'is dying, slowly, of the same magic they use'];
const QUIRK_CONTRA = ['a pacifist who is the best swordsman in the realm', 'a coward who has a reputation as a hero', 'a priest who has never prayed', 'a scholar who cannot read', 'a healer who faints at blood', 'a thief with an unbreakable code of honour', 'a monster who wants to be a librarian', 'a queen who sleeps in the stables', 'an assassin who weeps at weddings', 'a giant afraid of heights'];

const MAGIC_NAME = ['Threadcraft', 'Ashsong', 'Hollow Speech', 'The Salt Art', 'Bonelight', 'Starbinding', 'Wordweaving', 'Bloodwrit', 'Tidecalling', 'Mothcraft', 'The Lantern Way', 'Graveglass', 'Rootsong', 'Dreamwalking', 'Ironsinging'];
const MAGIC_SOURCE = ['drawn from the user’s own memories', 'sung into being from the true names of things', 'borrowed from the dead, who want it back', 'pulled from starlight, so it fails on cloudy nights', 'taken from salt, sea and tears', 'grown like a garden inside the bones', 'burned from candles made of years of life', 'bargained from the fae, one favour at a time', 'pressed from dreams, which must be slept for', 'drunk from a well at the centre of the world'];
const MAGIC_COST = ['each spell takes a memory, chosen by the magic, not the mage', 'every use ages the caster a day', 'the caster feels all the pain they cause', 'it leaves frost in the caster’s veins, which never quite thaws', 'it must be paid back with an equal kindness within a week', 'every spell is heard by something that listens', 'the caster cannot speak their own name for a day', 'it costs a coloured thread from the caster’s hair, which turns white', 'it draws its strength from the nearest living plant, which dies'];
const MAGIC_LIMIT = ['it cannot touch iron', 'it cannot create, only change', 'it fails across running water', 'it only works at dusk and dawn', 'it cannot affect anyone who knows the caster’s true name', 'no spell can undo another', 'it cannot raise the dead, though many have tried', 'it cannot be used for the caster’s own gain', 'it needs a spoken bargain, and the bargain must be kept', 'two mages within a mile cancel each other out'];

const PROPH_A = ['When the', 'Before the', 'After the', 'Until the', 'In the year the'];
const PROPH_B = ['crownless', 'drowned', 'twice-born', 'last', 'nameless', 'silver', 'burning', 'blind', 'hollow', 'seventh', 'frozen', 'weeping'];
const PROPH_C = ['king', 'tower', 'star', 'wolf', 'child', 'moon', 'river', 'bell', 'sword', 'oak', 'queen', 'lamp'];
const PROPH_D = ['wakes', 'falls silent', 'is broken', 'returns', 'sings', 'is forgotten', 'bleeds gold', 'burns', 'is crowned', 'remembers'];
const PROPH_E = ['the one who was not chosen', 'the daughter of no one', 'a thief with a borrowed face', 'the last of the old blood', 'the one who carries ashes', 'a voice from beneath the hill', 'the child of salt and smoke', 'one who has died before', 'the keeper of the empty book', 'two who are one'];
const PROPH_F = ['shall unmake the world, or mend it', 'shall open the door that has no other side', 'shall bring the long winter, or end it', 'shall wear the crown of thorns and bells', 'shall kill a god, and weep for it', 'shall be betrayed by the one they love most', 'shall find what was buried and wish they had not', 'shall carry the light into the Hollow'];

const TITLE_A = ['The', 'A'];
const TITLE_B = ['Ashen', 'Hollow', 'Silver', 'Drowned', 'Last', 'Broken', 'Nameless', 'Winter', 'Hidden', 'Gilded', 'Thorned', 'Sleeping', 'Wandering', 'Burning', 'Seventh', 'Lantern-Lit', 'Bitter', 'Starless'];
const TITLE_C = ['Crown', 'Throne', 'Road', 'Sword', 'Tower', 'Queen', 'Archive', 'Song', 'Wolf', 'Kingdom', 'Map', 'Oath', 'Gate', 'Heir', 'Feather', 'Sea', 'Garden', 'Bell'];
const TITLE_D = ['of Ash and Embers', 'of the Salt King', 'of Thorns', 'of Forgotten Things', 'of the Hollow Moon', 'Beneath the Hill', 'at World’s End', 'of the Seven Wells', 'and the Silver Fox', 'of Winter’s Teeth', 'in the Mist', 'of the Ninth Flame'];
const TAVERN_A = ['The Prancing', 'The Drunken', 'The Sleeping', 'The Laughing', 'The Wandering', 'The One-Eyed', 'The Golden', 'The Rusty', 'The Singing', 'The Hanged', 'The Weeping', 'The Fat'];
const TAVERN_B = ['Wyvern', 'Goose', 'Bishop', 'Hare', 'Kraken', 'Knight', 'Sow', 'Lantern', 'Mermaid', 'Badger', 'Dragon', 'Fiddle'];

// ------------------------------------------------------------------ the generators

export const DRAWS = [
    { id: 'name', name: 'A Name', talent: null, blurb: 'A name, and a house to go with it.', keep: 'character' },
    { id: 'place', name: 'A Place', talent: null, blurb: 'A place, what it is, and what’s strange about it.', keep: 'place' },
    { id: 'seed', name: 'A Story Seed', talent: null, blurb: 'Who, what happens, and what must be done.', keep: 'premise' },
    { id: 'twist', name: 'A Twist', talent: 'o_twist', blurb: 'A reversal for your second half.', keep: 'note' },
    { id: 'quirk', name: 'A Quirk', talent: 'o_quirk', blurb: 'A habit, a secret and a contradiction.', keep: 'character' },
    { id: 'magic', name: 'A Magic', talent: 'o_magic', blurb: 'A system of power: source, cost and limit.', keep: 'magic' },
    { id: 'prophecy', name: 'A Prophecy', talent: 'o_prophecy', blurb: 'Ominous, ambiguous, rhymes at least once in spirit.', keep: 'lore' },
    { id: 'title', name: 'Titles', talent: 'o_title', blurb: 'A book title, a chapter title and an inn sign.', keep: 'note' },
];
export const DRAW_BY_ID = Object.fromEntries(DRAWS.map((d) => [d.id, d]));

export const drawOpen = (S, id) => { const d = DRAW_BY_ID[id]; return !!d && (!d.talent || hasTalent(S, d.talent)); };

/** Draw from the Well. opts.people picks the name list. Returns { kind, title, text, data } and counts the draw. */
export function draw(S, kind, opts = {}) {
    if (!drawOpen(S, kind)) return null;
    const n = S.player.oracleN++;
    S.player.stats.oracle++;
    const rng = makeRng(hashString(`${S.seed}:${kind}:${n}`));
    let out;
    switch (kind) {
        case 'name': {
            const people = NAMES[opts.people] ? opts.people : rng.pick(Object.keys(NAMES));
            const nm = makeName(rng, people);
            out = { title: nm.full, text: `${nm.full}, of ${NAMES[people].label.toLowerCase()} name. Friends call them ${nm.first}.`, data: { name: nm.full, first: nm.first, people: NAMES[people].label.replace(/ \(.*\)/, '') } };
            break;
        }
        case 'place': {
            const name = rng.pick(PLACE_PRE) + rng.pick(PLACE_SUF);
            const what = rng.pick(PLACE_KIND), hook = rng.pick(PLACE_HOOK);
            out = { title: name, text: `${name}: ${what} ${hook}.`, data: { name, summary: `${what.charAt(0).toUpperCase() + what.slice(1)} ${hook}.` } };
            break;
        }
        case 'seed': {
            const text = `${cap(rng.pick(WHO))} ${rng.pick(FINDS)}, ${rng.pick(MUST)}.`;
            out = { title: 'A story seed', text, data: { premise: text } };
            break;
        }
        case 'twist': out = { title: 'A twist', text: rng.pick(TWISTS), data: {} }; break;
        case 'quirk': {
            const habit = rng.pick(QUIRK_HABIT), secret = rng.pick(QUIRK_SECRET), contra = rng.pick(QUIRK_CONTRA);
            out = { title: 'A quirk', text: `Someone who ${habit}, who secretly ${secret}: ${contra}.`, data: { habit, secret, contra } };
            break;
        }
        case 'magic': {
            const name = rng.pick(MAGIC_NAME), source = rng.pick(MAGIC_SOURCE), cost = rng.pick(MAGIC_COST), limit = rng.pick(MAGIC_LIMIT);
            out = { title: name, text: `${name}: power ${source}. The cost: ${cost}. The limit: ${limit}.`, data: { name, source: cap(source) + '.', cost: cap(cost) + '.', limits: cap(limit) + '.' } };
            break;
        }
        case 'prophecy': {
            const text = `${rng.pick(PROPH_A)} ${rng.pick(PROPH_B)} ${rng.pick(PROPH_C)} ${rng.pick(PROPH_D)},\n${cap(rng.pick(PROPH_E))}\n${rng.pick(PROPH_F)}.`;
            out = { title: 'A prophecy', text, data: { prophecy: true } };
            break;
        }
        case 'title': {
            const book = `${rng.pick(TITLE_A)} ${rng.pick(TITLE_B)} ${rng.pick(TITLE_C)}`;
            const book2 = `${rng.pick(TITLE_A) === 'A' ? 'The' : 'A'} ${rng.pick(TITLE_C)} ${rng.pick(TITLE_D)}`;
            const inn = `${rng.pick(TAVERN_A)} ${rng.pick(TAVERN_B)}`;
            out = { title: book, text: `For the book: “${book}” or “${book2}”. A chapter: “${rng.pick(TITLE_B)} ${rng.pick(TITLE_C)}s”. The inn: ${inn}.`, data: { book, book2, inn } };
            break;
        }
        default: return null;
    }
    return { kind, n, ...out };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
