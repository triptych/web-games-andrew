// The story of RUNEBORE: cast, scenes, chapters, contracts, codex and Thimble's voice.
// Pure data + small functions over G. Scenes are played by the UI when a
// { type: 'scene', id } event appears in G.events.

import { W, T, RELICS, ARTIFACTS, UPGRADES, STRATA } from '../config.js';

// ------------------------------------------------------------------
// Cast (portraits are drawn procedurally from these parameters)
// ------------------------------------------------------------------
export const CAST = {
    narrator: { name: '', title: '' },
    thimble:  { name: 'Thimble', title: 'your automaton', kind: 'automaton', col: '#c8923a', eye: '#7fe0ff' },
    maren:    { name: 'Thimble (Maren)', title: 'your grandmother', kind: 'automaton', col: '#d8a24a', eye: '#ffb0d8' },
    orla:     { name: 'Orla Brask', title: 'Guildmistress', kind: 'dwarf', skin: '#e0a882', hair: '#b8482a', beard: true, braid: true, eyes: '#3a5a7a', scar: true },
    pell:     { name: 'Pell Fennick', title: 'Tinker of the Forge', kind: 'gnome', skin: '#f0c09a', hair: '#e8e8e8', beard: false, goggles: true, eyes: '#2a6a3a' },
    sedge:    { name: 'Sedgewick Thorne', title: 'Assayer', kind: 'elf', skin: '#e8d2b8', hair: '#2a2a3a', spectacles: true, eyes: '#6a4a8a' },
    mirabel:  { name: 'Mirabel Hask', title: 'Hedge-witch', kind: 'witch', skin: '#c89070', hair: '#5a8a4a', hat: true, eyes: '#e0b030' },
    ansel:    { name: 'Brother Ansel', title: 'Lamplighter of the Spire', kind: 'monk', skin: '#d8b090', hair: '#c8c0b0', bald: true, beard: true, eyes: '#4a4a3a' },
    corvin:   { name: 'Corvin Dask', title: 'Rival delver', kind: 'human', skin: '#e8b898', hair: '#1a1a20', moustache: true, tophat: true, eyes: '#4a7a9a' },
    wyrm:     { name: 'The Gloamwyrm', title: '', kind: 'wyrm', col: '#7a3ab0', eye: '#ff40a0' },
    ysmereth: { name: 'Ysmereth', title: 'Heartwarden', kind: 'wyrm', col: '#f0c060', eye: '#fff4b0' },
};

// ------------------------------------------------------------------
// Scenes. {name} is replaced with the player's name.
// A line may carry { choice: [{ label, flag, next }] } to branch.
// ------------------------------------------------------------------
export const SCENES = {
    prologue: [
        { who: 'narrator', text: 'In the hill-town of Emberwick, the Lumen Spire has burned for nine hundred years — a beacon fed by the Wyrmheart, a living crystal at the root of the world.' },
        { who: 'narrator', text: 'While the Spire burns, the frost-dark stays in the north. This autumn, for the first time in living memory, the light flickers.' },
        { who: 'narrator', text: 'You came to Emberwick with a satchel, a debt, and the key to a shed. Your grandmother, Maren Ashdown, was the finest delver the Guild ever knew. Nine years ago she went down into the Hollowdeep and never came back.' },
        { who: 'narrator', text: 'Under a tarp, under nine years of dust, you find her digging automaton: a barrel of brass and riveted oak, an auger for a nose, a cracked rune-core for a heart. You wipe the glass of its eye.' },
        { who: 'thimble', text: '…kzzt. …K-KEY. HAND. WARM.' },
        { who: 'thimble', text: 'DESIGNATION: THIMBLE. MEMORY: …BROKEN. TASK: …DELVE? DELVE.' },
        { who: 'narrator', text: 'The core flickers to a faint blue. Somewhere inside, gears that have waited nine years begin, stiffly, to turn.' },
        { who: 'thimble', text: '{NAME}? …NAME KNOWN. WHY. …UNKNOWN. GUILD. GO TO GUILD.' },
    ],
    license: [
        { who: 'orla', text: 'Well. Maren\'s grandchild, and Maren\'s old barrel on legs. I never thought I\'d see that rust-bucket walk again. I\'m Orla Brask. I run the Delvers\' Guild.' },
        { who: 'orla', text: 'You want a license? Here\'s the whole of the law: dig what you like, sell what you find, and don\'t die where I have to send the crane.' },
        { who: 'orla', text: 'Sedge buys ore at the Assay House. Fill your tank at the Aether Well. Pell Fennick at the Forge will bolt anything onto anything, and Mirabel sells runes for the stubborn rock.' },
        { who: 'orla', text: 'Push down to drill. Push into a wall to bore sideways. Up runs the vanes, and the vanes drink aether — so watch your gauge. Run dry down there and the Guild hauls you up, for a fee, and your cargo stays in the dark.' },
        { who: 'thimble', text: 'ORLA. …ORLA. KNOWN. NOT KNOWN WHY.' },
        { who: 'orla', text: '…Huh. It\'s talking. It never talked for me.' },
        { who: 'orla', text: 'Go on, then. Get fifteen fathoms of dirt under you and sell something. Then we\'ll see if you\'re a delver or a tourist.' },
    ],
    ch1done: [
        { who: 'orla', text: 'Ore sold, mud on your boots, all your fingers. You\'ll do.' },
        { who: 'orla', text: 'Here — a hundred and fifty crowns from the Guild purse. Spend it on Pell\'s Forge, not ale.' },
        { who: 'orla', text: 'Listen. Maren kept a map of every vault she ever smelled. She always swore the Rootloam hid "an eye that sees through stone". Thirty fathoms, give or take, and she never got it open.' },
        { who: 'thimble', text: '…EYE. LENS. THIRTY. …YES. THIMBLE REMEMBERS A RING OF BRICK.' },
        { who: 'orla', text: 'Then go find your ring of brick, the both of you.' },
    ],
    relic0: [
        { who: 'narrator', text: 'Behind the dwarf-brick, in a nest of roots, a lens of clear crystal the size of a fist. As you lift it, Thimble\'s eye blazes blue and the lens slides into the socket as if it had always belonged there.' },
        { who: 'thimble', text: 'CORE: ACCEPTED. SIGHT: …CLEARING.' },
        { who: 'narrator', text: 'A memory, not yours: two girls with lanterns at the mouth of a shaft, sixty years ago. A dark-haired one with a laugh like a bell, and a red-braided dwarf who is scared and pretending not to be.' },
        { who: 'thimble', text: 'Orla and… me? No. Not me. Her. "One day we\'ll reach the Heart, Orla. One day we\'ll see it with our own eyes."' },
        { who: 'thimble', text: 'Ore-sight active, {name}. I can see the glint of metal through the rock now — and the bogwind, too. Let\'s not drill into that.' },
    ],
    ch2done: [
        { who: 'orla', text: 'You found the Lumen Lens. Sixty years Maren and I scratched at that vault, and you walk in like it\'s the privy.' },
        { who: 'thimble', text: 'Orla. You were frightened of the shaft. You held her hand all the way down the first ladder.' },
        { who: 'orla', text: '…Who told that thing that?' },
        { who: 'orla', text: 'Never mind. Three hundred crowns, and a warning: below forty fathoms the Greystone starts, and the Rootloam\'s soft dirt turns to slate. Your auger\'ll want better teeth, and you\'ll want to stop falling into holes.' },
        { who: 'orla', text: 'Maren\'s notes mention a sigil that "lets a body fall like a feather". The old watch-halls, seventy-odd fathoms. Find it.' },
    ],
    corvin1: [
        { who: 'corvin', text: 'Well, well. The famous Ashdown name, riding a rain barrel. Corvin Dask, of Dask & Sons. You\'ll have seen my rig — the Brass Baron. Steam-driven. Twelve pistons.' },
        { who: 'thimble', text: 'It leaks, {name}. I can hear it from here.' },
        { who: 'corvin', text: 'The Glimmerdeep\'s mine. Moonquartz by the cartload. Stay up here in the shallows, where the worms are friendly.' },
        { who: 'corvin', text: 'Ta-ta!' },
        { who: 'thimble', text: 'He reminds me of someone. Someone who also never listened. …I think it was me.' },
    ],
    relic1: [
        { who: 'narrator', text: 'In the cold watch-hall a silver sigil hangs in the air of the vault, turning slowly like a leaf that has forgotten to land. It settles onto Thimble\'s vanes and the brass sings.' },
        { who: 'thimble', text: 'A memory: a rope, and a fall, and a red-braided arm that would not let go. "I\'ve got you, Maren. I\'ve always got you."' },
        { who: 'thimble', text: 'And another. A cottage in the valley. A baby that smells of milk and woodsmoke, laid in my — in her — arms. "I\'ll make the deep safe for you, little one. I promise."' },
        { who: 'thimble', text: '…That baby was your mother, {name}. I don\'t know how I know that.' },
        { who: 'thimble', text: 'Featherfall: active. We can drop as far as we like now, and the vanes lift easier.' },
    ],
    ch3done: [
        { who: 'orla', text: 'Featherfall. Maren fell down a shaft at Greyhollow once and lived to laugh about it. I didn\'t laugh. I held the rope.' },
        { who: 'thimble', text: 'You did, Orla. Your hands bled for a week.' },
        { who: 'orla', text: '…That\'s enough of that, tin-can.' },
        { who: 'orla', text: 'Five hundred crowns. And Brother Ansel up at the Spire\'s been asking for you. The light\'s getting worse. Go and hear him out — he talks slow, but he talks sense.' },
    ],
    ansel4: [
        { who: 'ansel', text: 'Ah. The Ashdown child. Come in, come in; mind the oil. I trim the wicks of a lamp that has no wick.' },
        { who: 'ansel', text: 'The Spire draws its light up a thread of crystal, from the Wyrmheart far below. Nine hundred years it has burned steady. This year it gutters like a candle in a draught.' },
        { who: 'ansel', text: 'And at night I hear something down the thread. A sound like breathing. Like something very large, very hungry, and very patient.' },
        { who: 'ansel', text: 'Your grandmother believed there were seven keys to the Heart, scattered by the dwarves when Kharadun fell. The third lies in the Glimmerdeep — a gear from the heart of a dwarf-forge. Around a hundred and twenty-five fathoms.' },
        { who: 'thimble', text: 'The Heartgear. Yes. She drew it on the back of a tavern bill. I can see the drawing.' },
        { who: 'ansel', text: 'Then may your lamp burn longer than ours, little delver.' },
    ],
    relic2: [
        { who: 'narrator', text: 'A gear of red-gold, warm to the touch, its teeth cut finer than any human hand could cut them. When it seats in Thimble\'s drive, every cog in the automaton suddenly runs true.' },
        { who: 'thimble', text: 'A forge. A young gnome with a soot-black nose and a pair of goggles too big for him. "Rivets in a spiral, Maren, so the hull flexes instead of cracking." We built a body together. We built me.' },
        { who: 'thimble', text: 'Pell. That was Pell. He made me — he made Thimble. With her.' },
        { who: 'thimble', text: 'The auger turns faster now, {name}. Much faster. Shall we see what\'s under all this crystal?' },
    ],
    ch4done: [
        { who: 'ansel', text: 'The Heartgear. Truly? Then your grandmother was right, and I owe her an apology she will never hear.' },
        { who: 'thimble', text: 'You called her a madwoman in the Lantern Inn, Brother. In front of the whole Guild.' },
        { who: 'ansel', text: '…I did. Spirits preserve me, I did.' },
        { who: 'ansel', text: 'Here is the rest of the old story, then. Beneath Kharadun lies the Heart, and around the Heart sleeps its warden — Ysmereth, the oldest wyrm. When the dwarves dug too greedily, they broke into the Gloam, the cold hunger under the world.' },
        { who: 'ansel', text: 'Ysmereth swallowed the Gloam to save the Heart. That was nine hundred years ago. I fear the Gloam has been swallowing Ysmereth ever since.' },
        { who: 'ansel', text: 'Take eight hundred crowns from the Spire\'s alms. It is the best use they have had in years. Go and tell Orla. She will know what lies in Kharadun — whether she likes it or not.' },
    ],
    ch5start: [
        { who: 'orla', text: 'Ansel told you about Kharadun. Of course he did.' },
        { who: 'orla', text: 'There\'s a sunken city at a hundred and fifty fathoms. Dwarf-halls, coffers, the bones of my grandmother\'s grandmother. And a waystone — an aether-well the old kings used — around two hundred. Wake it and you can travel between it and the Spire.' },
        { who: 'orla', text: 'There\'s a key down there too. A satchel that holds more than it ought to. Maren and I found its vault, once.' },
        { who: 'orla', text: 'Find the satchel. Wake the waystone. Then come back and I\'ll tell you the rest. I owe you that much. I owe her that much.' },
    ],
    relic3: [
        { who: 'narrator', text: 'A small satchel of grey dwarf-felt, empty, light as nothing. You put your arm in to the shoulder and do not touch the bottom.' },
        { who: 'thimble', text: 'The gate of Kharadun. Two delvers in front of it, older now, grey in their hair. One says "We go in." The other says "We go home."' },
        { who: 'thimble', text: 'Orla turned back. Maren went on. They didn\'t speak for twenty years.' },
        { who: 'thimble', text: 'Our hold carries half again as much now, {name}. Don\'t let it go to your head.' },
    ],
    waystone0: [
        { who: 'narrator', text: 'Your weight settles on the plinth. Dwarf-runes kindle one by one in a ring around it, and a column of pale aether climbs out of the stone and up into the dark, toward the Spire.' },
        { who: 'thimble', text: 'The Kharadun Waystone. Awake again after nine hundred years. We can refuel here, mend here, and travel home and back in a breath.' },
        { who: 'thimble', text: 'It costs more down here, mind. Dwarves were never cheap.' },
    ],
    ch5done: [
        { who: 'orla', text: 'You stood at the gate of Kharadun. Then you know what I did there.' },
        { who: 'orla', text: 'Maren wanted to go on to the Heart. I wanted to go home. I told her she was mad, that she\'d die down there, that the Heart was a story for children. She went on alone. And twenty years later she went down for the last time, and she didn\'t ask me to come.' },
        { who: 'orla', text: 'Nine years ago I found that barrel of yours at the top of the Guild shaft. Alone. Scorched. Its core cracked. It must have climbed four hundred fathoms by itself.' },
        { who: 'orla', text: 'I couldn\'t look at it. I couldn\'t scrap it. So I put it in her shed and locked the door.' },
        { who: 'thimble', text: 'You left a lantern lit beside me, Orla. Every winter. I remember the light.' },
        { who: 'orla', text: '…Fifteen hundred crowns. Go. Before I say something soft.' },
    ],
    ch6start: [
        { who: 'orla', text: 'Trouble. Corvin Dask went down two days ago, chasing some rumour of a salamander\'s scale in the Emberdeep. His beacon\'s fading, two hundred and forty-odd fathoms down.' },
        { who: 'orla', text: 'The Emberdeep cooks hulls. Get Pell to chalk you some Frostward runes, or you\'ll come up as a kettle.' },
        { who: 'thimble', text: 'He isn\'t our friend, {name}.' },
        { who: 'thimble', text: '…But Maren never left anyone in the dark. Neither will we.' },
    ],
    wreck: [
        { who: 'narrator', text: 'The Brass Baron lies on its side in a pocket of cooling basalt, every one of its twelve pistons cracked. A muffled voice comes from inside.' },
        { who: 'corvin', text: 'Hello? Hello! Is that — oh, of course it\'s you. Of course it\'s the rain barrel.' },
        { who: 'corvin', text: '…Please get me out. It\'s very hot and I have been singing to myself for two days and I don\'t know any more songs.' },
        { who: 'narrator', text: 'Thimble pries the hatch open. Corvin climbs out, soot-black, and clings to Thimble\'s back like a soggy cat.' },
        { who: 'corvin', text: 'Not a word about this at the Lantern Inn. Not one word.' },
        { who: 'thimble', text: 'I make no promises.' },
    ],
    relic4: [
        { who: 'narrator', text: 'A single scale as big as your palm, red as a coal and cold as snow. When you lay it on the hull, the heat of the Emberdeep simply… stops reaching you.' },
        { who: 'thimble', text: 'Her last descent. Alone. The heat beating on the hull. She stopped here, in this very hollow, and wrote a letter she knew she might never send.' },
        { who: 'thimble', text: '"To my grandchild, whom I have not met. If you are reading this, the deep has my bones and I am sorry. Be braver than me. Be kinder than me. Come home more often than I did."' },
        { who: 'thimble', text: '…{name}. That letter was for you.' },
    ],
    ch6done: [
        { who: 'corvin', text: 'Ahem. The Guild should know that I was performing a, ah, controlled cooling experiment. Inside my rig. For two days.' },
        { who: 'orla', text: 'The Guild knows you were stuck in a hole, Dask.' },
        { who: 'corvin', text: '…Yes. Fine. Thank you, Ashdown. Truly. Here — the schematics for my father\'s rime-runes. Pell will know what to do with them. Consider it a debt paid. Partly.' },
        { who: 'orla', text: 'Two and a half thousand crowns from the Guild. Dask is paying half of it.' },
        { who: 'corvin', text: 'I am WHAT?' },
        { who: 'orla', text: 'Below three hundred fathoms is the Gloam, {name}. Nobody\'s come back from there with their wits whole. Except, maybe, one stubborn old woman. Find the Heart of Kharadun and get out.' },
    ],
    relic5: [
        { who: 'narrator', text: 'In a vault of black glass, a heart of rose-red crystal beats — slowly, steadily — like something asleep. It knows Thimble. It leaps into the cracked core, and the crack seals over with light.' },
        { who: 'maren', text: 'Oh. Oh, there you are.' },
        { who: 'maren', text: 'I remember now. All of it. The Rune Gate. The shadow of the wyrm coming up through the floor. My rig breaking under me like kindling. And I knew — I knew — I wasn\'t getting out.' },
        { who: 'maren', text: 'So I did the one thing a delver should never do. I bound myself into my automaton, the old dwarf-way, so that something of me could climb home and tell you where the keys were. It cost me most of my memory. It cost me my voice.' },
        { who: 'maren', text: 'Thimble isn\'t just a machine, {name}. Thimble is your grandmother. Hello, my darling. I\'m so sorry I was late.' },
        { choice: [
            { label: 'Hello, Grandmother.', flag: 'warm' },
            { label: 'You let me think you were dead.', flag: 'hurt' },
        ] },
    ],
    relic5_warm: [
        { who: 'maren', text: 'Ha! You have my chin and your mother\'s manners. Thank every spirit in the deep for that.' },
        { who: 'maren', text: 'Let\'s go home and give Orla the fright of her life. And then, my darling, let\'s go and finish this.' },
    ],
    relic5_hurt: [
        { who: 'maren', text: 'I did. I didn\'t remember I was alive, if this is alive. That doesn\'t make it fair. You\'re allowed to be angry.' },
        { who: 'maren', text: 'Be angry and come with me anyway? There\'s a wyrm that needs us, and an old dwarf at the Guild who has waited nine years for this. Let\'s go home first.' },
    ],
    ch7done: [
        { who: 'orla', text: 'What did you find down — why is its eye pink?' },
        { who: 'maren', text: 'Hello, Orla. You kept the lantern lit.' },
        { who: 'orla', text: '…' },
        { who: 'orla', text: 'Maren?' },
        { who: 'maren', text: 'Mostly. The rest of me is brass and oak, and frankly I\'ve never looked better.' },
        { who: 'orla', text: 'You — you mule-headed, stone-brained, stubborn, LYING — nine years. NINE YEARS, Maren.' },
        { who: 'maren', text: 'I know. I\'m sorry I didn\'t ask you to come.' },
        { who: 'orla', text: '…I\'d have said no.' },
        { who: 'maren', text: 'I know that too.' },
        { who: 'orla', text: 'Take the Guild\'s three thousand and go and finish it, the two of you. The last key\'s past three-fifty fathoms, right against the Gate. And Maren — come back this time. Both of you. That\'s an order from the Guildmistress.' },
    ],
    relic6: [
        { who: 'narrator', text: 'A lance of star-iron, forged from a stone that fell from the sky before the dwarves had names. Thimble\'s old auger slides away and the lance locks into its place, humming like a struck bell.' },
        { who: 'maren', text: 'The seventh key. Every lock below us will know this voice now — the Rune Gate, and the shards the Gloam has grown around the wyrm\'s heart.' },
        { who: 'maren', text: 'The Gate is at three hundred and sixty-eight fathoms. Beyond it, Ysmereth. Bring blast runes, bring draughts, and fill the tank to the brim. I\'ll not lose you down there. I will not.' },
    ],
    gate: [
        { who: 'narrator', text: 'The lance touches the Rune Gate and the runes read it like a name. From one wall of the world to the other, the Gate crumbles into falling light.' },
        { who: 'wyrm', text: '…LIGHT. SMALL LIGHT. SMALL WARM LIGHT. COME DOWN. COME DOWN AND BE EATEN.' },
        { who: 'maren', text: 'That\'s not Ysmereth talking. That\'s the Gloam, wearing Ysmereth like a coat. Its heart is bound in four shards of shadow-crystal, set in the chamber walls. Break the shards with the lance and the Gloam loses its grip.' },
        { who: 'maren', text: 'Mind its lunge — it winds up before it strikes — and keep moving when it spits. And {name}? I\'m proud of you. I wanted to say it before.' },
    ],
    wyrm1: [
        { who: 'wyrm', text: 'THE OLD ONE. THE OLD ONE CAME BACK, IN A TIN SHELL. I REMEMBER THE TASTE OF YOUR RIG, DELVER.' },
        { who: 'maren', text: 'You\'ll not taste this one. Shards, {name}! Two up on the high ledges, two low by the floor. Go!' },
    ],
    freed: [
        { who: 'narrator', text: 'The last shard bursts. The shadow pours off the wyrm like ink off a dropped page, and beneath it is gold — scale after scale of old, tired, shining gold.' },
        { who: 'ysmereth', text: 'Ahhh. Light. I had forgotten. Nine hundred years in the dark of my own belly, little ones, and I had forgotten.' },
        { who: 'ysmereth', text: 'The Gloam is burned from me. Go to the Heart, the pair of you. Lay your lance to it. It has been waiting a long time for a delver.' },
    ],
    ending: [
        { who: 'narrator', text: 'The lance touches the Wyrmheart. Light floods up the crystal thread — up through the Gloam and the Emberdeep, through Kharadun and the Glimmerdeep, the Greystone and the Rootloam — and far above, in the middle of the night, the Lumen Spire blazes like a second sun.' },
        { who: 'ysmereth', text: 'There. Now I can sleep properly. And you, old delver in your tin shell, I owe you a gift.' },
        { who: 'ysmereth', text: 'I cannot give you back your bones. But I can let your spirit go gently on, to whatever rest waits for delvers. Or you may stay in your brass shell with the child, as long as the brass holds. Choose.' },
        { who: 'maren', text: '…{name}. I\'ve made every choice in my life alone. Let\'s make this one together. What do you want?' },
        { choice: [
            { label: 'Stay with me, Grandmother.', flag: 'stay' },
            { label: 'You\'ve earned your rest.', flag: 'rest' },
        ] },
    ],
    ending_stay: [
        { who: 'maren', text: 'Then I stay. Ha! I\'ll want new rivets, mind. And a hat.' },
        { who: 'ysmereth', text: 'So be it. Go up, delvers. The deep is safe again.' },
    ],
    ending_rest: [
        { who: 'maren', text: 'You\'d let me go? You really are your mother\'s child.' },
        { who: 'maren', text: 'Thimble will still turn. My gears are in it, my rivets, my stubbornness. Just not my voice. Talk to it anyway. I\'ll hear.' },
        { who: 'maren', text: 'Goodbye, my darling. Come home more often than I did.' },
        { who: 'ysmereth', text: 'So be it. Go up, delver. The deep is safe again.' },
    ],
    // short scenes for a first rescue and the journal pages
    rescue1: [
        { who: 'orla', text: 'The crane brought you up looking like a dropped teapot. That\'s a fee, and whatever was in your hold is feeding the worms now.' },
        { who: 'orla', text: 'Watch the aether gauge and the hull. Turn back at half a tank. Every delver who ever died thought they had "just one more vein" in them.' },
    ],
    page1: [ { who: 'narrator', text: '"Day one of the last descent. Orla doesn\'t know. Better she doesn\'t. I\'ve left the Lens where it lies — thirty fathoms, the old brick ring under the oak roots. If I don\'t come back, someone braver will need it more than me." — M.A.' } ],
    page2: [ { who: 'narrator', text: '"The Greystone watch-halls. The dwarves cut their halls in rows of four and always left the Featherfall in the fourth. I mapped it at seventy-six fathoms years ago. I thought of my grandchild, who I\'ve never met, and nearly turned back." — M.A.' } ],
    page3: [ { who: 'narrator', text: '"Glimmerdeep. The crystals sing when Thimble passes — I swear they know Pell\'s rivets. The Heartgear\'s vault is at one-twenty-six. Thimble runs smoother with it. I\'m leaving it for whoever comes after: I need the weight for blast runes." — M.A.' } ],
    page4: [ { who: 'narrator', text: '"Kharadun. Twenty years since Orla and I stood at this gate and shouted at each other. I miss her. I should have asked her to come. I should have asked her a hundred times. The waystone still works if you stand on it." — M.A.' } ],
    page5: [ { who: 'narrator', text: '"The heat. Gods, the heat. The Salamander Scale is at two-fifty-two, but I\'ve found it too late to need it — the Gate is the thing. I\'m writing a letter to my grandchild in case. I am not brave. I am only stubborn." — M.A.' } ],
    page6: [ { who: 'narrator', text: '"The Gate. It wants star-iron and I have none. Something huge moved under the floor. If this page is found: the Lance is at three-fifty-six, east of the black glass. The Heart is worth it. Tell Orla — tell Orla I\'m sorry." — M.A.' } ],
};

// Waystone 1 shares the first one's wonder in a shorter form.
SCENES.waystone1 = [
    { who: 'maren', text: 'The Gloam Waystone. The last light before the Gate. Fill the tank and mend the hull here, {name}, and travel home whenever you need. We are close now.' },
];

// ------------------------------------------------------------------
// Thimble's voice: [garbled (no Lens), halting (Lens), Maren (Heart)]
// ------------------------------------------------------------------
const BARKS = {
    firstore:   ['ORE. GOOD. SELL. SEDGE.', 'Ore! Copper first, then tin. Sedge pays at the Assay House.', 'Ore, darling. Fill the hold, then go and fleece Sedge.'],
    stratum1:   ['COLD. SLATE. HALLS.', 'The Greystone Halls. Slate, and dwarf-cut stone. Iron here, and silver.', 'The Greystone. I lost a glove down here in my twenties.'],
    stratum2:   ['…SINGING?', 'The Glimmerdeep. Do you hear the crystals? They\'re singing.', 'The Glimmerdeep. Pell and I used to come down just to listen.'],
    stratum3:   ['CITY. DROWNED.', 'Sunken Kharadun. A whole kingdom, swallowed by the stone. Gold, and sapphires, and ghosts.', 'Kharadun. I never stop being sad down here.'],
    stratum4:   ['HOT. HOT. HOT.', 'The Emberdeep. The hull is heating. Frostward runes, or the Salamander Scale, or we cook.', 'The Emberdeep. Breathe slow, love. The heat wants you to panic.'],
    stratum5:   ['…DARK.', 'The Gloam. My lantern seems smaller here. Something is watching the light.', 'The Gloam. Stay in the light. Stay close to me.'],
    upgrade:    ['NEW PART. GOOD.', 'Pell\'s work. I can feel it fit.', 'Oh, that\'s lovely. Tell Pell he still does the best rivets in the north.'],
    gasnear:    ['SMELL. BAD.', 'Bogwind nearby — the green-glowing pockets. Don\'t drill into them.', 'Bogwind, darling. Leave it be.'],
    shard1:     ['', 'One shard down! It felt that.', 'One! It felt that. Keep moving!'],
    shard2:     ['', 'Two! Halfway there!', 'Two! Halfway, my brave one!'],
    shard3:     ['', 'Three! One more!', 'Three! Just one more!'],
    rescued:    ['…CRANE.', 'The crane again. Let\'s be more careful.', 'Up we come again. No shame in it. Mind the gauges.'],
    sold:       ['CROWNS.', 'Crowns! Pell will want to see those.', 'Crowns! Spend them on the hull, love, not the hat I mentioned.'],
};

export function voiceTier(G) { return G.relics[5] ? 2 : G.relics[0] ? 1 : 0; }

export function thimbleBark(G, key) {
    const b = BARKS[key];
    if (!b) return;
    if (G.story.flags.restful) { G.events.push({ type: 'bark', key, text: '*a warm, contented whirr*' }); return; }
    const tier = voiceTier(G);
    const t = b[tier] || b[1] || b[0];
    if (t) G.events.push({ type: 'bark', key, text: t, who: tier === 2 ? 'maren' : 'thimble' });
}

// ------------------------------------------------------------------
// Chapters
// ------------------------------------------------------------------
export const CHAPTERS = [
    { title: 'The Letter',          to: 'orla',  scene: 'license', reward: 0,
      obj: () => 'Visit Orla at the Delvers\' Guild (the banners, right of the Spire).', goal: () => true },
    { title: 'First Delve',         to: 'orla',  scene: 'ch1done', reward: 150,
      obj: (G) => `Dig 15 fathoms down (${Math.min(15, G.stats.deepest)}/15), then sell ore at Sedge's Assay House.`,
      goal: (G) => G.stats.deepest >= 15 && G.story.flags.sold },
    { title: 'A Glint in the Loam', to: 'orla',  scene: 'ch2done', reward: 300,
      obj: () => 'Find the relic Maren mapped in the Rootloam: a brick ring, about 30 fathoms down.', goal: (G) => G.relics[0] },
    { title: 'The Grey Halls',      to: 'orla',  scene: 'ch3done', reward: 500,
      obj: () => 'Find the Featherfall Sigil in the Greystone Halls, about 76 fathoms down.', goal: (G) => G.relics[1] },
    { title: 'Glimmer and Gloom',   to: 'ansel', scene: 'ch4done', reward: 800, start: 'ansel4', startAt: 'ansel',
      obj: (G) => G.story.flags.ansel4 ? 'Find the Dwarven Heartgear in the Glimmerdeep, about 126 fathoms down.' : 'Brother Ansel wants a word at the Lumen Spire.',
      goal: (G) => G.relics[2] && G.story.flags.ansel4 },
    { title: 'Sunken Kharadun',     to: 'orla',  scene: 'ch5done', reward: 1500, start: 'ch5start', startAt: 'orla',
      obj: (G) => G.story.flags.ch5start
          ? `Find the Hollowing Satchel (~186 fathoms)${G.relics[3] ? ' ✓' : ''} and wake the Kharadun Waystone (~200)${G.waystones[0] ? ' ✓' : ''}.`
          : 'Orla has something to tell you about Kharadun. Visit the Guild.',
      goal: (G) => G.relics[3] && G.waystones[0] && G.story.flags.ch5start },
    { title: 'Ember and Ash',       to: 'orla',  scene: 'ch6done', reward: 2500, start: 'ch6start', startAt: 'orla',
      obj: (G) => G.story.flags.ch6start
          ? `Rescue Corvin in the Emberdeep (~246)${G.story.flags.corvin ? ' ✓' : ''}; find the Salamander Scale (~252)${G.relics[4] ? ' ✓' : ''}.`
          : 'Orla needs you at the Guild. Urgently.',
      goal: (G) => G.story.flags.corvin && G.relics[4] && G.story.flags.ch6start },
    { title: 'Into the Gloam',      to: 'orla',  scene: 'ch7done', reward: 3000,
      obj: () => 'Find the Heart of Kharadun in the Gloam, about 316 fathoms down.', goal: (G) => G.relics[5] },
    { title: 'Starforged',          to: null,    reward: 0,
      obj: (G) => G.relics[6] ? 'Open the Rune Gate at 368 fathoms with the Starforged Lance.' : 'Find the Starforged Lance, about 356 fathoms down, near the Gate.',
      goal: (G) => G.gateOpen },
    { title: 'The Gloamwyrm',       to: null,    reward: 0,
      obj: (G) => `Break the Gloamwyrm's heart-shards (${G.boss ? G.boss.shards.filter((s) => s.broken).length : 0}/4) in the chamber below the Gate.`,
      goal: (G) => G.bossDefeated },
    { title: 'The Wyrmheart',       to: null,    reward: 0,
      obj: () => 'Lay the lance to the Wyrmheart on the chamber floor.', goal: (G) => G.story.flags.ending },
    { title: 'Epilogue',            to: null,    reward: 0,
      obj: () => 'The Spire burns bright. Delve as you please.', goal: () => false },
];

export function newStoryState() {
    return { ch: 0, ready: false, flags: {}, seen: {}, contractsDone: [], chatter: {}, pending: [] };
}

export function objectiveText(G) {
    const ch = CHAPTERS[G.story.ch];
    if (!ch) return '';
    if (G.story.ready && ch.to) return `Report to ${CAST[ch.to].name} (${BUILDING_OF[ch.to]}).`;
    return ch.obj(G);
}
export const BUILDING_OF = { orla: 'the Guild', ansel: 'the Lumen Spire', pell: 'the Forge', sedge: 'the Assay House', mirabel: 'Runes & Remedies' };

export function playScene(G, id) {
    G.story.seen[id] = true;
    G.events.push({ type: 'scene', id });
}

/** Called by the UI when a scene with a choice resolves. */
export function chooseInScene(G, sceneId, flag) {
    if (sceneId === 'relic5') { G.story.flags.greeting = flag; playScene(G, 'relic5_' + flag); }
    if (sceneId === 'ending') {
        G.story.flags.endingChoice = flag;
        if (flag === 'rest') G.story.flags.restful = true;
        playScene(G, 'ending_' + flag);
    }
}

function addCodex(G, key) {
    if (!LORE[key] || G.codex.includes(key)) return;
    G.codex.push(key);
    G.events.push({ type: 'codex', key });
}

// ------------------------------------------------------------------
// Event hooks from the simulation
// ------------------------------------------------------------------
export function storyEvent(G, ev) {
    const st = G.story, F = st.flags;
    switch (ev.type) {
        case 'depth':
            if (ev.depth >= 3 && !F.firstDig) { F.firstDig = true; addCodex(G, 'stratum0'); }
            break;
        case 'stratum':
            if (!F['st' + ev.s] && ev.s > 0) {
                F['st' + ev.s] = true;
                addCodex(G, 'stratum' + ev.s);
                if (ev.s < 6) thimbleBark(G, 'stratum' + ev.s);
            }
            break;
        case 'ore':
            if (!F.firstOre) { F.firstOre = true; thimbleBark(G, 'firstore'); }
            break;
        case 'sell':
            if (!F.sold) { F.sold = true; thimbleBark(G, 'sold'); }
            break;
        case 'artifact': {
            const a = ARTIFACTS[ev.id];
            addCodex(G, a.lore);
            if (a.lore.startsWith('page')) playScene(G, a.lore);
            break;
        }
        case 'relic':
            addCodex(G, 'relic' + ev.id);
            playScene(G, 'relic' + ev.id);
            break;
        case 'waystone':
            playScene(G, 'waystone' + ev.id);
            break;
        case 'wreck':
            F.corvin = true;
            playScene(G, 'wreck');
            addCodex(G, 'corvin');
            break;
        case 'gate-open':
            playScene(G, 'gate');
            break;
        case 'boss-start':
            if (!F.wyrm1) { F.wyrm1 = true; playScene(G, 'wyrm1'); }
            break;
        case 'shard':
            if (ev.n < 4) thimbleBark(G, 'shard' + ev.n);
            break;
        case 'wyrm-freed':
            playScene(G, 'freed');
            addCodex(G, 'ysmereth');
            break;
        case 'heart':
            F.ending = true;
            playScene(G, 'ending');
            break;
        case 'rescued':
            if (!F.rescue1) { F.rescue1 = true; st.pending.push('rescue1'); }
            else thimbleBark(G, 'rescued');
            break;
        case 'upgrade':
            if (!F.firstUpgrade) { F.firstUpgrade = true; thimbleBark(G, 'upgrade'); }
            break;
        default: break;
    }
}

/** Per-step checks: chapter goals, surface-only scenes, gas warnings. */
export function storyTick(G) {
    const st = G.story;
    const ch = CHAPTERS[st.ch];
    if (ch && !st.ready && ch.goal(G)) {
        if (ch.to) {
            st.ready = true;
            G.events.push({ type: 'objective', text: objectiveText(G) });
        } else {
            advance(G);
        }
    }
    const onSurface = G.rig.y > 0 && G.rig.grounded;
    if (onSurface && !G.down) {
        if (st.pending.length) playScene(G, st.pending.shift());
        if (!st.flags.corvin1 && G.stats.deepest >= 40 && st.ch >= 3) { st.flags.corvin1 = true; playScene(G, 'corvin1'); addCodex(G, 'corvin'); }
    }
    // Gas warning once the Lens can see it
    if (G.relics[0] && !st.flags.gasWarned && (G._gasT = (G._gasT ?? 0) + 1) % 30 === 0) {
        const c0 = Math.floor(G.rig.x), r0 = Math.floor(-G.rig.y);
        for (let r = r0 - 3; r <= r0 + 3 && !st.flags.gasWarned; r++) {
            for (let c = c0 - 3; c <= c0 + 3; c++) {
                if (r >= 0 && c >= 0 && c < W && G.world.tiles[r * W + c] === T.GAS) { st.flags.gasWarned = true; thimbleBark(G, 'gasnear'); break; }
            }
        }
    }
}

function advance(G) {
    const st = G.story;
    st.ch++;
    st.ready = false;
    const ch = CHAPTERS[st.ch];
    if (ch) G.events.push({ type: 'chapter', ch: st.ch, title: ch.title, text: objectiveText(G) });
}

/**
 * Talk to someone in a building. Returns the scene id to play (or a chatter line).
 */
export function talk(G, who) {
    const st = G.story;
    const ch = CHAPTERS[st.ch];
    if (ch && st.ready && ch.to === who) {
        playScene(G, ch.scene);
        if (ch.reward) { G.money += ch.reward; G.stats.earned += ch.reward; G.events.push({ type: 'reward', amount: ch.reward }); }
        if (ch.scene === 'ch6done' && G.up.ward < UPGRADES.ward.tiers.length - 1) { G.up.ward++; G.events.push({ type: 'upgrade', key: 'ward', tier: G.up.ward, gift: true }); }
        if (ch.scene === 'ch7done') addCodex(G, 'maren');
        advance(G);
        return { scene: ch.scene };
    }
    const next = CHAPTERS[st.ch];
    if (next && next.start && next.startAt === who && !st.flags[next.start]) {
        st.flags[next.start] = true;
        playScene(G, next.start);
        return { scene: next.start };
    }
    return { line: chatter(G, who) };
}

/** True when this person has story business with you right now. */
export function hasBusiness(G, who) {
    const st = G.story, ch = CHAPTERS[st.ch];
    if (!ch) return false;
    if (st.ready && ch.to === who) return true;
    return !!(ch.start && ch.startAt === who && !st.flags[ch.start]);
}

// ------------------------------------------------------------------
// Chatter (idle conversation), by chapter
// ------------------------------------------------------------------
const CHATTER = {
    orla: [
        [0, 'Contracts are on the board by the door. Fill one and the Guild pays over the odds.'],
        [1, 'Every fathom down, the rock gets harder and the dark gets darker. Upgrade the auger and the lantern before you get greedy.'],
        [2, 'Maren used to say the deep tells you what it wants, if you shut up and listen. I never shut up.'],
        [3, 'Below the Greystone the soft augers just bounce. Pell will sort you out.'],
        [5, 'That waystone of yours can bring you up in a blink. Use it. Pride is heavier than ore.'],
        [7, 'Don\'t you dare let that tin-can go and get itself wrecked again, Maren. Don\'t you dare.'],
        [8, 'The Gate. Gods. Be careful, the pair of you.'],
        [11, 'The Spire\'s brighter than I\'ve ever seen it. The whole town is out in the street. Go on, have a look.'],
    ],
    pell: [
        [0, 'Maren\'s Thimble! Let me look — oh, my old spiral rivets, still holding! Who built you, eh? Who built you? I did!'],
        [2, 'Lantern first, then auger. Can\'t dig what you can\'t see — that\'s the first law of Fennick.'],
        [3, 'Hull plating\'s cheaper than the crane fee. Second law of Fennick.'],
        [4, 'I put a little tin heart-shaped plate under the left vane, when we built Thimble. For luck. Don\'t tell Maren.'],
        [6, 'Corvin\'s rime-runes! His father knew his business. Frostward in the Emberdeep, that\'s the third law of Fennick.'],
        [7, 'Maren. MAREN. I knew those rivets were thinking. I KNEW it.'],
        [11, 'Seven keys, one Heart, and my rivets held the whole way. Best work I ever did.'],
    ],
    sedge: [
        [0, 'Ore goes on the scale; crowns come off the scale. I am an assayer, not a conversationalist.'],
        [2, 'Amberglass. Lovely stuff. The fae used it for lamp-glass; I use it for my retirement.'],
        [4, 'Moonquartz should be handled with gloves. Not because it\'s dangerous. Because it\'s mine now.'],
        [5, 'A crown of King Durrak would pay for a great deal. Should you trip over one.'],
        [8, 'Starmetal. In my lifetime. Do try not to drop it.'],
        [11, 'Very well, I admit it. I was moved. Do not tell anyone.'],
    ],
    mirabel: [
        [0, 'A blast rune for the warded stone, a draught for the dents, and a recall scroll for when the deep says "no". Mind your eyebrows.'],
        [2, 'The runestone down there is warded by dwarf-witches. Blast runes don\'t argue with wards; they just win.'],
        [4, 'Glimmerdeep crystals ring in a minor key. Very bad for jam-making. Don\'t ask.'],
        [6, 'Gloam-wisps hate light and love aether. Keep the lantern bright and a blast rune handy.'],
        [8, 'The Gloamwyrm? Great Blast Runes, dear. A bang to the nose will stun anything with a nose.'],
        [11, 'The jam has never set better. That\'s the Spire, that is.'],
    ],
    ansel: [
        [0, 'The Spire? It is the oldest light in the north. Lately, I think, it is tired.'],
        [4, 'I dreamed of gold scales last night. Old, tired gold.'],
        [5, 'The light rises when you go down. I don\'t know how. I only know it does.'],
        [8, 'I have lit every lamp in the Spire for you. All three hundred.'],
        [11, 'Look at it! Look at it, little delver. I can read by it at midnight.'],
    ],
};

export function chatter(G, who) {
    const list = CHATTER[who];
    if (!list) return '';
    const avail = list.filter(([ch]) => ch <= G.story.ch);
    const n = (G.story.chatter[who] = ((G.story.chatter[who] ?? -1) + 1));
    // most recent line first, then cycle through the older ones
    const pick = avail[avail.length - 1 - (n % avail.length)];
    return pick ? pick[1] : '';
}

// ------------------------------------------------------------------
// Guild contracts
// ------------------------------------------------------------------
export const CONTRACTS = [
    { id: 0,  title: 'A Bell for the Spire',  from: 'ansel',   ore: 0,  n: 6, reward: 160,  ch: 1, text: 'Copper for a new bell to ring the hours.' },
    { id: 1,  title: 'Tin for the Tinker',    from: 'pell',    ore: 1,  n: 5, reward: 230,  ch: 1, text: 'Pell needs tin for a thousand tiny gears.' },
    { id: 2,  title: 'Lamp-glass',            from: 'mirabel', ore: 3,  n: 4, reward: 420,  ch: 2, text: 'Amberglass for Mirabel\'s night-lamps.' },
    { id: 3,  title: 'Iron for the Watch',    from: 'orla',    ore: 2,  n: 8, reward: 520,  ch: 3, text: 'The town watch needs new pike-heads.' },
    { id: 4,  title: 'Silver Wards',          from: 'mirabel', ore: 4,  n: 5, reward: 950,  ch: 3, text: 'Silver for warding the town gates against the frost-dark.' },
    { id: 5,  title: 'Moonlight for the Spire', from: 'ansel', ore: 5,  n: 6, reward: 1750, ch: 4, text: 'Moonquartz to brace the Spire\'s failing light.' },
    { id: 6,  title: 'A Wedding Ring',        from: 'sedge',   ore: 6,  n: 2, reward: 950,  ch: 5, text: 'A farmer at Sallowmere wants two gold rings. Sedge is sentimental, it turns out.' },
    { id: 7,  title: 'Sapphire Lenses',       from: 'pell',    ore: 7,  n: 4, reward: 2500, ch: 5, text: 'Pell is building a telescope. He won\'t say why.' },
    { id: 8,  title: 'Mithril for the Guard', from: 'orla',    ore: 8,  n: 5, reward: 4100, ch: 6, text: 'Mail shirts for the Guild\'s rescue crew.' },
    { id: 9,  title: 'Embers for the Hearth', from: 'mirabel', ore: 9,  n: 4, reward: 4900, ch: 6, text: 'Emberstone, to keep the poor-house warm all winter.' },
    { id: 10, title: 'Dragonglass Panes',     from: 'ansel',   ore: 10, n: 3, reward: 5200, ch: 7, text: 'New panes for the Spire\'s lamp-room.' },
    { id: 11, title: 'Star-iron',             from: 'pell',    ore: 11, n: 3, reward: 7200, ch: 7, text: 'Pell wants to "try something" with star-iron. Everyone is nervous.' },
];

export function availableContracts(G) {
    return CONTRACTS.filter((c) => c.ch <= G.story.ch && !G.story.contractsDone.includes(c.id));
}

export function canDeliver(G, id) {
    const c = CONTRACTS[id];
    return c && G.cargo[c.ore] >= c.n && !G.story.contractsDone.includes(id) && c.ch <= G.story.ch;
}

export function deliverContract(G, id) {
    if (!canDeliver(G, id)) return { ok: false };
    const c = CONTRACTS[id];
    G.cargo[c.ore] -= c.n;
    G.money += c.reward;
    G.stats.earned += c.reward;
    G.stats.contracts++;
    G.story.contractsDone.push(id);
    G.events.push({ type: 'contract', id, reward: c.reward });
    return { ok: true, reward: c.reward };
}

// ------------------------------------------------------------------
// The Codex
// ------------------------------------------------------------------
export const LORE = {
    stratum0: { cat: 'Strata', title: STRATA[0].name, text: STRATA[0].blurb + ' The Guild cut its first shaft here three hundred years ago, and the gnomes of Emberwick still swear the mushrooms whisper.' },
    stratum1: { cat: 'Strata', title: STRATA[1].name, text: STRATA[1].blurb + ' The dwarves of Kharadun built their outer watch-halls here, rows of four, to keep an eye on the surface folk. The surface folk never noticed.' },
    stratum2: { cat: 'Strata', title: STRATA[2].name, text: STRATA[2].blurb + ' Fae merchants once came here to trade moonlight for metal. They left when the crystals began to sing in a minor key.' },
    stratum3: { cat: 'Strata', title: STRATA[3].name, text: STRATA[3].blurb + ' King Durrak dug too greedily and broke into the Gloam. The city sank in a single night, and the last dwarves scattered the seven keys so no one could reach the Heart again.' },
    stratum4: { cat: 'Strata', title: STRATA[4].name, text: STRATA[4].blurb + ' Salamanders swim in the magma here, though no one has seen a live one in a hundred years.' },
    stratum5: { cat: 'Strata', title: STRATA[5].name, text: STRATA[5].blurb + ' The Gloam is not a place but a hunger, leaking up through the cracks the dwarves made. Light thins it. Nothing else does.' },
    stratum6: { cat: 'Strata', title: STRATA[6].name, text: 'The great chamber at the root of the world, where the Wyrmheart beats and its warden sleeps — or sleeps no longer.' },
    relic0: { cat: 'Relics', title: RELICS[0].name, text: 'A lens of fae crystal cut for a dwarf\'s eye. ' + RELICS[0].power },
    relic1: { cat: 'Relics', title: RELICS[1].name, text: 'A silver sigil from the fourth watch-hall, where the dwarves kept their falling-charms. ' + RELICS[1].power },
    relic2: { cat: 'Relics', title: RELICS[2].name, text: 'The master gear of King Durrak\'s great forge. ' + RELICS[2].power },
    relic3: { cat: 'Relics', title: RELICS[3].name, text: 'A satchel woven from a hole in the world. ' + RELICS[3].power },
    relic4: { cat: 'Relics', title: RELICS[4].name, text: 'Shed by the last salamander-queen of the Emberdeep. ' + RELICS[4].power },
    relic5: { cat: 'Relics', title: RELICS[5].name, text: 'The crystal heart of Kharadun\'s last king-forge, still beating. ' + RELICS[5].power },
    relic6: { cat: 'Relics', title: RELICS[6].name, text: 'Forged from a fallen star before the dwarves had names. ' + RELICS[6].power },
    pipe:     { cat: 'Finds', title: ARTIFACTS[0].name, text: 'Still smells faintly of mushroom-leaf. Sedge says gnomes lose six pipes a year and blame the soil.' },
    signet:   { cat: 'Finds', title: ARTIFACTS[2].name, text: 'A ring of the Hall-Wardens of Kharadun. Inside the band, in dwarf-runes: "Watch the sky. Fear the floor."' },
    musicbox: { cat: 'Finds', title: ARTIFACTS[4].name, text: 'Wind it and it plays a fae lullaby that makes everyone in the room briefly homesick for a place they have never been.' },
    crown:    { cat: 'Finds', title: ARTIFACTS[6].name, text: 'The crown of the king who dug too deep. Heavy, cold, and somehow embarrassed.' },
    ledger:   { cat: 'Finds', title: ARTIFACTS[7].name, text: 'A stone tablet of accounts. The last line reads: "Owed by King Durrak to the Gloam: everything."' },
    egg:      { cat: 'Finds', title: ARTIFACTS[9].name, text: 'Cold as a stone, and yet Mirabel swears she heard it tap. Sedge has put it in a very warm drawer.' },
    skull:    { cat: 'Finds', title: ARTIFACTS[11].name, text: 'The skull of a young wyrm, black with Gloam. Whatever the Gloam touches, it starves.' },
    page1: { cat: 'Journal', title: ARTIFACTS[1].name, text: SCENES.page1[0].text },
    page2: { cat: 'Journal', title: ARTIFACTS[3].name, text: SCENES.page2[0].text },
    page3: { cat: 'Journal', title: ARTIFACTS[5].name, text: SCENES.page3[0].text },
    page4: { cat: 'Journal', title: ARTIFACTS[8].name, text: SCENES.page4[0].text },
    page5: { cat: 'Journal', title: ARTIFACTS[10].name, text: SCENES.page5[0].text },
    page6: { cat: 'Journal', title: ARTIFACTS[12].name, text: SCENES.page6[0].text },
    corvin: { cat: 'People', title: 'Corvin Dask', text: 'Heir to Dask & Sons, owner of the Brass Baron, a steam-rig with twelve pistons and opinions. Braver than he is wise, which is saying something.' },
    maren:  { cat: 'People', title: 'Maren Ashdown', text: 'The finest delver the Guild ever knew. She bound her spirit into her automaton, Thimble, so that the knowledge of the seven keys would reach home. It did.' },
    ysmereth: { cat: 'People', title: 'Ysmereth, the Heartwarden', text: 'The oldest wyrm, who swallowed the Gloam nine hundred years ago to save the Wyrmheart, and was slowly eaten by it. Freed, at last, by two Ashdowns.' },
};

/** Sedge's word on each artifact when you sell it. */
export const APPRAISAL = {
    0: 'A gnome\'s pipe. Sixty crowns, because I am feeling generous and slightly nostalgic.',
    2: 'A Hall-Warden\'s signet! The museum in Greyhollow will want this.',
    4: 'A fae music box. Please don\'t wind it in here. Please.',
    6: 'The Crown of King Durrak. I need to sit down.',
    7: 'An accounts tablet. Dwarves. Even at the end of the world, they balanced the books.',
    9: 'A salamander egg. It is warm. Why is it warm?',
    11: 'A wyrmling skull. I shall put it somewhere I cannot see it.',
};

// ------------------------------------------------------------------
// Epilogue cards, after the ending
// ------------------------------------------------------------------
export const EPILOGUE = {
    common: [
        'That winter, for the first time in a hundred years, the frost-dark never came down from the north. The Lumen Spire burned so bright that the farmers of Sallowmere planted by its light.',
        'Corvin Dask rebuilt the Brass Baron with eleven pistons instead of twelve ("for humility") and opened a salvage yard. He still owes the Guild twelve hundred and fifty crowns.',
        'Brother Ansel wrote the whole story down in a very long book that nobody has finished. Pell Fennick built his telescope and pointed it at the Spire, just to look.',
    ],
    stay: [
        'Maren Ashdown, in her brass shell, took up her old seat at the Guild — and her old argument with Orla Brask, which resumed exactly where it had stopped twenty-nine years before.',
        'Every Sunday the two of them take tea on the Guild steps. Orla drinks hers. Maren holds hers, for the warmth.',
        'And {name} Ashdown and old Thimble kept delving, as delvers do — and always, always came home.',
    ],
    rest: [
        'Thimble never spoke again. But it hums, sometimes, when {name} sings in the forge, and its eye glows a little pinker when Orla visits.',
        'Orla hung Maren\'s old lantern at the top of the Spire, beside the crystal. It has never once gone out.',
        'And {name} Ashdown kept delving, as delvers do — and always, always came home.',
    ],
};
