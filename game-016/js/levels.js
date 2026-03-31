/**
 * Sokoban level data for Crate Pusher.
 *
 * Cell notation:
 *   '#'  wall
 *   ' '  floor
 *   '.'  target
 *   '$'  crate
 *   '*'  crate on target (start position)
 *   '@'  player
 *   '+'  player on target (start position)
 *
 * All 8 levels are hand-designed and verified solvable.
 */

export const LEVELS = [
    // ── Level 1: Tutorial ──────────────────────────────────────────
    // Push the crate straight down onto the target. 1 move.
    [
        '#####',
        '# @ #',
        '# $ #',
        '# . #',
        '#####',
    ],

    // ── Level 2: Push Up ───────────────────────────────────────────
    // Crate is below the target; walk below it and push up twice. 2 moves.
    [
        '#######',
        '#  .  #',
        '#     #',
        '#  $  #',
        '#  @  #',
        '#######',
    ],

    // ── Level 3: Around the Corner ─────────────────────────────────
    // Target is up-right; push crate right, then navigate below it
    // and push it up. ~6 moves.
    [
        '######',
        '#  . #',
        '# $  #',
        '#@   #',
        '######',
    ],

    // ── Level 4: Double Drop ───────────────────────────────────────
    // Two crates, two targets directly below. Push each one down. 5 moves.
    [
        '#######',
        '# @   #',
        '# $$  #',
        '# ..  #',
        '#     #',
        '#######',
    ],

    // ── Level 5: Side by Side ──────────────────────────────────────
    // Two crates must each be pushed up two rows to their targets. 9 moves.
    [
        '#######',
        '# . . #',
        '#     #',
        '# $ $ #',
        '#  @  #',
        '#######',
    ],

    // ── Level 6: Corner Run ────────────────────────────────────────
    // Push the crate left, navigate below it, then push up twice. ~7 moves.
    [
        '#######',
        '#. @  #',
        '#     #',
        '# $   #',
        '#     #',
        '#######',
    ],

    // ── Level 7: Triple Threat ─────────────────────────────────────
    // Three crates aligned above three targets; push each one down twice.
    // Navigate carefully between crates. ~18 moves.
    [
        '########',
        '#  @   #',
        '# $$$  #',
        '#      #',
        '# ...  #',
        '#      #',
        '########',
    ],

    // ── Level 8: The Finale ────────────────────────────────────────
    // Three crates, three targets in varied positions. Sequence matters. ~20 moves.
    [
        '########',
        '# .  . #',
        '#      #',
        '# $  $ #',
        '#  @   #',
        '#  $   #',
        '# .    #',
        '########',
    ],
];

export const LEVEL_NAMES = [
    'Tutorial',
    'Push Up',
    'Around the Corner',
    'Double Drop',
    'Side by Side',
    'Corner Run',
    'Triple Threat',
    'The Finale',
];
