// Echoheart Academy — every scene, in the line language that js/sim/vn.js compiles. Pure data.
//
// Day scenes: d<day>m (the morning, usually with class) and d<day>n (the night). Hangouts: talk_<friend>_<n>.
// Heart events: heart_<friend>_<n>. Quests: q_*. The climax: res_*, undercroft, finale, epilogue.

export const STORY = {};
const S = (name, src) => { STORY[name] = src; };

// ====================================================================== CHAPTER 1 · The Boy Who Echoes
S('d1m', `
chapter 1
bg gate
music title
> The floating island of Lumina rose out of the morning clouds, all white towers and blue roofs and waterfalls spilling into the sky.
> At the start of the sky bridge stood a boy with a battered suitcase, a silver tuning fork on a cord, and absolutely no idea what he was doing.
kai surprised: Whoa... it's real. It's actually real.
kai: Lumina Academy. One week ago I was fixing radios in my uncle's shop. Now I'm... a magic student?
> Kai had never cast a spell in his life. He couldn't light a candle or float a feather.
> But whenever someone near him used magic, he could hear it, a song only he seemed to notice. And sometimes, if he listened hard enough, he could sing it back.
show ren happy right
ren happy: Heyyy! New kid! You're blocking the bridge with that face! [v:hi]
kai surprised: Huh? Oh! Sorry!
ren normal: Relax, I'm kidding. Ren Takeda, second year, wind magic, fastest broom on the island. And you're...?
choice
- "Kai Amano. Nice to meet you!" | ren+3
- "Kai. Is everyone here this loud?" | ren+2 -> loud
ren happy: Kai! Then you're the transfer student with the weird magic everyone's whispering about. Cool. We're roommates.
goto bridge
label loud
ren happy: Ha! Only me. You'll get used to it. Wait, Kai? You're the transfer with the weird magic. We're roommates!
label bridge
kai: Weird magic? I... I don't even know if I have any. They just sent a letter.
ren normal: Pfft. Lumina doesn't send letters to people without magic. Come on, the Principal's doing the welcome speech!
hide ren
> As they crossed, something small and white tumbled out of the clouds and landed on Kai's suitcase.
show mochi mochi center
mochi: Kyuu! [v:happy]
kai surprised: A... a cloud? With ears?
> The little cloud fox sniffed his tuning fork, sneezed a sparkle, and climbed onto his shoulder like it had always lived there.
kai: Okay. Hi. I'm Kai. I guess you're... Mochi? You look like a Mochi.
mochi: Kyu kyu kyu! [v:chatter]
bg courtyard
music academy
show veymont kind center
veymont kind: Welcome, welcome, all of you! I am Sorrel Veymont, principal of this old academy, and this is the best day of my year. [v:welcome]
veymont: Every one of you carries a light inside you. Here, we help it shine. Oh, and do take a lemon candy on your way in.
do give:candy
veymont think: Ah... and you must be young Mr. Amano. The boy who echoes. Such a curious gift you have. [v:curious]
kai surprised: You know about that?
veymont kind: I make it my business to know my students, my boy. Come. Your entrance assessment awaits in the Great Hall.
bg hall
show graves stern center
graves stern: Professor Odile Graves. Spellcraft and Resonance. Place your hand on the Prism and listen. Pay attention, Mr. Amano. [v:attention]
> The great crystal orb on the stage began to sing, four clear notes rising and falling.
graves: Repeat the song. If you can.
mini echo 1
graves alarm: ...
> The Prism didn't glow one colour. It flashed red, then violet, then teal, then green, then silver, every colour at once, like it couldn't decide what he was.
graves stern: Interesting. Most students have one element. You appear to have none and all of them.
kai: Is that... bad?
graves soft: It is unusual. Unusual is not bad. Off you go. Explore. Meet people. Try not to explode anything.
hide graves
do quest:meet:1
> Your first afternoon at Lumina is free. Find the library, the alchemy lab and the dueling grounds and meet some classmates!
`);

S('meet_lys', `
bg library
music academy
> Books drifted between the shelves like lazy fish. Somewhere above, someone was humming.
> A book fell off a high shelf. Kai caught it without thinking.
show lys surprised center
lys surprised: Ah! I'm so sorry! It slipped, I didn't mean... are you all right?
kai: Totally fine! Nice catch, right? "Myths of the Hollow Moon"? Spooky.
lys normal: It's... just an old legend. I like old legends. I'm Lys. Lys Moonwell. I help Madam Quill with the library.
lys: You're the boy the Prism couldn't decide about. Everyone's talking about it.
choice
- "Great. My first day and I'm already gossip." | lys+2
- "What do YOU think it means?" | lys+4 -> think
lys happy: Don't worry. By Friday they'll be talking about whatever Pip blows up next.
goto out
label think
lys normal: Me? Um... Stars don't have one colour either. They look white, but they're every colour at once. Maybe you're like that.
kai: That's... really nice, actually. Thanks, Lys.
lys blush: I-it's just astronomy.
label out
lys normal: Oh! Star Catching class is in a few days. It's in the observatory... if you want, I can save you a seat.
do lys+2 flag:metLys
`);

S('meet_pip', `
bg lab
music academy
sfx water
> The lab door opened onto a cloud of pink smoke and a very pleased voice.
show pip surprised center
pip surprised: It worked! It worked! Oh... wait. It worked a little TOO much.
> A bubble the size of a pumpkin floated past Kai's head and popped into confetti.
pip happy: Hi! Hello! New face! I'm Pip Brightwater, water alchemy, part-time inventor, full-time menace. Hold this! [v:hi]
> She pressed a warm flask into his hands. It was purring.
kai surprised: Why is it purring?!
pip normal: It likes you! Most potions don't purr. You must have a good vibe.
choice
- "Can I help with the next experiment?" | pip+4
- "Should I... put it down very slowly?" | pip+2
pip happy: Ha! Come by any time. I always need an assistant who doesn't run away screaming.
do pip+2 flag:metPip
`);

S('meet_hana', `
bg arena
music academy
sfx fire
> A fireball the size of a melon whistled past Kai's nose and exploded on a practice dummy.
show hana normal center
hana normal: Bullseye! Oh. Hey. You walked right into my range. You okay?
kai surprised: I have eyebrows. I think I still have eyebrows.
hana happy: Ha! You're fine. Hana Kirishima. Fire. Best duelist in the second year. Well, almost the best.
hana normal: You're the Prism kid! Okay, I have to know. Can you copy MY fire? Try it!
> She made a flame dance on her palm. Kai listened. A bright, crackling song. He hummed it back...
sfx echo
> ...and a tiny, wobbly flame flickered over his own fingertips for one second before it puffed out.
hana normal: ...
hana angry: No WAY. That took me three years! You did it in three seconds?!
choice
- "It was a fluke, honest!" | hana+3
- "Want a rematch?" | hana+4
hana happy: Okay, okay. You're interesting. I'm keeping an eye on you, Echo Boy.
do hana+2 flag:metHana
`);

S('meet_done', `
> You've met everyone! The sun is setting over the island. Head back to the Dormitory when you're ready to turn in.
do quest:meet:2
`);

S('d1n', `
bg dorm
music tender
show ren happy right
ren happy: So? First day! Thoughts? Feelings? Fears? Did Graves give you the stare?
kai: She gave me the stare.
ren normal: Everyone gets the stare. Listen, Kai... whatever your magic is, it's not nothing. I watched the Prism. It loved you.
show mochi mochi left
mochi: Kyuu... [v:sad]
ren normal: Also your cloud is sad because you haven't fed it.
kai: I don't know what clouds eat!
ren happy: Marshmallows, obviously. Night, roomie.
hide all
> Kai lay awake for a while, listening to the island hum. Somewhere far below the floors, very faintly, something was humming back. Something hollow.
`);

// ====================================================================== day 2 · first class
S('d2m', `
bg classroom
music academy
show graves stern center
graves stern: Rune Strokes. A spell is a shape, and a shape is a sequence. Trace each rune before it fades. Begin.
mini runes 1
graves soft: Adequate. More than adequate, in places.
hide graves
show hana normal right
hana normal: Psst. Echo Boy. What'd you get? Bet I beat you.
choice
- "Let's compare after class." | hana+3
- "I wasn't keeping score." | hana+1
hana happy: Ha! Everyone keeps score. See you at the Dueling Grounds!
hide hana
> Your afternoon and evening are free. Spend time with friends, play their mini-games, look for Echo Charms, or visit the shop in the courtyard.
`);

S('d2n', `
bg courtyard-night
music mystery
> On the way back to the dorm, Kai passed the infirmary. A light was on. A boy with round glasses was arguing with the nurse.
show theo normal center
theo: I'm fine, really! I just keep... falling asleep in the strangest places. Last night I woke up by the old clocktower.
kai: Sleepwalking? That sounds rough.
theo: I'm Theo. Resonance class, back row. Hey, you're the echo kid! Maybe you can hear what's wrong with my magic? It feels... quiet lately.
> Kai listened. Theo's song was there, a warm brown hum like an old cello... but thin. Like someone had turned the volume down.
kai: It's... faint. But it's there!
theo: Phew. Okay. Probably just exams. Night, Kai!
hide theo
show mochi mochi center
mochi: Kyu... [v:sad]
`);

// ====================================================================== CHAPTER 2 · Moonfade
S('d3m', `
bg lab
music academy
show pip happy center
pip happy: Welcome to Potion Brewing! The professor's sick, so I'm in charge! Nobody panic!
pip normal: Add each ingredient as the needle crosses the glowing bit. Too early, fizzle. Too late, BOOM. Just right... magic!
mini potion 1 pip
pip happy: Kaboom! In a good way! Look, it's sparkling! [v:win]
hide pip
> As class let out, a hush spread through the halls. Students were gathering around the infirmary.
`);

S('d3n', `
chapter 2
bg infirmary
music mystery
show crowd center
> Theo was lying in one of the white beds, sleeping peacefully. Too peacefully.
hide all
nurse: He was found in the courtyard at dawn. He's not hurt. He just won't wake up. And his magic...
kai: I can't hear it. At all. His song is... gone.
nurse: We call it Moonfade. It happens once in a generation, the old books say. A student's light simply goes out.
show veymont think center
veymont think: Dreadful. Truly dreadful. Rest assured, children, I have my very best people looking into it.
veymont kind: Off to bed now, all of you. And take a lemon candy, sugar is good for shock.
hide veymont
> As the Principal swept out, Kai heard something. Just for a moment. Coming from the crystal on top of his cane.
> A warm, brown hum. Like an old cello.
kai surprised: ...Theo?
show mochi mochi center
mochi: Kyuuu! [v:sad]
> Kai shook his head. He was tired. He was imagining things. He had to be.
do quest:moonfade:1
`);

S('d4m', `
bg library
music academy
show lys normal center
lys normal: Star Catcher class is up in the dome. Catch the falling stars, but not the dark comets, they bite. Ready?
mini stars 1 lys
lys happy: You're a natural! The stars like you. I... I mean, obviously. Haha.
lys sad: Kai... I heard about Theo. Some of the older books talk about "Moonfade" and the Hollow Moon. I'll keep looking.
do quest:moonfade:2
`);

S('d4n', `
bg forest
music mystery
show ren serious right
ren serious: You saw it too, right? Lights in the Whispering Wood. Purple ones.
kai determined: Let's check it out. Quietly.
ren normal: Quietly is my middle name. Actually it's Hiroshi. But spiritually, quietly.
sfx hollow
> Between the trees, two floating flames turned toward them. They wore little white masks with round, open mouths.
ren serious: Okay. Those are definitely not fireflies.
> Battle! On your turn, pick Strike, a Skill, an Item or Defend. Kai's ECHO copies the last spell anyone cast, even an enemy's, and casts it back stronger!
do join:ren
battle tutorial
ren happy: Ha! Did you see that?! We make a great team, roomie! [v:win]
> Where the wisps had been, something glinted in the moss: a broken shard of a white porcelain mask, and an old library book.
do give:maskshard give:librarybook quest:moonfade:3 quest:book:1
kai: "Resonance and Its Echoes". Theo's name is on the card. Why would this be out here?
ren serious: Kai. I don't like this. Let's get back.
`);

S('d5m', `
bg skyfield
music academy
show ren happy center
ren happy: Flying class! My time to shine! Steer your broom through every ring. Don't fall off. Falling off is bad.
mini rings 1 ren
ren happy: Not bad, huh? Okay, you're officially my favourite flying buddy.
hide ren
show lys sad center
lys sad: Kai! I found something. There's a section of the library nobody's allowed in. The Restricted Archive.
lys normal: I have... um... access. Sort of. I know where Madam Quill keeps the key. Tomorrow, after class?
choice
- "Lys Moonwell, are you suggesting a heist?" | lys+4
- "Let's do it. For Theo." | lys+3
lys blush: It's NOT a heist. It's... unauthorised research.
do give:silverkey quest:moonfade:4
`);

S('d5n', `
bg dorm
music tender
show ren normal right
ren normal: Hey. You've been quiet. Thinking about Theo?
kai: Yeah. And the Principal's cane. I swear I heard Theo's magic in it.
ren serious: Veymont? The guy who gives everyone candy and remembers your birthday? No way.
ren normal: ...But if you say you heard it, I believe you. You hear stuff nobody else does. That's your thing.
choice
- "Thanks, Ren. That means a lot." | ren+4
- "You'd believe me about anything, huh?" | ren+3
ren happy: Pretty much. Except when you say you're not hungry. Night!
`);

// ====================================================================== CHAPTER 3 · Whispers in the Stacks
S('d6m', `
chapter 3
bg arena
music academy
show hana normal center
hana normal: Fireball Gallery! Blast the masked targets. Do NOT hit the Mochi plushies. I'm serious. They're adorable.
mini fireball 1 hana
hana happy: Hah! Not bad, Echo Boy. Not as good as me. But not bad. [v:win]
hide hana
bg archive
music mystery
show lys normal center
lys normal: The Restricted Archive. Okay. Okay okay okay. We're doing this.
> Dust, chains, and a single floating lantern. On the far wall, carved deep in the stone: an empty circle, ringed by open, singing mouths.
lys surprised: That's... the mark of the Hollow Choir. A cult from three hundred years ago. They stole students' magic to make their leader live forever.
lys sad: It says they gather the stolen light under a Hollow Moon. And the next Hollow Moon is...
kai: When?
lys sad: The night of the Starfall Festival. Six days from now.
sfx bell
> The suit of armor by the door turned its head. Violet light leaked from its joints.
lys surprised: Kai! The armor!
do join:lys
battle archive
lys happy: I... I did it! We did it! [v:win]
lys normal: I'm coming with you, Kai. Whatever this is. I'm not just going to read about it.
do lys+5 quest:moonfade:5 give:hollowshard
`);

S('d6n', `
bg courtyard-night
music mystery
> Crossing the courtyard late, Kai saw a figure in dark green slip out of the Principal's Tower, glance around, and vanish toward the Great Hall.
kai: Professor Graves...? What's she doing sneaking around at midnight?
show mochi mochi center
mochi: Kyu kyu! [v:chatter]
kai: You're right. We need to keep an eye on her.
do flag:suspectGraves
`);

S('d7m', `
bg hall
music academy
show graves stern center
graves stern: Resonance. Harder this time. The song is longer and it will not wait for you.
mini echo 2
graves soft: Hmph. Well done. [v:well]
graves stern: Mr. Amano. A word. Where were you last night?
kai surprised: Me? Asleep! Where were YOU?
graves stern: ...Go to lunch, Mr. Amano.
hide graves
`);

S('d7n', `
bg courtyard-night
music mystery
show hana sad center
hana sad: Kai! Have you seen Yuki? Ice girl, ponytail, laughs at everything? She went to the forest to practice and never came back!
kai determined: The Whispering Wood. Come on!
bg forest
> Footprints in the frost led between the trees. A snowflake ribbon was caught on a branch.
show hana angry center
hana angry: Masks. More of those creepy masks. Get away from her stuff!
do join:hana
battle yuki
hana happy: Let's burn bright! Ha, they ran! [v:start]
hana sad: But Yuki's not here. Just her ribbon. Kai, what's going on at this school?
kai: Someone's taking students. And their magic. And I think I know where it goes.
hana normal: Then we stop them. Together. Don't you dare give up on me, Kai. [v:cheer]
do hana+5 quest:moonfade:6
`);

S('d8m', `
bg classroom
music academy
show graves stern center
graves stern: Rune Strokes, level two. Faster runes, longer strokes. I expect no less than your best.
mini runes 2
graves soft: Good.
hide graves
> After class, a paper bird fluttered onto Kai's desk. It unfolded into a letter: "Tea in my study at sunset? I have lemon cakes. — S. Veymont"
`);

S('d8n', `
bg office
music mystery
show veymont kind center
veymont kind: Come in, come in! Sit. Cake? Candy? Both, I think. You look like you need both.
veymont think: Terrible business, these Moonfade cases. Theo... and now young Yuki. You've been asking questions, I hear.
choice
- "Someone's stealing magic, sir. I can hear it." | flag:toldVeymont
- "Just worried about my friends, sir."
veymont kind: Of course, of course. Such a good heart.
> Behind his desk stood a glass cabinet full of little violet crystals, lined up neatly. Each one hummed. Kai heard a warm brown cello. A tinkling, icy laugh. Dozens of others, faint and far away.
kai surprised: (Those songs... those are people.)
veymont sinister: Something the matter, my boy?
kai: N-no, sir! Great cake!
veymont kind: Mm. Magic is such a fragile thing. So often wasted on the young. Do be careful. [v:wasted]
hide veymont
> Kai walked very calmly out of the office. Then he ran.
do quest:moonfade:7 flag:sawCabinet
`);

// ====================================================================== CHAPTER 4 · Starfall Festival
S('d9m', `
chapter 4
bg lab
music academy
show pip normal center
pip normal: Potion Brewing, round two! I've upgraded the needle. It's faster now. You're welcome!
mini potion 2 pip
pip happy: Best. Day. Ever! [v:yay]
pip sad: Kai, can I tell you something? My Moonfade detector keeps going off. Near the Principal's Tower. Every single night.
kai: Pip... I think the Principal is the one taking them.
pip surprised: WHAT?! Veymont?! Candy Veymont?!
`);

S('d9n', `
bg courtyard-night
music mystery
> Kai went looking for Professor Graves. He found her, or rather, she found him, stepping out of the shadows by the fountain.
show graves stern center
graves stern: You've been following me, Mr. Amano. And I have been following HIM.
kai surprised: You... you know about Veymont?!
graves alarm: I suspected. For months. Students whose light simply "fades". Always the bright ones. Always near the Festival.
graves stern: Three hundred years ago the Hollow Choir's leader was never caught. A man who wanted to live forever on other people's light. I believe he never left. He just kept changing his name.
sfx hollow
> The stone gargoyles on the roof cracked open their eyes. Violet light.
graves alarm: Stand behind me, children! [v:behind]
show pip surprised right
pip surprised: Children? I'm here too! Experiment time! [v:start]
do join:pip
battle gargoyles
graves soft: ...You fight well. All of you. Very well.
graves stern: Listen to me. On the night of the Festival, the Hollow Moon rises. He will take more students, all at once, and drain them in the Undercroft beneath his tower. We must be ready.
do quest:moonfade:8
`);

S('d10m', `
bg library
music academy
show lys normal center
lys normal: Star Catcher, level two. More stars. More comets. I believe in you!
mini stars 2 lys
lys happy: Amazing! Kai... the festival is the day after tomorrow. Whatever happens... I'm glad you came to Lumina.
`);

S('d10n', `
bg dorm
music tender
show ren normal right
ren normal: Festival tomorrow. Big dance at the end. Everybody asks somebody.
ren happy: So? Who are YOU gonna ask? Huh? Huh?
kai surprised: I... haven't thought about it!
ren happy: Liar! Your ears are red!
hide ren
> Tomorrow is the Starfall Festival. At the end of the night there's a dance. Spend your free time with the friend you'd like to ask!
`);

S('d11m', `
bg festival
music academy
sfx cheer
show crowd center
> The Starfall Festival! Lanterns everywhere, food stalls, games, and the smell of roasted chestnuts.
hide all
> Every booth on campus is running a festival game today. Prizes for the best scores! Tonight, the dance.
do give:lantern
`);

S('d11n', `
bg festival
music tender
> The stars began to fall. Real ones, slow and golden, drifting over the courtyard like snow. The music started.
if hearts:hana>=3 -> canhana
label checklys
if hearts:lys>=3 -> canlys
label checkpip
if hearts:pip>=3 -> canpip
label checkren
if hearts:ren>=3 -> canren
goto ask
label canhana
do flag:danceHana
goto checklys
label canlys
do flag:danceLys
goto checkpip
label canpip
do flag:dancePip
goto checkren
label canren
do flag:danceRen
label ask
> Who will you ask to dance?
call dance_menu
sfx bell
music climax
> At the stroke of midnight, the great bell tolled. Once. Twice. Thirteen times.
> The moon turned violet. A dark ring opened around it like a hollow eye.
show hollow menace center
hollow menace: The Hollow Moon rises, and with it, my eternity! [v:moon]
cg reveal
> Atop the clocktower stood Principal Veymont, but his robes were black now, his silver hair floating, his spectacles glowing violet. Masked acolytes knelt all around him.
hollow menace: Thank you for a lovely festival, children. Your light will keep me young for another hundred years.
cg off
sfx hollow
> Violet ribbons of light lashed down into the crowd. Students cried out. And then {captive} was gone, pulled up into the dark.
do capture
kai determined: {captive}!!
show graves alarm center
graves alarm: Mr. Amano! He has taken five students to the Undercroft cages! When the moon reaches its peak, their magic will be drained forever!
graves stern: The cages are guarded across the island. Free every student before the moon rises. Hurry!
kai determined: Hang on, I'm coming! [v:coming]
climax
`);

S('dance_menu', `
choice
- Ask Hana | partner:hana hana+6 -> d_hana
- Ask Lys | partner:lys lys+6 -> d_lys
- Ask Pip | partner:pip pip+6 -> d_pip
- Ask Ren | partner:ren ren+6 -> d_ren
- Dance with Mochi | partner:mochi -> d_mochi
label d_hana
if !flag:danceHana -> shy
show hana blush center
hana blush: M-me? You're asking ME? ...Fine. But I'm leading.
> Hana did not lead. Hana stepped on your foot four times and laughed every time, and her hand was very warm.
end
label d_lys
if !flag:danceLys -> shy
show lys blush center
lys blush: I... I've never danced before. But I'd like to. With you.
> Under the falling stars, Lys counted the steps under her breath, and then forgot to, and it didn't matter.
end
label d_pip
if !flag:dancePip -> shy
show pip blush center
pip blush: A dance?! With me?! Okay, but I might accidentally invent a new dance. Is that okay?
> Pip invented three new dances. One of them involved bubbles. It was the best one.
end
label d_ren
if !flag:danceRen -> shy
show ren blush center
ren blush: Ha... you, uh, you serious? Okay. Okay! Don't let go, I'm doing a spin.
> Ren spun you so fast your feet left the ground, and caught you, grinning like the wind.
end
label shy
> They smile and shake their heads. "Maybe if we knew each other a little better." Mochi tugs your sleeve instead.
do partner:mochi
label d_mochi
show mochi mochi center
mochi: Kyuu! Kyu kyu! [v:chatter]
> You dance with a tiny cloud fox under the falling stars. Everybody agrees it is the cutest thing they've ever seen.
end
`);

// ====================================================================== CHAPTER 5 · The Hollow Moon
S('climax_intro', `
chapter 5
bg clocktower
music climax
> The Hollow Moon hangs over Lumina. Four cages, four places, one night.
> Free Theo at the Library, Yuki in the Whispering Wood, the first-years at the Sky Tower Field, and {captive} in the Great Hall. Then storm the Undercroft beneath the Principal's Tower.
> Every step you take, the moon climbs higher. Every fight costs precious time. Go!
`);

S('res_theo', `
bg library
music climax
> Theo floats asleep inside a cage of violet crystal, guarded by an armored sentinel and an acolyte.
battle resLibrary
sfx shatter
show theo normal center
theo: Kai? Kai! My magic, I can feel it again! Like waking up from the longest nap ever!
theo: Go! I'll get the others in here safe. Go!
`);

S('res_yuki', `
bg forest
music climax
> Frost glitters on a crystal cage between the trees. Inside, Yuki is curled up asleep. Wisps circle it like moths.
battle resForest
sfx shatter
show yuki normal center
yuki: Brrr! Okay, I'm awake, I'm awake! Did you just punch a cult? That's amazing! Go get him!
`);

S('res_firsties', `
bg skyfield
music climax
> Three tiny first-years huddle in a cage at the cliff's edge, guarded by two gargoyles.
battle resSky
sfx shatter
> The first-years tumble out, crying and cheering at once. One of them hugs your leg and won't let go for a full minute.
`);

S('res_best', `
bg hall
music climax
> In the middle of the Great Hall, where you took your first test, a cage hangs in the air. Inside, {captive} is asleep, glowing faintly.
battle resHall
sfx shatter
if captive:hana -> h
if captive:lys -> l
if captive:pip -> p
show ren serious center
ren serious: Kai...? You came. Of course you came. Nobody messes with my roommate! [v:angry]
ren happy: Now let's go kick a principal.
goto out
label h
show hana sad center
hana sad: Kai? ...You idiot. You came for me.
hana happy: Heh... thanks, partner. Now let's burn him down. [v:thanks]
goto out
label l
show lys sad center
lys sad: Kai... I was so scared. And then I heard you. Your song.
lys normal: I'm not afraid anymore. Let's finish this. [v:brave]
goto out
label p
show pip surprised center
pip surprised: Whoa, I'm out! Did I miss anything? Was there an explosion? There should be an explosion.
pip happy: Hold still, this'll sting a teeny bit. For HIM. [v:heal]
label out
do heal
`);

S('moonrise', `
sfx bell
music climax
> The bell tolls. The Hollow Moon reaches its peak. A great beam of violet light pours down into the Undercroft.
> You're out of time. The students still in their cages are being drained, and Veymont grows stronger by the second.
> There's only one thing left to do. Get to the Undercroft. Now.
`);

S('undercroft', `
bg undercroft
music climax
show hollow menace center
hollow menace: Ah. Mr. Amano. The boy who echoes. You've come to give me your light too? How thoughtful. [v:laugh]
kai determined: You've been stealing your students' magic for three hundred years. It ends tonight.
hollow menace: And what will you do? You have no magic of your own, boy. Nothing! A mirror. A copy. An echo!
kai determined: Yeah. I'm an echo. That means I don't fight alone.
show graves alarm right
graves alarm: Warding Glyph! The children are with you, Mr. Amano! All of them! [v:glyph]
battle boss
call finale
`);

S('finale', `
bg undercroft
music tender
hollow menace: Impossible! You echo them all? [v:impossible]
kai determined: Everyone... lend me your light! [v:finale]
> Kai listened. Every song in the cavern answered him: fire and starlight and water and wind, ice and the old warm cello, a hundred stolen voices finally singing again.
> He sang them all back at once.
sfx shatter
> The giant hollow crystal cracked from top to bottom. Light poured out of it, every colour at once, and streamed up through the hole in the roof like fireworks, back to every student it had been taken from.
hollow menace: No... my light... it's fading... [v:fade]
> The robes crumbled into dust. Where the Principal had stood, there was only a small, cracked cane, and a single lemon candy.
hide all
show graves soft center
graves soft: It's over. It's really over. ...Well done, Kai. Truly.
kai surprised: You called me Kai.
graves stern: Don't get used to it, Mr. Amano.
call epilogue
`);

S('epilogue', `
bg courtyard
music title
cg ending
> Dawn broke over Lumina. Every captured student woke up with their magic shining brighter than before. The Prism in the Great Hall sang all day.
> Professor Graves was named acting principal. Her first rule: no more lemon candy.
if late -> late
> Thanks to you, every cage was opened before the moon could take a single drop of light.
goto pick
label late
> It was a close call. But Kai's echo carried every stolen song home. Nobody's light was lost.
label pick
cg off
if best:hana -> hana
if best:lys -> lys
if best:pip -> pip
goto ren
label hana
show hana happy center
if romance:hana -> hanar
hana happy: Rematch at noon, partner. Best friends don't go easy on each other!
goto done
label hanar
hana blush: So, um. About the rooftop. And the dance. I meant it. All of it. You're kind of my favourite person, Echo Boy.
goto done
label lys
show lys happy center
if romance:lys -> lysr
lys happy: I'm writing a book about all this. You're in every chapter. That's what best friends are for.
goto done
label lysr
lys blush: The stars came back tonight. I counted them all. But I think... my favourite light is you.
goto done
label pip
show pip happy center
if romance:pip -> pipr
pip happy: Lab partners forever? Lab partners forever! I'm making us matching goggles!
goto done
label pipr
pip blush: I made a potion that tells you who your heart likes. It turned your colour, Kai. I didn't even need to drink it.
goto done
label ren
show ren happy center
if romance:ren -> renr
ren happy: Roommates, best friends, cult-busters. Same time next year? Kidding. Mostly.
goto done
label renr
ren blush: Hey. When you came for me tonight... yeah. Let's fly somewhere. Just us. The long way round.
label done
hide all
show mochi mochi center
mochi: Kyuu! [v:happy]
> And somewhere in the sky above Lumina, an echo kept singing.
ending
`);

// ====================================================================== hangouts (one per visit, in order, repeating the last)
S('talk_hana_1', `
bg arena
show hana normal center
hana normal: Echo Boy! Here to train? Or here to watch the master at work?
choice
- "Teach me something!" | hana+3
- "Here to watch the master, obviously." | hana+2
hana happy: Ha! Okay. Stance wide, breathe from your belly, and imagine the target insulted your mom. Boom.
`);
S('talk_hana_2', `
bg arena
show hana normal center
hana normal: You know what I love about fire? It doesn't wait for permission.
hana sad: My family's all healers. Gentle magic. They didn't know what to do with a kid who set the curtains on fire. Twice.
choice
- "Your fire's amazing. They'll see it." | hana+4
- "Only twice?" | hana+2
hana blush: ...Thanks. Don't tell anyone I got sappy.
`);
S('talk_hana_3', `
bg arena
show hana happy center
hana happy: Spicy chestnut eating contest. You and me. Loser carries the winner's books for a week.
choice
- "You're on!" | hana+3
- "I value my tongue too much." | hana+1
hana happy: Ha! Next time, then. I'm keeping a list.
`);
S('talk_hana_4', `
bg arena
show hana normal center
hana normal: When Yuki went missing... I was scared. I'm never scared. It's weird.
choice
- "Being scared just means you care." | hana+4
- "We'll find everyone. I promise." | hana+3
hana normal: ...Yeah. Okay. With you around, I think we might.
`);
S('talk_hana_5', `
bg arena
show hana blush center
hana blush: You keep showing up here. People are gonna think we're... friends or something.
hana happy: ...Good. Let 'em think.
do hana+2
`);

S('talk_lys_1', `
bg library
show lys normal center
lys normal: Oh! Kai! I was just reshelving the astronomy section. Did you know some stars we see are already gone? Their light is still travelling.
choice
- "That's beautiful. And a little sad." | lys+4
- "So we're looking at ghosts?" | lys+2
lys happy: Exactly! Beautiful and sad. Like most of the best things.
`);
S('talk_lys_2', `
bg library
show lys normal center
lys normal: I used to read in the back corner so nobody would notice me. Now people keep noticing me. Because of you.
choice
- "They should've noticed you ages ago." | lys+4
- "Sorry! Want me to make a distraction?" | lys+2
lys blush: You're... very kind. Please stop. I mean, don't stop. I mean...
`);
S('talk_lys_3', `
bg library
show lys happy center
lys happy: I made you a reading list! Forty-two books. Too many? It's too many. I'll cut it to forty.
choice
- "I'll read every single one." | lys+4
- "Can you read me the good bits?" | lys+3
lys happy: Deal!
`);
S('talk_lys_4', `
bg library
show lys sad center
lys sad: I keep thinking: what if it was me in that bed instead of Theo? Would anyone even...
choice
- "I would. I'd tear the island apart." | lys+5
- "Everyone would notice, Lys." | lys+3
lys normal: ...Okay. Okay. Thank you.
`);
S('talk_lys_5', `
bg library
show lys blush center
lys blush: I saved you the window seat. The good one. I always will.
do lys+2
`);

S('talk_pip_1', `
bg lab
show pip happy center
pip happy: Kai! Perfect! Try this! It's a potion that makes you taste colours!
choice
- "Gulp. ...I can taste BLUE." | pip+4
- "Maybe after lunch?" | pip+2
pip happy: Science!!
`);
S('talk_pip_2', `
bg lab
show pip normal center
pip normal: Everyone thinks alchemy's just mixing stuff. It's not. It's listening to what things want to become.
pip happy: Kinda like your magic, actually!
choice
- "Huh. I never thought of it like that." | pip+4
- "So what does this jar want to become?" | pip+3
pip happy: Mostly it wants to become soup. Everything wants to become soup eventually.
`);
S('talk_pip_3', `
bg lab
show pip surprised center
sfx water
pip surprised: DUCK!
> A bubble the size of a car floated over your head and popped into a gentle drizzle of glitter.
choice
- Laugh until you can't breathe | pip+4
- Help her mop up | pip+3
pip happy: You're the best assistant I've ever had. You're the ONLY assistant I've ever had, but still.
`);
S('talk_pip_4', `
bg lab
show pip sad center
pip sad: I'm building a detector for Moonfade. If I'd built it sooner, maybe Theo...
choice
- "This isn't your fault, Pip." | pip+5
- "Then let's finish it together." | pip+4
pip normal: ...Okay. Hand me the tiny screwdriver. No, the tinier one.
`);
S('talk_pip_5', `
bg lab
show pip blush center
pip blush: I named my newest potion after you. It's called "Kai". It glows when someone nice is nearby. It's glowing right now.
do pip+2
`);

S('talk_ren_1', `
bg skyfield
show ren happy center
ren happy: Roomie! Wanna see me do a loop-the-loop with no hands?
choice
- "Please don't." | ren+2
- "Do two!" | ren+4
ren happy: Ha! That's the spirit!
`);
S('talk_ren_2', `
bg skyfield
show ren normal center
ren normal: Know why I love flying? Up there nobody expects anything from you. It's just you and the wind.
choice
- "Is it hard, people expecting stuff?" | ren+4
- "Take me up sometime?" | ren+3
ren serious: ...Yeah. Sometimes. My older brothers are all perfect. I'm the funny one. It's... a lot.
`);
S('talk_ren_3', `
bg skyfield
show ren happy center
ren happy: Okay, prank planning. Graves's office. Rubber ducks. Four hundred of them.
choice
- "I'm in." | ren+4
- "She will END us." | ren+2
ren happy: Worth it!
`);
S('talk_ren_4', `
bg skyfield
show ren serious center
ren serious: Hey. Whatever happens with this Hollow Choir stuff... I've got your back. You know that, right?
choice
- "I know. And I've got yours." | ren+5
- "Even if I'm wrong about Veymont?" | ren+3
ren normal: Always. Easy, buddy. I'm right here. [v:support]
`);
S('talk_ren_5', `
bg skyfield
show ren blush center
ren blush: Funny. I used to fly alone all the time. Now it feels weird without you on the back of the broom.
do ren+2
`);

// ====================================================================== heart events
S('heart_hana_1', `
bg arena
music tender
show hana normal center
hana normal: Hey. Stay a bit after everyone leaves? I want to show you something.
> When the grounds were empty, Hana held out her hands. A flame bloomed there, not wild, but gentle, shaped like a flower.
hana blush: My grandma taught me this before she passed. Fire doesn't just burn. It keeps you warm too. I've never shown anyone.
choice
- Echo it back softly | hana+6
- "It's beautiful, Hana." | hana+5
hana blush: ...Yeah. It is when you're here.
do hana+3
`);
S('heart_hana_2', `
bg arena
music tender
show hana angry center
hana angry: Duel me. For real this time. No holding back.
> You traded spells until the sun went down. In the end, you were both lying flat on the arena floor, laughing.
hana happy: Okay. Okay. It's a draw. I'll allow a draw. Just this once.
hana blush: You're the first person who ever made me want to lose a fight just to see you smile. That's really stupid, right?
choice
- "It's not stupid at all." | hana+6
- "I would've let you win too." | hana+5
do hana+3
`);
S('heart_hana_3', `
bg arena
music tender
cg hana
> On the dueling-grounds roof at sunset, Hana shared a bag of spicy chestnuts and held a little flame between your hands to keep them warm.
hana blush: Hey, Kai. I've been thinking. About us. About what you are to me.
hana blush: You're my rival. My partner. My best friend. And maybe... more? If you want. No pressure! Okay, a little pressure.
choice
- "I want more, Hana." | romance:hana hana+10
- "You're my best friend. I hope that's okay." | friend:hana hana+8
cg off
if romance:hana -> r
show hana happy center
hana happy: Best friends, then. The best. Don't you ever forget it, Echo Boy.
end
label r
show hana blush center
hana blush: ...Okay. Okay! Cool. Great. I'm not blushing. Shut up. You're blushing.
`);

S('heart_lys_1', `
bg library
music tender
show lys normal center
lys normal: Could you help me? There's a book on the top shelf. The very top. I'm... scared of the ladder.
> You held the ladder. She climbed, one shaky rung at a time, and came down with an old star atlas and a triumphant grin.
lys happy: I did it! I've wanted that book for two years! I just never had anyone to hold the ladder.
choice
- "I'll always hold the ladder." | lys+6
- "You did it yourself, Lys." | lys+5
do lys+3
`);
S('heart_lys_2', `
bg library
music tender
show lys sad center
lys sad: Can I tell you a secret? My magic is weak. Really weak. I can only call stars when I feel... safe.
lys blush: Lately I can call a lot of them. When you're around.
choice
- "Then I'll stay around." | lys+6
- "Your magic isn't weak. You're just gentle." | lys+5
do lys+3
`);
S('heart_lys_3', `
bg library
music tender
cg lys
> In the glass observatory above the library, Lys spread a blanket under the stars and drew constellations with her fingertips. A bird. A fox. A boy with a tuning fork.
lys blush: That one's you. I made it. I hope that's not weird.
lys blush: Kai... I've read a thousand love stories. I always thought they were just stories. And then you caught a falling book.
choice
- "Maybe this is our story, Lys." | romance:lys lys+10
- "You're my dearest friend. Always." | friend:lys lys+8
cg off
if romance:lys -> r
show lys happy center
lys happy: Always. That's a long time. I'll hold you to it.
end
label r
show lys blush center
lys blush: Our story. ...I like the sound of that. Chapter one.
`);

S('heart_pip_1', `
bg lab
music tender
show pip normal center
pip normal: Okay, I need a test subject for something important. Close your eyes.
> Something clicked onto your wrist: a little brass band with a glass bead that glowed silver.
pip happy: It's a resonance bracelet! It hums when you're near magic. Now you can see the songs, not just hear them!
choice
- "Pip, this is incredible." | pip+6
- "You made this for me?" | pip+5
pip blush: I made it for my favourite person. Shh. Science secret.
do pip+3
`);
S('heart_pip_2', `
bg lab
music tender
show pip sad center
pip sad: My big inventions never work. My parents keep asking when I'll get a "real" job. Sometimes I wonder if I should stop.
choice
- "Never stop. The world needs your weird." | pip+6
- "Your detector is going to save people, Pip." | pip+5
pip happy: ...Okay. Okay! Then I'm going to build the weirdest, most wonderful thing ever. And you're going to help.
do pip+3
`);
S('heart_pip_3', `
bg lab
music tender
cg pip
> The potion exploded. Of course it did. The whole lab filled with glittering pink and teal bubbles, and the two of you laughed until you couldn't stand.
pip blush: Kai... every time something blows up, you laugh instead of running. Do you know how rare that is?
pip blush: I think I've been doing my best experiments just to make you laugh. So... um. What are we? Hypothetically. For science.
choice
- "Hypothetically... I really like you, Pip." | romance:pip pip+10
- "Best lab partners in the universe." | friend:pip pip+8
cg off
if romance:pip -> r
show pip happy center
pip happy: Best lab partners in the universe! I'm making a certificate! With glitter!
end
label r
show pip blush center
pip blush: Hypothesis confirmed. Oh no. I'm going to explode. In a good way!
`);

S('heart_ren_1', `
bg skyfield
music tender
show ren normal center
ren normal: Hop on. Back of the broom. I'm taking you somewhere.
> He flew you to a tiny floating islet with a single tree. The whole academy glittered below.
ren normal: My spot. Nobody knows about it. Well. Now you do.
choice
- "Thanks for trusting me with it." | ren+6
- "It's perfect, Ren." | ren+5
do ren+3
`);
S('heart_ren_2', `
bg skyfield
music tender
show ren serious center
ren serious: I don't have to be the funny guy with you. Do you know how weird that is? Good weird.
choice
- "You never have to pretend with me." | ren+6
- "You ARE funny though. Just also more." | ren+5
ren happy: ...Yeah. Okay. Thanks, Kai. Seriously.
do ren+3
`);
S('heart_ren_3', `
bg skyfield
music tender
cg ren
> At sunrise, high above the clouds, Ren flew the two of you through every golden ring on the course, whooping into the wind.
ren blush: Hey, Kai. I gotta say something before I chicken out.
ren blush: You're my best friend. But sometimes I look at you and it feels like... more than that? Is that okay?
choice
- "It's more than okay. Me too." | romance:ren ren+10
- "Best friends. The best there's ever been." | friend:ren ren+8
cg off
if romance:ren -> r
show ren happy center
ren happy: The best there's ever been. Ha! Yeah. I like that.
end
label r
show ren blush center
ren blush: ...Cool. Cool cool cool. Don't let go, okay? We're landing. Badly.
`);

// ====================================================================== quests
S('q_book_done', `
bg library
show lys surprised center
lys surprised: Theo's book! You found it in the forest? He must have been reading about resonance when... oh.
lys normal: I'll keep it safe for him. For when he wakes up. Thank you, Kai. Here, Madam Quill would want you to have this.
do take:librarybook give:starchart lys+4 lumens:+30 quest:book:2
`);
S('q_petals_start', `
bg lab
show pip normal center
pip normal: Ooh, Kai! Have you seen moonpetals? They grow around the island and glow at night. If I had five, I could brew a Phoenix Feather!
do quest:petals:1
`);
S('q_petals_done', `
bg lab
show pip happy center
pip happy: Five moonpetals! You're amazing! Stand back! Further! FURTHER!
sfx water
pip happy: Ta-daa! Two Phoenix Feathers! One for you, one for... also you!
do take:moonpetal:5 give:phoenix:2 pip+5 quest:petals:2
`);
S('q_treats_start', `
show mochi mochi center
mochi: Kyu... kyu kyu. [v:sad]
> Mochi looks hungry. Ren said cloud foxes eat marshmallows. There might be some Cloud Marshmallows hidden around campus.
do quest:treats:1
`);
S('q_treats_done', `
show mochi mochi center
mochi: KYUUU! [v:happy]
> Mochi gobbles all three marshmallows and glows like a little moon. From now on, Mochi sniffs out Echo Charms: watch where it points!
do take:mochitreat:3 quest:treats:2 flag:mochiSniff
`);
S('q_charms_done', `
show mochi mochi center
> All twelve Echo Charms ring together in your pocket, one long chord. Your tuning fork glows.
kai determined: Every song I've heard here... I can hear them all at once now.
> Kai's Echo now costs no MP!
do quest:charms:2 flag:grandEcho
`);
