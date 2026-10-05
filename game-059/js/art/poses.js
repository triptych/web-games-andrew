/**
 * poses.js — the animation library: keyframe poses for the rig.
 *
 * Two kinds of animation:
 *   looping  { fps, loop, frames: [pose...] }      idle, walk, run, falls...
 *   phased   { st: [...], ac: [...], rc: [...] }    attacks: the sim reports
 *            which phase a move is in (startup / active / recovery) and how far
 *            through it, and the view picks the frame. So timing lives in the
 *            sim's move data and the art never drifts out of sync with hitboxes.
 *
 * Every humanoid shares these angles; proportions come from the character.
 */

export const STANCE = { lean: 6, head: -4, fsh: 26, fel: 104, bsh: 12, bel: 120, fhip: 20, fkn: 26, bhip: -16, bkn: 18, hair: 0 };
const P = (o = {}) => ({ ...STANCE, ...o });
const A = (o = {}) => ({ ...STANCE, air: true, ...o });

// Relaxed / standing straight (portraits, cutscenes, non-fighters)
export const STAND = { lean: 0, head: 0, fsh: 6, fel: 14, bsh: -4, bel: 16, fhip: 4, fkn: 2, bhip: -4, bkn: 2, hair: 0 };
const S = (o = {}) => ({ ...STAND, ...o });

export const ANIMS = {
    idle: { fps: 3.2, loop: true, frames: [P(), P({ fkn: 32, bkn: 24, fel: 108, bel: 124, hair: 6 })] },
    stand: { fps: 2, loop: true, frames: [S(), S({ fkn: 5, bkn: 5, hair: 4 })] },
    walk: {
        fps: 8, loop: true, frames: [
            P({ fhip: 28, fkn: 8, bhip: -24, bkn: 26, hair: 8 }),
            P({ fhip: 6, fkn: 30, bhip: -2, bkn: 10, hair: 14 }),
            P({ fhip: -22, fkn: 26, bhip: 26, bkn: 8, hair: 8 }),
            P({ fhip: -2, fkn: 10, bhip: 6, bkn: 32, hair: 14 }),
        ],
    },
    run: {
        fps: 11, loop: true, frames: [
            P({ lean: 22, fhip: 56, fkn: 70, bhip: -38, bkn: 30, fsh: -42, fel: 96, bsh: 62, bel: 84, hair: 30 }),
            P({ lean: 22, fhip: 22, fkn: 104, bhip: -8, bkn: 22, fsh: -10, fel: 96, bsh: 30, bel: 92, dy: 3, hair: 36 }),
            P({ lean: 22, fhip: -36, fkn: 30, bhip: 56, bkn: 70, fsh: 62, fel: 84, bsh: -42, bel: 96, hair: 30 }),
            P({ lean: 22, fhip: -8, fkn: 22, bhip: 22, bkn: 104, fsh: 30, fel: 92, bsh: -10, bel: 96, dy: 3, hair: 36 }),
        ],
    },
    jump: {
        fps: 1, loop: false, frames: [
            A({ lean: 2, fhip: 50, fkn: 92, bhip: 12, bkn: 74, fsh: 150, fel: 24, bsh: 120, bel: 34, hair: -30 }),
            A({ lean: 12, fhip: 78, fkn: 124, bhip: 44, bkn: 120, fsh: 60, fel: 92, bsh: 40, bel: 104, hair: -10 }),
            A({ lean: 4, fhip: 26, fkn: 34, bhip: -12, bkn: 44, fsh: 112, fel: 30, bsh: 84, bel: 44, hair: 20 }),
        ],
    },
    land: { fps: 1, loop: false, frames: [P({ lean: 16, fhip: 44, fkn: 84, bhip: -30, bkn: 70, fsh: 40, fel: 80, hair: 20 })] },

    // ---- player chain ----
    jab: {
        st: [P({ fsh: 44, fel: 122, lean: 2 })],
        ac: [P({ fsh: 90, fel: 2, lean: 12, bsh: 22, bel: 126, fhip: 28, bhip: -24, hair: 10 })],
        rc: [P({ fsh: 62, fel: 62, lean: 9 })],
    },
    cross: {
        st: [P({ lean: 0, bsh: 30, bel: 112 })],
        ac: [P({ lean: 22, bsh: 88, bel: 0, fsh: 22, fel: 116, fhip: 30, fkn: 34, bhip: -32, bkn: 4, head: 4, hair: 16 })],
        rc: [P({ lean: 14, bsh: 52, bel: 62 })],
    },
    hook: {
        st: [P({ lean: -6, fsh: 18, fel: 132, bsh: 30 })],
        ac: [P({ lean: 18, fsh: 96, fel: 148, bsh: 10, bel: 120, fhip: 32, bhip: -26, head: 6, hair: 22 })],
        rc: [P({ lean: 10, fsh: 60, fel: 110 })],
    },
    kick: {
        st: [P({ fhip: 72, fkn: 122, lean: -8, bhip: -10, bkn: 10, fsh: 10, fel: 90, hair: -6 })],
        ac: [P({ fhip: 94, fkn: 0, lean: -22, bhip: -8, bkn: 6, fsh: -30, fel: 70, bsh: 52, bel: 60, head: 10, hair: -16 })],
        rc: [P({ fhip: 60, fkn: 90, lean: -10, fsh: 10, fel: 90 })],
    },
    upper: {
        st: [P({ fhip: 46, fkn: 88, bhip: -30, bkn: 72, fsh: 10, fel: 70, lean: 18 })],
        ac: [P({ fsh: 172, fel: 8, lean: -4, fhip: 10, fkn: 6, bhip: -16, bkn: 22, dy: 5, head: -10, bsh: -20, bel: 60, hair: -34 })],
        rc: [P({ fsh: 130, fel: 34, lean: 0, dy: 1 })],
    },
    backfist: {
        st: [P({ lean: -4, fsh: -6, fel: 140 })],
        ac: [P({ fsh: 92, fel: 12, lean: 10, fhip: 24, bhip: -20, hair: 18 })],
        rc: [P({ fsh: 50, fel: 70 })],
    },
    dashknee: {
        st: [P({ lean: 22, fhip: 40, fkn: 80, bhip: -30, bkn: 30, fsh: -30, fel: 70 })],
        ac: [P({ lean: 12, fhip: 102, fkn: 132, bhip: -36, bkn: 14, fsh: -42, fel: 60, bsh: -52, bel: 40, dy: 4, hair: 34 })],
        rc: [P({ fhip: 40, fkn: 60, lean: 10 })],
    },
    jumpkick: {
        st: [A({ lean: 4, fhip: 60, fkn: 110, bhip: 30, bkn: 110, fsh: 40, fel: 90 })],
        ac: [A({ lean: -14, fhip: 88, fkn: 2, bhip: 20, bkn: 122, fsh: -30, fel: 80, bsh: 100, bel: 40, head: 6, hair: 30 })],
        rc: [A({ lean: -4, fhip: 50, fkn: 60, bhip: 10, bkn: 60 })],
    },
    jumpknee: {
        st: [A({ fhip: 60, fkn: 110, bhip: 20, bkn: 100 })],
        ac: [A({ fhip: 112, fkn: 152, bhip: -20, bkn: 90, fsh: 60, fel: 112, bsh: 40, bel: 110, lean: 8 })],
        rc: [A({ fhip: 50, fkn: 80 })],
    },
    stomp: {
        st: [A({ fhip: 60, fkn: 120, bhip: 50, bkn: 120, fsh: 150, fel: 30, bsh: 150, bel: 30 })],
        ac: [A({ lean: 4, fhip: 8, fkn: 4, bhip: 58, bkn: 112, fsh: 142, fel: 30, bsh: 162, bel: 20, hair: -40 })],
        rc: [A({ fhip: 20, fkn: 30 })],
    },
    airkick2: {
        st: [A({ lean: 10, fhip: 60, fkn: 120, bhip: 40, bkn: 120 })],
        ac: [A({ lean: -30, fhip: 120, fkn: 10, bhip: 10, bkn: 80, fsh: -40, fel: 60, bsh: 90, bel: 50, hair: 30 })],
        rc: [A({ lean: -6, fhip: 50, fkn: 70 })],
    },

    // ---- grabs & throws ----
    grab: { fps: 1, loop: false, frames: [P({ fsh: 80, fel: 40, bsh: 74, bel: 52, lean: 10 })] },
    knee: {
        st: [P({ fsh: 80, fel: 40, bsh: 74, bel: 52, lean: 10, fhip: 40, fkn: 60 })],
        ac: [P({ fsh: 86, fel: 30, bsh: 80, bel: 40, lean: 18, fhip: 102, fkn: 152, bhip: -10, dy: 2 })],
        rc: [P({ fsh: 80, fel: 40, bsh: 74, bel: 52, lean: 10 })],
    },
    headbutt: {
        st: [P({ fsh: 80, fel: 40, bsh: 74, bel: 52, lean: -16, head: -14 })],
        ac: [P({ fsh: 86, fel: 30, bsh: 80, bel: 40, lean: 30, head: 22 })],
        rc: [P({ lean: 10 })],
    },
    throwF: {
        st: [P({ lean: -24, fsh: 160, fel: 30, bsh: 150, bel: 34, fhip: 30, bhip: -30 })],
        ac: [P({ lean: 30, fsh: 84, fel: 0, bsh: 72, bel: 4, fhip: 38, fkn: 40, bhip: -30, hair: 20 })],
        rc: [P({ lean: 12, fsh: 50, fel: 40 })],
    },
    throwB: {
        st: [P({ lean: -6, fsh: 90, fel: 40, bsh: 90, bel: 40, fhip: 34, fkn: 50, bhip: -20, bkn: 40 })],
        ac: [P({ lean: -48, fsh: 190, fel: 10, bsh: 190, bel: 10, head: -20, fhip: 20, fkn: 30, bhip: -20, bkn: 30, hair: -30 })],
        rc: [P({ lean: -10 })],
    },

    // ---- specials ----
    arc: {
        st: [P({ fhip: 36, fkn: 64, bhip: -36, bkn: 62, fsh: 40, fel: 132, bsh: 40, bel: 132, lean: 12, head: 8 })],
        ac: [P({ fhip: 42, fkn: 10, bhip: -42, bkn: 10, fsh: 126, fel: 0, bsh: 126, bel: 0, lean: -4, head: -12, hair: -40 })],
        rc: [P({ fsh: 80, fel: 40, bsh: 80, bel: 50 })],
    },
    rail: {
        st: [P({ lean: -10, fsh: -50, fel: 100, fhip: 30, fkn: 50, bhip: -30, bkn: 40 })],
        ac: [P({ lean: 38, fsh: 90, fel: 0, bsh: -60, bel: 30, fhip: 62, fkn: 40, bhip: -52, bkn: 20, head: 6, hair: 50 })],
        rc: [P({ lean: 16, fsh: 60, fel: 40 })],
    },
    meteor: {
        st: [A({ lean: 18, fhip: 82, fkn: 130, bhip: 62, bkn: 130, fsh: 172, fel: 40, bsh: 172, bel: 40, hair: -30 })],
        ac: [A({ lean: 34, fhip: 70, fkn: 120, bhip: 50, bkn: 110, fsh: -22, fel: 0, bsh: -12, bel: 0, head: 20, hair: -50 })],
        rc: [P({ lean: 30, fhip: 60, fkn: 100, bhip: -30, bkn: 90, fsh: -10, fel: 10, bsh: 0, bel: 10 })],
    },
    rising: {
        st: [P({ fhip: 50, fkn: 96, bhip: -30, bkn: 80, fsh: 0, fel: 80, lean: 20 })],
        ac: [A({ fsh: 178, fel: 4, lean: -8, fhip: 30, fkn: 80, bhip: -10, bkn: 60, bsh: -30, bel: 50, head: -14, hair: -50 })],
        rc: [A({ fsh: 120, fel: 40, fhip: 30, fkn: 50 })],
    },
    pulse: {
        st: [P({ fsh: 60, fel: 124, bsh: 60, bel: 124, lean: 6, fhip: 30, bhip: -26 })],
        ac: [P({ fsh: 92, fel: 0, bsh: 90, bel: 0, lean: -6, fhip: 34, fkn: 30, bhip: -30, bkn: 10, hair: 20 })],
        rc: [P({ fsh: 70, fel: 40, bsh: 60, bel: 50 })],
    },
    overdrive: {
        st: [P({ fsh: 20, fel: 150, bsh: 20, bel: 150, lean: 20, head: 20, fhip: 30, fkn: 60, bhip: -30, bkn: 60 })],
        ac: [P({ fsh: 150, fel: 20, bsh: 150, bel: 20, lean: -10, head: -20, fhip: 30, fkn: 4, bhip: -30, bkn: 4, hair: -50 })],
        rc: [P({ fsh: 110, fel: 30, bsh: 110, bel: 30 })],
    },

    // ---- weapons ----
    swingA: {
        st: [P({ fsh: 172, fel: 40, lean: -8, bsh: 30 })],
        ac: [P({ fsh: 82, fel: 0, lean: 14, fhip: 30, bhip: -26, hair: 16 })],
        rc: [P({ fsh: 30, fel: 10, lean: 10 })],
    },
    swingB: {
        st: [P({ fsh: 20, fel: 10, lean: 12 })],
        ac: [P({ fsh: 120, fel: 0, lean: -6, fhip: 26, bhip: -20 })],
        rc: [P({ fsh: 100, fel: 30 })],
    },
    swingC: {
        st: [P({ fsh: 200, fel: 30, lean: -16, bsh: 160, bel: 30 })],
        ac: [P({ fsh: 60, fel: 0, bsh: 50, bel: 10, lean: 26, fhip: 40, fkn: 50, bhip: -30, hair: 30 })],
        rc: [P({ fsh: 30, fel: 10, lean: 14 })],
    },
    toss: {
        st: [P({ fsh: 170, fel: 60, lean: -10 })],
        ac: [P({ fsh: 92, fel: 0, lean: 12 })],
        rc: [P({ fsh: 50, fel: 30 })],
    },

    // ---- reactions ----
    hurt: { fps: 1, loop: false, frames: [P({ lean: -18, head: -22, fsh: -20, fel: 40, bsh: 30, bel: 60, fhip: 16, fkn: 20, bhip: -20, bkn: 30, hair: 30 })] },
    hurt2: { fps: 1, loop: false, frames: [P({ lean: 34, head: 26, fsh: 40, fel: 70, bsh: 30, bel: 80, fhip: 30, fkn: 52, bhip: -10, bkn: 40, hair: -20 })] },
    fall: {
        fps: 7, loop: false, frames: [
            A({ spin: 26, lean: -10, fhip: 40, fkn: 40, bhip: 10, bkn: 60, fsh: 150, fel: 20, bsh: 120, bel: 30, head: -20, hair: 40 }),
            A({ spin: 58, lean: -10, fhip: 50, fkn: 30, bhip: 20, bkn: 50, fsh: 160, fel: 30, bsh: 130, bel: 40, head: -16, hair: 50 }),
        ],
    },
    down: { fps: 1, loop: false, frames: [P({ spin: 90, lean: 0, fhip: 8, fkn: 14, bhip: -6, bkn: 24, fsh: 160, fel: 20, bsh: 120, bel: 30, head: -6, hair: 70 })] },
    getup: {
        fps: 6, loop: false, frames: [
            P({ spin: 46, lean: 10, fhip: 80, fkn: 120, bhip: 60, bkn: 120, fsh: -40, fel: 0, bsh: -20, bel: 0, hair: 40 }),
            P({ lean: 28, fhip: 64, fkn: 112, bhip: -30, bkn: 92, fsh: 30, fel: 60, bsh: 20, bel: 70 }),
        ],
    },
    spin: {
        fps: 14, loop: true, frames: [0, 90, 180, 270].map((s) => A({ spin: s, fhip: 70, fkn: 90, bhip: 40, bkn: 80, fsh: 120, fel: 60, bsh: 100, bel: 60 })),
    },
    grabbed: { fps: 6, loop: true, frames: [P({ lean: -10, head: -10, fsh: 60, fel: 60, bsh: 40, bel: 70, fhip: 6, bhip: -6 }), P({ lean: -6, head: -16, fsh: 50, fel: 70, bsh: 50, bel: 60, fhip: 10, bhip: -10 })] },
    dizzy: { fps: 4, loop: true, frames: [P({ lean: -6, head: 16, fsh: 4, fel: 20, bsh: -6, bel: 20, fkn: 12, bkn: 10 }), P({ lean: 6, head: -16, fsh: 10, fel: 30, bsh: 2, bel: 30, fkn: 12, bkn: 10 })] },
    victory: { fps: 2, loop: true, frames: [P({ fsh: 176, fel: 10, bsh: -24, bel: 70, lean: -4, head: -8, fhip: 14, fkn: 4, bhip: -14, bkn: 4, hair: 20 }), P({ fsh: 172, fel: 18, bsh: -24, bel: 70, lean: -4, head: -10, fhip: 14, fkn: 6, bhip: -14, bkn: 6, hair: 30 })] },
    taunt: { fps: 3, loop: true, frames: [P({ fsh: 100, fel: 70, bsh: -30, bel: 60, lean: -6, head: -10 }), P({ fsh: 110, fel: 100, bsh: -30, bel: 60, lean: -6, head: -12 })] },
    block: { fps: 1, loop: false, frames: [P({ fsh: 72, fel: 96, bsh: 40, bel: 110, lean: -2, fhip: 26, bhip: -24 })] },
    portrait: { fps: 1, loop: false, frames: [S({ fsh: 8, fel: 24, bsh: 4, bel: 30 })] },

    // ---- enemy moves ----
    punch: {
        st: [P({ fsh: 30, fel: 120, lean: -2 })],
        ac: [P({ fsh: 92, fel: 4, lean: 16, fhip: 28, bhip: -26 })],
        rc: [P({ fsh: 60, fel: 60, lean: 8 })],
    },
    slam: {
        st: [P({ fsh: 178, fel: 30, bsh: 170, bel: 30, lean: -12, head: -10 })],
        ac: [P({ fsh: 60, fel: 4, bsh: 56, bel: 8, lean: 34, head: 16, fhip: 40, fkn: 50, bhip: -30, bkn: 30 })],
        rc: [P({ fsh: 40, fel: 20, bsh: 36, bel: 20, lean: 20 })],
    },
    charge: { fps: 10, loop: true, frames: [
        P({ lean: 36, head: 10, fsh: 70, fel: 30, bsh: 60, bel: 40, fhip: 60, fkn: 70, bhip: -40, bkn: 30 }),
        P({ lean: 36, head: 10, fsh: 76, fel: 30, bsh: 66, bel: 40, fhip: -30, fkn: 30, bhip: 56, bkn: 70, dy: 2 }),
    ] },
    windup: { fps: 6, loop: true, frames: [P({ lean: -14, fsh: -30, fel: 100, bsh: -40, bel: 100, head: -6, fhip: 30, fkn: 40, bhip: -30, bkn: 30 }), P({ lean: -16, fsh: -34, fel: 104, bsh: -44, bel: 104, head: -8, fhip: 30, fkn: 44, bhip: -30, bkn: 34 })] },
    slash: {
        st: [P({ fsh: 160, fel: 60, lean: -10 })],
        ac: [P({ fsh: 70, fel: -10, lean: 18, fhip: 30, bhip: -30, hair: 20 })],
        rc: [P({ fsh: 30, fel: 30, lean: 10 })],
    },
    slash2: {
        st: [P({ fsh: 20, fel: 20, lean: 14 })],
        ac: [P({ fsh: 124, fel: 0, lean: -6, fhip: 26, bhip: -22, hair: -20 })],
        rc: [P({ fsh: 100, fel: 20 })],
    },
    lunge: {
        st: [P({ lean: -10, fsh: -20, fel: 90, fhip: 30, fkn: 50, bhip: -20, bkn: 40 })],
        ac: [P({ lean: 34, fsh: 90, fel: 0, bsh: -40, bel: 30, fhip: 60, fkn: 30, bhip: -50, bkn: 10, hair: 40 })],
        rc: [P({ lean: 14, fsh: 60, fel: 30 })],
    },
    shoot: {
        st: [P({ fsh: 76, fel: 20, lean: 0, bsh: 60, bel: 40 })],
        ac: [P({ fsh: 92, fel: 0, lean: -6, bsh: 70, bel: 30 })],
        rc: [P({ fsh: 100, fel: 10, lean: -4, bsh: 60, bel: 40 })],
    },
    bash: {
        st: [P({ fsh: 50, fel: 90, lean: -10 })],
        ac: [P({ fsh: 86, fel: 70, lean: 28, fhip: 40, fkn: 40, bhip: -36, bkn: 10 })],
        rc: [P({ fsh: 70, fel: 90, lean: 8 })],
    },
    flip: { fps: 12, loop: false, frames: [
        A({ spin: 60, fhip: 80, fkn: 120, bhip: 60, bkn: 120, fsh: 130, fel: 40, bsh: 120, bel: 40 }),
        A({ spin: 180, fhip: 80, fkn: 120, bhip: 60, bkn: 120, fsh: 130, fel: 40, bsh: 120, bel: 40 }),
        A({ spin: 300, fhip: 60, fkn: 90, bhip: 40, bkn: 80, fsh: 120, fel: 40, bsh: 110, bel: 40 }),
    ] },
    leap: {
        st: [P({ fhip: 50, fkn: 96, bhip: -30, bkn: 86, lean: 26, fsh: -30, fel: 60, bsh: -40, bel: 60 })],
        ac: [A({ lean: 30, fhip: 60, fkn: 70, bhip: -10, bkn: 60, fsh: 120, fel: 10, bsh: 110, bel: 20, hair: 40 })],
        rc: [P({ lean: 26, fhip: 50, fkn: 90, bhip: -30, bkn: 80, fsh: 60, fel: 20 })],
    },
    spit: {
        st: [P({ lean: -20, head: -24, fsh: 10, fel: 40 })],
        ac: [P({ lean: 26, head: 20, fsh: 20, fel: 40 })],
        rc: [P({ lean: 10 })],
    },
    stance: { fps: 1, loop: false, frames: [P({ lean: 14, head: 4, fsh: 30, fel: 60, bsh: 10, bel: 90, fhip: 50, fkn: 80, bhip: -40, bkn: 60 })] },
    hover: { fps: 6, loop: true, frames: [S({ dy: 0 }), S({ dy: 1 })] },
    fly: { fps: 6, loop: true, frames: [A({ lean: 20, fhip: 10, fkn: 30, bhip: -10, bkn: 40, fsh: 40, fel: 30, bsh: -20, bel: 30 }), A({ lean: 20, fhip: 14, fkn: 36, bhip: -6, bkn: 46, fsh: 44, fel: 34, bsh: -16, bel: 34, dy: 2 })] },
    beam: {
        st: [A({ lean: -10, fsh: 150, fel: 20, bsh: 150, bel: 20, fhip: 10, fkn: 20, bhip: -10, bkn: 30 })],
        ac: [A({ lean: 4, fsh: 96, fel: 0, bsh: 92, bel: 0, fhip: 10, fkn: 20, bhip: -10, bkn: 30 })],
        rc: [A({ fsh: 60, fel: 20 })],
    },
};

/** Flatten an animation to { frames: [pose], phases?: {st:[a,b],ac,rc}, fps, loop }. */
export function flattenAnim(a) {
    if (a.frames) return { frames: a.frames, fps: a.fps, loop: a.loop };
    const frames = [], phases = {};
    for (const ph of ['st', 'ac', 'rc']) {
        const list = a[ph] || [];
        phases[ph] = [frames.length, list.length];
        frames.push(...list);
    }
    return { frames, phases };
}
