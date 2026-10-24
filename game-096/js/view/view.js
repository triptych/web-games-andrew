// The view: reads G every frame, turns sim events into effects, and runs the camera.
// It never changes G.

import { THREE, clamp, damp, angleDamp, lerp, smooth } from './kit.js';
import { Stage } from './stage.js';
import { FX } from './fx.js';
import { WorldView } from './world3d.js';
import { makePinch } from './models.js';
import { themeOf } from './themes.js';
import { PARTS } from '../sim/data.js';

const TAU = Math.PI * 2;

export class View {
    constructor(canvas) {
        this.stage = new Stage(canvas);
        this.scene = this.stage.scene;
        this.fx = new FX(this.scene);
        this.stage.onResize = () => this.fx.setScale(this.stage.pxScale());
        this.fx.setScale(this.stage.pxScale());
        this.pinch = makePinch();
        this.pinch.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        this.scene.add(this.pinch.root);
        this.world = null;
        this.time = 0;
        this.mode = 'title';
        this.winT = 0;
        this.camSnap = true;
        this.stepT = 0;
        this.reduced = false;
        this.orbit = 0;
        this.warn = 0;
        this.listeners = {};
    }

    setReducedMotion(on) { this.reduced = on; this.fx.reduced = on; }
    setQuality(q) { this.stage.setQuality(q); }

    /** Build the scene for a fresh run. */
    loadLevel(G0) {
        if (this.world) { this.scene.remove(this.world.root); this.world.dispose(); this.world = null; }
        this.fx.rings.forEach((r) => this.fx.group.remove(r.m)); this.fx.rings.length = 0;
        const theme = themeOf(G0.level.theme);
        this.stage.setTheme(G0.level.theme);
        this.stage.setWaterLevel(G0.level.waterY);
        this.world = new WorldView(G0.level, theme, G0);
        this.scene.add(this.world.root);
        this.pinch.setShell(G0.p.shell);
        this.camSnap = true;
        this.winT = 0;
        this.level = G0.level;
        this.world.addFlag(G0.level.start.x - 2.4, G0.level.start.y, G0.level.start.z + 1.6);
        this.world.flags[0].userData.grow = 1;
    }

    // ------------------------------------------------------------ events
    onEvents(G0, events) {
        const fx = this.fx;
        for (const e of events) {
            switch (e.type) {
                case 'jump': fx.dust(e.x, e.y, e.z, e.rolling ? 5 : 3, 0xf4e3bc, 1, 0.4); break;
                case 'land': fx.dust(e.x, e.y, e.z, Math.min(10, 3 + e.v * 0.35), 0xf4e3bc, 1.8, 0.5); if (e.v > 14) fx.shake(0.12); break;
                case 'spin': fx.ring(e.x, e.y + 0.5, e.z, 2.6, 0xfff4a0, 0.3, 0.7, 0.2); break;
                case 'roll': fx.dust(e.x, e.y, e.z, 6, 0xf4e3bc, 2, 0.5); break;
                case 'bump': fx.stars(e.x, e.y + 0.8, e.z, 5); break;
                case 'hop': fx.ring(e.x, e.y + 0.1, e.z, 2.2, 0x7ad7ff, 0.4, 0.8); fx.dust(e.x, e.y, e.z, 8, 0xdff6ff, 2, 0.5); break;
                case 'glide': fx.sparkle(e.x, e.y + 0.8, e.z, 0xffe27a, 6, 2); break;
                case 'slamStart': break;
                case 'slam': fx.ring(e.x, e.y, e.z, 3.6, 0xffffff, 0.55, 0.9, 0.2); fx.ring(e.x, e.y, e.z, 2.4, 0xffd34d, 0.4, 0.7, 0.25); fx.dust(e.x, e.y, e.z, 14, 0xf4e3bc, 4, 0.7); fx.shake(0.45); break;
                case 'swap': fx.poof(e.x, e.y, e.z, 0xffffff); break;
                case 'pearl': fx.sparkle(e.x, e.y, e.z, 0xffd9f4, e.n > 1 ? 10 : 4, e.n > 1 ? 3 : 1.6); break;
                case 'curio': fx.sparkle(e.x, e.y, e.z, 0xfff0a0, 22, 4); fx.ring(e.x, e.y, e.z, 3.6, 0xffe27a, 0.7, 0.9, 0.12); fx.confetti(e.x, e.y, e.z, 16); break;
                case 'heart': fx.sparkle(e.x, e.y + 0.5, e.z, 0xff9ac0, 14, 3); break;
                case 'crate': {
                    const col = { wood: 0xd9a15c, pearl: 0xd9a15c, iron: 0xaab4c0, check: 0x58c866, heart: 0xf2688c }[e.kind] || 0xd9a15c;
                    fx.debris(e.x, e.y, e.z, col, 12); if (e.kind === 'iron') fx.shake(0.2);
                    if (e.kind === 'check' && this.world) this.world.addFlag(e.x, e.y - 0.45, e.z + 0.2);
                    if (e.kind === 'pearl') fx.sparkle(e.x, e.y + 0.2, e.z, 0xffd9f4, 14, 4);
                    break;
                }
                case 'checkpoint': fx.confetti(e.x, e.y + 1, e.z, 20); break;
                case 'bounce': fx.ring(e.x, e.y + 0.2, e.z, 2.0, 0xffd34d, 0.35, 0.8); fx.sparkle(e.x, e.y + 0.4, e.z, 0xfff4a0, 6, 2.4); break;
                case 'barrel': fx.smoke(e.x, e.y + 1.2, e.z, 6, 0xffffff); fx.sparkle(e.x, e.y + 1.4, e.z, 0xffd34d, 10, 3); fx.shake(0.15); break;
                case 'hurt': fx.stars(e.x, e.y + 1.0, e.z, 6); fx.shake(e.god ? 0.05 : 0.3); break;
                case 'oopsie': fx.poof(e.x, e.y, e.z, 0xff9ac0); fx.shake(0.3); break;
                case 'respawn': fx.poof(e.x, e.y, e.z, 0xffffff); this.camSnap = true; break;
                case 'rescue': fx.poof(e.x, e.y, e.z, 0xbfeeff); fx.bubbles(e.x, e.y, e.z, 12, 0.6); this.camSnap = true; break;
                case 'splash': fx.splash(e.x, e.y, e.z); fx.shake(0.1); break;
                case 'kill': fx.poof(e.x, e.y + 0.4, e.z, e.how === 'slam' ? 0xffd34d : 0xffffff); fx.stars(e.x, e.y + 0.6, e.z, 6); break;
                case 'clink': fx.sparkle(e.x, e.y, e.z, 0xffffff, 8, 3); break;
                case 'block': fx.sparkle(e.x, e.y, e.z, 0xfff4a0, 14, 4); fx.ring(e.x, e.y - 0.5, e.z, 1.8, 0xffffff, 0.3, 0.8); fx.shake(0.2); break;
                case 'clank': fx.sparkle(e.x, e.y, e.z, 0xffffff, 10, 4); break;
                case 'splat': fx.debris(e.x, e.y, e.z, 0x6b4426, 8); break;
                case 'smash': fx.debris(e.x, e.y, e.z, e.kind === 'rock' ? 0xe2c07a : e.kind === 'fish' ? 0xbfe8ff : 0x6b4426, 8); break;
                case 'throw': fx.smoke(e.x, e.y, e.z, 4, e.kind === 'ball' ? 0x888888 : 0xe8dcc0); break;
                case 'windup': fx.sparkle(e.x, e.y, e.z, 0xffb347, 6, 2); break;
                case 'switch': fx.confetti(e.x, e.y + 0.5, e.z, 22); fx.shake(0.3); break;
                case 'ring': fx.shake(0.15); break;
                case 'bossStomp': fx.ring(e.x, e.y, e.z, 5, 0xffa14d, 0.5, 0.9, 0.2); fx.dust(e.x, e.y, e.z, 16, 0xf4e3bc, 5, 0.9); fx.shake(0.55); break;
                case 'bossSmash': fx.dust(e.x, e.y, e.z, 18, 0xe8d6a8, 5, 0.9); fx.ring(e.x, e.y, e.z, 5, 0xffffff, 0.5, 0.9, 0.2); fx.shake(0.6); break;
                case 'bossHit': fx.stars(e.x, e.y + 1.5, e.z, 12); fx.confetti(e.x, e.y + 1.5, e.z, 26); fx.shake(0.45); break;
                case 'bossDaze': fx.stars(e.x, e.y + 1.5, e.z, 10); break;
                case 'bossDefeat': fx.confetti(e.x, e.y + 2, e.z, 90); fx.sparkle(e.x, e.y + 2, e.z, 0xfff0a0, 40, 6); fx.shake(0.7); break;
                case 'crumble': fx.dust(e.x, e.y, e.z, 6, 0xe8d6a8, 1.5, 0.5); break;
                case 'vent': fx.bubbles(e.x, e.y, e.z, 6, 0.5); break;
                case 'swept': fx.splash(e.x, e.y, e.z, 30); fx.shake(0.6); break;
                case 'win': { const g = G0.level.goal; if (g) { fx.confetti(g.x, g.y + 2, g.z, 120); fx.sparkle(g.x, g.y + 3, g.z, 0xffd9f4, 40, 6); } else fx.confetti(G0.p.x, G0.p.y + 2, G0.p.z, 100); break; }
            }
        }
    }

    // ------------------------------------------------------------ the frame
    frame(G0, dt, time, mode = 'play') {
        this.mode = mode;
        this.time = time;
        const p = G0.p;
        this.stage.resize();
        const win = G0.status === 'won';
        if (win) this.winT += dt; else this.winT = 0;

        // Pinch: a victory dance when it is over
        let pp = p;
        if (win) pp = { ...p, spinT: Math.floor(this.winT * 1.3) % 2 === 0 && (this.winT * 1.3) % 1 < 0.4 ? 0.3 : 0, grounded: true, yaw: p.yaw + Math.sin(this.winT * 2) * 0.3 };
        this.pinch.update(pp, dt, time, G0);
        if (win) this.pinch.root.position.y += Math.abs(Math.sin(this.winT * 6)) * 0.45;
        this.pinch.root.visible = this.pinch.root.visible && !(G0.p.dead > 0 && G0.p.dead < 0.2);

        // little trails of life
        this.stepT -= dt;
        const speed = Math.hypot(p.vx, p.vz);
        if (p.grounded && speed > 4.5 && this.stepT <= 0 && mode === 'play') { this.stepT = p.rollT > 0 ? 0.04 : 0.13; this.fx.dust(p.x, p.y, p.z, p.rollT > 0 ? 2 : 1, 0xf4e3bc, 0.8, 0.28); }
        if (p.glide && Math.random() < dt * 30) this.fx.streak(p.x + (Math.random() - 0.5) * 2, p.y + 1.5, p.z + (Math.random() - 0.5) * 2, 0xffffff);
        if (p.slam === 2) this.fx.streak(p.x, p.y + 1.6, p.z, 0xffffff);
        if (p.charge > 0.2 && Math.random() < dt * 40) this.fx.sparkle(p.x, p.y + 0.2, p.z, 0xbfeeff, 1, 1.2);
        if (Math.random() < dt * 6 && this.world) this.fx.leaf(p.x + (Math.random() - 0.5) * 30, p.y + 8 + Math.random() * 4, p.z + (Math.random() - 0.5) * 30, this.stage.themeName === 'jungle' ? 0x6fd05a : this.stage.themeName === 'castle' || this.stage.themeName === 'beach' ? 0xffffff : 0xffd9f4);

        if (this.world) { this.world.pearls.root.visible = mode !== 'title'; this.world.update(G0, dt, time, this.fx, this.pinch); }
        this.fx.update(dt);
        this.camera(G0, dt, time, mode);
        // the sun's shadow box follows the player
        this.stage.followSun(p.x, p.y, p.z);
        this.stage.render(time);
    }

    // ------------------------------------------------------------ camera
    camera(G0, dt, time, mode) {
        const st = this.stage, cam = st.camera, rig = st.rig;
        const p = G0.p, aspect = st.w / st.h;
        const portrait = Math.max(0, 1 - aspect) * 1.0;
        let tx, ty, tz, lx, ly, lz, fov = 52;
        const yaw = G0.cam.yaw;
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        const L = G0.level;
        // vertical follow: eased, slower in the air so jumps stay on screen
        if (this.camSnap) rig.focusY = p.y;
        rig.focusY = damp(rig.focusY, p.y, p.grounded ? 5 : 1.8, dt);
        const focus = rig.focusY;

        if (mode === 'title') {
            this.orbit += dt * 0.18;
            const r = 6.4, a = Math.PI - yaw + Math.sin(this.orbit) * 0.9 + (p.yaw - yaw) * 0;
            tx = p.x + Math.sin(a) * r; tz = p.z + Math.cos(a) * r; ty = focus + 2.4;
            lx = p.x; ly = focus + (aspect < 1 ? 0.3 : 0.4); lz = p.z; fov = 46;
        } else if (G0.cam.mode === 'arena' && G0.boss) {
            const B = G0.boss, A = L.arena;
            const mx = (p.x + (B.x - p.x) * 0.35), mz = (p.z + (B.z - p.z) * 0.35);
            const R = A.half;
            const dist = R * 0.95 + 6 + portrait * 6, h = R * 0.55 + 7 + portrait * 5;
            tx = mx - fx * dist; tz = mz - fz * dist; ty = A.y + h;
            lx = mx + fx * 2; ly = A.y + 1.2; lz = mz + fz * 2; fov = 54 + portrait * 8;
        } else if (L.chase) {
            const dist = 12.5 + portrait * 5, h = 9.5 + portrait * 3;
            tx = p.x - fx * dist; tz = p.z - fz * dist; ty = focus + h;
            lx = p.x + fx * 5; ly = focus + 0.4; lz = p.z + fz * 5; fov = 58 + portrait * 8;
        } else if (mode === 'win') {
            const dist = 7;
            tx = p.x - fx * dist + Math.cos(this.winT * 0.6) * 1.5; tz = p.z - fz * dist - Math.sin(this.winT * 0.6) * 1.5; ty = focus + 3.2;
            lx = p.x; ly = focus + 1.2; lz = p.z; fov = 48;
        } else {
            const dist = 8.8 + portrait * 5.5, h = 5.4 + portrait * 3.6;
            const look = 3.2 + (p.rollT > 0 ? 1.5 : 0);
            tx = p.x - fx * dist; tz = p.z - fz * dist; ty = focus + h;
            lx = p.x + fx * look; ly = focus + 0.9; lz = p.z + fz * look;
            fov = 50 + portrait * 9 + (p.rollT > 0 || p.glide ? 3 : 0) + (p.slam === 2 ? 4 : 0);
        }
        if (G0.win_zoom) fov -= 4;
        if (this.camSnap) { rig.x = tx; rig.y = ty; rig.z = tz; rig.lx = lx; rig.ly = ly; rig.lz = lz; rig.fov = fov; this.camSnap = false; }
        const k = mode === 'title' ? 3 : 6.5;
        rig.x = damp(rig.x, tx, k, dt); rig.y = damp(rig.y, ty, k * 0.8, dt); rig.z = damp(rig.z, tz, k, dt);
        rig.lx = damp(rig.lx, lx, k * 1.3, dt); rig.ly = damp(rig.ly, ly, k, dt); rig.lz = damp(rig.lz, lz, k * 1.3, dt);
        rig.fov = damp(rig.fov, fov, 3, dt);
        const sh = this.fx.shakeAmt;
        const sx = sh ? (Math.random() - 0.5) * sh * 0.8 : 0, sy = sh ? (Math.random() - 0.5) * sh * 0.8 : 0;
        cam.position.set(rig.x + sx, Math.max(rig.y + sy, L.waterY + 1.2), rig.z);
        cam.lookAt(rig.lx, rig.ly, rig.lz);
        if (Math.abs(cam.fov - rig.fov) > 0.05) { cam.fov = rig.fov; cam.updateProjectionMatrix(); }
    }

    /** Screen position (px) of a world point, for HUD pointers. */
    project(x, y, z) {
        const v = new THREE.Vector3(x, y, z).project(this.stage.camera);
        return { x: (v.x * 0.5 + 0.5) * this.stage.w, y: (-v.y * 0.5 + 0.5) * this.stage.h, behind: v.z > 1 };
    }
}
