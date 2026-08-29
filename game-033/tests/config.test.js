import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    xpToNextLevel,
    enemyScaleForLevel,
    scaledEnemy,
    ITEM_DEFS,
    BREW_RECIPES,
    ENEMY_DEFS,
} from '../js/config.js';

describe('xpToNextLevel', () => {
    test('level 1 requires the base amount', () => {
        assert.equal(xpToNextLevel(1), 20);
    });

    test('increases linearly with level', () => {
        assert.equal(xpToNextLevel(2), 35);
        assert.equal(xpToNextLevel(5), 80);
    });
});

describe('enemyScaleForLevel (Phase 3 difficulty curve)', () => {
    test('level 1 applies no scaling', () => {
        const scale = enemyScaleForLevel(1);
        assert.equal(scale.hp, 1);
        assert.equal(scale.strength, 1);
        assert.equal(scale.xp, 1);
    });

    test('scaling grows monotonically with level', () => {
        const low = enemyScaleForLevel(2);
        const high = enemyScaleForLevel(10);
        assert.ok(high.hp > low.hp, 'hp scale should grow with level');
        assert.ok(high.strength > low.strength, 'strength scale should grow with level');
        assert.ok(high.xp > low.xp, 'xp scale should grow with level');
    });

    test('never scales below the base (level 0 or negative treated as level 1)', () => {
        const scale = enemyScaleForLevel(0);
        assert.equal(scale.hp, 1);
        assert.equal(scale.strength, 1);
        assert.equal(scale.xp, 1);
    });
});

describe('scaledEnemy', () => {
    test('returns null for an unknown enemy id', () => {
        assert.equal(scaledEnemy('nonexistent_enemy', 5), null);
    });

    test('level 1 returns (approximately) the base stats', () => {
        const base = ENEMY_DEFS.cellar_slime;
        const scaled = scaledEnemy('cellar_slime', 1);
        assert.equal(scaled.hp, base.hp);
        assert.equal(scaled.strength, base.strength);
        assert.equal(scaled.xp, base.xp);
        assert.equal(scaled.name, base.name);
    });

    test('higher level strictly increases hp and xp', () => {
        const low = scaledEnemy('hedge_wolf', 1);
        const high = scaledEnemy('hedge_wolf', 10);
        assert.ok(high.hp > low.hp);
        assert.ok(high.xp > low.xp);
    });

    test('strength scaling never drops below the base value', () => {
        // At low levels the multiplier could round down below base; the
        // implementation must clamp with Math.max(base, ...).
        const scaled = scaledEnemy('cellar_slime', 1);
        assert.ok(scaled.strength >= ENEMY_DEFS.cellar_slime.strength);
    });

    test('does not mutate the base ENEMY_DEFS entry', () => {
        const beforeHp = ENEMY_DEFS.hedge_wolf.hp;
        scaledEnemy('hedge_wolf', 15);
        assert.equal(ENEMY_DEFS.hedge_wolf.hp, beforeHp);
    });
});

describe('Phase 3 equip trade-off items', () => {
    test('charm-slot items declare both a bonus and a penalty', () => {
        const charmItems = Object.values(ITEM_DEFS).filter(i => i.slot === 'charm');
        assert.ok(charmItems.length >= 2, 'expected at least 2 charm-slot trade-off items');
        for (const item of charmItems) {
            assert.ok(item.bonus && Object.keys(item.bonus).length > 0, `${item.name} should have a bonus`);
            assert.ok(item.penalty && Object.keys(item.penalty).length > 0, `${item.name} should have a penalty`);
        }
    });

    test('trinket-slot items remain flat bonuses (no penalty), preserving Phase 1/2 behavior', () => {
        const trinketItems = Object.values(ITEM_DEFS).filter(i => i.type === 'equip' && (i.slot || 'trinket') === 'trinket');
        for (const item of trinketItems) {
            assert.equal(item.penalty, undefined, `${item.name} should not have a penalty`);
        }
    });
});

describe('BREW_RECIPES', () => {
    test('every recipe result and requirement references a real item', () => {
        for (const [id, recipe] of Object.entries(BREW_RECIPES)) {
            assert.ok(ITEM_DEFS[recipe.result.item], `recipe ${id} result item "${recipe.result.item}" must exist`);
            for (const req of recipe.requires) {
                assert.ok(ITEM_DEFS[req.item], `recipe ${id} requires unknown item "${req.item}"`);
                assert.ok(req.count > 0, `recipe ${id} requirement count must be positive`);
            }
        }
    });

    test('every recipe requires at least one material', () => {
        for (const [id, recipe] of Object.entries(BREW_RECIPES)) {
            assert.ok(recipe.requires.length > 0, `recipe ${id} must require at least one item`);
        }
    });
});
