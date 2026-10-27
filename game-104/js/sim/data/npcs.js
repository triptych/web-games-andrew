// The people. `talk` is what "talk to X" says (it may depend on the story so far); `topics` answer
// "ask X about Y" by keyword. Story actions (healing, teaching, giving) are rules in story.js.

import { say } from '../core.js';
import { nextObjective } from './objectives.js';

const S = (G, text) => say(G, text, 'speech');

export const NPCS = {
    bryony: {
        name: 'Bryony', names: ['bryony', 'bryony wick', 'girl', 'apprentice'], kind: 'witch', x: 210, at: 'mill',
        look: (G) => G.flags.bryony_healed
            ? 'Bryony Wick is perhaps sixteen, all elbows and defiance, in a patched green cloak two sizes too large. Her mentor, Granny Dunmore, taught her to love the dark and to hate being told what to do. She carries a crossbow nearly as big as she is, a bandaged side and a very sharp tongue.'
            : 'A thin girl in a green cloak crouches by the cold hearth with a crossbow across her knees, pointed at your middle. A rag at her side is stiff and brown with blood. She has not stopped watching your hands since you came in.',
        talk: (G) => {
            if (!G.flags.bryony_healed) {
                S(G, '"Marga\'s girl, are you? You\'ll have to do better than a password. A bailiff\'s blade went across my ribs as I came out of the loft, and it won\'t stop weeping. Marga\'s apprentice would have yarrow and plantain in her satchel and the sense to make a salve of them. So make one."');
                return;
            }
            S(G, `"${nextObjective(G).bry}"`);
        },
        topics: [
            { k: ['marga', 'mentor', 'thistle'], say: (G) => S(G, '"Marga Thistle taught my Granny, and Granny taught me, so I suppose she\'s my great-aunt in everything but blood. If they\'ve taken her too, then this isn\'t a raid. It\'s a harvest."') },
            { k: ['dunmore', 'granny', 'gran'], say: (G) => S(G, '"Granny Dunmore. They came for her two nights ago: six of them, with a cart. She hit one with a ladle. She was telling them what she thought of their mothers when they carried her out."') },
            { k: ['governor', 'cray', 'aldous'], say: (G) => S(G, '"Aldous Cray. His grandfather hanged witches. Aldous has found it\'s far more profitable to keep us alive, and busy."') },
            { k: ['bailiff', 'bailiffs', 'crow', 'crows', 'brass'], say: (G) => S(G, '"Brass crows on the coat. Brask and his lot. Never let one near enough to see your face."') },
            { k: ['plan', 'edict', 'hollow', 'moon'], say: (G) => S(G, '"The notices say that from the Hollow Moon no one may sell or give a cure except through the Infirmary or Pell. Which is fine if you\'ve got the money, and fatal if you haven\'t."') },
            { k: ['loosen', 'lock', 'spell', 'magic'], say: (G) => S(G, '"Loosen? Easy. It\'s only persuasion. But it can\'t touch cold iron: iron doesn\'t listen to anyone."') },
            { k: ['herbs', 'herb', 'herbal', 'plants'], say: (G) => S(G, '"Always smell before you taste, and never taste what\'s black or purple-spotted. Marga\'s Herbal covers the rest."') },
            { k: ['oak', 'gammer'], say: (G) => S(G, '"The Hanged Oak. They say the old witch it\'s named for will talk to anyone with manners and a sprig of rue."') },
            { k: ['salt', 'road', 'tunnel'], say: (G) => S(G, '"The Salt Road. The old salters\' tunnel from Ashwick to Gallows Hill. Sealed years ago, they say."') },
            { k: ['vesper', 'cordelia', 'doctor'], say: (G) => S(G, '"Dr. Vesper runs the Infirmary. White gloves. Voice like a cold cloth. Nobody\'s ever seen her smile."') },
            { k: ['hint', 'help', 'now', 'do'], say: (G) => S(G, `"${nextObjective(G).bry}"`) },
        ],
        fallback: '"I wouldn\'t know. Ask me something I can use."',
    },
    corvin: {
        name: 'the crow', names: ['crow', 'corvin', 'raven', 'bird'], kind: 'crow', x: 250, at: 'lane',
        look: 'A glossy black crow watches you from the gatepost with an eye like a wet bead. Marga\'s Corvin: you have never once seen him let anyone but her touch him. He does not look frightened. He looks like he is waiting for something to be done.',
        talk: (G) => say(G, 'The crow turns his head and gives one flat, sarcastic caw. He seems to think it is your move.', 'narr'),
        topics: [],
        fallback: 'Corvin only looks at you. It is a very eloquent look.',
    },
    gammer: {
        name: 'Mother Gammer', names: ['gammer', 'mother gammer', 'ghost', 'woman', 'spirit'], kind: 'ghost', x: 215, at: 'limbo',
        look: 'A woman made of cold and moonlight stands under the oak with a noose still loose around her neck. She has the tired, sharp face of someone who has seen every kind of fool and forgiven most of them.',
        talk: (G) => {
            if (!G.flags.gammer_talked) {
                G.flags.gammer_talked = true;
                S(G, '"Rue on my roots. Manners! I\'d begun to think they\'d died out with me. Sit, child. Mind the rope: it\'s still tender. I was Marga\'s teacher before I was hers. They hanged me for curing the Governor\'s grandfather and not curing him quickly enough. Ask me what you need to know. I haven\'t a great deal of time left, and you have even less."');
            } else {
                S(G, '"Ask, child. I can tell you of Marga, of the Governor, of sight, of vervain, of salt."');
            }
        },
        topics: [
            { k: ['sight', 'see', 'eyes', 'spell', 'magic', 'learn', 'teach'], say: (G) => {
                if (G.flags.gammer_sight) { S(G, '"You have it already. Use it wisely; a witch who sees too much has few friends."'); return; }
                S(G, '"Sight. Yes. Close your eyes. No, child, the others. There."');
                say(G, 'A hand colder than well-water rests over your eyes. For a moment you see the oak not as a tree but as a hundred years of what has been done under it: a river of grief, grey and slow.', 'magic');
                G.flags.gammer_sight = true;
            } },
            { k: ['marga', 'thistle', 'mentor'], say: (G) => S(G, '"She kept my grave tidy. She brought rue every Michaelmas, long after anyone else forgot my name. If anyone can hold out against them, Marga can. But she is old, child, and they have things in that place for making the strong tired."') },
            { k: ['governor', 'cray', 'aldous'], say: (G) => S(G, '"A fat man with his grandfather\'s hands. He\'d hang us still if there were money in it. There is more money in keeping us breathing. Always follow the money, child: it leaves a trail like a slug."') },
            { k: ['vervain', 'herb', 'herbs', 'plant'], say: (G) => {
                S(G, '"Vervain grows round my roots because blood fell here, and it wants to be useful. Take it. It binds and it unbinds. With salt and rue it will loosen a thing that was knotted in the dark."');
                if (!G.lore.includes('vervain')) G.lore.push('vervain');
                if (!G.recipes.includes('tincture')) { G.recipes.push('tincture'); say(G, '[You have learned a recipe: unbinding tincture (vervain + salt + rue).]', 'clue'); }
            } },
            { k: ['salt', 'road', 'tunnel', 'hill', 'gallows', 'vault', 'vaults'], say: (G) => S(G, '"Under Gallows Hill the old salt-miners cut a cathedral and left it. The Governor\'s grandfather bricked up the Salt Road to hide it. They will have unbricked it now. Cold iron, white salt, and a hum that makes a witch feel as though her own bones are strangers."') },
            { k: ['vesper', 'cordelia', 'doctor', 'infirmary'], say: (G) => S(G, '"Ah. You have not heard of Cordelia? No. Ask your Marga about a girl who was very clever, and very proud, and who thought a cure ought to cost something. Ask her. But not here."') },
        ],
        fallback: '"That I cannot tell. The dead are poor at gossip."',
    },
    dray: {
        name: 'Corporal Dray', names: ['dray', 'corporal', 'corporal dray', 'bailiff', 'guard', 'sentry', 'man'], kind: 'bailiff', x: 225, at: 'gate',
        look: (G) => G.flags.gate_open
            ? 'Corporal Dray snores on the barrel with his chin on his chest, a ribbon of spit dangling off his lip. The brass crow on his coat rises and falls with his breath.'
            : 'Corporal Dray is wide and slow, in a long dark coat with a brass crow on each shoulder, and he is looking at you with the expression of a man who is paid to find something wrong with whatever walks past. His flask hangs on a hook by his elbow.',
        talk: (G) => {
            if (G.flags.gate_open) { say(G, 'Dray snores. You decide not to disturb him.', 'narr'); return; }
            S(G, '"Licence. Governor\'s Healing Licence, signed, stamped and paid for. No? Then no one passes. Edict of the Governor. And no, I don\'t take silver. I\'m not that sort of crow."');
        },
        topics: [
            { k: ['licence', 'license', 'edict'], say: (G) => S(G, '"Two silver a head, and a day in the Infirmary to be assessed. You haven\'t got one. You\'re not getting through."') },
            { k: ['marga', 'witch', 'witches', 'healer', 'healers'], say: (G) => S(G, '"Don\'t know any. Don\'t want to. Move along."') },
        ],
        fallback: '"Move along."',
    },
    tanner: {
        name: 'Mrs. Tanner', names: ['tanner', 'mrs tanner', 'mrs. tanner', 'mother', 'mrs'], kind: 'crone', x: 175, at: 'row',
        look: 'Mrs. Tanner is a thin, tired woman with a tallow-stained apron and hands scrubbed raw. She scrubs the floors in Pell\'s scullery by night and looks after her son by day, and she looks like she has not slept in a week.',
        talk: (G) => {
            if (G.flags.tobias_healed) {
                S(G, '"Tobias is sleeping like a lamb. I can never thank you. Mind yourself in the Infirmary, miss. And don\'t drink anything they give you."');
            } else {
                S(G, '"My Tobias. He burns, and he\'s been burning three days. The Infirmary wants six silver down before they\'ll look at him, and then they keep the child. My mother used to say feverfew and willow bark for a fever. Feverfew\'s in my window-boxes. But the willow grows at the mill, and the mill\'s been shut."');
            }
        },
        topics: [
            { k: ['tobias', 'son', 'boy', 'child', 'fever'], say: (G) => S(G, G.flags.tobias_healed ? '"He asked for bread. Bread!"' : '"Hot as a stove and won\'t wake. Three days."') },
            { k: ['pell', 'shop', 'scullery', 'apothecary'], say: (G) => S(G, '"I scrub his scullery at night. Barrels of the grey stuff come in from the Infirmary wagon and he waters it for the bottles. Twice, I saw crates I wasn\'t meant to see."') },
            { k: ['infirmary', 'hospital', 'sister', 'nurse'], say: (G) => S(G, '"My sister Dot was a nurse there. She left in the spring and won\'t say why. She said they never let a patient get well: it wouldn\'t pay."') },
            { k: ['healers', 'witches', 'witch', 'missing'], say: (G) => S(G, '"Gone, all of them, one by one, since the thaw. Widow Harrow, Old Dunmore at the Mill, the Pennywhistle sisters. The wagons come at night. No one says a word."') },
        ],
        fallback: '"I wouldn\'t know, miss."',
    },
    tobias: {
        name: 'Tobias', names: ['tobias', 'child', 'boy', 'son', 'toby'], kind: 'child', x: 245, at: 'row',
        look: (G) => G.flags.tobias_healed
            ? 'Tobias is propped on a pillow, pale and damp-haired and cross, demanding bread. He looks about seven.'
            : 'A small boy lies on a straw pallet by the window, flushed scarlet, his hair plastered to his forehead. He breathes in short, hot gasps and does not wake when you speak.',
        talk: (G) => say(G, G.flags.tobias_healed ? '"Is there any bread?" the boy asks, hopefully.' : 'The child does not wake. His skin is as hot as a stovepipe.', 'narr'),
        topics: [],
        fallback: 'The boy only breathes.',
    },
    hob: {
        name: 'Hob', names: ['hob', 'innkeeper', 'landlord', 'barman', 'man'], kind: 'man', x: 215, at: 'inn',
        look: 'Hob the innkeeper is a big man with a towel on his shoulder and a way of looking at everything except what he\'s wiping. He has been told what he may and may not know, and he knows it extremely well.',
        talk: (G) => S(G, '"A room is two silver, a bed and a bolt on the door. There\'s a stew too, but I wouldn\'t. Ask about what you like. I don\'t promise to know it."'),
        topics: [
            { k: ['room', 'bed', 'rest', 'sleep'], say: (G) => S(G, '"Two silver. BUY ROOM, if you want it. You\'ll sleep better than anyone in this town."') },
            { k: ['healers', 'witches', 'witch', 'missing', 'marga'], say: (G) => S(G, '"I serve bailiffs. I don\'t ask. But old Widow Harrow brewed my wife through her last winter, and now Harrow\'s gone and my wife\'s cough is back. Draw your own conclusions, quietly."') },
            { k: ['bailiffs', 'bailiff', 'brask', 'crow', 'crows'], say: (G) => S(G, '"Two of Brask\'s drink in the corner. They talk when they\'re drunk. A man with good ears might learn something. LISTEN."') },
            { k: ['salt', 'road', 'tunnel', 'chapel', 'moll'], say: (G) => S(G, '"The old Salt Road ran under St. Agnes\'s crypt, so they say. Moll the sexton would know. Quiet woman. Don\'t go down there."') },
            { k: ['infirmary', 'hospital', 'doctor', 'vesper'], say: (G) => S(G, '"Dr. Vesper. They say twelve cots empty every morning, and always the same twelve filled the night after. I don\'t ask."') },
            { k: ['pell', 'tonic', 'apothecary'], say: (G) => S(G, '"Tonic No. 9. Three silver a bottle. Cures everything, so they say, which is odd, since there\'s no one in town left well enough to prove it."') },
        ],
        fallback: '"I\'m a publican, miss, not a prophet."',
    },
    pell: {
        name: 'Master Pell', names: ['pell', 'master pell', 'apothecary', 'shopkeeper', 'man'], kind: 'man', x: 215, at: 'apothecary',
        look: 'Master Pell is a smooth, soft man in spotless sleeves, with the practised smile of a person who has never once been surprised by a customer\'s ill health. He keeps one hand on the till and one on the counter, in case either needs defending.',
        talk: (G) => S(G, '"Welcome, welcome. Tonic No. 9, the Governor\'s Own: three silver, cures what ails. Everything else on the shelf is, I\'m afraid, reserved for the Infirmary. A licence, naturally? No? Then tonic it is."'),
        topics: [
            { k: ['tonic', 'cure', 'bottle', 'no'], say: (G) => S(G, '"Brewed to the Governor\'s own formula. Slightly bitter, extremely effective. Three silver. BUY TONIC."') },
            { k: ['marga', 'witch', 'witches', 'healer', 'healers', 'herb', 'herbs'], say: (G) => S(G, '"Unlicensed practice is a crime, my dear. And you appear to be carrying a great many unlicensed leaves."') },
            { k: ['infirmary', 'vesper', 'governor'], say: (G) => S(G, '"A most excellent institution. We are all very proud."') },
        ],
        fallback: '"I\'m afraid I can\'t help you there."',
    },
    moll: {
        name: 'Sexton Moll', names: ['moll', 'sexton', 'sexton moll', 'old moll', 'woman'], kind: 'crone', x: 200, at: 'chapel',
        look: 'The sexton is as broad and stooped as a yew tree, in a man\'s coat and a head-cloth, with a gravedigger\'s hands and an old witch\'s eyes: bright, black and noticing everything. A bunch of keys hangs at her belt and she is smiling at you in a way that makes you feel seen.',
        talk: (G) => {
            if (G.flags.veil_learned) { S(G, '"The bell\'s ready when you are, my dear. I\'ve waited thirty years to ring it."'); return; }
            if (G.loc.satchel !== 'inv') { S(G, '"The chapel is shut, child. Go home."'); return; }
            S(G, '"That\'s Marga\'s satchel. She gave it to you? Then she\'s gone, and you\'re all that\'s left. Sit. I was a hedge witch before the Governor made it a crime, and I\'ve a trick or two left in me. My knees ache. A sprig of mugwort, burned, would help me remember what I used to know."');
        },
        topics: [
            { k: ['marga', 'thistle'], say: (G) => S(G, '"Marga and I trained together at old Gammer\'s knee. She had the gift; I had the digging arm. Now she\'s gone."') },
            { k: ['veil', 'spell', 'magic', 'teach', 'learn', 'trick'], say: (G) => S(G, G.flags.veil_learned ? '"You have it."' : '"A veil. The one thing I could do that was any use. Bring me mugwort, my dear."') },
            { k: ['salt', 'road', 'tunnel', 'crypt', 'door', 'iron'], say: (G) => S(G, '"The Salt Road runs from the Infirmary cellar to the Vaults at Gallows Hill, and a branch of it opens here, behind the salters\' door in the crypt. It was sealed years ago. The key was kept by the Infirmary. Bar the door from the inside, and you can open it from the tunnel side."') },
            { k: ['bell', 'ring'], say: (G) => S(G, '"Not yet, my dear. A bell rung for nothing wakes only bailiffs. When you have something to ring for, you\'ll know."') },
            { k: ['governor', 'cray', 'vesper', 'infirmary'], say: (G) => S(G, '"I bury what the Infirmary sends. Four last month. All of them had been in for a cough."') },
        ],
        fallback: '"Hm. I don\'t know that, my dear."',
    },
    sable: {
        name: 'Matron Sable', names: ['sable', 'matron', 'matron sable', 'nurse', 'woman'], kind: 'matron', x: 205, at: 'infirmary',
        look: 'Matron Sable is made of starch and disapproval. She sits behind the desk with the Infirmary\'s ledger in front of her, and she writes in it without looking at the pen.',
        talk: (G) => {
            if (G.loc.apron === 'worn' && G.loc.cap === 'worn') S(G, '"New girl? You\'re late. Ward first, then take the charts down. Dr. Vesper is not to be disturbed. Go on."');
            else S(G, '"Visiting hours ended at noon. Patients are assessed on payment. Six silver deposit. No? Then good night."');
        },
        topics: [
            { k: ['vesper', 'doctor', 'cordelia'], say: (G) => S(G, '"Dr. Vesper is not to be disturbed. Not by anyone."') },
            { k: ['marga', 'witch', 'witches', 'healers'], say: (G) => S(G, 'The matron\'s pen stops for an instant. "I\'ve no idea what you mean. Good night."') },
        ],
        fallback: '"Good night."',
    },
    alder: {
        name: 'Mr. Alder', names: ['alder', 'mr alder', 'farmer', 'patient', 'man'], kind: 'man', x: 235, at: 'ward',
        look: 'A weathered farmer in a nightshirt lies in the fourth bed, his hands hard as roots on the blanket. His eyes are clear. For a man who has been ill six weeks, they are far too clear.',
        talk: (G) => S(G, '"Shh. Don\'t look at me. They give me the grey syrup twice a day, and I spit it in the pot when the orderly\'s back is turned. I came in with a cough six weeks ago, miss. I\'m fitter than I\'ve been in years. They won\'t let me leave. They say I\'m not fit."'),
        topics: [
            { k: ['tonic', 'syrup', 'medicine', 'dose'], say: (G) => S(G, '"Grey stuff. Makes you sleepy and sick, both. The ones who drink it every day get no better. The ones who spit it out start to mend, and then Dr. Vesper puts them back on it."') },
            { k: ['vesper', 'doctor'], say: (G) => S(G, '"Never smiles. She said, last week, quite kindly, \'It is such a shame to be well in a hospital.\'"') },
            { k: ['witches', 'healers', 'marga'], say: (G) => S(G, '"I\'ve heard singing from under the floor at night. A low sort of humming, like a hive. The orderlies say it\'s the pipes."') },
            { k: ['chart', 'clipboard'], say: (G) => S(G, '"Take it. Show it to anyone who will look. I\'ve got nothing else to leave on the table."') },
        ],
        fallback: '"Can\'t say, miss."',
    },
    vesper: {
        name: 'Dr. Vesper', names: ['vesper', 'doctor', 'dr vesper', 'cordelia', 'dr. vesper', 'woman'], kind: 'doctor', x: 205, at: 'works',
        look: (G) => G.flags.vesper_asleep
            ? 'Dr. Cordelia Vesper sleeps with her cheek on the ledger, her mask pushed up on her forehead. She looks a great deal younger asleep, and a great deal less sure.'
            : 'A tall woman in a white coat and a long, beaked doctor\'s mask pushed up on her forehead sits at the long table. Her gloves are very white and she holds her teacup exactly level. Her eyes, under the mask, are the grey of a cold sea.',
        talk: (G) => say(G, G.flags.vesper_asleep ? 'Dr. Vesper sleeps on.' : 'You dare not speak to her. If she turned her head, you would be the next patient.', 'narr'),
        topics: [],
        fallback: 'She does not answer.',
    },
    marga: {
        name: 'Marga', names: ['marga', 'marga thistle', 'mentor', 'old woman', 'woman'], kind: 'crone', x: 70, at: 'cells',
        look: (G) => G.flags.ready_marga
            ? 'Marga Thistle stands straight, with a hand against the wall, her white plait coming down and her eyes very bright. She looks older, and smaller, and wholly herself.'
            : 'Marga lies on the straw in the nearest cell, her white plait come loose, a blue-grey pallor round her mouth. Her chest rises and falls very slowly. She does not stir when you say her name. A cup of grey syrup sits untouched by her hand, and a smell of poppies hangs about her.',
        talk: (G) => {
            if (!G.flags.ready_marga) { say(G, 'Marga does not hear you. Her breath is slow and shallow, and her lips are the colour of slate. Whatever they gave her, she is far down in it.', 'narr'); return; }
            if (!G.flags.marga_told) {
                G.flags.marga_told = true;
                S(G, '"Elspeth. Child. I told you to go to Bryony and stay there. Never mind. Listen: Cordelia Vesper was my first apprentice. Clever, proud, always wanted a cure to be worth something. I sent her away when she began to charge. I should have burned her recipes. Everything Cray is doing, she thought of. The ward-stone at the Works holds all our power in iron. Break it with vervain, salt and rue, and Unbind. It must be spoken by someone who loves the bound. You will do."');
                return;
            }
            S(G, '"Hurry, child. The wagons won\'t wait."');
        },
        topics: [
            { k: ['vesper', 'cordelia'], say: (G) => S(G, G.flags.ready_marga ? '"A clever girl. I should have taught her less cleverness and more kindness."' : 'She cannot hear you.') },
            { k: ['stone', 'ward', 'unbind', 'rite', 'wintergreen'], say: (G) => S(G, G.flags.ready_marga ? '"The Wintergreen Rite. Vervain, salt and rue upon the stone, and the Unbind spoken. It will take everything you have."' : 'She cannot hear you.') },
        ],
        fallback: '"Later, child."',
    },
    dunmore: {
        name: 'Granny Dunmore', names: ['dunmore', 'granny', 'granny dunmore', 'mrs dunmore', 'old woman', 'woman'], kind: 'crone', x: 125, at: 'cells',
        look: (G) => G.flags.ready_dunmore
            ? 'Granny Dunmore sits up in the straw, blinking, her chin up, her hand reaching for a ladle that is not there. She is looking at you. She can see.'
            : 'An old woman sits upright in the straw with a ladle across her knees, her chin high, her eyes open and milky white. She turns her head toward every sound. They have blinded her, you realise: with belladonna, forced into her eyes until the sight went.',
        talk: (G) => {
            if (!G.flags.ready_dunmore) S(G, '"Who\'s that? Not a bailiff. Bailiffs breathe through their mouths. Child, is Bryony safe? Tell me Bryony\'s safe. They put something in my eyes. If someone could wash them out with eyebright..."');
            else S(G, '"Bryony! Where is that girl? Tell her she\'s been standing in a draught all week."');
        },
        topics: [
            { k: ['bryony'], say: (G) => S(G, '"My girl. My clever, rude, wonderful girl."') },
            { k: ['eyes', 'blind', 'belladonna', 'eyebright'], say: (G) => S(G, '"Belladonna. Eyebright and elderflower will clear it. I\'ve done it for a hundred others."') },
        ],
        fallback: '"Hush, child."',
    },
    harrow: {
        name: 'Widow Harrow', names: ['harrow', 'widow', 'widow harrow', 'woman'], kind: 'crone', x: 180, at: 'cells',
        look: (G) => G.flags.ready_harrow
            ? 'Widow Harrow is sitting up, sweat-damp and thin, with a face like a good apple left too long in the barn. She has the look of a woman about to complain about the draught, which is a very good sign.'
            : 'A stout old woman lies on the straw, flushed and glassy-eyed, her breath rattling in her chest. The brine has got into her lungs. She mutters about her cat.',
        talk: (G) => {
            if (!G.flags.ready_harrow) S(G, '"Is that the doctor? I\'m not drinking it. I\'m not. I\'ll have a feverfew tea and a sit down, and no more of that grey filth."');
            else S(G, '"I\'ll have a word to say to that Cray when I\'m on my feet. And to his mother."');
        },
        topics: [
            { k: ['fever', 'cough', 'tea', 'lungs'], say: (G) => S(G, '"Feverfew and willow bark. My own mother taught me."') },
        ],
        fallback: '"Hm?"',
    },
    twins: {
        name: 'the Pennywhistle sisters', names: ['pennywhistle', 'pennywhistles', 'twins', 'sisters', 'pennywhistle sisters', 'misses pennywhistle', 'old women'], kind: 'twins', x: 245, at: 'cells',
        look: (G) => G.flags.ready_twins
            ? 'The Misses Pennywhistle stand arm in arm, identical in grey and in outrage, rubbing their throats. Without the collars, they are talking at once.'
            : 'Two identical old ladies in lavender cardigans sit side by side on a bench, holding hands. Each wears a heavy iron collar with a rune on it, and neither speaks. The runes pulse faintly with a grey, slow light. Their eyes follow you, bright and furious.',
        talk: (G) => {
            if (!G.flags.ready_twins) say(G, 'The Pennywhistles stare at you, speechless. The iron collars hold their voices as well as their craft. One of them taps her collar and glares meaningfully.', 'narr');
            else S(G, '"We said it was a draught, and he said no, said it was the pipes, and we have been shouting about it for a week, and nobody listens to old ladies. Nobody."');
        },
        topics: [],
        fallback: 'They only glare.',
    },
};
