// The story. Pure data. Each scene is a full-screen anime cutscene (art) or, with no art, a radio exchange shown
// over play with portraits. Every line has a voice id (`vo`), filled in below from the scene id and line number:
// the audio pipeline (dev/audio/) voices each character's lines in that order.
//
// who: a pilot id (sora, kaito, lyra), a CAST id (mei, seraphine, voss, hikari, system), or 'pilot' (the pilot
// you are flying; resolved by storyFor()).

const S = {};
const scene = (id, art, lines) => { S[id] = { id, art, lines: lines.map(([who, text], i) => ({ who, text, vo: `${id}-${i}` })) }; };

// ---------------------------------------------------------------- shared opening
scene('opening', 'cs-opening', [
    ['mei', 'Six days ago, the Requiem came out of the Veil Nebula, singing.'],
    ['mei', 'Every star it sings to goes dark. At Saturn, it met the Aegis fleet. The fleet is gone.'],
    ['mei', 'The Lumen Ark has three prototype Seraphs left. Three pilots. That is all humanity has.'],
]);
scene('launch', 'cs-launch', [
    ['mei', 'Seraph, you are clear for launch. Bring back the morning.'],
    ['pilot', '@launch'],
]);

// ---------------------------------------------------------------- pilot introductions
scene('sora-intro', 'cs-sora-1', [
    ['sora', "Hikari... you flew into that nebula first. Everyone says you're gone."],
    ['sora', "But I can hear you. Inside that song. I know it's you."],
    ['sora', "Wait for me, big sister. I'm coming to bring you home."],
]);
scene('kaito-intro', 'cs-kaito-1', [
    ['kaito', 'Saturn. I gave the order to fall back, and eleven thousand people did not hear it in time.'],
    ['kaito', 'Voss said retreat. Voss said hold the line. Then Voss went over to them.'],
    ['kaito', "I can't bring them back. But I can carry their names all the way to the end."],
]);
scene('lyra-intro', 'cs-lyra-1', [
    ['lyra', 'Unit seven of seven. Grown from the tissue of a Requiem drone. The other six did not wake up.'],
    ['lyra', 'When I sleep, the choir sings to me. It calls me daughter.'],
    ['lyra', 'I do not know what I am. So I will fly, and find out.'],
]);

// ---------------------------------------------------------------- launch lines, by pilot
const LAUNCH = {
    sora: 'Sora Amane, Azure Seraph. Kirin, launching!',
    kaito: 'Kaito Ren, Crimson Halberd. Garuda. Going out.',
    lyra: 'Lyra-07. Violet Wraith. Nue... launching. I think I am afraid.',
};

// ---------------------------------------------------------------- stage radio (shared, at each stage start)
scene('stage1', null, [['mei', "Saturn's rings, dead ahead. Watch the debris. The dreadnought that did this is still out there."]]);
scene('stage2', null, [['mei', "You're entering the Veil. Something enormous is moving in the crystals. Stay sharp."]]);
scene('stage3', null, [['mei', "That's the mothership. It's too big to go around. You'll have to fly through it. Hit the engines!"]]);
scene('stage4', null, [['mei', "The Iron Halo. They're building war-frames here. And I'm reading an Aegis command code."]]);
scene('stage5', null, [['mei', 'Bio-signs everywhere. Those are not asteroids. Those are bones.']]);
scene('stage6', null, [['mei', "This is it. The Requiem Heart. Whatever happens in there... I'm proud of you."]]);

// ---------------------------------------------------------------- boss warnings (shared, the computer)
scene('warn', null, [['system', 'Warning. A huge enemy is approaching fast.']]);

// ---------------------------------------------------------------- boss exchanges, by pilot
scene('boss1-sora', null, [['sora', "That's the ship that broke the fleet! I'll break it right back!"]]);
scene('boss1-kaito', null, [['kaito', 'Bellwether. I watched you burn the Resolute. Your turn.']]);
scene('boss1-lyra', null, [['lyra', 'It is singing the same song as me. I will make it stop.']]);

scene('boss2-sora', null, [['sora', 'A dragon made of glass? Hikari, did you see this too?']]);
scene('boss2-kaito', null, [['kaito', "Big. Beautiful. Still in my way."]]);
scene('boss2-lyra', null, [['lyra', 'It is a lens. It focuses the song. Breaking it.']]);

scene('boss3-sora', null, [['seraphine', 'Little bird, you fly so far for a voice that no longer remembers you.'], ['sora', "Then I'll remind her!"]]);
scene('boss3-kaito', null, [['seraphine', 'Commander. How many names do you carry? Set them down. Rest.'], ['kaito', 'Not until the last one.']]);
scene('boss3-lyra', null, [['seraphine', 'There you are, my daughter. Come home. The choir has a place for you.'], ['lyra', 'I have not decided where home is.']]);

scene('boss4-sora', null, [['voss', 'The Amane girl. Your sister sang so beautifully when they took her.'], ['sora', 'You... you knew? You let them?!']]);
scene('boss4-kaito', null, [['voss', 'Ren. Still flying for the dead? They gave me forever, boy.'], ['kaito', 'You were my admiral. Now you are just the last name on my list.']]);
scene('boss4-lyra', null, [['voss', 'The failed seventh. They should have melted you down with the others.'], ['lyra', 'You chose to become a machine. I am choosing the opposite.']]);

scene('boss5-sora', null, [['sora', "It's guarding the way to the Heart. Move!"]]);
scene('boss5-kaito', null, [['kaito', 'Every eye on me. Good. Look at me, then.']]);
scene('boss5-lyra', null, [['lyra', 'Mother of Eyes. You are not my mother either.']]);

scene('boss6-sora', null, [['seraphine', 'Hear her, little bird. Your sister is my song now.'], ['sora', 'Hikari! Sing with me instead!']]);
scene('boss6-kaito', null, [['seraphine', 'Every star ends, Commander. I only sing the last verse.'], ['kaito', 'Then I will write one more.']]);
scene('boss6-lyra', null, [['seraphine', 'Daughter. You were made from me. You cannot unmake yourself.'], ['lyra', 'Watch me.']]);

// ---------------------------------------------------------------- mid-story cutscenes
scene('cathedral', 'cs-cathedral', [
    ['mei', 'The mothership is opening. Seraph, it is a thousand kilometres long. There is no way around.'],
    ['pilot', '@cathedral'],
]);
const CATHEDRAL = {
    sora: "Then I'll go through it. Hikari went through worse.",
    kaito: 'Understood. Going in through the front door.',
    lyra: 'It feels like the inside of my dreams. I know the way.',
};
scene('kaito-voss', 'cs-kaito-2', [
    ['voss', 'You could have had eternity, Ren...'],
    ['kaito', 'Eleven thousand and one, Admiral. I will carry yours too.'],
]);
scene('heart', 'cs-heart', [
    ['mei', 'The star is dying from the inside. The Heart is at its core. All signals are breaking up.'],
    ['seraphine', 'Come, Seraph. Come and hear the end of everything.'],
]);
scene('sora-hikari', 'cs-sora-2', [
    ['hikari', '...Sora? You got so tall. You should not have come here.'],
    ['sora', "I promised I'd bring you home! Fight it, Hikari!"],
    ['hikari', 'I am trying. Break the Heart, and I can stop singing. Please.'],
]);
scene('lyra-daughter', 'cs-lyra-2', [
    ['seraphine', 'Seventh daughter. I gave you your eyes. Your voice. Your wings.'],
    ['lyra', 'You gave me a body. Everything else, I chose.'],
]);

// ---------------------------------------------------------------- endings
scene('sora-end', 'cs-sora-end', [
    ['hikari', 'The song has stopped. Sora... I can hear the stars again.'],
    ['sora', "Let's go home, big sister. I've got so much to tell you."],
    ['mei', 'Lumen Ark to Seraph. Two signals on my screen. Welcome home, both of you.'],
]);
scene('kaito-end', 'cs-kaito-end', [
    ['kaito', 'It is over. The sun is coming back up over Saturn.'],
    ['mei', 'Kaito. The names. We will build them a wall where everyone can read them.'],
    ['kaito', 'Make room for one more. Mine can wait a long, long time.'],
]);
scene('lyra-end', 'cs-lyra-end', [
    ['lyra', 'The choir is quiet. For the first time, I can hear my own thoughts.'],
    ['mei', "Lyra, report. Are you... alright?"],
    ['lyra', 'I am Lyra. Not seven. Not daughter. Just Lyra. And I would like to see a sunrise.'],
]);

// ---------------------------------------------------------------- game over / survival
scene('gameover', null, [['mei', "Seraph, you're down! Eject, eject!"]]);
scene('endless', null, [['system', 'Survival protocol engaged. The choir does not end. Neither do you.']]);

export const SCENES = S;
export const PILOT_LINES = { launch: LAUNCH, cathedral: CATHEDRAL };

/** A scene with 'pilot' lines resolved for the given pilot (`@key` text looks up PILOT_LINES). */
export function storyFor(id, pilot) {
    const s = S[id];
    if (!s) return null;
    return {
        ...s,
        lines: s.lines.map((l) => {
            if (l.who !== 'pilot') return l;
            const key = l.text.slice(1);
            return { who: pilot, text: PILOT_LINES[key][pilot], vo: `${s.id}-${key}-${pilot}` };
        }),
    };
}

/** The scenes a story-mode run plays, keyed by hook. */
export function storyPlan(pilot) {
    return {
        intro: ['opening', `${pilot}-intro`, 'launch'],
        afterStage: {
            2: ['cathedral'],
            4: pilot === 'kaito' ? ['kaito-voss'] : [],
            5: ['heart', ...(pilot === 'sora' ? ['sora-hikari'] : pilot === 'lyra' ? ['lyra-daughter'] : [])],
        },
        bossTalk: (n) => `boss${n}-${pilot}`,
        ending: [`${pilot}-end`],
    };
}

/** Every voiced line in the game, resolved for every pilot, for the audio pipeline and the tests. */
export function allLines() {
    const out = new Map();
    for (const p of ['sora', 'kaito', 'lyra']) {
        for (const id of Object.keys(S)) for (const l of storyFor(id, p).lines) out.set(l.vo, l);
    }
    return [...out.values()];
}
