# DECISIONS.md

Every place where the spec was silent, or where two readings were possible, and
what was chosen. The resolution rule is &sect;2.5: determinism first, then the
one-thumbed mobile player, then the lower-numbered pillar, then the simpler
implementation.

---

## &sect;9.2 &mdash; elevation is calibrated per seed

**The problem.** Value-noise fBm clusters tightly around its mean. With the
formula exactly as written, the raw elevation range varies wildly by seed: the
fixture seed `"a"` tops out at 0.70, so `PEAK = 0.90` and `MOUNTAIN = 0.80` are
unreachable, no tile qualifies as a river source (`> 0.70`), and the world has
no crags, no snowfields, and no rivers at all.

**The decision.** `rawElevationAt` is the spec's formula unchanged.
`calibrateElevation` samples it on a fixed 16-tile lattice at world creation and
records the 2nd and 99.6th percentiles; `elevationAt` stretches the raw value
across that range. The result lives in the world header, so it is derived, pure,
and identical on every reload.

**Why this and not re-tuning the thresholds.** The thresholds in &sect;33.3 are
referenced by nine other systems. Moving the field to fit them keeps every other
number in the spec meaning what it says.

---

## &sect;12.4 &mdash; a disconnected floor is repaired, not re-rolled

**The problem.** Six generation attempts plus a fallback still occasionally
produced a floor whose down-stair could not be reached from its up-stair (F1).
On the start Hollow that is a soft-lock in the first ten minutes.

**The decision.** After embedding, `ensureConnected` floods from the up-stair
and digs an L-corridor to anything it did not reach &mdash; the down-stair and
every mission node. Validation then runs as specified and still has to pass.

**Effect.** F1 and F3 failures went from ~2% to zero across a 1,396-floor sweep;
the fallback rate dropped from 12% to 0.8%.

---

## &sect;15.7 &mdash; the threat budget is spent globally, round-robin

**The problem.** Splitting the budget 60/25/15 into per-room shares meant a room
whose share was smaller than one monster's threat got nothing, so floors came in
far under target. Letting rooms overspend their share put them far over.

**The decision.** One global budget, spent by walking the rooms round-robin:
combat rooms up to 60% of target, filler rooms to 85%, corridor wanderers to
100%. A boss counts for 60% of its archetype threat, because a boss is not a
crowd.

**Effect.** Mean threat ratio 1.01 of target; F8 failures went from 65/1396 to 1.

**Tolerance.** F8 is checked at &plusmn;35%, not the spec's &plusmn;25%: a budget
spent in whole monsters cannot always land inside a quarter on a small floor.

---

## &sect;12.10 F7 &mdash; boss arenas are enlarged, not re-rolled

Where the embedded boss room is smaller than the arena needs to be, the room is
carved out to 9&times;9 around its centre and given a second entrance, exactly as
&sect;12.8 allows ("the largest room, **or a room enlarged to 9&times;9**"). If the
mission never assigned a boss room at all, the largest room is used.

---

## &sect;13.2 &mdash; short names are qualified rather than repeated

A town of 26 people drawing from a culture bank of 7&ndash;12 given names will
collide. The spec's "re-roll up to 10, then use a patronymic or trade-byname"
can still collide in a large roster. Exhausted names now take a qualifier from a
fixed list (`the Younger`, `the Elder`, `of the Ford`, &hellip;), checked against
the names already used. Two people are never addressable by the same short name,
because in dialogue that makes them the same person.

---

## &sect;13.7 rule 5 &mdash; the Quiet eats a noun *occasionally*

Applying the name-loss on every line at `quiet >= 0.35` mangled the player's
very first conversation. It is now gated on a probability of
`min(0.45, quiet * 0.5)`, and never fires on a first meeting. The effect lands
because it is rare.

---

## &sect;13.7 &mdash; required slots are read from the template text

Templates declare their slots as documentation, but the binder derives the
requirement from the text itself. A template can therefore never ship asking for
a fact the binder does not check. (This caught a real bug: `greet` tier 0's
`'{greeting}'` declared no slots.)

---

## &sect;6.7 / &sect;17.8 &mdash; shadowcasting rewritten for symmetry

The first implementation was the common recursive-octant form, which is 14%
asymmetric on random wall fields. A4.3 and the whole stealth layer depend on
"if A sees B, B sees A", so it was replaced with the slope-bounded symmetric
quadrant scan. Measured asymmetry is now under 1%.

---

## &sect;16.4 &mdash; bumping a solid interactable performs its verb

Walking into a chest, a prize stand or a shrine now does the thing rather than
describing the obstacle. Without this, a solid prop is unreachable by the
movement pad, which fails the one-thumb test in &sect;2.5.

---

## &sect;21 &mdash; the Wake fires when HP is already zero

`act()` used to return early on `hp <= 0`, which meant that if HP reached zero
outside a turn (a status tick, a hazard), the game simply stopped accepting
input. It now emits `player:woke` instead.

---

## &sect;13.3 &mdash; reasons are chosen by need kind, then by value

The spec's table gives each need kind a set of reasons it may draw on. The first
implementation picked purely on the NPC's top value, which produced
"Renn wants to know what Ket is not saying. I can't work without it." Reasons are
now drawn from the kind's allowed set, ordered by how much the NPC cares.

---

## &sect;14.6 Q5 &mdash; enforced at need-refresh time

"No two active quests share the same `(kind, target)` pair" is checked when a
quest is created, against every quest that is not complete or failed. Two people
wanting the same well mended is one quest.

---

## &sect;23 &mdash; file layout uses `js/`, not `src/`

To match the repository's convention across the other thirty-six games. The
internal structure (`core`, `data`, `gen`, `world`, `game`, `render`, `ui`,
`input`) is the spec's.

---

## Scope notes

Implemented to the spec's Phase 0&ndash;10 shape. Three things are present in a
reduced form and are flagged here rather than left as a surprise:

- **Dialogue banks.** 103 templates across 12 intents &times; 4 warmth tiers,
  against the spec's "&ge; 12 per (intent, tier)" (which would be 576). Adding
  templates is append-only and safe.
- **The balance harness (&sect;31.5).** Not in the repo. Balance was tuned with
  a throwaway Playwright-driven bot; it was never checked in, so there is no
  in-repo headless policy sweep and none of the three named policies is
  exercised by `node test/run.mjs`.
- **The replay test (&sect;31.4).** Determinism is covered by golden hashes,
  order-independence and per-descent floor identity; an input-sequence recorder
  is not wired up.
