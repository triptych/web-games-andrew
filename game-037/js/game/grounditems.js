// ============================================================
// game/grounditems.js - what is lying on the floor
// Shared by actions.js, verbs.js and the renderer, because "the ground" is
// two different arrays depending on which map you are standing on.
// ============================================================

export function floorItemsAt(state, x, y) {
  if (state.hollow && state.hollow.floor) {
    return state.hollow.floor.floorItems.get(y * state.hollow.floor.w + x);
  }
  return state.worldItems && state.worldItems.get(x + ',' + y);
}

export function setFloorItems(state, x, y, list) {
  if (state.hollow && state.hollow.floor) {
    const i = y * state.hollow.floor.w + x;
    if (list && list.length) state.hollow.floor.floorItems.set(i, list);
    else state.hollow.floor.floorItems.delete(i);
    return;
  }
  state.worldItems = state.worldItems || new Map();
  const key = x + ',' + y;
  if (list && list.length) state.worldItems.set(key, list);
  else state.worldItems.delete(key);
}
