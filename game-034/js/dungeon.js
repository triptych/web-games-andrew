import { FLOOR_SCALING, ROOM_TYPES, GOLD_BASE_PER_ROOM } from './config.js';
import { spawnMonsterGroup } from './monsters.js';

/** Weighted-random pick among ROOM_TYPES (excluding forced combat rooms). */
function pickRoomType() {
    const entries = Object.entries(ROOM_TYPES);
    const total = entries.reduce((s, [, def]) => s + def.weight, 0);
    let r = Math.random() * total;
    for (const [key, def] of entries) {
        if (r < def.weight) return key;
        r -= def.weight;
    }
    return 'combat';
}

/** Generate the room sequence for a floor. Room 0 is never a rest room (avoid do-nothing openers). */
export function generateFloor(floorNum) {
    const isBossFloor = floorNum % FLOOR_SCALING.bossEveryNFloors === 0;
    const roomCount = Math.min(
        FLOOR_SCALING.roomsPerFloorMax,
        FLOOR_SCALING.roomsPerFloorBase + Math.floor(floorNum / 4)
    );

    const rooms = [];
    for (let i = 0; i < roomCount; i++) {
        const isLastRoom = i === roomCount - 1;
        const type = (isLastRoom && isBossFloor) ? 'combat' : (i === 0 ? 'combat' : pickRoomType());
        rooms.push(makeRoom(floorNum, type, isLastRoom && isBossFloor));
    }
    return { floorNum, rooms, isBossFloor };
}

function makeRoom(floorNum, type, isBossRoom) {
    const goldBase = Math.round(
        GOLD_BASE_PER_ROOM * Math.pow(1 + FLOOR_SCALING.goldGrowthPerFloor, floorNum - 1)
    );

    if (type === 'treasure') {
        return {
            type: 'treasure',
            gold: Math.round(goldBase * ROOM_TYPES.treasure.goldMul),
            isBossRoom: false,
        };
    }
    if (type === 'rest') {
        return {
            type: 'rest',
            healPct: ROOM_TYPES.rest.healPct,
            isBossRoom: false,
        };
    }
    return {
        type: 'combat',
        monsters: spawnMonsterGroup(floorNum, isBossRoom),
        goldPerMonster: goldBase,
        isBossRoom,
    };
}
