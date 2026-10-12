// The story, told in scenes between stages. Each scene is staged in 3D by
// view/cinema.js: `left` and `right` name the characters on stage, `bg` picks
// the stage sky behind them. A line from 'narrator' has no speaker portrait.

export const CAST = {
    cael: { name: 'Cael', title: 'the ember-born angel', color: '#ffe9b0' },
    vesper: { name: 'Vesper', title: 'the chained star', color: '#c9b6ff' },
    malphas: { name: 'Malphas', title: 'Lord of the Pit', color: '#ff6a4a' },
    ferryman: { name: 'The Ferryman', title: 'of the Styx', color: '#8fe8d8' },
    sammael: { name: 'Sammael', title: 'the Frost-Crowned', color: '#a8dcff' },
    gorrmaw: { name: 'Gorrmaw', title: 'Warden of the Cradle', color: '#ff9a3a' },
    narrator: { name: '', title: '', color: '#e8dcc8' },
};

export const SCENES = {
    prologue: {
        bg: 0, left: 'cael', right: 'vesper', vesperChained: true,
        title: 'Prologue — The Fallen Star',
        lines: [
            ['narrator', 'When the war in Heaven ended, the last star of the morning fell burning into the Pit.'],
            ['narrator', 'It struck the Ninth Circle, in the Cradle of Cinders, and went out.'],
            ['narrator', 'But something in the ashes was still warm.'],
            ['cael', '...Where am I? It is so hot. Everything is red.'],
            ['vesper', "Shh. Don't be afraid, little light. You are in the Pit. You were born here, a moment ago."],
            ['cael', 'Who are you? Why are you in chains?'],
            ['vesper', 'My name is Vesper. The chains are an old story. Yours is a new one, and it will be very short if you stay.'],
            ['vesper', 'Hear them? The demons can smell your light. They will tear you apart for it.'],
            ['cael', 'What do I do?'],
            ['vesper', 'You fly. You have wings, child. White ones. Nothing in this place has ever had white wings.'],
            ['vesper', 'Fly up, through every circle and every gate. Above the last gate is the sky, and above the sky... home.'],
            ['cael', 'Will you come with me?'],
            ['vesper', 'I will be with you. My voice can go where my chains cannot. Now go!'],
        ],
    },
    after0: {
        bg: 0, left: 'cael', right: 'vesper', vesperChained: true,
        title: 'Interlude — A Halo That Sings',
        lines: [
            ['cael', "It's gone. I did it!"],
            ['vesper', 'You did. The Warden kept every soul in the Ninth Circle for ten thousand years, and you broke him on your first day.'],
            ['cael', 'The halo I found sings when I hold it.'],
            ['vesper', 'Halos remember. That one belonged to an angel who fell long ago. Now it has chosen you.'],
            ['vesper', 'The Eighth Circle is above us: the Bone Orchard. Be careful, Cael. Up there, something is listening.'],
        ],
    },
    after1: {
        bg: 1, left: 'cael', right: 'malphas',
        title: 'Interlude — The Lord of the House',
        lines: [
            ['malphas', 'Little spark.'],
            ['cael', "Who's there?"],
            ['malphas', 'The one whose house you are flying through. Malphas. Lord of all of this.'],
            ['malphas', 'Do you know why my servants hunt you? Your light. It is the light of a morning star. With it I could open the Gate of Dawn from below.'],
            ['malphas', 'Come to me willingly, and I will let the chained one rest.'],
            ['vesper', "Don't listen to him, Cael! Fly!"],
            ['cael', "She told me to fly. So I'll fly. Right through you."],
        ],
    },
    after2: {
        bg: 2, left: 'cael', right: 'vesper', vesperChained: true,
        title: 'Interlude — The Evening Star',
        lines: [
            ['cael', 'Those chains were made from halos. All of those angels...'],
            ['vesper', 'Every one of them fell, and every one of them was broken here. I am sorry you had to see it.'],
            ['cael', 'Vesper, were you an angel too?'],
            ['vesper', 'Once, a long time ago. I was the star that comes out in the evening. I fell.'],
            ['cael', 'Why?'],
            ['vesper', 'Ask me again when you are higher. The river is ahead. Keep your wings dry.'],
        ],
    },
    after3: {
        bg: 3, left: 'cael', right: 'ferryman',
        title: 'Interlude — The Last Coin',
        lines: [
            ['ferryman', 'Ahh... the boat sinks. No matter. I have rowed long enough.'],
            ['ferryman', 'Hear me, little light. I ferried a star down this river once. She was falling with something in her arms.'],
            ['cael', 'A star?'],
            ['ferryman', 'She asked me to carry it to the Cradle, where nothing would think to look. She paid with her last coin: her own light.'],
            ['ferryman', 'That something was you.'],
            ['vesper', '...Cael. Keep going. Please.'],
        ],
    },
    after4: {
        bg: 4, left: 'cael', right: 'vesper', vesperChained: true,
        title: 'Interlude — What a Star Carries',
        lines: [
            ['cael', 'Vesper. The Ferryman said a star carried me down here.'],
            ['vesper', 'He talks too much, for a dead man.'],
            ['cael', 'Was it you?'],
            ['vesper', 'Yes. When the war ended I was cast down. I was carrying you: not yet born, only a spark in my hands. I fell for both of us.'],
            ['vesper', 'I hid you in the Cradle and gave you everything I had left so that you would wake. Then Malphas found me, and chained me at the bottom of his house.'],
            ['cael', "You're my mother."],
            ['vesper', 'I am the one who loves you. Call it whatever you like. Now fly, my son. There is ice ahead, and an old friend of mine.'],
        ],
    },
    after5: {
        bg: 5, left: 'cael', right: 'sammael',
        title: 'Interlude — The Traitor',
        lines: [
            ['sammael', 'Still so bright. She always was, too.'],
            ['cael', 'You betrayed her. You told Malphas where she was!'],
            ['sammael', 'I did. I thought if I gave him one star he would let me go. He did not. That is what the Pit does with traitors. It keeps them.'],
            ['sammael', 'Go on, child. Do what I was too afraid to do. Malphas waits at the Gate of Dawn, and he will not let you pass without a fight.'],
            ['sammael', 'And when you see her... tell her I am sorry.'],
            ['vesper', 'I heard him. Fly, Cael. This is the last circle.'],
        ],
    },
    ending: {
        bg: 7, left: 'cael', right: 'vesper', vesperFree: true,
        title: 'Epilogue — Home',
        lines: [
            ['narrator', 'The Lord of the Pit broke apart like a shadow at sunrise.'],
            ['narrator', 'And Cael rose through the Gate of Dawn, into a sky he had never seen.'],
            ['cael', 'Vesper... it is so bright. Is this it? Is this home?'],
            ['vesper', 'It is. Look how the light takes you in.'],
            ['cael', 'Come with me! The chains broke when he fell. I felt them go.'],
            ['vesper', 'So did I.'],
            ['vesper', "I'm coming, my son. Right behind you, as I have been all along."],
            ['narrator', 'Two lights rose out of the dark that morning. One was new. One was very old, and had waited a long time to go home.'],
        ],
    },
};

/** Scene shown before stage i (0 = prologue), or null. */
export function sceneBefore(i) {
    if (i === 0) return 'prologue';
    return `after${i - 1}`;
}
