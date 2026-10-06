// aiWorker.js — runs the computer captain off the main thread so the sea keeps
// moving while it thinks. Receives { id, fen, history, level, seed }.
import { Position } from './sim/chess.js';
import { chooseMove } from './sim/ai.js';

self.onmessage = (e) => {
    const { id, fen, history, level, seed, override } = e.data;
    const pos = Position.fromFEN(fen);
    const r = chooseMove(pos, { level, seed, history, override, now: () => performance.now() });
    self.postMessage({ id, ...r });
};
