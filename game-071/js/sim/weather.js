/**
 * weather.js — regional weather that drifts over game hours.
 *
 * Each region has a weighted table (geography.js). Every few game hours a new weather is
 * rolled for the region the player is in, and the visible parameters blend toward it.
 */
import { REGIONS } from './geography.js';

export const WEATHER = {
    clear:    { cover: 0.05, fog: 0.0,  rain: 0, snow: 0, wind: 0.5, aurora: 1 },
    cloudy:   { cover: 0.55, fog: 0.08, rain: 0, snow: 0, wind: 0.8, aurora: 0.3 },
    fog:      { cover: 0.45, fog: 0.75, rain: 0, snow: 0, wind: 0.2, aurora: 0 },
    rain:     { cover: 0.85, fog: 0.25, rain: 1, snow: 0, wind: 1.2, aurora: 0, storm: true },
    snow:     { cover: 0.8,  fog: 0.3,  rain: 0, snow: 0.7, wind: 0.9, aurora: 0 },
    blizzard: { cover: 0.95, fog: 0.7,  rain: 0, snow: 1.0, wind: 2.2, aurora: 0 },
};

export class Weather {
    constructor(rng) {
        this.rng = rng;
        this.type = 'clear';
        this.cur = { ...WEATHER.clear };
        this.timer = 4;          // game hours until the next roll
        this.lightning = 0;
        this.flashTimer = 5;
        this.forced = null;
    }

    roll(region) {
        const table = REGIONS[region]?.weather || { clear: 1 };
        this.type = this.rng.weighted(Object.entries(table));
        this.timer = this.rng.range(3, 9);
    }

    set(type) { this.type = type; this.timer = 6; }

    /** dtH: game hours elapsed; dt: real-ish sim seconds for blending and lightning. */
    update(dtH, dt, region, events) {
        this.timer -= dtH;
        if (this.timer <= 0) this.roll(region);
        const target = WEATHER[this.forced || this.type];
        const k = Math.min(1, dt * 0.05);
        for (const key of ['cover', 'fog', 'rain', 'snow', 'wind', 'aurora']) this.cur[key] += (target[key] - this.cur[key]) * k;
        this.lightning = Math.max(0, this.lightning - dt * 3);
        if (target.storm && this.cur.rain > 0.6) {
            this.flashTimer -= dt;
            if (this.flashTimer <= 0) {
                this.flashTimer = this.rng.range(6, 22);
                this.lightning = 1;
                events?.push({ type: 'thunder', delay: this.rng.range(0.4, 2.5) });
            }
        }
    }

    state() {
        return { ...this.cur, type: this.type, lightning: this.lightning };
    }
}
