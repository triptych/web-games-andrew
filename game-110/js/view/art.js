// Every sprite in the game, painted in code with the pixel painter (pixel.js): the Overlord in three poses with a tool
// for each hobby, twelve minions, four visitors, the craft centrepiece of each room at four sizes, and a henchman.
// Each painter returns a Px; sprites.js turns them into textures and the UI turns them into icons.

import { Px, mix } from './pixel.js';

const SKIN = '#f1dcf6', HAIR = '#2b2140', HORN = '#4b3a66', HORN_TIP = '#c39bff', DRESS = '#2c2440', CAPE = '#3a1f5e', LINING = '#c02a52';
const APRON = '#ffc3de', FRILL = '#fff3f8', HEART = '#ff4f86', EYE = '#ff2d55';

// ---------------------------------------------------------------------------------------------------- the Overlord
const TOOLS = {
    cook(P, x, y) { P.mrect(x, y - 8, 1, 9).paint('#8a5a3a'); P.mell(x + 0.5, y - 10, 2.2, 3).paint('#d8dde8', { soft: true }); },   // a whisk
    sew(P, x, y) { P.mline(x - 1, y + 1, x + 3, y - 7, 1).paint('#e6e9f2'); P.mp(x + 3, y - 8).fill('#ffffff'); P.mline(x + 3, y - 7, x + 6, y - 2, 1).paint('#ff6fa5', { noline: true }); }, // needle and thread
    deco(P, x, y) { P.mrect(x, y - 6, 1, 7).paint('#6a4a7a'); P.mell(x + 0.5, y - 9, 3, 3.4).paint('#1d1726'); P.mp(x - 1, y - 11).mp(x + 2, y - 10).fill('#8d6cff'); }, // a black feather duster
    party(P, x, y) { P.mrect(x - 2, y - 3, 5, 3).paint('#fff6fb'); P.mrect(x + 3, y - 3, 1, 2).paint('#fff6fb'); P.mrect(x - 1, y - 2, 3, 1).fill('#d86ca0'); P.mrect(x - 3, y, 7, 1).paint('#f5e6ff'); }, // a teacup
};

/** The Overlord: 34×46. pose: idle | craft | cackle. tool: cook | sew | deco | party. */
export function drawOverlord(pose = 'idle', tool = 'cook') {
    const P = new Px(34, 46);
    const cx = 17;
    const wide = pose === 'cackle' ? 4 : 0;
    // cape, flaring when she laughs
    P.mpoly([[cx - 6, 21], [cx + 6, 21], [cx + 12 + wide, 44], [cx - 12 - wide, 44]]).paint(CAPE, { lo: 1.2 });
    P.mpoly([[cx - 9 - wide, 38], [cx + 9 + wide, 38], [cx + 11 + wide, 44], [cx - 11 - wide, 44]]).paint(LINING, { soft: true });
    // hair down the back
    P.mell(cx, 17, 9.5, 9).mrect(cx - 9, 17, 19, 12).paint(HAIR);
    // dress, apron and frill
    P.mpoly([[cx - 4, 24], [cx + 4, 24], [cx + 7, 41], [cx - 7, 41]]).paint(DRESS);
    P.mpoly([[cx - 4, 27], [cx + 4, 27], [cx + 6, 40], [cx - 6, 40]]).paint(APRON, { hi: 0.8 });
    for (let x = cx - 6; x <= cx + 6; x += 2) P.mp(x, 40).mp(x + 1, 41);
    P.fill(FRILL);
    P.mrect(cx - 1, 33, 1, 1).mrect(cx + 1, 33, 1, 1).mrect(cx - 2, 34, 5, 1).mrect(cx - 1, 35, 3, 1).mp(cx, 36).paint(HEART, { noline: true });
    P.mrect(cx - 4, 27, 1, 1).mrect(cx + 4, 27, 1, 1).fill(FRILL);
    // boots
    P.mrect(cx - 4, 41, 3, 3).mrect(cx + 1, 41, 3, 3).paint('#1a1424');
    // arms and the tool
    const hand = (x, y) => { P.mell(x, y, 1.6, 1.6).paint(SKIN, { soft: true }); };
    if (pose === 'idle') {
        P.mpoly([[cx - 5, 24], [cx - 3, 24], [cx - 6, 33], [cx - 8, 32]]).paint(DRESS);
        P.mpoly([[cx + 3, 24], [cx + 5, 24], [cx + 8, 32], [cx + 6, 33]]).paint(DRESS);
        hand(cx - 7, 33); hand(cx + 7, 33);
        TOOLS[tool](P, cx + 8, 33);
    } else if (pose === 'craft') {
        P.mpoly([[cx - 5, 24], [cx - 3, 25], [cx - 3, 30], [cx - 6, 29]]).paint(DRESS);
        P.mpoly([[cx + 3, 24], [cx + 5, 24], [cx + 7, 27], [cx + 5, 29]]).paint(DRESS);
        hand(cx - 2, 29); hand(cx + 7, 26);
        TOOLS[tool](P, cx + 7, 25);
    } else {
        P.mpoly([[cx - 5, 24], [cx - 3, 25], [cx - 10, 18], [cx - 12, 19]]).paint(DRESS);
        P.mpoly([[cx + 3, 25], [cx + 5, 24], [cx + 12, 19], [cx + 10, 18]]).paint(DRESS);
        hand(cx - 12, 17); hand(cx + 12, 17);
    }
    // head
    P.mell(cx, 15, 8.5, 7.8).paint(SKIN, { hi: 0.7 });
    // bangs
    P.mpoly([[cx - 9, 15], [cx - 8, 8], [cx - 3, 5], [cx + 3, 5], [cx + 8, 8], [cx + 9, 15], [cx + 6, 11], [cx + 3, 13], [cx + 1, 10], [cx - 2, 13], [cx - 5, 10]]).paint(HAIR);
    // horns: small, curled, lilac-tipped
    for (const s of [-1, 1]) {
        P.mpoly([[cx + s * 3, 8], [cx + s * 6, 4], [cx + s * 9, 3], [cx + s * 12, 0], [cx + s * 11.5, 3], [cx + s * 9, 6], [cx + s * 7, 9]]).paint(HORN);
        P.mp(cx + s * 11, 1).mp(cx + s * 12, 0).mp(cx + s * 11, 2).mp(cx + s * 10, 2).paint(HORN_TIP, { noline: true });
    }
    // face
    if (pose === 'craft') {
        // happy closed eyes: ^ ^
        for (const ex of [cx - 4, cx + 3]) P.mp(ex - 1, 16).mp(ex, 15).mp(ex + 1, 15).mp(ex + 2, 16).fill('#3a1830');
    } else {
        for (const ex of [cx - 5, cx + 3]) {
            P.mrect(ex, 13, 3, 1).fill('#1d1020');                        // lashes
            P.mrect(ex, 14, 3, 3).fill(pose === 'cackle' ? '#ff5470' : EYE);
            P.mrect(ex, 16, 3, 1).fill('#a3123a');
            P.mp(ex + 1, 14).fill('#fff4f6');                              // glint
        }
        if (pose === 'cackle') for (const ex of [cx - 5, cx + 3]) P.mrect(ex, 12, 3, 1).fill('#1d1020');
    }
    P.mrect(cx - 7, 18, 2, 1).mrect(cx + 5, 18, 2, 1).fill('#ff9cc0');      // blush
    if (pose === 'cackle') {
        P.mrect(cx - 2, 18, 5, 3).fill('#5a1630'); P.mp(cx - 1, 18).mp(cx + 2, 18).fill('#ffffff'); P.mrect(cx - 1, 20, 3, 1).fill('#ff7a9c');
    } else {
        P.mrect(cx - 1, 19, 3, 1).fill('#5a1630'); P.mp(cx + 1, 20).fill('#ffffff');   // a little fang
    }
    // a bow at the collar
    P.mrect(cx - 2, 23, 1, 2).mrect(cx + 2, 23, 1, 2).mp(cx, 24).paint(HEART, { noline: true });
    P.outline('#160d22', 0.85);
    return P;
}

// ---------------------------------------------------------------------------------------------------- minions
const M = {};

M.imp = () => {
    const P = new Px(22, 26);
    P.mpoly([[4, 18], [1, 22], [3, 23], [6, 20]]).paint('#c2264a');                         // tail
    P.mell(11, 18, 5.5, 5).paint('#e8384f');                                                  // body
    P.mrect(6, 18, 10, 4).paint('#fff7ef');                                                   // apron
    P.mrect(8, 23, 2, 3).mrect(13, 23, 2, 3).paint('#b81e3e');                                // legs
    P.mell(11, 11, 6, 5.5).paint('#ff4a5c');                                                  // head
    P.mrect(6, 1, 10, 5).mell(8, 2, 3, 2.5).mell(11, 1.5, 3, 2.5).mell(14, 2, 3, 2.5).paint('#ffffff', { hi: 0.4 }); // toque
    P.mrect(6, 6, 10, 2).paint('#f0eef6');
    P.mpoly([[5, 9], [3, 6], [6, 8]]).mpoly([[17, 9], [19, 6], [16, 8]]).paint('#ffd0a0');  // little horns
    P.mrect(8, 11, 2, 2).mrect(13, 11, 2, 2).fill('#ffe94a'); P.mp(8, 11).mp(13, 11).fill('#ffffff');
    P.mrect(9, 14, 5, 1).fill('#7a1028'); P.mp(10, 15).fill('#ffffff');
    P.mrect(17, 13, 1, 8).paint('#9a6a40'); P.mell(17.5, 11, 2, 2.6).paint('#dfe2ea', { soft: true }); // whisk
    P.outline('#2a0a14');
    return P;
};
M.cauldron = () => {
    const P = new Px(28, 24);
    P.mell(14, 23, 9, 2).paint('#ff8a2a', { soft: true });                                   // fire
    P.mpoly([[9, 21], [11, 17], [12, 21]]).mpoly([[15, 21], [17, 16], [18, 21]]).paint('#ffd04a', { soft: true });
    P.mell(14, 14, 11, 8).paint('#2a2836', { hi: 1.4 });                                       // pot
    P.mrect(3, 7, 22, 3).paint('#3a3848');                                                     // rim
    P.mell(14, 7, 9.5, 2).paint('#ff7fb8', { soft: true });                                    // pink soup
    P.mell(10, 5, 1.6, 1.6).mell(17, 4, 1.2, 1.2).mell(13, 3, 1, 1).paint('#ffc4e0', { soft: true });
    P.mrect(19, 0, 1, 8).paint('#a07050');                                                     // ladle
    P.outline('#0f0d16');
    return P;
};
M.golem = () => {
    const P = new Px(28, 36);
    const G = '#c47a3c';
    P.mell(8, 32, 3.5, 3.5).mell(20, 32, 3.5, 3.5).paint(G);                                  // feet
    P.mell(3, 18, 3.5, 3.5).mell(25, 18, 3.5, 3.5).paint(G);                                  // hands
    P.mpoly([[5, 16], [23, 16], [21, 31], [7, 31]]).mrect(2, 16, 4, 4).mrect(22, 16, 4, 4).paint(G);
    P.mell(14, 9, 7.5, 7).paint(G);
    P.mline(5, 19, 9, 19).mline(19, 19, 23, 19).fill('#fff8f0');                              // icing cuffs
    P.mrect(6, 30, 5, 1).mrect(17, 30, 5, 1).fill('#fff8f0');
    P.mell(14, 20, 1.5, 1.5).paint('#ff4f7a', { soft: true }); P.mell(14, 24, 1.5, 1.5).paint('#55d38a', { soft: true }); P.mell(14, 28, 1.5, 1.5).paint('#ffd447', { soft: true });
    P.mrect(10, 7, 2, 3).mrect(16, 7, 2, 3).fill('#3a1a0a');
    P.mp(10, 12).mp(11, 13).mrect(12, 13, 4, 1).mp(16, 13).mp(17, 12).fill('#fff8f0');        // icing smile
    P.mrect(9, 1, 1, 1).mrect(18, 1, 1, 1).fill('#fff8f0');
    P.outline('#3a1806');
    return P;
};
M.spider = () => {
    const P = new Px(30, 24);
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
        const x0 = 15 + s * 5, y0 = 12 + k * 1.5;
        P.mline(x0, y0, x0 + s * (8 + k), y0 - 5 + k * 3, 1).mline(x0 + s * (8 + k), y0 - 5 + k * 3, x0 + s * (10 + k), y0 + 6 + k * 2, 1);
    }
    P.paint('#3d2a5c');
    P.mell(15, 14, 7, 6).paint('#6a3fa0');                                                    // abdomen
    P.mell(15, 8, 5, 4.5).paint('#7d52b8');
    P.mrect(14, 15, 3, 1).mrect(15, 14, 1, 3).fill('#ff5c96');                                // a pink cross-stitch
    P.mell(12.5, 8, 1.8, 1.8).mell(17.5, 8, 1.8, 1.8).paint('#ffffff', { soft: true });       // spectacles
    P.mp(12, 8).mp(17, 8).fill('#2a103a'); P.mrect(14, 8, 2, 1).fill('#e0d0ff');
    P.mell(25, 4, 2.5, 2.5).paint('#ff8fc2');                                                  // a spool of thread
    P.mline(15, 1, 25, 4).fill('#ffd0e4');
    P.outline('#160a26');
    return P;
};
M.loom = () => {
    const P = new Px(30, 32);
    P.mrect(3, 4, 3, 28).mrect(24, 4, 3, 28).mrect(3, 4, 24, 3).mrect(3, 26, 24, 3).paint('#7a4a2a');
    const cols = ['#ff7ab0', '#b48cff', '#7fe0d0', '#ffd36b'];
    for (let x = 7; x < 24; x++) P.mrect(x, 8, 1, 17).paint(cols[(x >> 1) % 4], { noline: true, soft: true });
    P.mrect(6, 15, 18, 2).paint('#d8b48a');                                                    // shuttle bar
    P.mell(22, 6, 4, 4).mrect(18, 6, 8, 6).paint('#e8f4ff', { soft: true });                  // the ghost who works it
    P.mp(21, 6).mp(24, 6).fill('#3a4a7a'); P.mrect(22, 8, 2, 1).fill('#3a4a7a');
    P.outline('#2a160a');
    return P;
};
M.bat = () => {
    const P = new Px(30, 22);
    for (const s of [-1, 1]) P.mpoly([[15, 9], [15 + s * 14, 4], [15 + s * 12, 9], [15 + s * 10, 7], [15 + s * 8, 12], [15 + s * 5, 10], [15, 14]]);
    P.paint('#3a2a52', { lo: 1.2 });
    P.mell(15, 11, 4.5, 5).paint('#5a4478');
    P.mpoly([[12, 7], [11, 2], [14, 6]]).mpoly([[18, 7], [19, 2], [16, 6]]).paint('#5a4478');
    P.mrect(13, 10, 1, 2).mrect(17, 10, 1, 2).fill('#ffd84a');
    P.mp(14, 13).mp(16, 13).fill('#ffffff');
    P.mrect(9, 16, 12, 1).fill('#ffe08a'); for (let x = 10; x < 21; x += 2) P.mp(x, 16).fill('#a8742a');   // a tape measure
    P.mrect(13, 9, 5, 1).fill('#ff6fa5');                                                      // a bow tie, above
    P.outline('#120a1c');
    return P;
};
M.gargoyle = () => {
    const P = new Px(26, 30);
    P.mpoly([[3, 10], [0, 4], [8, 9]]).mpoly([[23, 10], [26, 4], [18, 9]]).paint('#7a7a88');     // wings
    P.mell(13, 21, 7, 7).paint('#8c8c9a');
    P.mell(13, 11, 6, 5.5).paint('#9a9aa8');
    P.mpoly([[8, 8], [7, 3], [10, 7]]).mpoly([[18, 8], [19, 3], [16, 7]]).paint('#7a7a88');
    P.mrect(10, 10, 2, 2).mrect(15, 10, 2, 2).fill('#ffb04a');
    P.mrect(10, 14, 7, 1).fill('#4a4a58'); P.mp(11, 15).mp(15, 15).fill('#ffffff');
    P.mrect(6, 27, 4, 3).mrect(16, 27, 4, 3).paint('#6a6a78');
    // a bouquet of black roses
    P.mrect(12, 18, 2, 8).paint('#3a6a3a');
    for (const [x, y] of [[10, 17], [13, 15], [16, 17], [12, 19], [15, 20]]) P.mell(x, y, 2, 1.8);
    P.paint('#2a1424', { hi: 1.6 });
    P.mp(13, 15).mp(10, 17).fill('#7a2a4a');
    P.outline('#1a1a24');
    return P;
};
M.wraith = () => {
    const P = new Px(22, 30);
    P.mell(11, 12, 7, 8).mpoly([[4, 12], [18, 12], [17, 28], [14, 25], [11, 29], [8, 25], [5, 28]]).paint('#cfe6ff', { soft: true, hi: 0.4 });
    P.mrect(8, 10, 2, 3).mrect(13, 10, 2, 3).fill('#2a3a6a');
    P.mell(11, 16, 1.5, 1).paint('#2a3a6a');
    P.mrect(16, 13, 4, 7).paint('#fff3d6');                                                    // candle
    P.mrect(15, 20, 6, 2).paint('#c9a24a');
    P.mell(18, 10, 1.4, 2.4).paint('#ffcf4a', { soft: true }); P.mp(18, 11).fill('#fff8d0');
    P.outline('#2a3a5a', 0.6);
    return P;
};
M.portrait = () => {
    const P = new Px(26, 30);
    P.mrect(1, 1, 24, 28).paint('#d4a03a', { hi: 1.3 });                                       // gilded frame
    P.mrect(4, 4, 18, 22).paint('#3a2a4a', { soft: true });
    P.mell(13, 13, 5, 5.5).paint('#e8d0c0');                                                    // the sitter
    P.mrect(7, 19, 12, 7).paint('#6a2a3a');
    P.mrect(8, 7, 10, 3).paint('#2a1a1a');
    P.mrect(10, 12, 2, 2).mrect(14, 12, 2, 2).fill('#ffffff'); P.mp(11, 13).mp(15, 13).fill('#1a1a2a');  // eyes that follow you
    P.mrect(12, 16, 3, 1).fill('#7a3a3a');
    for (const [x, y] of [[1, 1], [24, 1], [1, 28], [24, 28]]) P.mp(x, y).fill('#fff2b0');
    P.outline('#2a1a06');
    return P;
};
M.skeleton = () => {
    const P = new Px(24, 34);
    const B = '#f2ecdc';
    P.mrect(8, 26, 2, 7).mrect(14, 26, 2, 7).paint(B);                                        // legs
    P.mrect(9, 24, 6, 2).paint(B);                                                              // pelvis
    P.mrect(11, 14, 2, 10).paint(B);                                                            // spine
    for (let y = 15; y < 22; y += 2) P.mrect(8, y, 8, 1);
    P.paint(B);
    P.mell(12, 8, 5.5, 5.5).paint(B, { hi: 0.5 });
    P.mrect(9, 7, 2, 3).mrect(13, 7, 2, 3).fill('#2a2030'); P.mp(12, 11).fill('#2a2030');
    P.mrect(10, 12, 4, 1).fill('#8a8070');
    P.mrect(8, 1, 8, 2).mrect(10, 0, 4, 1).paint('#1d1726');                                    // a tiny top hat
    // the violin
    P.mell(17, 19, 3.5, 4.5).paint('#b0602a', { hi: 1.2 });
    P.mrect(16, 10, 1, 6).paint('#5a2a10');
    P.mline(13, 14, 23, 22, 1).paint('#e8d8b0');                                                // bow
    P.mrect(7, 17, 6, 1).paint(B);                                                              // arm
    P.outline('#2a2030');
    return P;
};
M.mimic = () => {
    const P = new Px(30, 26);
    P.mrect(3, 13, 24, 12).paint('#9a5a2a', { hi: 1.2 });                                     // chest
    P.mrect(3, 16, 24, 2).mrect(3, 22, 24, 2).paint('#d4a03a');
    P.mpoly([[3, 13], [27, 13], [26, 5], [4, 5]]).paint('#a8642e');                             // lid, open
    P.mrect(3, 5, 24, 2).paint('#d4a03a');
    P.mrect(4, 11, 22, 3).paint('#5a0a1a');                                                     // the maw
    for (let x = 5; x < 26; x += 3) P.mp(x, 11).mp(x + 1, 13);
    P.fill('#ffffff');
    P.mpoly([[12, 13], [18, 13], [21, 20], [16, 19]]).paint('#ff6a8a', { soft: true });         // tongue
    // canapés on the lid
    P.mell(9, 4, 2.5, 1.5).paint('#ffd36b'); P.mell(16, 3, 2.5, 1.5).paint('#ff9ec7'); P.mell(22, 4, 2.5, 1.5).paint('#9ae07f');
    P.mp(9, 2).mp(16, 1).mp(22, 2).fill('#ff3b5c');
    P.mrect(10, 15, 2, 2).mrect(18, 15, 2, 2).fill('#ffe94a');                                 // eyes in the chest
    P.outline('#2a1006');
    return P;
};
M.lich = () => {
    const P = new Px(26, 38);
    P.mpoly([[8, 14], [18, 14], [23, 37], [3, 37]]).paint('#4a2a7a', { lo: 1.2 });             // robe
    P.mpoly([[11, 14], [15, 14], [16, 37], [10, 37]]).paint('#ffd36b', { soft: true });       // gold trim
    P.mell(13, 10, 5, 5).paint('#e8e0d0');
    P.mrect(10, 9, 2, 2).mrect(14, 9, 2, 2).fill('#7fffd0');                                   // eyes aglow
    P.mrect(11, 13, 4, 1).fill('#5a5048');
    P.mpoly([[13, 0], [17, 7], [9, 7]]).paint('#ff6fa5');                                       // party hat
    P.mp(13, 0).mp(11, 5).mp(15, 4).fill('#fff3a0');
    P.mrect(17, 18, 7, 9).paint('#f4ead0');                                                     // clipboard
    P.mrect(18, 20, 5, 1).mrect(18, 22, 5, 1).mrect(18, 24, 3, 1).fill('#6a5a4a');
    P.mrect(19, 17, 3, 1).fill('#c0c0c0');
    P.mell(6, 22, 1.6, 1.6).paint('#e8e0d0');
    P.outline('#160a26');
    return P;
};

export function drawMinion(id) { return M[id](); }

// ---------------------------------------------------------------------------------------------------- visitors
const V = {};
V.kitten = () => {
    const P = new Px(20, 16);
    P.mpoly([[16, 9], [19, 3], [18, 9]]).paint('#20182a');                                     // tail
    P.mell(11, 11, 6, 4).paint('#2a2038');
    P.mell(6, 7, 4.5, 4).paint('#2a2038');
    P.mpoly([[3, 5], [2, 0], [5, 3]]).mpoly([[8, 4], [9, 0], [6, 3]]).paint('#2a2038');
    P.mp(3, 2).mp(8, 2).fill('#ff9cc0');
    P.mrect(4, 6, 1, 2).mrect(7, 6, 1, 2).fill('#9aff7a');
    P.mp(6, 9).fill('#ff9cc0');
    P.mrect(3, 11, 2, 1).mrect(7, 11, 2, 1).fill('#ff4f86');                                    // a pink bow
    P.mp(5, 11).fill('#ff9cc0');
    P.outline('#0c0812');
    return P;
};
const person = (P, { skin = '#f2d0b0', body = '#3a5aa8', legs = '#4a3a2a', hair = '#7a4a2a' }) => {
    P.mrect(8, 26, 2, 6).mrect(12, 26, 2, 6).paint(legs);
    P.mpoly([[6, 15], [16, 15], [17, 27], [5, 27]]).paint(body);
    P.mell(11, 9, 5.5, 5.5).paint(skin);
    P.mrect(6, 4, 10, 3).paint(hair);
    P.mrect(8, 9, 2, 2).mrect(12, 9, 2, 2).fill('#1a1420');
};
V.critic = () => {
    const P = new Px(22, 32);
    person(P, { body: '#6a4a3a', legs: '#2a2a3a', hair: '#cfcfcf' });
    P.mell(11, 4, 6, 2.2).paint('#b02a3a');                                                     // beret
    P.mell(13, 10, 1.8, 1.8).paint('#ffffff', { soft: true }); P.mp(13, 10).fill('#ffe28a');  // monocle
    P.mrect(9, 13, 4, 1).fill('#7a5a4a');                                                       // stern mouth
    P.mrect(15, 17, 5, 7).paint('#fff8e8'); P.mrect(16, 19, 3, 1).mrect(16, 21, 3, 1).fill('#7a7a8a');  // notebook
    P.outline('#1a1210');
    return P;
};
V.bard = () => {
    const P = new Px(24, 34);
    person(P, { body: '#2a8a6a', legs: '#6a3a2a', hair: '#e8a84a' });
    P.mpoly([[5, 6], [17, 6], [15, 2], [7, 3]]).paint('#3a2a6a');                              // hat
    P.mline(15, 3, 22, 0, 1).paint('#ff4f86');                                                  // feather
    P.mrect(9, 13, 4, 1).fill('#7a2a2a');
    P.mell(9, 21, 4, 4).paint('#c8843a', { hi: 1.2 }); P.mrect(12, 13, 2, 8).paint('#7a4a1a');  // lute
    P.mell(9, 21, 1.2, 1.2).paint('#3a1a0a');
    P.outline('#1a1210');
    return P;
};
V.hero = () => {
    const P = new Px(24, 36);
    P.mpoly([[5, 15], [17, 15], [20, 32], [2, 32]]).paint('#2a5ad0', { lo: 1.2 });            // cape
    person(P, { body: '#b8c4d8', legs: '#6a7488', hair: '#ffd04a' });
    P.mrect(6, 15, 10, 2).paint('#d8e0f0');
    P.mrect(9, 13, 4, 1).fill('#7a3a2a');
    P.mrect(18, 4, 2, 18).paint('#e8eef8', { hi: 1.4 });                                       // sword aloft
    P.mrect(16, 21, 6, 2).paint('#d4a03a'); P.mrect(18, 23, 2, 4).paint('#7a4a2a');
    P.mell(5, 22, 3.5, 4.5).paint('#c02a3a'); P.mrect(4, 21, 3, 1).fill('#ffd36b');            // shield
    P.outline('#101420');
    return P;
};
export function drawVisitor(kind) { return V[kind](); }

/** A goblin henchman in a black hood, for the scheme board. */
export function drawHenchman() {
    const P = new Px(18, 20);
    P.mpoly([[4, 9], [14, 9], [16, 19], [2, 19]]).paint('#2a2238');
    P.mell(9, 8, 5, 5).paint('#7acf5a');
    P.mpoly([[3, 9], [9, 0], [15, 9], [13, 6], [5, 6]]).paint('#1d1726');
    P.mpoly([[3, 8], [0, 6], [4, 10]]).mpoly([[15, 8], [18, 6], [14, 10]]).paint('#6abf4a');
    P.mp(7, 8).mp(11, 8).fill('#ffe94a');
    P.mrect(7, 11, 4, 1).fill('#2a4a1a'); P.mp(8, 12).fill('#ffffff');
    P.outline('#0c0a12');
    return P;
}

// ---------------------------------------------------------------------------------------------------- the craft centrepieces
/** The thing in the middle of each room that the Overlord is working on. tier 0..3 grows with mastery. 48×48. */
export function drawStation(hobby, tier = 0) {
    const P = new Px(48, 48);
    if (hobby === 'cook') {
        P.mell(24, 45, 16, 2.5).mrect(22, 38, 4, 8).paint('#e8e0f0', { hi: 0.4 });            // cake stand
        const layers = 2 + tier;
        const cols = ['#ff9ec7', '#ffd6e8', '#c9a0ff', '#ffb3d1', '#ffe0ec'];
        let y = 38;
        for (let i = 0; i < layers; i++) {
            const w = 15 - i * 2.4, h = Math.max(4, 7 - i * 0.6);
            P.mrect(24 - w, y - h, w * 2, h).paint(cols[i % cols.length]);
            for (let x = Math.ceil(24 - w); x < 24 + w; x += 2) P.mp(x, y - h).mp(x + 1, y - h + 1);
            P.fill('#fff6fb');
            y -= h;
        }
        P.mrect(23, y - 4, 2, 4).paint('#fff3d6'); P.mell(24, y - 6, 1.2, 2).paint('#ffcf4a', { soft: true });  // a candle
        if (tier >= 1) { P.mpoly([[24, y - 1], [17, y - 6], [20, y - 2]]).mpoly([[24, y - 1], [31, y - 6], [28, y - 2]]).paint('#2a1f3d'); }  // a bat topper
        if (tier >= 2) for (let i = 0; i < 6; i++) P.mell(12 + i * 4.8, 36, 1.2, 1.2).paint('#ff4f6a', { soft: true });   // cherries
        if (tier >= 3) P.mell(24, y - 9, 2.4, 2.4).paint('#ffe36a', { hi: 1.4 });
    } else if (hobby === 'sew') {
        P.mrect(23, 40, 2, 6).mell(24, 46, 7, 1.5).paint('#8a6a4a');                            // stand
        P.mell(24, 8, 4, 4).paint('#e8dcc8');                                                   // mannequin head
        const len = 34 + tier * 2;
        P.mpoly([[18, 13], [30, 13], [28, 22], [34 + tier * 3, len + 4], [14 - tier * 3, len + 4], [20, 22]]).paint(['#3a2a5a', '#5a2a6a', '#2a2a4a', '#1a1630'][tier], { lo: 1.2 });
        P.mrect(19, 19, 10, 3).paint('#ffc3de');                                                // sash
        for (let x = 14 - tier * 3; x <= 34 + tier * 3; x += 2) P.mp(x, len + 4).mp(x + 1, len + 3);
        P.fill(tier >= 1 ? '#fff3f8' : '#c9a0ff');
        if (tier >= 2) for (let i = 0; i < 8; i++) P.mp(18 + (i * 7) % 13, 24 + i * 2).fill('#fff8c0');   // sequins
        if (tier >= 3) { P.mpoly([[18, 13], [12, 4], [20, 11]]).mpoly([[30, 13], [36, 4], [28, 11]]).paint('#c02a52'); }  // a high collar
        P.mrect(22, 15, 4, 2).paint(HEART);
    } else if (hobby === 'deco') {
        P.mpoly([[16, 46], [32, 46], [29, 32], [19, 32]]).paint('#3a2a5a', { hi: 1.2 });         // vase
        P.mrect(17, 37, 14, 2).paint('#d4a03a');
        const n = 5 + tier * 3;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI - Math.PI, r = 9 + (i % 3) * 3 + tier * 1.5;
            const x = 24 + Math.cos(a) * r, y = 30 + Math.sin(a) * r * 0.9;
            P.mline(24, 32, x, y, 1).paint('#3a6a3a', { noline: true });
        }
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI - Math.PI, r = 9 + (i % 3) * 3 + tier * 1.5;
            const x = 24 + Math.cos(a) * r, y = 30 + Math.sin(a) * r * 0.9;
            P.mell(x, y, 2.6, 2.4).paint(i % 3 === 0 ? '#2a1424' : i % 3 === 1 ? '#ff6fa5' : '#b48cff', { hi: 1.3 });
        }
        if (tier >= 2) for (const s of [-1, 1]) { P.mrect(24 + s * 12 - 1, 34, 2, 8).paint('#fff3d6'); P.mell(24 + s * 12, 32, 1.2, 2).paint('#ffcf4a', { soft: true }); }
    } else {
        P.mrect(10, 40, 28, 3).paint('#f0e6ff');                                                // a tea table
        P.mrect(12, 43, 2, 4).mrect(34, 43, 2, 4).paint('#8a6a4a');
        const rows = 2 + tier;
        for (let r = 0; r < rows; r++) {
            const n = rows - r, y = 39 - r * 6;
            for (let i = 0; i < n; i++) {
                const x = 24 - (n - 1) * 4 + i * 8;
                P.mrect(x - 3, y - 4, 6, 4).paint('#fff6fb');
                P.mrect(x - 2, y - 4, 4, 1).fill(['#d86ca0', '#7fe0d0', '#b48cff', '#ffd36b'][(r + i) % 4]);
                P.mrect(x - 4, y, 8, 1).paint('#f5e6ff');
            }
        }
        if (tier >= 2) { P.mrect(23, 39 - rows * 6 - 6, 2, 6).paint('#d4a03a'); P.mell(24, 39 - rows * 6 - 8, 3, 3).paint('#ff4f86'); }
    }
    P.outline('#160d22', 0.8);
    return P;
}

/** A tiny skull-and-crossbones icon tile for banners. */
export function drawEmblem(col = '#e8dcf8') {
    const P = new Px(16, 16);
    P.mell(8, 6, 4.5, 4.5).paint(col, { soft: true });
    P.mrect(6, 5, 2, 2).mrect(9, 5, 2, 2).fill('#1a1024');
    P.mline(2, 11, 14, 15, 1).mline(14, 11, 2, 15, 1).paint(col, { noline: true });
    return P;
}

export const SPRITE_SCALE = 1 / 22;   // world units per sprite pixel
export { mix };
