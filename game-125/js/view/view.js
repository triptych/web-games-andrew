// The view: the station in first person while you walk the Ark, the planet through the bot's eyes while it is
// down. Reads G every frame and answers its events; never writes G.

import * as THREE from 'three';
import { Stage } from './stage.js';
import { StationView } from './station3d.js';
import { PlanetView } from './planet3d.js';
import { WALK } from '../config.js';
import { ZONES } from '../sim/data.js';
import { talkLine } from '../sim/game.js';

export class View {
    constructor(canvas, quality) {
        this.stage = new Stage(canvas, quality);
        this.cam = this.stage.camera;
        this.station = new StationView();
        this.planet = new PlanetView();
        this.planet.scene.add(this.cam);
        this.station.scene.add(this.cam);
        this.place = null;
        this.missionKey = null;
        this.pitch = 0;               // the bot's look pitch is a view matter; the sim aims by yaw alone
        this.goalTerm = null;
        this.hurt = 0;
    }

    addPitch(dp) { this.pitch = Math.max(-1.0, Math.min(1.0, this.pitch + dp)); }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'hurt') this.hurt = Math.min(0.7, this.hurt + 0.25 + e.dmg * 0.01);
            if (e.type === 'deploy') this.pitch = 0;
        }
        if (this.place === 'planet') this.planet.onEvents(G, events, this.cam);
    }

    frame(G, dt, time) {
        const want = G.mode === 'mission' && G.mission ? 'planet' : 'station';
        if (want === 'planet') {
            const key = G.mission.seed + ':' + G.mission.zone;
            if (this.missionKey !== key) {
                this.planet.build(G, this.cam);
                this.missionKey = key;
            }
        } else if (this.place === 'planet') {
            this.planet.dispose(this.cam);
            this.missionKey = null;
        }
        if (want !== this.place) {
            this.place = want;
            const sc = want === 'planet' ? this.planet.scene : this.station.scene;
            sc.add(this.cam);
            this.stage.setScene(sc);
        }
        if (want === 'station') {
            const m = G.me;
            this.cam.position.set(m.x, WALK.eye + Math.sin(time * 1.3) * 0.01, m.z);
            this.cam.rotation.set(m.pitch, -m.yaw, 0, 'YXZ');
            const L = talkLine(G);
            this.station.wantMood = L && L.w === 'tilly' ? L.m || 'happy' : G.talk ? 'think' : 'happy';
            this.station.update(G, dt, time, this.cam, this.goalTerm);
            this.stage.grade({ tint: 0xeef4ff, blur: 0.8, bloom: 0.65, vig: 0.4, sat: 1.1, band: 0.24 });
        } else {
            this.planet.frame(G, dt, time, this.cam, { pitch: this.pitch });
            const Z = ZONES[G.mission.zone];
            this.stage.grade({ tint: Z.id === 'hollow' ? 0xe8e0ff : Z.id === 'mesa' ? 0xfff0e0 : 0xffffff, blur: 1.1, bloom: Z.id === 'hollow' ? 0.9 : 0.55, vig: 0.45, sat: 1.15, band: 0.2 });
        }
        this.hurt = Math.max(0, this.hurt - dt * 1.6);
        this.stage.flash(this.hurt);
        this.stage.resize();
        this.stage.render();
    }

    /** Mean and spread of a small grid of the frame's pixels, for the tests: a blank screen fails. */
    probe() {
        const gl = this.stage.renderer.getContext();
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4);
        const vals = [];
        for (let j = 1; j < 9; j++) for (let i = 1; i < 12; i++) { gl.readPixels(Math.floor(w * i / 12), Math.floor(h * j / 9), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); vals.push((px[0] + px[1] + px[2]) / 3); }
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
        return { mean, sd };
    }
}

void THREE;
