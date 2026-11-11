// Gemheart Saga — the four tales. Each starting hero walks the Vale in a different order, meets different people and
// hunts a different nemesis; all four end at Gloamspire against the Gloam Sovereign. Pure data.
//
// Chapter: { region, title, lv, fights: [foe ids], before: [[speaker, text]], after: [[speaker, text]] }
//   lv     the level of the chapter's foes (bosses +1). fights run in order; the last is the chapter's finale.
//   speaker: a hero id, an NPC id (data/village.js), a foe id (data/world.js) or 'narrator'.
// A chapter's 'retreat' flag: the finale foe flees at the end instead of dying (the nemesis's first meeting).

export const OPENING = [
    ['narrator', 'Beneath the Vale lies the Gemheart, a crystal as old as the hills. Its light is in every jewel, every harvest, every lantern.'],
    ['narrator', 'This year the light is going out. Crops grey in the field. Lanterns gutter. Something in the east is drinking it.'],
    ['narrator', 'Briarwick, a village at the edge of the meadows, has opened its doors to one more traveller.'],
];

// The finale: the Sovereign speaks the same to all, then each hero's ending.
export const SOVEREIGN_INTRO = [
    ['sovereign', 'Little light. Every lantern, every harvest, every jewel of this Vale is mine to drink. Why should it shine on peasants?'],
];
const LV = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
const F = (region) => {
    const r = { greenmarch: ['slime', 'goblin', 'boar', 'hornet', 'wolf', 'bandit', 'tusk'],
        mirefen: ['toad', 'wisp', 'leech', 'lizard', 'shaman', 'troll', 'murk'],
        emberdeep: ['kobold', 'bat', 'beetle', 'salamander', 'miner', 'golem', 'cinderjaw'],
        frostfang: ['imp', 'harpy', 'ram', 'yeti', 'wraith', 'jarl', 'hrimfrost'],
        gloamspire: ['shade', 'skeleton', 'hound', 'gargoyle', 'cultist', 'revenant', 'sovereign'] }[region];
    return {
        a: [r[0], r[1], r[5]],              // first chapter in a region: two normals and the elite
        b: [r[2], r[3], r[4], r[6]],        // second: three normals and the region boss
        n: (nem) => [r[0], r[3], nem],      // a nemesis chapter
    };
};

// Two shapes of tale. 'hunt' (Fenn, Odo): the nemesis is met in the third region before its boss, and fought for good
// in chapter 9 at Gloamspire; chapter 10 is the Sovereign. 'oath' (Kael, Sela): the nemesis is met in the third region,
// which then gets two chapters of its own, and the last chapter at Gloamspire is the nemesis and the Sovereign together.
function tale(order, nemesis, style, ch) {
    const plan = style === 'hunt'
        ? [[0, 'a'], [0, 'b'], [1, 'a'], [1, 'b'], [2, 'n'], [2, 'b'], [3, 'a'], [3, 'b'], [4, 'n'], [4, 'end']]
        : [[0, 'a'], [0, 'b'], [1, 'a'], [1, 'b'], [2, 'n'], [2, 'a'], [2, 'b'], [3, 'a'], [3, 'b'], [4, 'last']];
    return plan.map(([ri, kind], i) => {
        const region = ri < 4 ? order[ri] : 'gloamspire';
        const f = F(region);
        const c = { region, lv: LV[i], retreat: kind === 'n' && ri < 4, mid: {}, ...ch[i] };
        if (kind === 'a') c.fights = f.a;
        else if (kind === 'b') c.fights = f.b;
        else if (kind === 'n') c.fights = f.n(nemesis);
        else if (kind === 'end') { c.fights = ['cultist', 'revenant', 'sovereign']; c.mid = { 2: SOVEREIGN_INTRO }; }
        else {
            // the nemesis falls mid-chapter: their last words play before the Sovereign steps in
            c.fights = ['revenant', nemesis, 'sovereign'];
            c.mid = { 2: [...c.after, ...SOVEREIGN_INTRO] };
            c.after = [];
        }
        return c;
    });
}

export const TALES = {
    kael: tale(['greenmarch', 'emberdeep', 'frostfang', 'mirefen'], 'varek', 'oath', [
        { title: 'Ashes on the Road',
            before: [['maren', 'A knight of the Dawn? I thought they were all dead.'], ['kael', 'Most of them are. Bandits are raiding your carts, Elder. Let me earn my bed.'], ['maren', 'Their captain wears a sun-pin. Stolen from one of yours, I\'d guess.']],
            after: [['kael', 'This pin… it belonged to Brother Aldric. These men had it from someone who robbed the dead at Dawnhold.'], ['maren', 'Then you\'ll be staying a while. Briarwick could use a sword. Help us grow, and we\'ll back you.']] },
        { title: 'The Boar King',
            before: [['tobin', 'Old Tusk\'s come down from the hills! He\'s never come this far before. He\'s scared of something.'], ['kael', 'Scared beasts are the worst kind. Stay behind the wall.']],
            after: [['kael', 'There\'s grey ash in his bristles. The same ash that fell on Dawnhold the night it burned.'], ['maren', 'Ash from the east, where the mines are. Emberdeep.']] },
        { title: 'Into Emberdeep',
            before: [['garrick', 'The dwarf-holds went quiet a month back. Not a single ore cart since.'], ['kael', 'Then I\'ll go and knock.']],
            after: [['kael', 'The golem carried a brand: a cracked sun. Varek\'s mark. He was here.']] },
        { title: 'Cinderjaw',
            before: [['garrick', 'There\'s a wyrm down there now, they say. Woke up when the light dimmed.'], ['kael', 'Then it\'s been sleeping on something it shouldn\'t.']],
            after: [['kael', 'Beneath its nest: crates marked for Gloamspire. Varek is feeding the light of the mines to someone.'], ['garrick', 'Bring me some of that wyrm-iron and I\'ll make you a blade worth the trouble.']] },
        { title: 'The Oathbreaker',
            before: [['narrator', 'On the road into the Frostfang pass, a figure in blackened gold waits in the snow.'], ['varek', 'Kael. Still carrying that broken sun? The Order was rotten. I only let it burn.'], ['kael', 'You burned a hundred people who trusted you.']],
            after: [['varek', 'Good. You\'ve grown teeth. The Sovereign will want to meet you.'], ['narrator', 'Varek vanishes in a gust of grey flame.'], ['kael', 'Sovereign. So he serves someone. Then I\'ll go through him to them.']] },
        { title: 'Embers in the Snow',
            before: [['ilse', 'The shrines in the peaks still burn, if anyone tends them. Bring this lantern-oil. It may help you.'], ['kael', 'I will, Mother.']],
            after: [['kael', 'The Dawn kept a shrine up here once. Someone has knocked it down.']] },
        { title: 'Hrimfrost',
            before: [['narrator', 'The mountain shakes. Ice cracks along the pass like a door opening.']],
            after: [['kael', 'The titan guarded the old Dawn road east. Now the way to Gloamspire is open, but only through the Mirefen.'], ['bess', 'Come home first, love. You look like a snowman.']] },
        { title: 'Lanterns in the Fog',
            before: [['tobin', 'The marsh folk say lights move in the fog at night. Lights that whisper your name.'], ['kael', 'Whispers I can deal with.']],
            after: [['kael', 'The shaman spoke of a "queen of the bog" who keeps a road for the Sovereign\'s carts.']] },
        { title: 'The Hag\'s Toll',
            before: [['murk', 'A shiny knight in my bog! Pay the toll, dearie: one heart, still beating.'], ['kael', 'Mine\'s spoken for.']],
            after: [['kael', 'Gloamspire is a day\'s march from here. Varek will be waiting.'], ['maren', 'Then go with all of Briarwick behind you.']] },
        { title: 'The Last Dawn',
            before: [['varek', 'You came all this way to die where the light ends?'], ['kael', 'I came to keep an oath. You taught me how, once.'], ['varek', 'Then let us both be done with oaths.']],
            after: [['varek', 'Kael… the Sovereign is drinking the Gemheart. I wanted a dawn that never ended. Stop him. Mend… what I…'], ['kael', 'Rest, brother. I\'ll finish it.']] },
    ]),

    sela: tale(['mirefen', 'greenmarch', 'frostfang', 'emberdeep'], 'quell', 'oath', [
        { title: 'The Drowned Stacks',
            before: [['sela', 'The Moonbrook Archive sank into the Mirefen a hundred years ago. Master Quell went down to find the oldest book in it.'], ['maren', 'And you\'ll go after him alone? Take Briarwick\'s blessing at least. And come back.']],
            after: [['sela', 'Wet pages, all with the same symbol: an eye inside a crown. It\'s not one of ours.']] },
        { title: 'Mother Murk',
            before: [['murk', 'Little librarian! Your master came through my bog. He paid me in secrets.'], ['sela', 'Then you can pay me back in answers.']],
            after: [['sela', 'She had his reading lens. Cracked. He went somewhere through the meadows, carried, not walking.'], ['bess', 'Carts, love. Grey carts on the meadow road at night. We all heard them.']] },
        { title: 'Grey Carts',
            before: [['tobin', 'The bandits have been guarding those carts. Rough lot.'], ['sela', 'I\'m very good with rough lots. I\'ve read about them.']],
            after: [['sela', 'The cart held crystals, drained grey. Something drank the light right out of them.']] },
        { title: 'Old Tusk',
            before: [['tobin', 'Old Tusk ate one of the grey crystals! He\'s gone mad!'], ['sela', 'Then let\'s give him something cooler to think about.']],
            after: [['sela', 'The crystal in his belly came from the Frostfang mines. The carts go north first.']] },
        { title: 'A Familiar Voice',
            before: [['narrator', 'In the snow, a figure in sodden robes drifts above the ground, dripping seawater that freezes as it falls.'], ['sela', 'Master Quell?'], ['quell', 'Sela. Little Sela. The water showed me so many things. The Sovereign showed me more.']],
            after: [['quell', 'You\'ve learned well. Too well. Do not follow me.'], ['narrator', 'He dissolves into a cold mist.'], ['sela', 'His eyes were empty. Whatever came back up, it isn\'t all him.']] },
        { title: 'Rime and Crystal',
            before: [['ilse', 'If his mind is bound, child, it can be unbound. The Sovereign holds his servants by their regrets.'], ['sela', 'Then I have to find out what he regrets.']],
            after: [['sela', 'Shrine runes: "the Archive drowned because a scholar opened the wrong book." He blames himself.']] },
        { title: 'Hrimfrost',
            before: [['narrator', 'A titan of glacier ice blocks the only path east.']],
            after: [['sela', 'The titan\'s heart was a Gemheart shard, almost empty. They\'re draining the whole Vale through its stones.'], ['pell', 'Crystal\'s going to be worth a fortune. Just saying.']] },
        { title: 'The Deep Forges',
            before: [['garrick', 'Mines\'ve gone hot and quiet. You\'re going down there? You\'re brave or daft.'], ['sela', 'Bit of both. It\'s called research.']],
            after: [['sela', 'The forges were melting stolen crystals into a black glass. Gloam-glass.']] },
        { title: 'Cinderjaw',
            before: [['narrator', 'The wyrm guards the last forge, where the black glass is poured into chains.']],
            after: [['sela', 'Chains of gloam-glass. That\'s how he binds them. That\'s how he bound Master Quell.'], ['maren', 'Gloamspire, then. Go, and come home.']] },
        { title: 'The Unbinding',
            before: [['quell', 'You followed. Of course you did. You never once listened.'], ['sela', 'You taught me the Archive drowned because of you. It didn\'t. It drowned because the river rose. It wasn\'t your fault.'], ['quell', 'Lies are a poor spell, Sela.']],
            after: [['quell', 'The chain… it\'s cracked. Sela? The light in the citadel. He means to drink the Gemheart whole. Go. I am so proud of you.'], ['sela', 'Rest now, Master. I\'ll write the rest of it.']] },
    ]),

    fenn: tale(['greenmarch', 'mirefen', 'emberdeep', 'frostfang'], 'rotroot', 'hunt', [
        { title: 'Rot at the Edge',
            before: [['fenn', 'Smell that? Sweet and wrong. Like fruit left in the sun. The rot\'s reached the meadows.'], ['tobin', 'My hedges went black overnight. Then the goblins came, as if they\'d been waiting.']],
            after: [['fenn', 'The goblins were carrying seeds. Grey ones. Somebody is planting this.']] },
        { title: 'The Boar King',
            before: [['fenn', 'Old Tusk! I used to leave him apples when I was a kid. Look at his eyes, Ash. He doesn\'t know us.']],
            after: [['fenn', 'A grey seed was lodged in his tusk, roots and all. It came from the marsh. The marsh water carries it.'], ['maren', 'Then the marsh is next. Briarwick will keep the lamps lit for you.']] },
        { title: 'Grey Water',
            before: [['fenn', 'The reeds are grey from the root up. The rot is in the water.']],
            after: [['fenn', 'The troll had a bag of seeds on its belt, and a map. The seeds come up from the mines.']] },
        { title: 'Mother Murk',
            before: [['murk', 'The ranger boy and his wolf! The Sovereign pays me in seeds, sweetie. Such pretty grey seeds.'], ['fenn', 'I\'ll pay you in arrows.']],
            after: [['fenn', 'She\'d planted half the marsh. She said the first seed went into "the oldest tree of the Thornwood".'], ['fenn', 'Old Bramble. No.']] },
        { title: 'Old Bramble',
            before: [['narrator', 'On the mine road, a vast blackened treant drags itself from the earth.'], ['fenn', 'Bramble… you carried me on your shoulders. You taught me the names of every bird.'], ['rotroot', 'BRAMBLE IS ROOT. ROOT IS ROT. ROT IS EVERYTHING.']],
            after: [['narrator', 'The treant sinks back into the earth, roots tearing up the road.'], ['fenn', 'There\'s a glowing violet stone in his heartwood. If I can get at it… maybe I can save him.']] },
        { title: 'Cinderjaw',
            before: [['garrick', 'They\'re smelting the grey seeds down there into black glass. Got a wyrm guarding it.'], ['fenn', 'Then the wyrm and I need to talk.']],
            after: [['fenn', 'Black glass. Gloam-glass. Same stuff as the stone in Bramble\'s heart.'], ['ilse', 'Glass of the gloam is broken by light, child. Bring the light to it.']] },
        { title: 'Up the Mountain',
            before: [['fenn', 'The seed-carts went north, over the peaks. Ash, you\'re going to hate the snow.']],
            after: [['fenn', 'The Jarl was a buyer. The Sovereign\'s been trading seeds for passage.']] },
        { title: 'Hrimfrost',
            before: [['narrator', 'A titan of ice stands across the eastern pass, its chest glowing faint and grey.']],
            after: [['fenn', 'Beyond the pass: Gloamspire. Bramble went that way. I could see the trail of dead grass.'], ['bess', 'You eat something before you go. That\'s not a request.']] },
        { title: 'The Heartwood',
            before: [['rotroot', 'LITTLE FENN. LITTLE SEED. COME HOME TO THE ROOT.'], ['fenn', 'I\'m coming, old friend. Hold still. This is going to sting.']],
            after: [['fenn', 'The stone\'s out! Bramble?'], ['rotroot', 'Fenn. Little Fenn. I am so tired. The one in the citadel… he drinks the Gemheart. Stop him… and plant me somewhere sunny.']] },
        { title: 'The Sovereign\'s Garden',
            before: [['fenn', 'This is it, Ash. Last hunt.']],
            after: [] },
    ]),

    odo: tale(['frostfang', 'greenmarch', 'mirefen', 'emberdeep'], 'vesper', 'hunt', [
        { title: 'The Guttering Flame',
            before: [['ilse', 'Brother Odo. The Lantern Temple sent you all this way? Then the flame must be very low.'], ['odo', 'It burns blue now, Mother. Blue and small. The shrines in the peaks are where the old wardens kept their spare light.']],
            after: [['odo', 'The shrine is cold. Ashes on the altar, and a woman\'s footprints in them. Small feet. A dancer\'s step.'], ['odo', 'Vesper.']] },
        { title: 'Hrimfrost',
            before: [['narrator', 'The ice titan rises over the shrine path, its chest-light dimming.']],
            after: [['odo', 'The titan was a warden of the shrines. Someone emptied its light and left it angry.'], ['maren', 'Stay a while, Brother. Briarwick could do with a temple of its own.']] },
        { title: 'Ash on the Meadow',
            before: [['tobin', 'Grey ash falling on the wheat, Brother. The crops won\'t grow where it lands.'], ['odo', 'Then we will follow where it falls from.']],
            after: [['odo', 'The bandits were paid in candles. Snuffed temple candles.']] },
        { title: 'Old Tusk',
            before: [['odo', 'Peace, old king. Peace. Ah. You do not want peace.']],
            after: [['odo', 'He was frightened of the ash. Animals know. The ash drifts from the marsh tonight.'], ['ilse', 'Take my lantern, Odo. It\'s small, but it\'s honest.']] },
        { title: 'The Ashen Priestess',
            before: [['narrator', 'In the marsh, a woman in grey swings a censer. Where its smoke touches the lily-lights, they go out.'], ['vesper', 'Odo. Still smiling at everyone? The flame is wasted on smiles. Light should be kept.'], ['odo', 'Light that is kept is only darkness waiting, Vesper.']],
            after: [['vesper', 'You were always stronger than you looked. Come to Gloamspire and see what real light is.'], ['narrator', 'She steps into her own smoke and is gone.'], ['odo', 'We knelt side by side as novices. Where did you go, sister?']] },
        { title: 'Mother Murk',
            before: [['murk', 'A monk! I haven\'t eaten a monk since the old days.'], ['odo', 'I\'m mostly gristle and good intentions.']],
            after: [['odo', 'Vesper paid the hag in temple light. And it goes on: down into the mines, to the forges.']] },
        { title: 'Smoke in the Deep',
            before: [['garrick', 'Mines are full of grey smoke. Lungs won\'t take it.'], ['odo', 'Breathe slowly and step lightly. That is all the Temple ever taught me.']],
            after: [['odo', 'The smoke is coming from the forges, where they are melting light into glass.']] },
        { title: 'Cinderjaw',
            before: [['narrator', 'A magma wyrm curls around the last forge, guarding the black glass.']],
            after: [['odo', 'The glass is shaped like lanterns. Hundreds of them. He means to bottle all the light of the Vale.'], ['maren', 'Then go break his bottles, Brother.']] },
        { title: 'Ashes and Embers',
            before: [['vesper', 'Look at them, Odo. Every flame in the Vale, kept safe in glass. No one will ever waste it again.'], ['odo', 'A flame in a jar is a flame that cannot warm anyone.']],
            after: [['vesper', 'Odo… it\'s so cold. I only wanted to keep it safe.'], ['odo', 'I know, sister. Here. Take my lantern. It\'s small, but it\'s honest.']] },
        { title: 'The Lantern Unbroken',
            before: [['odo', 'Every flame he took is in that citadel. Let us go and let them out.']],
            after: [] },
    ]),
};

export const ENDINGS = {
    kael: [['narrator', 'The Gemheart\'s light pours back across the Vale like a sunrise.'], ['kael', 'The Order of the Dawn is gone. But an oath can be kept by one person.'], ['maren', 'Then keep it here, Sir Kael. Briarwick has a knight now.']],
    sela: [['narrator', 'The light returns, and with it the river\'s voice.'], ['sela', 'I\'ll raise the Archive. Book by book. Master Quell\'s first.'], ['maren', 'Briarwick has a library now, it seems.']],
    fenn: [['narrator', 'The grey lifts from the meadows. In a sunny corner of Briarwick, a young oak takes root.'], ['fenn', 'Grow tall, Bramble. I\'ll bring you apples.'], ['tobin', 'Best harvest in years. You\'re staying for the festival, right?']],
    odo: [['narrator', 'A thousand glass lanterns shatter at once, and the light of the Vale flies home.'], ['odo', 'Far away, the flame of the Lantern Temple burns gold again.'], ['ilse', 'And here, too, Brother. Briarwick\'s lamp will never go out.']],
};
export const CREDITS_LINE = 'Your tale is told — but Briarwick still needs you. Patrols, requests and the village go on.';
