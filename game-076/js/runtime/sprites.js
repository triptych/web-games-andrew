/* TALEWRIGHT runtime — sprites: characters built from parts (4 facings × 3 walk
 * frames at 16×20), map objects, battle monsters, item icons and faces.
 * Everything is drawn in code and cached. */
(window.TW_MODULES = window.TW_MODULES || []).push(['sprites', function (TW) {
    'use strict';
    const U = TW.util;
    const CW = 16, CH = 20;       // character frame
    const DIR_ROW = { 2: 0, 4: 1, 6: 2, 8: 3 };

    // ── parts ────────────────────────────────────────────────────────────────
    const PARTS = {
        body: ['human', 'cat', 'slime', 'ghost', 'robot'],
        skin: ['#f6d2b0', '#e8b890', '#c88a5a', '#9a6438', '#6a4224', '#f0e0d0', '#b8d8a0', '#a8b8e8'],
        hair: ['short', 'long', 'spiky', 'bald', 'ponytail', 'bob', 'curly'],
        hairColor: ['#5a3a1a', '#2a1e18', '#d8b048', '#c84a2a', '#f0f0f0', '#8a8a8a', '#4a6ad8', '#d05aa0', '#4aa060', '#8a4ad8'],
        eyes: ['dot', 'wide', 'closed', 'glow'],
        outfit: ['tunic', 'robe', 'armor', 'dress', 'coat', 'rags'],
        head: ['none', 'hood', 'helmet', 'wizard', 'bandana', 'crown', 'tiara', 'plume', 'straw'],
        acc: ['none', 'cape', 'beard', 'scarf', 'glasses'],
        colors: ['#3a64c8', '#c83a3a', '#3a9a4a', '#8a4ac8', '#e0b040', '#f0f0f0', '#3a3a44', '#8a5a30', '#e8783a', '#4ac0c8', '#d05aa0', '#6a7a8a'],
    };
    // Which parts come from the Emporium (the editor checks ownership; the runtime draws anything).
    const PACKS = {
        crown: 'sprites.royal', tiara: 'sprites.royal', plume: 'sprites.royal',
        cat: 'sprites.critters', slime: 'sprites.critters', ghost: 'sprites.critters', robot: 'sprites.critters',
        cape: 'sprites.adventurer', scarf: 'sprites.adventurer', glasses: 'sprites.adventurer',
    };

    const P = (o) => Object.assign({ body: 'human', skin: '#f6d2b0', hair: 'short', hairColor: '#5a3a1a', eyes: 'dot', outfit: 'tunic', c1: '#3a64c8', c2: '#5a3a1a', head: 'none', hc: '#8a4ac8', acc: 'none', ac: '#c83a3a' }, o);
    const PRESETS = {
        hero:      { name: 'Hero', parts: P({ hair: 'spiky', hairColor: '#5a3a1a', c1: '#3a64c8', c2: '#6a4a2a', acc: 'cape', ac: '#c83a3a' }) },
        heroine:   { name: 'Heroine', parts: P({ hair: 'long', hairColor: '#c84a2a', outfit: 'tunic', c1: '#3a9a4a', c2: '#5a3a1a', eyes: 'wide' }) },
        knight:    { name: 'Knight', parts: P({ outfit: 'armor', c1: '#b8c0d0', c2: '#4a4a5a', head: 'helmet', hc: '#b8c0d0', acc: 'cape', ac: '#3a64c8' }) },
        mage:      { name: 'Mage', parts: P({ hair: 'long', hairColor: '#f0f0f0', outfit: 'robe', c1: '#6a3ac8', c2: '#e0b040', head: 'wizard', hc: '#6a3ac8' }) },
        priest:    { name: 'Priest', parts: P({ hair: 'short', hairColor: '#d8b048', outfit: 'robe', c1: '#f0f0f0', c2: '#e0b040', head: 'hood', hc: '#f0f0f0' }) },
        thief:     { name: 'Thief', parts: P({ hair: 'short', hairColor: '#2a1e18', outfit: 'coat', c1: '#3a3a44', c2: '#8a5a30', head: 'bandana', hc: '#c83a3a', acc: 'scarf', ac: '#c83a3a' }) },
        elder:     { name: 'Elder', parts: P({ hair: 'bald', hairColor: '#f0f0f0', outfit: 'robe', c1: '#8a5a30', c2: '#5a3a1a', acc: 'beard', eyes: 'closed' }) },
        merchant:  { name: 'Merchant', parts: P({ hair: 'short', hairColor: '#8a8a8a', outfit: 'coat', c1: '#3a9a4a', c2: '#e0b040', skin: '#e8b890' }) },
        child:     { name: 'Child', parts: P({ hair: 'bob', hairColor: '#d8b048', outfit: 'tunic', c1: '#e8783a', c2: '#3a64c8', eyes: 'wide' }) },
        guard:     { name: 'Guard', parts: P({ outfit: 'armor', c1: '#8a8a9a', c2: '#c83a3a', head: 'helmet', hc: '#8a8a9a' }) },
        king:      { name: 'King', parts: P({ hair: 'short', hairColor: '#f0f0f0', outfit: 'robe', c1: '#c83a3a', c2: '#e0b040', head: 'crown', hc: '#e0b040', acc: 'beard' }) },
        queen:     { name: 'Queen', parts: P({ hair: 'long', hairColor: '#2a1e18', outfit: 'dress', c1: '#8a4ac8', c2: '#e0b040', head: 'tiara', hc: '#e0b040', eyes: 'wide' }) },
        princess:  { name: 'Princess', parts: P({ hair: 'long', hairColor: '#d8b048', outfit: 'dress', c1: '#d05aa0', c2: '#f0f0f0', head: 'tiara', hc: '#e0b040', eyes: 'wide' }) },
        farmer:    { name: 'Farmer', parts: P({ hair: 'short', hairColor: '#8a5a30', outfit: 'tunic', c1: '#6a8a3a', c2: '#3a64c8', head: 'straw', hc: '#e0c060', skin: '#e8b890' }) },
        sailor:    { name: 'Sailor', parts: P({ hair: 'curly', hairColor: '#2a1e18', outfit: 'tunic', c1: '#f0f0f0', c2: '#3a64c8', head: 'bandana', hc: '#3a64c8', skin: '#c88a5a' }) },
        nun:       { name: 'Nun', parts: P({ outfit: 'robe', c1: '#2a2a34', c2: '#f0f0f0', head: 'hood', hc: '#2a2a34' }) },
        bard:      { name: 'Bard', parts: P({ hair: 'curly', hairColor: '#c84a2a', outfit: 'coat', c1: '#e0b040', c2: '#3a9a4a', head: 'plume', hc: '#3a9a4a' }) },
        smith:     { name: 'Blacksmith', parts: P({ hair: 'bald', hairColor: '#2a1e18', outfit: 'rags', c1: '#6a4a2a', c2: '#3a3a44', acc: 'beard', skin: '#c88a5a' }) },
        innkeeper: { name: 'Innkeeper', parts: P({ hair: 'bob', hairColor: '#8a5a30', outfit: 'dress', c1: '#c83a3a', c2: '#f0f0f0' }) },
        witch:     { name: 'Witch', parts: P({ hair: 'long', hairColor: '#4aa060', outfit: 'robe', c1: '#2a2a34', c2: '#8a4ac8', head: 'wizard', hc: '#2a2a34', skin: '#b8d8a0' }) },
        villager:  { name: 'Villager', parts: P({ hair: 'short', hairColor: '#2a1e18', outfit: 'tunic', c1: '#8a5a30', c2: '#3a3a44' }) },
        villager2: { name: 'Villager (W)', parts: P({ hair: 'ponytail', hairColor: '#5a3a1a', outfit: 'dress', c1: '#4ac0c8', c2: '#f0f0f0' }) },
        oldwoman:  { name: 'Old Woman', parts: P({ hair: 'bob', hairColor: '#f0f0f0', outfit: 'dress', c1: '#6a7a8a', c2: '#8a4ac8', eyes: 'closed', acc: 'glasses' }) },
        scholar:   { name: 'Scholar', parts: P({ hair: 'short', hairColor: '#5a3a1a', outfit: 'coat', c1: '#3a3a44', c2: '#e0b040', acc: 'glasses' }) },
        ranger:    { name: 'Ranger', parts: P({ hair: 'ponytail', hairColor: '#2a1e18', outfit: 'coat', c1: '#3a7a3a', c2: '#8a5a30', head: 'hood', hc: '#3a7a3a', skin: '#c88a5a' }) },
        monk:      { name: 'Monk', parts: P({ hair: 'bald', outfit: 'robe', c1: '#e8783a', c2: '#e0b040', skin: '#e8b890' }) },
        dancer:    { name: 'Dancer', parts: P({ hair: 'ponytail', hairColor: '#d05aa0', outfit: 'dress', c1: '#e0b040', c2: '#c83a3a', eyes: 'wide', skin: '#c88a5a' }) },
        captain:   { name: 'Captain', parts: P({ hair: 'short', hairColor: '#2a1e18', outfit: 'coat', c1: '#3a64c8', c2: '#e0b040', head: 'plume', hc: '#3a3a44', acc: 'beard' }) },
        cat:       { name: 'Cat', parts: P({ body: 'cat', c1: '#e8a050', c2: '#ffffff' }) },
        blackcat:  { name: 'Black Cat', parts: P({ body: 'cat', c1: '#2a2a34', c2: '#e0e0e0', eyes: 'glow' }) },
        slime:     { name: 'Slime', parts: P({ body: 'slime', c1: '#4ac0c8', c2: '#ffffff' }) },
        ghost:     { name: 'Ghost', parts: P({ body: 'ghost', c1: '#f0f4ff', c2: '#a8b8e8' }) },
        robot:     { name: 'Robot', parts: P({ body: 'robot', c1: '#a8b0c0', c2: '#4ac0c8' }) },
    };

    // ── drawing ──────────────────────────────────────────────────────────────
    function mk(g) {
        const R = (x, y, w, h, c) => { if (w > 0 && h > 0) { g.fillStyle = c; g.fillRect(x, y, w, h); } };
        return { R, g };
    }

    // A human seen from the front (dir 2), the left side (dir 4) or the back (dir 8).
    function human(g, p, dir, fr) {
        const { R } = mk(g);
        const sk = p.skin, skD = U.shade(sk, -0.18);
        const hr = p.hairColor, hrD = U.shade(hr, -0.3), hrL = U.shade(hr, 0.25);
        const c1 = p.c1, c1D = U.shade(c1, -0.32), c1L = U.shade(c1, 0.22);
        const c2 = p.c2, c2D = U.shade(c2, -0.3);
        const out = '#1a1218';
        const step = fr === 0 ? -1 : fr === 2 ? 1 : 0;
        const side = dir === 4, back = dir === 8;
        const long = p.outfit === 'robe' || p.outfit === 'dress';
        const hooded = p.head === 'hood';
        const bob = step !== 0 ? 0 : 0;

        // cape behind the body
        if (p.acc === 'cape') {
            const k = p.ac, kD = U.shade(k, -0.3);
            if (back) { R(3, 10, 10, 8, k); R(3, 17, 10, 1, kD); R(7, 10, 2, 8, kD); }
            else if (side) { R(8, 10, 4, 8, k); R(11, 10, 1, 8, kD); }
            else { R(3, 11, 1, 6, kD); R(12, 11, 1, 6, kD); }
        }
        // long hair behind the shoulders
        if (!hooded && (p.hair === 'long')) {
            if (back) R(3, 8, 10, 6, hr);
            else if (side) R(8, 8, 4, 6, hr);
            else { R(3, 9, 2, 4, hr); R(11, 9, 2, 4, hr); }
        }

        // legs
        const pants = p.outfit === 'armor' ? c2 : c2D;
        if (!long) {
            if (side) {
                R(6 + step, 15, 2, 3, pants); R(8 - step, 15, 2, 3, U.shade(pants, -0.15));
                R(5 + step, 18, 3, 1, out); R(8 - step, 18, 3, 1, '#2a1a10');
            } else {
                const l = step < 0 ? 1 : 0, r = step > 0 ? 1 : 0;
                R(5, 15, 2, 3 - l, pants); R(9, 15, 2, 3 - r, pants);
                R(5, 18 - l, 2, 1, '#2a1a10'); R(9, 18 - r, 2, 1, '#2a1a10');
            }
        } else {
            if (side) { R(5 + step, 18, 3, 1, '#2a1a10'); R(8 - step, 18, 3, 1, '#2a1a10'); }
            else { R(5, 18, 2, 1, '#2a1a10'); R(9, 18, 2, 1, '#2a1a10'); }
        }

        // body / outfit
        const bodyColor = c1;
        if (side) {
            R(5, 10, 6, 5, bodyColor); R(5, 10, 1, 5, c1L); R(10, 10, 1, 5, c1D);
            if (long) {
                R(4, 15, 8, 3, bodyColor); R(4, 17, 8, 1, c1D);
                if (p.outfit === 'dress') { R(3, 16, 10, 2, bodyColor); R(3, 17, 10, 1, c1D); }
            }
            if (p.outfit === 'tunic' || p.outfit === 'rags') { R(5, 14, 6, 1, c2); }
            if (p.outfit === 'coat') { R(5, 14, 6, 3, bodyColor); R(5, 16, 6, 1, c1D); R(5, 11, 1, 4, c2); }
            if (p.outfit === 'armor') { R(7, 10, 4, 2, c1L); R(5, 13, 6, 1, c2); }
            // arm swings with the stride
            const ay = 10 + (step === 0 ? 0 : 0);
            R(7 - step, ay + 1, 2, 3, c1D); R(7 - step, ay + 4, 2, 1, sk);
        } else {
            R(4, 10, 8, 5, bodyColor); R(4, 10, 1, 5, c1L); R(11, 10, 1, 5, c1D);
            if (long) {
                R(4, 15, 8, 3, bodyColor); R(4, 17, 8, 1, c1D);
                if (p.outfit === 'dress') { R(3, 15, 10, 3, bodyColor); R(3, 17, 10, 1, c1D); R(3, 15, 1, 3, c1L); }
                if (p.outfit === 'robe' && !back) R(7, 11, 2, 7, c2);
            }
            if (p.outfit === 'tunic' || p.outfit === 'rags') R(4, 14, 8, 1, c2);
            if (p.outfit === 'rags' && !back) { R(5, 12, 1, 1, c1D); R(9, 11, 1, 2, c1D); }
            if (p.outfit === 'coat') { R(4, 14, 8, 3, bodyColor); R(4, 16, 8, 1, c1D); if (!back) R(7, 10, 2, 7, c2); else R(7, 13, 2, 4, c1D); }
            if (p.outfit === 'armor') { R(3, 10, 3, 2, c1L); R(10, 10, 3, 2, c1L); if (!back) { R(7, 11, 2, 3, c1L); R(4, 14, 8, 1, c2); } }
            if (p.outfit === 'dress' && !back) R(6, 10, 4, 1, c2);
            // arms
            const la = step > 0 ? 1 : 0, ra = step < 0 ? 1 : 0;
            R(3, 10 + la, 1, 4, c1D); R(12, 10 + ra, 1, 4, c1D);
            R(3, 14 + la, 1, 1, sk); R(12, 14 + ra, 1, 1, sk);
        }
        if (p.acc === 'scarf') {
            const k = p.ac;
            if (side) { R(5, 10, 6, 1, k); R(10, 11, 2, 3, U.shade(k, -0.2)); }
            else { R(4, 10, 8, 1, k); if (!back) R(9, 11, 2, 3, U.shade(k, -0.2)); else R(5, 11, 2, 3, U.shade(k, -0.2)); }
        }

        // head
        const head = (y, x0, x1) => R(x0, y, x1 - x0 + 1, 1, sk);
        head(2, 5, 10); head(3, 4, 11);
        for (let y = 4; y <= 8; y++) head(y, 3, 12);
        head(9, 4, 11);
        R(3, 8, 10, 1, skD); R(4, 9, 8, 1, skD);

        // face
        if (!back) {
            const ec = p.eyes === 'glow' ? (p.ac || '#ffe066') : '#1a1218';
            if (side) {
                if (p.eyes === 'closed') R(4, 7, 2, 1, ec);
                else { R(4, 6, 1, 2, ec); if (p.eyes === 'wide') R(4, 6, 1, 1, '#ffffff'); }
                R(3, 8, 1, 1, U.shade(sk, -0.25));
            } else {
                if (p.eyes === 'closed') { R(5, 7, 2, 1, ec); R(9, 7, 2, 1, ec); }
                else if (p.eyes === 'wide') { R(5, 6, 2, 2, ec); R(9, 6, 2, 2, ec); R(5, 6, 1, 1, '#ffffff'); R(9, 6, 1, 1, '#ffffff'); }
                else { R(5, 6, 1, 2, ec); R(10, 6, 1, 2, ec); }
                R(7, 8, 2, 1, U.shade(sk, -0.22));
                R(4, 7, 1, 1, U.mix(sk, '#ff8080', 0.35)); R(11, 7, 1, 1, U.mix(sk, '#ff8080', 0.35));
            }
        }

        // hair
        if (!hooded && p.hair !== 'bald') {
            const H = hr;
            if (back) {
                R(4, 1, 8, 1, H); R(3, 2, 10, 7, H); R(4, 9, 8, 1, hrD); R(5, 2, 3, 1, hrL);
                if (p.hair === 'ponytail') { R(7, 9, 2, 4, H); R(7, 12, 2, 1, hrD); }
                if (p.hair === 'bob' || p.hair === 'curly') R(3, 9, 10, 1, H);
            } else if (side) {
                R(5, 1, 7, 1, H); R(4, 2, 9, 2, H); R(8, 4, 5, 5, H); R(4, 4, 2, 1, H);
                R(5, 2, 3, 1, hrL); R(12, 4, 1, 5, hrD);
                if (p.hair === 'ponytail') { R(12, 5, 2, 5, H); R(13, 9, 1, 2, hrD); }
                if (p.hair === 'bob' || p.hair === 'curly') R(8, 9, 5, 1, H);
            } else {
                R(5, 1, 6, 1, H); R(4, 2, 8, 2, H); R(3, 3, 2, 4, H); R(11, 3, 2, 4, H);
                R(5, 4, 2, 1, H); R(9, 4, 2, 1, H); R(7, 4, 2, 1, hrD);
                R(5, 2, 3, 1, hrL);
                if (p.hair === 'bob' || p.hair === 'curly') { R(3, 7, 2, 3, H); R(11, 7, 2, 3, H); }
                if (p.hair === 'long') { R(3, 7, 2, 3, H); R(11, 7, 2, 3, H); }
            }
            if (p.hair === 'spiky') {
                if (back) { R(4, 0, 1, 1, H); R(7, 0, 2, 1, H); R(11, 0, 1, 1, H); R(2, 3, 1, 2, H); R(13, 3, 1, 2, H); }
                else if (side) { R(6, 0, 1, 1, H); R(9, 0, 2, 1, H); R(13, 3, 1, 2, H); R(3, 3, 1, 1, H); }
                else { R(4, 0, 1, 1, H); R(7, 0, 2, 1, H); R(11, 0, 1, 1, H); R(2, 3, 1, 2, H); R(13, 3, 1, 2, H); }
            }
            if (p.hair === 'curly') {
                const d = hrL;
                if (!back) { R(4, 2, 1, 1, d); R(8, 1, 1, 1, d); R(11, 2, 1, 1, d); }
                else { R(5, 4, 1, 1, d); R(9, 5, 1, 1, d); R(7, 7, 1, 1, d); }
            }
        }

        // beard and glasses
        if (p.acc === 'beard' && !back) {
            const B = p.hair === 'bald' ? p.hairColor : hr;
            if (side) { R(3, 8, 5, 2, B); R(4, 10, 3, 1, B); }
            else { R(4, 8, 8, 2, B); R(5, 10, 6, 1, B); R(6, 11, 4, 1, B); R(7, 8, 2, 1, U.shade(B, -0.25)); }
        }
        if (p.acc === 'glasses' && !back) {
            if (side) R(3, 6, 3, 1, '#d8d8e0');
            else { R(4, 6, 3, 1, '#d8d8e0'); R(9, 6, 3, 1, '#d8d8e0'); R(7, 6, 2, 1, '#9a9aa8'); }
        }

        // headgear
        const hc = p.hc, hcD = U.shade(hc, -0.3), hcL = U.shade(hc, 0.25);
        switch (p.head) {
            case 'hood':
                if (back) { R(3, 1, 10, 10, hc); R(4, 1, 8, 1, hcL); R(3, 10, 10, 1, hcD); }
                else if (side) { R(4, 1, 9, 3, hc); R(8, 4, 5, 7, hc); R(4, 1, 8, 1, hcL); R(3, 3, 2, 6, hc); R(12, 4, 1, 7, hcD); }
                else { R(3, 1, 10, 4, hc); R(2, 3, 2, 8, hc); R(12, 3, 2, 8, hc); R(4, 1, 8, 1, hcL); R(4, 4, 8, 1, hcD); R(4, 9, 8, 2, hc); }
                break;
            case 'helmet':
                R(3, 1, 10, 4, hc); R(4, 0, 8, 1, hc); R(4, 0, 4, 1, hcL);
                if (!back) {
                    if (side) { R(2, 4, 4, 1, hcD); R(8, 4, 5, 4, hc); }
                    else { R(3, 4, 10, 1, hcD); R(2, 3, 1, 5, hc); R(13, 3, 1, 5, hc); R(7, 1, 2, 3, hcL); }
                } else { R(3, 5, 10, 4, hc); R(3, 8, 10, 1, hcD); }
                break;
            case 'wizard':
                R(1, 4, 14, 1, hc); R(2, 5, 12, 1, hcD);
                R(4, 2, 8, 2, hc); R(5, 1, 6, 1, hc); R(6, 0, 4, 1, hc);
                R(10, 0, 3, 1, hc); R(12, 1, 1, 1, hcD);
                R(4, 3, 8, 1, p.c2 || hcL);
                break;
            case 'bandana':
                R(3, 3, 10, 2, hc); R(3, 4, 10, 1, hcD);
                if (back || side) { R(back ? 7 : 12, 5, 2, 3, hc); }
                break;
            case 'crown':
                R(4, 0, 8, 3, hc); R(4, 0, 1, 1, '#00000000'); R(5, 0, 1, 1, U.shade(hc, 0.4)); R(7, 0, 2, 1, U.shade(hc, 0.4)); R(10, 0, 1, 1, U.shade(hc, 0.4));
                R(4, 2, 8, 1, hcD); if (!back) R(7, 1, 2, 1, '#ff3a5a');
                break;
            case 'tiara':
                R(4, 2, 8, 1, hc); R(7, 1, 2, 1, hc); if (!back) R(7, 1, 2, 1, '#5ad0ff');
                break;
            case 'plume':
                R(2, 3, 12, 1, hc); R(4, 1, 8, 2, hc); R(4, 1, 8, 1, hcL);
                R(11, 0, 2, 1, '#ffffff'); R(12, 1, 2, 1, '#e8e8f0'); R(13, 2, 1, 1, '#e8e8f0');
                break;
            case 'straw':
                R(1, 4, 14, 1, hc); R(2, 5, 12, 1, hcD); R(4, 1, 8, 3, hc); R(4, 1, 8, 1, hcL); R(4, 3, 8, 1, '#c83a3a');
                break;
        }
    }

    function critter(g, p, dir, fr) {
        const { R } = mk(g);
        const c1 = p.c1, c1D = U.shade(c1, -0.3), c1L = U.shade(c1, 0.25), c2 = p.c2;
        const step = fr === 0 ? -1 : fr === 2 ? 1 : 0;
        const side = dir === 4, back = dir === 8;
        const eye = p.eyes === 'glow' ? '#ffe066' : '#1a1218';
        if (p.body === 'cat') {
            if (side) {
                R(3, 12, 10, 4, c1); R(3, 12, 10, 1, c1L); R(12, 9, 2, 4, c1); R(13, 7, 1, 3, c1);
                R(2, 8, 6, 5, c1); R(2, 7, 1, 1, c1); R(6, 7, 1, 1, c1); R(3, 10, 1, 1, eye); R(2, 11, 1, 1, '#ff8a9a');
                R(4 + step, 16, 1, 2, c1D); R(10 - step, 16, 1, 2, c1D); R(7, 16, 1, 2, c1D);
                R(4, 13, 6, 2, c2);
            } else {
                R(4, 9, 8, 6, c1); R(3, 7, 2, 2, c1); R(11, 7, 2, 2, c1); R(4, 9, 8, 1, c1L);
                R(5, 15, 2, 2 + (step < 0 ? 0 : 1), c1D); R(9, 15, 2, 2 + (step > 0 ? 0 : 1), c1D);
                if (!back) { R(5, 11, 1, 1, eye); R(10, 11, 1, 1, eye); R(7, 12, 2, 1, '#ff8a9a'); R(6, 13, 4, 2, c2); }
                else { R(7, 14, 2, 1, c1D); R(8, 15, 1, 3, c1); R(9, 17, 2, 1, c1); }
            }
            return;
        }
        if (p.body === 'slime') {
            const sq = fr === 1 ? 0 : 1;
            R(3, 9 + sq, 10, 9 - sq, c1); R(4, 8 + sq, 8, 1, c1); R(5, 7 + sq, 6, 1, c1); R(2, 12, 12, 6, c1);
            R(4, 9 + sq, 3, 2, c1L); R(5, 8 + sq, 1, 1, '#ffffff'); R(2, 17, 12, 1, c1D);
            if (!back) {
                const ex = side ? -2 : 0;
                R(6 + ex, 12, 1, 2, eye); R(9 + ex, 12, 1, 2, eye); R(7 + ex, 15, 2, 1, U.shade(c1, -0.45));
            }
            return;
        }
        if (p.body === 'ghost') {
            const fl = fr === 1 ? 0 : (fr === 0 ? -1 : 1);
            const y0 = 3 + fl;
            R(4, y0, 8, 1, c1); R(3, y0 + 1, 10, 11, c1); R(3, y0 + 1, 2, 11, c1L); R(12, y0 + 1, 1, 11, p.c2);
            for (let x = 3; x < 13; x += 2) R(x, y0 + 12, 1, 2, c1);
            if (!back) {
                const ex = side ? -2 : 0;
                R(5 + ex, y0 + 4, 2, 2, '#1a1218'); R(9 + ex, y0 + 4, 2, 2, '#1a1218'); R(7 + ex, y0 + 8, 2, 2, '#1a1218');
            }
            return;
        }
        if (p.body === 'robot') {
            R(7, 0, 2, 2, '#6a6a7a'); R(7, 0, 1, 1, p.c2);
            R(3, 2, 10, 7, c1); R(3, 2, 10, 1, c1L); R(3, 8, 10, 1, c1D);
            if (!back) { if (side) R(3, 4, 4, 3, '#1a1a24'), R(4, 5, 2, 1, p.c2); else { R(4, 4, 8, 3, '#1a1a24'); R(5, 5, 2, 1, p.c2); R(9, 5, 2, 1, p.c2); } }
            R(4, 10, 8, 5, c1); R(4, 10, 8, 1, c1L); R(6, 11, 4, 2, U.shade(c1, -0.2)); if (!back) R(7, 12, 2, 1, p.c2);
            R(2, 10, 2, 4, c1D); R(12, 10, 2, 4, c1D);
            R(5, 15, 2, 3 - (step < 0 ? 1 : 0), '#5a5a6a'); R(9, 15, 2, 3 - (step > 0 ? 1 : 0), '#5a5a6a');
            R(4, 18, 3, 1, '#2a2a34'); R(9, 18, 3, 1, '#2a2a34');
        }
    }

    function drawFrame(g, parts, dir, fr) {
        if (parts.body && parts.body !== 'human') critter(g, parts, dir, fr);
        else human(g, parts, dir, fr);
    }

    // ── sheets ───────────────────────────────────────────────────────────────
    const sheetCache = new Map();
    let custom = {};              // Forge sprites from the open project, by id

    function setCustom(list) {
        const next = {};
        for (const s of list || []) if (s && s.id) next[s.id] = s;
        // drop cached sheets for Forge sprites that changed
        for (const id of Object.keys(custom)) sheetCache.delete(id);
        for (const id of Object.keys(next)) sheetCache.delete(id);
        custom = next;
    }

    function partsOf(id) {
        if (id && typeof id === 'object') return P(id);
        if (custom[id]) return P(custom[id].parts);
        if (PRESETS[id]) return PRESETS[id].parts;
        return null;
    }

    /** 48×80 sheet: columns are walk frames 0..2, rows are facings down, left, right, up. */
    function sheet(id) {
        const key = typeof id === 'object' ? JSON.stringify(id) : id;
        let c = sheetCache.get(key);
        if (c) return c;
        const parts = partsOf(id) || PRESETS.villager.parts;
        c = U.canvas(CW * 3, CH * 4);
        const g = U.ctx(c);
        for (let fr = 0; fr < 3; fr++) {
            for (const dir of [2, 4, 8]) {
                const t = U.canvas(CW, CH), tg = U.ctx(t);
                drawFrame(tg, parts, dir, fr);
                TW.outline(t, '#120c14');
                g.drawImage(t, fr * CW, DIR_ROW[dir] * CH);
                if (dir === 4) {
                    g.save(); g.translate(fr * CW + CW, DIR_ROW[6] * CH); g.scale(-1, 1);
                    g.drawImage(t, 0, 0); g.restore();
                }
            }
        }
        sheetCache.set(key, c);
        return c;
    }

    /** Draw one frame of a character at pixel (x, y) = top-left of its 16×20 box. */
    function drawChar(g, id, dir, fr, x, y) {
        const s = sheet(id);
        g.drawImage(s, (fr | 0) * CW, (DIR_ROW[dir] || 0) * CH, CW, CH, Math.round(x), Math.round(y), CW, CH);
    }

    /** A face: the head of the down-facing standing frame, 12×12. */
    function face(id) {
        const key = 'face:' + (typeof id === 'object' ? JSON.stringify(id) : id);
        let c = sheetCache.get(key);
        if (c) return c;
        c = U.canvas(14, 13);
        const g = U.ctx(c);
        g.drawImage(sheet(id), CW + 1, 0, 14, 13, 0, 0, 14, 13);
        sheetCache.set(key, c);
        return c;
    }

    function allSprites() {
        const list = Object.keys(PRESETS).map((id) => ({ id, name: PRESETS[id].name, preset: true, body: PRESETS[id].parts.body }));
        for (const id of Object.keys(custom)) list.push({ id, name: custom[id].name || id, preset: false, body: custom[id].parts && custom[id].parts.body });
        return list;
    }
    function spriteName(id) {
        if (custom[id]) return custom[id].name || id;
        return PRESETS[id] ? PRESETS[id].name : String(id || '');
    }

    // ── map objects (16×16, drawn standing on their tile) ────────────────────
    const OBJECTS = {
        chest:      { name: 'Chest', f: 1 },
        chest_open: { name: 'Chest (open)', f: 1 },
        bigchest:   { name: 'Royal Chest', f: 1 },
        bigchest_open: { name: 'Royal Chest (open)', f: 1 },
        door:       { name: 'Door', f: 1 },
        door_open:  { name: 'Door (open)', f: 1 },
        gate:       { name: 'Iron Gate', f: 1 },
        sign:       { name: 'Sign', f: 1 },
        crystal:    { name: 'Save Crystal', f: 4 },
        spring:     { name: 'Healing Spring', f: 4 },
        orb:        { name: 'Orb', f: 4 },
        star:       { name: 'Sparkle', f: 4 },
        lever:      { name: 'Lever (off)', f: 1 },
        lever_on:   { name: 'Lever (on)', f: 1 },
        plate:      { name: 'Pressure Plate', f: 1 },
        campfire:   { name: 'Campfire', f: 3 },
        lantern:    { name: 'Lantern (unlit)', f: 1 },
        lantern_lit: { name: 'Lantern (lit)', f: 3 },
        barrel:     { name: 'Barrel', f: 1 },
        pot:        { name: 'Pot', f: 1 },
        statue:     { name: 'Statue', f: 1 },
        grave:      { name: 'Grave', f: 1 },
        book:       { name: 'Book', f: 1 },
        scroll:     { name: 'Scroll', f: 1 },
        key:        { name: 'Key', f: 4 },
        boulder:    { name: 'Boulder', f: 1 },
        portal:     { name: 'Portal', f: 4 },
        wisp:       { name: 'Wisp', f: 4 },
        bed:        { name: 'Bed', f: 1 },
    };
    const objCache = new Map();

    function drawObject(id, fr) {
        const def = OBJECTS[id] || OBJECTS.chest;
        const f = (fr | 0) % def.f;
        const key = id + ':' + f;
        let c = objCache.get(key);
        if (c) return c;
        c = U.canvas(16, 16);
        const g = U.ctx(c);
        const d = TW.tiles.kit(g, U.strSeed(id));
        const PT = TW.tiles.PT;
        const R = d.R;
        switch (id) {
            case 'chest': PT.chest(d, 0, ['#a0602a', '#5a3010']); break;
            case 'chest_open':
                R(2, 8, 12, 7, '#a0602a'); R(2, 3, 12, 4, '#7a4a20'); R(3, 7, 10, 2, '#2a1408'); R(2, 8, 1, 7, '#5a3010'); R(13, 8, 1, 7, '#5a3010'); R(2, 11, 12, 1, '#5a3010');
                break;
            case 'bigchest': PT.chest(d, 0, ['#3a5ac8', '#e0b040']); R(2, 4, 12, 1, '#e0b040'); break;
            case 'bigchest_open':
                R(2, 8, 12, 7, '#3a5ac8'); R(2, 3, 12, 4, '#2a4aa8'); R(3, 7, 10, 2, '#0a0a24'); R(2, 8, 12, 1, '#e0b040'); R(2, 14, 12, 1, '#e0b040');
                break;
            case 'door': R(2, 0, 12, 16, '#5a3a1a'); R(3, 1, 10, 15, '#8a5a30'); R(8, 1, 1, 15, '#5a3a1a'); R(3, 6, 10, 1, '#5a3a1a'); R(11, 9, 1, 1, '#ffd75a'); break;
            case 'door_open': R(2, 0, 12, 16, '#5a3a1a'); R(3, 1, 10, 15, '#120a06'); R(3, 1, 2, 15, '#8a5a30'); break;
            case 'gate': for (let x = 2; x < 15; x += 3) R(x, 0, 2, 16, '#4a4a58'); R(1, 2, 14, 2, '#6a6a7a'); R(1, 11, 14, 2, '#6a6a7a'); break;
            case 'sign': PT.sign(d, 0, ['#c8a070', '#6e4826']); break;
            case 'crystal': {
                const glow = ['#5ad0ff', '#8ae0ff', '#bff0ff', '#8ae0ff'][f];
                g.globalAlpha = 0.25; d.disc(8, 8, 7, glow); g.globalAlpha = 1;
                R(6, 2 + (f % 2), 4, 10, glow); R(7, 1 + (f % 2), 2, 1, glow); R(5, 5 + (f % 2), 1, 5, '#3a9ad0'); R(10, 5 + (f % 2), 1, 5, '#3a9ad0'); R(7, 3 + (f % 2), 1, 6, '#ffffff');
                R(4, 13, 8, 3, '#7a7a8a'); R(4, 13, 8, 1, '#a8a8b8');
                break;
            }
            case 'spring':
                d.ell(8, 10, 7, 5, '#8a8a9a'); d.ell(8, 10, 6, 4, '#5ad0ff'); d.ell(8, 9, 4, 2, '#a8f0ff');
                R(4 + f, 8, 1, 1, '#ffffff'); R(11 - f, 11, 1, 1, '#ffffff'); R(7, 4 - (f % 2), 1, 2, '#c8ffff'); R(10, 5 + (f % 2), 1, 1, '#c8ffff');
                break;
            case 'orb': g.globalAlpha = 0.3; d.disc(8, 8, 6, '#c05aff'); g.globalAlpha = 1; d.disc(8, 8, 4, '#a03ae0'); d.disc(7, 7, 2, '#e0b0ff'); R(6, 6 + (f % 2), 1, 1, '#ffffff'); break;
            case 'star': {
                const s = [1, 2, 3, 2][f];
                R(8 - s, 8, s * 2 + 1, 1, '#ffffa0'); R(8, 8 - s, 1, s * 2 + 1, '#ffffa0'); R(8, 8, 1, 1, '#ffffff');
                if (f === 2) { R(5, 5, 1, 1, '#fff'); R(11, 11, 1, 1, '#fff'); }
                break;
            }
            case 'lever': R(3, 12, 10, 3, '#5a5a6a'); d.line(8, 12, 4, 5, '#8a6a40'); d.disc(4, 5, 1, '#c83a3a'); break;
            case 'lever_on': R(3, 12, 10, 3, '#5a5a6a'); d.line(8, 12, 12, 5, '#8a6a40'); d.disc(12, 5, 1, '#3ac85a'); break;
            case 'plate': R(2, 6, 12, 8, '#6a6a7a'); R(3, 7, 10, 6, '#8a8a9a'); R(3, 7, 10, 1, '#a8a8b8'); break;
            case 'campfire': PT.campfire(d, f, []); break;
            case 'lantern': R(6, 2, 4, 1, '#3a3a44'); R(5, 3, 6, 9, '#3a3a44'); R(6, 4, 4, 7, '#5a5a64'); R(4, 12, 8, 2, '#3a3a44'); break;
            case 'lantern_lit': {
                g.globalAlpha = 0.25; d.disc(8, 8, 7, '#ffd040'); g.globalAlpha = 1;
                R(6, 2, 4, 1, '#3a3a44'); R(5, 3, 6, 9, '#3a3a44'); R(6, 4, 4, 7, ['#ffd040', '#ffe880', '#ffc020'][f]); R(7, 6, 2, 3, '#ffffff'); R(4, 12, 8, 2, '#3a3a44');
                break;
            }
            case 'barrel': PT.barrel(d, 0, ['#a06a3a', '#5a5a64']); break;
            case 'pot': PT.pot(d, 0, ['#c8784a', '#8a4a2a']); break;
            case 'statue': PT.statue(d, 0, ['#a8a8b4', '#6a6a78', '#d4d4e0']); break;
            case 'grave': PT.grave(d, 0, ['#8a8a94', '#5a5a64', '#a8a8b0']); break;
            case 'book': R(3, 6, 10, 7, '#8a2a2a'); R(4, 6, 8, 6, '#f0e8d0'); R(8, 6, 1, 7, '#8a2a2a'); R(5, 8, 2, 1, '#888'); R(9, 8, 2, 1, '#888'); break;
            case 'scroll': R(3, 5, 10, 7, '#f0e0b0'); R(2, 4, 2, 9, '#c8a070'); R(12, 4, 2, 9, '#c8a070'); R(5, 7, 6, 1, '#8a6a40'); R(5, 9, 5, 1, '#8a6a40'); break;
            case 'key': {
                const y = 8 + [0, -1, -1, 0][f];
                d.disc(5, y, 2, '#ffd040'); R(5, y, 1, 1, '#a0801a'); R(7, y, 6, 1, '#ffd040'); R(11, y + 1, 1, 2, '#ffd040'); R(9, y + 1, 1, 1, '#ffd040');
                if (f === 1) R(12, 4, 1, 1, '#ffffff');
                break;
            }
            case 'boulder': PT.boulder(d, 0, ['#8a8a94', '#5a5a64', '#b4b4be']); break;
            case 'portal': {
                const cols = ['#8a5aff', '#5a8aff', '#5ad0ff', '#5a8aff'];
                d.ell(8, 8, 6, 7, cols[f]); d.ell(8, 8, 4, 5, cols[(f + 1) % 4]); d.ell(8, 8, 2, 3, '#ffffff');
                break;
            }
            case 'wisp': {
                const y = 7 + [0, -1, 0, 1][f];
                g.globalAlpha = 0.35; d.disc(8, y, 5, '#9aff9a'); g.globalAlpha = 1; d.disc(8, y, 2, '#e0ffe0'); R(8, y + 3, 1, 3, '#9aff9a');
                break;
            }
            case 'bed': PT.bed(d, 0, ['#8a5a30', '#4a7ad0', '#ffffff']); break;
        }
        TW.outline(c, '#120c14');
        objCache.set(key, c);
        return c;
    }

    // ── monsters ─────────────────────────────────────────────────────────────
    const PALETTES = [
        ['#5ac85a', '#2a8a3a', '#e0ff8a'],   // 0 green
        ['#4a8ae8', '#2a4aa8', '#a8e0ff'],   // 1 blue
        ['#e84a4a', '#a02a2a', '#ffc04a'],   // 2 red
        ['#a05ae8', '#5a2aa0', '#ffa8ff'],   // 3 purple
        ['#e8c040', '#a8801a', '#fff8a8'],   // 4 gold
        ['#8a8a98', '#4a4a58', '#d8d8e8'],   // 5 stone
        ['#a8e8ff', '#5aa0d0', '#ffffff'],   // 6 ice
        ['#4a4048', '#1a141c', '#ff4a6a'],   // 7 shadow
    ];
    const FAMILIES = {
        slime:    { name: 'Slime', pal: 1 },
        bat:      { name: 'Bat', pal: 3 },
        wolf:     { name: 'Wolf', pal: 5 },
        goblin:   { name: 'Goblin', pal: 0 },
        eye:      { name: 'Evil Eye', pal: 2 },
        mushroom: { name: 'Myconid', pal: 2 },
        ghost:    { name: 'Spirit', pal: 6 },
        snake:    { name: 'Serpent', pal: 0 },
        imp:      { name: 'Imp', pal: 2 },
        plant:    { name: 'Mandrake', pal: 0 },
        drake:    { name: 'Drake', pal: 2, pack: 'monsters.dragonkin' },
        wyvern:   { name: 'Wyvern', pal: 1, pack: 'monsters.dragonkin' },
        dragon:   { name: 'Dragon', pal: 7, pack: 'monsters.dragonkin' },
        golem:    { name: 'Golem', pal: 5, pack: 'monsters.constructs' },
        sentinel: { name: 'Sentinel', pal: 4, pack: 'monsters.constructs' },
        mimic:    { name: 'Mimic', pal: 4, pack: 'monsters.constructs' },
        skeleton: { name: 'Skeleton', pal: 5, pack: 'monsters.undead' },
        wraith:   { name: 'Wraith', pal: 7, pack: 'monsters.undead' },
        lich:     { name: 'Lich', pal: 3, pack: 'monsters.undead' },
    };
    const SIZES = { S: 32, M: 48, L: 64 };
    const monCache = new Map();

    /** Battle sprite for { family, palette, size }, pixelised with shading and an outline. */
    function monster(look) {
        look = look || {};
        const fam = FAMILIES[look.family] ? look.family : 'slime';
        const palI = look.palette === undefined || look.palette === null || look.palette < 0 ? FAMILIES[fam].pal : look.palette % PALETTES.length;
        const size = SIZES[look.size] || 48;
        const key = fam + ':' + palI + ':' + size;
        let c = monCache.get(key);
        if (c) return c;
        c = U.canvas(size, size);
        const g = c.getContext('2d');
        const s = size / 48;
        const [m, k, a] = PALETTES[palI];
        const S = (v) => v * s;
        g.save();
        g.scale(s, s);
        const F = (col) => { g.fillStyle = col; };
        const ell = (x, y, rx, ry, col, rot) => { F(col); g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); g.fill(); };
        const poly = (pts, col) => { F(col); g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
        const rect = (x, y, w, h, col) => { F(col); g.fillRect(x, y, w, h); };
        const eyes = (x1, y1, x2, y2, r, col) => { ell(x1, y1, r, r, '#ffffff'); ell(x2, y2, r, r, '#ffffff'); ell(x1 + r * 0.25, y1, r * 0.5, r * 0.6, col || '#1a1218'); ell(x2 + r * 0.25, y2, r * 0.5, r * 0.6, col || '#1a1218'); };
        const wing = (x, y, dir, col) => poly([x, y, x + dir * 18, y - 12, x + dir * 22, y + 2, x + dir * 14, y + 2, x + dir * 12, y + 10, x + dir * 6, y + 6], col);
        switch (fam) {
            case 'slime':
                ell(24, 32, 18, 13, m); ell(24, 22, 12, 12, m); poly([24, 6, 30, 16, 18, 16], m);
                ell(18, 22, 4, 6, a); eyes(19, 28, 29, 28, 3.2); poly([20, 36, 28, 36, 24, 39], k);
                break;
            case 'bat':
                wing(20, 22, -1, k); wing(28, 22, 1, k); ell(24, 24, 9, 9, m); poly([17, 17, 19, 8, 22, 16], m); poly([31, 17, 29, 8, 26, 16], m);
                eyes(20, 23, 28, 23, 2.4, '#ff3a3a'); poly([21, 29, 23, 33, 24, 29], '#ffffff'); poly([24, 29, 25, 33, 27, 29], '#ffffff');
                break;
            case 'wolf':
                ell(26, 30, 15, 9, m); rect(13, 34, 4, 10, k); rect(21, 35, 4, 9, k); rect(30, 35, 4, 9, k); rect(37, 34, 4, 10, k);
                poly([39, 26, 47, 18, 44, 30], m); ell(13, 22, 9, 8, m); poly([6, 22, 0, 27, 8, 29], m); poly([9, 15, 11, 6, 15, 15], m); poly([15, 15, 19, 7, 19, 17], k);
                ell(12, 21, 1.8, 1.8, '#ffe066'); rect(1, 26, 2, 2, '#1a1218'); poly([3, 28, 5, 31, 7, 28], '#ffffff'); ell(26, 34, 10, 4, a);
                break;
            case 'goblin':
                rect(17, 36, 5, 10, k); rect(26, 36, 5, 10, k); ell(24, 30, 10, 10, a); rect(15, 27, 18, 10, m);
                ell(24, 17, 11, 10, m); poly([13, 14, 2, 10, 14, 20], m); poly([35, 14, 46, 10, 34, 20], m);
                eyes(19, 16, 29, 16, 2.6, '#ff3a3a'); poly([18, 22, 30, 22, 28, 25, 20, 25], '#1a1218'); rect(21, 22, 2, 2, '#ffffff'); rect(26, 22, 2, 2, '#ffffff');
                rect(36, 18, 3, 22, '#8a5a30'); ell(37, 18, 4, 4, '#8a5a30');
                break;
            case 'eye':
                for (let i = 0; i < 6; i++) { const an = Math.PI * 0.2 + i * 0.12 * Math.PI; poly([24, 30, 24 + Math.cos(an) * 22, 30 + Math.sin(an) * 18, 26 + Math.cos(an) * 20, 30 + Math.sin(an) * 20], k); }
                ell(24, 22, 16, 16, m); ell(24, 22, 11, 10, '#ffffff'); ell(24, 22, 6, 7, a); ell(24, 22, 3, 5, '#1a1218'); ell(21, 18, 2, 2, '#ffffff');
                break;
            case 'mushroom':
                rect(17, 26, 14, 16, '#f0e0c0'); rect(14, 42, 7, 4, k); rect(27, 42, 7, 4, k);
                ell(24, 20, 20, 13, m); ell(24, 26, 18, 4, k); ell(14, 15, 3, 3, '#ffffff'); ell(26, 11, 4, 3, '#ffffff'); ell(34, 18, 3, 3, '#ffffff');
                eyes(20, 33, 28, 33, 2.4); rect(22, 38, 4, 1.5, '#1a1218');
                break;
            case 'ghost':
                poly([10, 22, 12, 44, 17, 39, 22, 45, 27, 39, 32, 45, 37, 40, 38, 22], m); ell(24, 22, 14, 15, m); ell(18, 16, 4, 6, a);
                ell(19, 22, 3, 4, '#1a1218'); ell(29, 22, 3, 4, '#1a1218'); ell(24, 31, 3, 4, '#1a1218');
                poly([10, 28, 2, 24, 6, 32], m); poly([38, 28, 46, 24, 42, 32], m);
                break;
            case 'snake':
                ell(24, 40, 18, 6, k); ell(24, 37, 16, 6, m); ell(30, 30, 9, 8, m); ell(26, 22, 8, 8, m); ell(20, 14, 11, 8, m);
                ell(18, 17, 6, 3, a); eyes(15, 12, 23, 12, 2.4, '#ff3a3a'); poly([10, 18, 4, 21, 6, 17, 2, 18, 9, 16], '#ff3a5a');
                for (let i = 0; i < 4; i++) ell(18 + i * 5, 39, 1.5, 2, a);
                break;
            case 'imp':
                wing(18, 20, -1, k); wing(30, 20, 1, k); poly([30, 36, 44, 40, 42, 34, 46, 32], k);
                ell(24, 30, 9, 10, m); ell(24, 16, 10, 9, m); poly([16, 10, 12, 0, 20, 8], a); poly([32, 10, 36, 0, 28, 8], a);
                eyes(20, 15, 28, 15, 2.6, '#ffe066'); poly([19, 21, 29, 21, 24, 25], '#1a1218'); rect(19, 39, 4, 7, k); rect(26, 39, 4, 7, k);
                break;
            case 'plant':
                for (let i = 0; i < 5; i++) { const x = 10 + i * 7; poly([x, 46, x + 3, 30, x + 6, 46], k); }
                ell(24, 28, 12, 12, m); poly([24, 18, 14, 2, 22, 16], '#4ab05a'); poly([24, 18, 34, 2, 26, 16], '#4ab05a'); poly([24, 18, 24, 0, 27, 14], '#6ad07a');
                eyes(19, 27, 29, 27, 2.6, '#ff3a3a'); poly([18, 33, 30, 33, 24, 38], '#1a1218'); rect(21, 33, 2, 2, '#ffffff'); rect(26, 33, 2, 2, '#ffffff');
                break;
            case 'drake':
                wing(20, 20, -1, k); poly([30, 34, 46, 44, 40, 34], m);
                ell(26, 30, 12, 10, m); ell(26, 34, 8, 5, a); rect(18, 36, 5, 9, k); rect(28, 36, 5, 9, k);
                ell(14, 16, 9, 7, m); poly([6, 16, 0, 20, 7, 22], m); poly([12, 10, 14, 2, 17, 10], a); eyes(12, 14, 18, 14, 2.2, '#ffe066'); rect(1, 19, 4, 1.5, '#1a1218');
                break;
            case 'wyvern':
                wing(18, 18, -1, k); wing(30, 18, 1, k); poly([24, 30, 30, 46, 22, 40, 18, 46], m);
                ell(24, 26, 9, 11, m); ell(24, 30, 5, 6, a); ell(24, 12, 7, 6, m); poly([20, 8, 16, 0, 22, 6], a); poly([28, 8, 32, 0, 26, 6], a);
                eyes(21, 12, 27, 12, 2, '#ff3a3a'); poly([21, 16, 27, 16, 24, 19], '#1a1218');
                break;
            case 'dragon':
                wing(16, 14, -1, k); wing(32, 14, 1, k); poly([30, 38, 47, 46, 46, 40], m);
                ell(24, 32, 14, 12, m); ell(24, 36, 9, 7, a); rect(14, 38, 6, 9, k); rect(28, 38, 6, 9, k);
                ell(24, 15, 10, 9, m); poly([16, 10, 10, 0, 20, 7], a); poly([32, 10, 38, 0, 28, 7], a); ell(24, 21, 7, 4, U.shade(m, -0.15));
                eyes(19, 13, 29, 13, 2.6, '#ffe066'); rect(20, 21, 2, 2, '#1a1218'); rect(26, 21, 2, 2, '#1a1218');
                for (let i = 0; i < 4; i++) poly([18 + i * 4, 27, 20 + i * 4, 30, 22 + i * 4, 27], '#ffffff');
                break;
            case 'golem':
                rect(10, 18, 28, 20, m); rect(4, 20, 8, 18, k); rect(36, 20, 8, 18, k); rect(4, 36, 9, 8, m); rect(35, 36, 9, 8, m);
                rect(14, 38, 8, 9, k); rect(26, 38, 8, 9, k); rect(16, 4, 16, 14, m); rect(16, 4, 16, 3, a);
                rect(19, 10, 3, 3, '#5ad0ff'); rect(26, 10, 3, 3, '#5ad0ff'); rect(14, 26, 20, 2, k); rect(23, 20, 2, 18, k); ell(24, 30, 3, 3, '#5ad0ff');
                break;
            case 'sentinel':
                poly([24, 2, 36, 14, 24, 26, 12, 14], m); poly([24, 6, 31, 14, 24, 22, 17, 14], a); ell(24, 14, 3, 3, '#ff3a3a');
                rect(18, 26, 12, 14, k); rect(10, 30, 8, 4, m); rect(30, 30, 8, 4, m); poly([16, 40, 32, 40, 28, 47, 20, 47], m);
                ell(6, 32, 4, 4, a); ell(42, 32, 4, 4, a);
                break;
            case 'mimic':
                rect(6, 24, 36, 20, '#a0602a'); rect(6, 24, 36, 3, m); rect(6, 41, 36, 3, m); rect(21, 24, 6, 8, m);
                poly([6, 24, 42, 24, 40, 6, 8, 6], '#7a4a20'); rect(8, 6, 32, 3, m);
                for (let i = 0; i < 7; i++) { poly([9 + i * 5, 24, 11 + i * 5, 18, 13 + i * 5, 24], '#ffffff'); poly([9 + i * 5, 24, 11 + i * 5, 29, 13 + i * 5, 24], '#ffffff'); }
                ell(24, 22, 10, 2, '#a02a3a'); eyes(17, 14, 31, 14, 2.6, '#ff3a3a');
                break;
            case 'skeleton':
                rect(22, 18, 4, 18, '#e8e0c8'); for (let i = 0; i < 4; i++) rect(16, 21 + i * 4, 16, 2, '#e8e0c8');
                rect(12, 20, 3, 14, '#e8e0c8'); rect(33, 20, 3, 14, '#e8e0c8'); rect(18, 36, 3, 11, '#e8e0c8'); rect(27, 36, 3, 11, '#e8e0c8'); rect(16, 34, 16, 3, '#e8e0c8');
                ell(24, 10, 9, 9, '#f0e8d0'); ell(20, 10, 2.6, 3, '#1a1218'); ell(28, 10, 2.6, 3, '#1a1218'); rect(20, 16, 8, 3, '#f0e8d0'); rect(22, 16, 1, 3, '#1a1218'); rect(25, 16, 1, 3, '#1a1218');
                rect(36, 8, 3, 28, m); rect(33, 12, 9, 3, k); ell(20, 10, 1, 1, '#ff4a4a');
                break;
            case 'wraith':
                poly([8, 14, 24, 2, 40, 14, 44, 46, 34, 38, 28, 47, 20, 38, 12, 46, 4, 40], m); poly([14, 16, 24, 8, 34, 16, 34, 28, 14, 28], '#05040a');
                ell(19, 20, 2.4, 2, a); ell(29, 20, 2.4, 2, a); poly([4, 26, 0, 40, 10, 34], k); poly([44, 26, 48, 40, 38, 34], k);
                break;
            case 'lich':
                poly([12, 18, 36, 18, 42, 47, 6, 47], m); rect(21, 18, 6, 29, a); ell(24, 12, 8, 8, '#e8e0c8'); ell(21, 12, 2, 2.4, '#ff3a3a'); ell(27, 12, 2, 2.4, '#ff3a3a');
                poly([14, 6, 18, 0, 20, 6, 24, 0, 28, 6, 30, 0, 34, 6, 32, 9, 16, 9], '#e8c040');
                rect(40, 4, 3, 42, '#6a4a2a'); ell(41, 6, 4, 4, '#5ad0ff'); rect(8, 22, 6, 10, k); rect(34, 22, 6, 10, k);
                break;
        }
        g.restore();
        pixelise(c);
        monCache.set(key, c);
        return c;
    }

    /** Snap alpha, shade by neighbour (top-lit), and outline: canvas paths become pixel art. */
    function pixelise(c, outlineCol) {
        const g = c.getContext('2d');
        if (!g.getImageData) return;
        const w = c.width, h = c.height;
        const img = g.getImageData(0, 0, w, h), a = img.data;
        if (!a || !a.length) return;
        const op = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) op[i] = a[i * 4 + 3] >= 110 ? 1 : 0;
        const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : op[y * w + x]);
        const out = new Uint8ClampedArray(a.length);
        const [or, og, ob] = U.hex2rgb(outlineCol || '#120c14');
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = y * w + x, j = i * 4;
            if (op[i]) {
                let r = a[j], gg = a[j + 1], b = a[j + 2];
                const al = a[j + 3] / 255;
                if (al < 1) { r /= al; gg /= al; b /= al; }
                let f = 1;
                if (!at(x, y - 1) || !at(x - 1, y)) f = 1.18;
                else if (!at(x, y + 1) || !at(x + 1, y)) f = 0.72;
                out[j] = r * f; out[j + 1] = gg * f; out[j + 2] = b * f; out[j + 3] = 255;
            } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
                out[j] = or; out[j + 1] = og; out[j + 2] = ob; out[j + 3] = 255;
            }
        }
        img.data.set(out);
        g.putImageData(img, 0, 0);
    }

    // ── item icons (12×12) ───────────────────────────────────────────────────
    const ICONS = ['potion', 'ether', 'elixir', 'herb', 'bread', 'key', 'gem', 'coin', 'scroll', 'book', 'sword', 'axe', 'spear', 'bow', 'staff', 'dagger',
        'shield', 'helmet', 'armor', 'robe', 'ring', 'amulet', 'boots', 'feather', 'bomb', 'crystal', 'map', 'letter', 'lantern', 'flower', 'bone', 'star'];
    const iconCache = new Map();

    function icon(name) {
        let c = iconCache.get(name);
        if (c) return c;
        c = U.canvas(12, 12);
        const g = U.ctx(c);
        const d = TW.tiles.kit(g, 1);
        const R = d.R;
        const steel = '#d8e0ec', steelD = '#8a94a8', gold = '#e8c040', wood = '#8a5a30';
        switch (name) {
            case 'potion': case 'ether': case 'elixir': {
                const col = name === 'potion' ? '#e83a5a' : name === 'ether' ? '#3a8ae8' : '#e8c040';
                R(5, 1, 2, 1, '#c8a070'); R(5, 2, 2, 2, '#d8e8f0'); d.disc(6, 7, 3, '#d8e8f0'); d.disc(6, 7, 2, col); R(4, 6, 1, 1, '#ffffff');
                break;
            }
            case 'herb': d.line(6, 11, 6, 4, '#3a8a3a'); d.ell(4, 5, 2, 1, '#5ac85a'); d.ell(8, 4, 2, 1, '#5ac85a'); d.ell(5, 8, 2, 1, '#5ac85a'); d.ell(8, 7, 2, 1, '#6ad86a'); break;
            case 'bread': d.ell(6, 7, 5, 3, '#c88a40'); R(2, 6, 9, 1, '#e8b060'); R(4, 5, 1, 2, '#a86a2a'); R(7, 5, 1, 2, '#a86a2a'); break;
            case 'key': d.disc(3, 4, 2, gold); R(3, 4, 1, 1, '#a0801a'); d.line(4, 5, 10, 10, gold); R(8, 9, 1, 2, gold); R(9, 8, 2, 1, gold); break;
            case 'gem': R(3, 3, 6, 2, '#8ae0ff'); R(2, 5, 8, 1, '#5ab0e8'); d.line(2, 6, 6, 10, '#3a8ad0'); d.line(9, 6, 6, 10, '#3a8ad0'); R(4, 6, 4, 2, '#5ab0e8'); R(5, 8, 2, 1, '#3a8ad0'); R(4, 3, 1, 1, '#ffffff'); break;
            case 'coin': d.disc(6, 6, 4, gold); d.disc(6, 6, 2, '#ffe880'); R(6, 4, 1, 4, '#a0801a'); break;
            case 'scroll': R(2, 3, 8, 6, '#f0e0b0'); R(1, 2, 2, 8, '#c8a070'); R(9, 2, 2, 8, '#c8a070'); R(4, 5, 4, 1, '#8a6a40'); R(4, 7, 3, 1, '#8a6a40'); break;
            case 'book': R(2, 2, 8, 9, '#3a5ac8'); R(3, 2, 7, 8, '#4a6ae8'); R(2, 10, 8, 1, '#f0e8d0'); R(5, 4, 3, 2, gold); break;
            case 'sword': d.line(3, 9, 9, 2, steel); d.line(4, 9, 10, 2, steelD); R(2, 7, 4, 1, gold); R(4, 6, 1, 3, gold); R(1, 9, 2, 2, wood); break;
            case 'axe': d.line(3, 10, 8, 3, wood); d.ell(8, 4, 3, 2, steel); R(9, 2, 2, 4, steelD); break;
            case 'spear': d.line(2, 10, 9, 3, wood); R(8, 1, 3, 3, steel); R(9, 2, 1, 1, '#ffffff'); break;
            case 'bow': d.line(3, 1, 9, 6, wood); d.line(9, 6, 3, 11, wood); d.line(3, 1, 3, 11, '#f0f0f0'); break;
            case 'staff': d.line(3, 11, 7, 3, wood); d.disc(8, 2, 2, '#c05aff'); R(8, 1, 1, 1, '#ffffff'); break;
            case 'dagger': d.line(4, 8, 9, 3, steel); R(3, 7, 3, 1, gold); R(2, 8, 2, 2, wood); break;
            case 'shield': R(2, 1, 8, 6, '#3a5ac8'); d.ell(6, 7, 4, 4, '#3a5ac8'); R(5, 2, 2, 8, gold); R(3, 4, 6, 1, gold); R(2, 1, 8, 1, steel); break;
            case 'helmet': d.ell(6, 6, 5, 4, steel); R(1, 6, 10, 4, steel); R(3, 7, 6, 1, '#1a1218'); R(5, 2, 2, 6, steelD); break;
            case 'armor': R(2, 2, 8, 8, steel); R(1, 2, 2, 3, steelD); R(9, 2, 2, 3, steelD); R(4, 2, 4, 1, '#1a1218'); R(5, 3, 2, 6, steelD); break;
            case 'robe': R(3, 1, 6, 3, '#8a4ac8'); R(2, 4, 8, 7, '#8a4ac8'); R(5, 1, 2, 10, gold); R(2, 10, 8, 1, '#5a2aa0'); break;
            case 'ring': d.disc(6, 7, 3, gold); d.disc(6, 7, 1, '#00000000'); g.clearRect(5, 6, 3, 3); R(5, 2, 2, 2, '#ff3a5a'); break;
            case 'amulet': d.line(2, 1, 6, 6, gold); d.line(10, 1, 6, 6, gold); d.disc(6, 8, 2, '#3ae08a'); R(5, 7, 1, 1, '#ffffff'); break;
            case 'boots': R(2, 2, 3, 7, '#8a5a30'); R(7, 2, 3, 7, '#8a5a30'); R(1, 8, 5, 3, '#6a4020'); R(6, 8, 5, 3, '#6a4020'); break;
            case 'feather': d.line(2, 11, 9, 2, '#f0f0f0'); d.ell(7, 5, 2, 4, '#ffffff', 0); d.line(2, 11, 9, 2, '#c8c8d8'); break;
            case 'bomb': d.disc(6, 7, 4, '#2a2a34'); R(4, 5, 1, 1, '#8a8a9a'); R(6, 1, 1, 2, '#c8a070'); R(7, 0, 2, 1, '#ff8a1a'); break;
            case 'crystal': R(5, 1, 2, 10, '#c05aff'); R(4, 3, 4, 6, '#a03ae0'); R(5, 2, 1, 6, '#e0b0ff'); break;
            case 'map': R(1, 2, 10, 8, '#f0e0b0'); R(4, 2, 1, 8, '#c8a070'); R(7, 2, 1, 8, '#c8a070'); d.line(2, 8, 9, 4, '#c83a3a'); R(8, 4, 2, 1, '#c83a3a'); break;
            case 'letter': R(1, 3, 10, 7, '#f0f0f0'); d.line(1, 3, 6, 7, '#a8a8b8'); d.line(10, 3, 6, 7, '#a8a8b8'); R(5, 6, 2, 2, '#c83a3a'); break;
            case 'lantern': R(4, 1, 4, 1, '#3a3a44'); R(3, 2, 6, 7, '#3a3a44'); R(4, 3, 4, 5, '#ffd040'); R(5, 4, 2, 2, '#ffffff'); R(2, 9, 8, 2, '#3a3a44'); break;
            case 'flower': d.line(6, 11, 6, 6, '#3a8a3a'); d.disc(6, 4, 3, '#ff6aa0'); d.disc(6, 4, 1, '#ffe066'); break;
            case 'bone': d.line(3, 9, 9, 3, '#f0e8d0'); d.line(3, 8, 8, 3, '#f0e8d0'); R(1, 8, 3, 3, '#f0e8d0'); R(8, 1, 3, 3, '#f0e8d0'); break;
            case 'star': default:
                R(5, 1, 2, 10, '#ffe066'); R(1, 5, 10, 2, '#ffe066'); R(3, 3, 6, 6, '#ffe066'); R(5, 5, 2, 2, '#ffffff'); break;
        }
        TW.outline(c, '#120c14');
        iconCache.set(name, c);
        return c;
    }

    TW.sprites = {
        CW, CH, DIR_ROW, PARTS, PACKS, PRESETS, OBJECTS, FAMILIES, PALETTES, SIZES, ICONS,
        sheet, drawChar, face, setCustom, partsOf, allSprites, spriteName,
        object: drawObject, monster, icon, pixelise,
        clearCache: () => { sheetCache.clear(); objCache.clear(); monCache.clear(); iconCache.clear(); },
    };
}]);
