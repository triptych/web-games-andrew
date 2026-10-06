// The three-press swing meter. Press 1 starts the marker at the sweet spot; it runs up to full power
// and bounces back. Press 2 locks the power. The marker then runs back past the sweet spot; press 3
// inside the perfect zone for a PERFECT strike, early or late to hook or slice. Missing press 2 cancels
// the swing; missing press 3 shanks it.
//
// Marker position m: 0 = sweet spot, 1 = full power, down to −OVER past the sweet spot.

export const OVER = 0.22;

export class Swing {
    constructor() { this.reset(); }
    reset() { this.state = 'idle'; this.m = 0; this.dir = 1; this.power = 0; this.acc = 0; this.result = null; }
    get active() { return this.state !== 'idle'; }

    // speed: sweeps per second of the full bar; zone: half-width of the perfect zone (meter units)
    start(speed, zone) {
        this.reset();
        this.state = 'power';
        this.speed = speed; this.zone = zone;
        return true;
    }

    // returns a shot { power, acc, perfect } when the swing completes, 'cancel' or null
    press() {
        if (this.state === 'power') {
            this.power = Math.max(0.03, this.m);
            this.state = 'acc';
            this.dir = -1;
            return null;
        }
        if (this.state === 'acc') return this.finish(this.m);
        return null;
    }

    finish(m) {
        const perfect = Math.abs(m) <= this.zone;
        // early (m > 0) slices right, late (m < 0) hooks left; scaled so the end of the bar is ±1
        const acc = perfect ? 0 : Math.max(-1, Math.min(1, (m > 0 ? m - this.zone : m + this.zone) / (OVER - this.zone)));
        this.state = 'idle';
        this.result = { power: this.power, acc, perfect };
        return this.result;
    }

    update(dt) {
        if (this.state === 'power') {
            this.m += this.dir * this.speed * dt;
            if (this.m >= 1) { this.m = 2 - this.m; this.dir = -1; }
            if (this.dir < 0 && this.m <= 0) { this.state = 'idle'; this.m = 0; return 'cancel'; }
        } else if (this.state === 'acc') {
            this.m -= this.speed * 1.15 * dt;
            if (this.m <= -OVER) return this.finish(-OVER);
        }
        return null;
    }
}
