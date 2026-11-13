// The Meshy models that exist in assets/models/ (see dev/assets/README.md). The view never requests one that isn't
// listed, so a missing model is a stand-in, not a failed request.
export const MODEL_FILES = new Set([
    'veh-dump', 'veh-dozer', 'veh-digger', 'veh-roller', 'veh-crane', 'veh-wrecker', 'veh-loader', 'veh-mixer',
    'bld-townhall', 'bld-school', 'bld-cannery', 'bld-barn', 'bld-house', 'bld-shop',
]);
