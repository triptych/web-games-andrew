// Surfaces a wheel can be on. The simulation uses the numbers; the view uses the names to pick the
// colour of dust, spray and tyre marks.
//
//   grip   lateral and cornering grip, as a share of dry dirt's
//   drag   extra rolling drag (1/s): mud and water bog the car down
//   rough  bumpiness: costs speed unless the suspension soaks it up
//   loose  how much better tyres help here (0 = not at all, 1 = fully)

export const SURF = {
    dirt:   { grip: 1.00, drag: 0.00, rough: 0.04, loose: 0.3, label: 'Dirt' },
    clay:   { grip: 1.06, drag: 0.00, rough: 0.02, loose: 0.2, label: 'Clay' },
    loam:   { grip: 0.96, drag: 0.02, rough: 0.06, loose: 0.4, label: 'Forest loam' },
    redclay:{ grip: 1.00, drag: 0.00, rough: 0.05, loose: 0.3, label: 'Red clay' },
    swamp:  { grip: 0.90, drag: 0.06, rough: 0.06, loose: 0.6, label: 'Swamp dirt' },
    pack:   { grip: 0.82, drag: 0.02, rough: 0.03, loose: 0.8, label: 'Packed snow' },
    mud:    { grip: 0.72, drag: 0.55, rough: 0.12, loose: 1.0, label: 'Mud' },
    water:  { grip: 0.80, drag: 0.80, rough: 0.08, loose: 0.6, label: 'Water' },
    gravel: { grip: 0.84, drag: 0.10, rough: 0.30, loose: 0.8, label: 'Gravel' },
    sand:   { grip: 0.78, drag: 0.45, rough: 0.10, loose: 1.0, label: 'Sand' },
    ice:    { grip: 0.42, drag: 0.00, rough: 0.00, loose: 0.9, label: 'Ice' },
    grass:  { grip: 0.82, drag: 0.30, rough: 0.45, loose: 0.7, label: 'Grass' },
    snow:   { grip: 0.70, drag: 0.40, rough: 0.30, loose: 1.0, label: 'Deep snow' },
    rock:   { grip: 0.90, drag: 0.15, rough: 0.55, loose: 0.4, label: 'Rock' },
    bog:    { grip: 0.70, drag: 0.55, rough: 0.30, loose: 1.0, label: 'Bog' },
    plank:  { grip: 1.00, drag: 0.00, rough: 0.10, loose: 0.1, label: 'Planks' },
    asphalt:{ grip: 1.10, drag: 0.00, rough: 0.00, loose: 0.0, label: 'Asphalt' },
    oil:    { grip: 0.40, drag: 0.00, rough: 0.00, loose: 0.3, label: 'Oil slick' },
};
