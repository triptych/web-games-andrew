// The open project, undo/redo, autosave and the project library in
// localStorage. Every committed change is a snapshot, so undo restores
// exactly what was there. Storage can be blocked: everything still works in
// memory and Download still saves.
import { bus } from './bus.js';

const IDX = 'talewright.projects.v1';
const PRE = 'talewright.proj.';
const MAX_UNDO = 60;

function sget(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch { return null; } }
function sset(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch { return false; } }
function sdel(k) { try { localStorage.removeItem(k); } catch { /* blocked */ } }

export const store = {
    TW: null,
    project: null,
    snap: '',
    undoStack: [],
    redoStack: [],
    dirty: false,
    storageOk: true,
    timer: null,
    readOnly: false,

    init(TW) {
        this.TW = TW;
        try { localStorage.setItem('talewright.probe', '1'); localStorage.removeItem('talewright.probe'); } catch { this.storageOk = false; }
    },

    list() {
        const idx = sget(IDX);
        return Array.isArray(idx) ? idx.filter((e) => e && typeof e.id === 'string') : [];
    },

    open(p, opts) {
        this.project = p;
        this.TW.sprites.setCustom(p.sprites);
        this.snap = JSON.stringify(p);
        this.undoStack = []; this.redoStack = [];
        this.dirty = false;
        this.readOnly = !!(opts && opts.readOnly);
        bus.emit('project', p);
    },

    load(id) {
        const raw = sget(PRE + id);
        if (!raw) return null;
        try { return this.TW.schema.validate(raw); } catch { return null; }
    },

    create(title) {
        const p = this.TW.schema.newProject({ title: title || 'Untitled Tale' });
        this.open(p);
        this.saveNow();
        return p;
    },

    /** Record a change that has already been made to this.project. */
    commit(label, meta) {
        const now = JSON.stringify(this.project);
        if (now === this.snap) return;
        this.undoStack.push(this.snap);
        if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
        this.redoStack = [];
        this.snap = now;
        this.dirty = true;
        this.project.meta.modified = Date.now();
        this.schedule();
        bus.emit('change', Object.assign({ label }, meta || {}));
    },

    replace(json) {
        const p = JSON.parse(json);
        this.project = p;
        this.TW.sprites.setCustom(p.sprites);
        this.snap = json;
        this.dirty = true;
        this.schedule();
        bus.emit('project', p);
        bus.emit('change', { label: 'restore' });
    },
    undo() {
        if (!this.undoStack.length) return false;
        this.redoStack.push(this.snap);
        this.replace(this.undoStack.pop());
        bus.emit('edit', { kind: 'undo' });
        return true;
    },
    redo() {
        if (!this.redoStack.length) return false;
        this.undoStack.push(this.snap);
        this.replace(this.redoStack.pop());
        return true;
    },

    schedule() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.saveNow(), 2500);
    },

    /** Write the project and its index entry. Returns false if storage failed. */
    saveNow() {
        clearTimeout(this.timer);
        const p = this.project;
        if (!p || this.readOnly) return false;
        const json = JSON.stringify(p);
        const ok = sset(PRE + p.id, json);
        if (ok) {
            const idx = this.list().filter((e) => e.id !== p.id);
            idx.unshift({ id: p.id, title: p.system.title || p.meta.title, modified: Date.now(), size: json.length, maps: p.maps.length });
            sset(IDX, idx.slice(0, 200));
            this.dirty = false;
        }
        if (!ok && this.storageOk !== 'warned') { this.storageOk = 'warned'; bus.emit('storage-failed'); }
        bus.emit('saved', { ok });
        return ok;
    },

    remove(id) {
        sdel(PRE + id);
        sset(IDX, this.list().filter((e) => e.id !== id));
    },

    /** Parse and validate a downloaded project; gives it a fresh id if it clashes. */
    importText(text) {
        const raw = JSON.parse(text);
        const p = this.TW.schema.validate(raw);
        if (this.list().some((e) => e.id === p.id)) p.id = 'p_' + Math.random().toString(36).slice(2, 9);
        return p;
    },
};
