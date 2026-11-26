# Game avatars: the characters who text you in Pocket Garden

Every game has a character, and the Pocket Garden handheld (`console/`) has a
**Messages** app where those characters text the player. Play a game and its
character joins your address book; from then on they send chatter in their own
voice, tips, nudges to come back, notes about your save ("you're on level 3 in
Tomebound, let's go!") and, for idle games, word that something has piled up
while you were away. A new game in the collection **rings** the handheld with a
friend request (the device shakes like a phone), and when a friend's game is
updated they send the news with a link to play it. You can write back with
quick replies (wheel or tap) or by typing, and friendship grows from New friend
to Best friend. The Garden of Games itself is your **dragonfly**.

The engine is [console/js/messages.js](../../console/js/messages.js). The
characters live with their games, not in the console:

```
game-NNN/avatar/
    avatar.json        the character, its painting prompt and its message bank
    avatar.webp        256 px: address book, chat header, friend request card, Lounge dialog boxes
    avatar-tiny.webp    64 px: chat bubbles, inbox rows, notification banners
    sprite.png         96×200: its walking sprite in the Lounge (see below)
garden/avatar/          the Garden's dragonfly (drawn as your own 8-bit dragonfly once you've met it)
```

## avatar.json

```jsonc
{
 "id": "game-001",
 "name": "Nova Vance",                 // what the contact is called
 "role": "Ace pilot",                  // shown under the name
 "emoji": "🚀",
 "color": "#ff5a4f",                   // bubble tint, avatar ring
 "bio": "One line for the address book.",
 "portrait": { "subject": "...", "background": "..." },   // the fal prompt (see below)
 "request": "Friend request text (also their first message).",
 "hello": ["sent right after you become friends", "..."],
 "about": "Answer to 'Tell me about you'.",
 "how": "Answer to 'How do I play?' (the real controls).",
 "tips": ["real, useful tips for this game", "..."],
 "chat": ["in-character chatter", "..."],
 "nudge": ["invitations to play (a ▶ chip is added)"],
 "idle": ["only sent when the game hasn't been played for 6h+; use {ago}"],
 "progress": ["save-aware lines, e.g. You're level {level}! Push for {level+1}!"],
 "questions": [ { "q": "A question they ask", "a": [["Answer chip", "Their reply"], ["...", "..."]] } ],
 "update": "Sent when the game's version changes: name {version}.",
 "updates": { "1.2.0": "Optional custom news for a specific version." },
 "bye": ["..."],
 "save": { "keys": ["my-game.v1", "my-game.slot.*"], "stats": { "gold": ["coins", "player.purse"] }, "root": "best" },
 "art": "fal",                         // written by dev/make-avatars.py: "fal" or "icon" (stand-in)
 "sprite": { "art": "elevenlabs", "w": 32, "h": 40, "rows": ["s","se","e","ne","n"], "frames": 3,
             "subject": "optional: a full-body description for the sprite, when the portrait's doesn't suit" }
}
```

Write every line **in the character's voice and about this game**: real
controls in `how`, real strategy in `tips`, the game's own places, enemies and
cast in `chat`. Lines are short (a chat bubble, under ~200 characters).

### Placeholders

`{you}` the player's name (Settings → Your name, or "friend"), `{game}` the
title, `{name}` the character, `{version}`, `{ago}` (time since last played:
"3 days"), `{days}` (days you've been friends), `{df}` (the dragonfly's name),
`{count}` (games in the collection), and any **stat** from the save:
`{level} {gold} {best} {score} {wave} {day} {floor} {stage} {stars} {gems}
{wins} {solved}` plus any you name in `save.stats`. `{level+1}` adds;
`{best^}` rounds up to the next nice target (1,234 → 1,500). A line whose
placeholder can't be filled is simply never sent, so a progress line about
gold only appears once there is gold in the save.

### Reading the save

`save.keys` are the game's localStorage keys (a trailing `*` matches a prefix,
and the biggest slot wins). The console only ever **reads** them. The stats are
found by name, breadth-first, shallowest first: `level` matches `level`, `lvl`,
`playerLevel`…, `gold` matches `gold`, `coins`, `money`…, and a save that is a
bare number becomes `best` (or `save.root`). `save.stats` adds names or dotted
paths for a game's own words (`"gems": ["stardust"]`). Timestamps such as
`savedAt` count as "last played" for idle lines.

## Painting the avatar (fal)

The shared style is in [dev/avatar-style.json](../../dev/avatar-style.json)
(`fal-ai/nano-banana-2`, 1:1, 0.5K): a cute chibi head-and-shoulders portrait in
the same painterly style as the game icons. The prompt is that style with the
game's `portrait.subject` and `portrait.background` filled in. A character the
shared style doesn't fit can carry its own `portrait.style` (same `{subject}` and
`{background}` slots): Fray (game-131) is blind, and the shared style's "big shiny
eyes" kept painting eyes over her blindfold until her own style dropped it and
said so outright. Save the
painting as `game-NNN.png` in a folder, then:

```bash
python3 dev/make-avatars.py --src path/to/folder   # writes avatar.webp + avatar-tiny.webp, marks "art": "fal"
python3 dev/make-avatars.py --pending              # games still on their icon stand-in, with full prompts
node dev/check-avatars.mjs                         # every game has a complete, valid character
```

Without a painting, `make-avatars.py` writes the game's icon as a stand-in
(`"art": "icon"`), so every folder is complete and the console never 404s.

## For a new game

1. Pick the character (the hero, a sidekick, the narrator, a shopkeeper; for a
   game with no character, invent one who belongs there).
2. Write `avatar/avatar.json` (aim for 4+ chat, 3+ tips, 2+ nudge, 2+ idle,
   2+ progress if it saves, 1–2 questions).
3. Paint it with fal and run `make-avatars.py`, then `check-avatars.mjs`.
4. Paint its Lounge sprite with ElevenLabs and run `make-sprites.py` and
   `make-sprites.py --cast` (see **The Lounge sprite** below).
5. Done: the next time a player opens Pocket Garden, the console notices a
   game it hasn't seen and the character **calls** with a friend request.

When a game is **updated** (its version in `js/gamedata.js` changes), every
player who is friends with its character gets the `update` line with a ▶ link.
To say what changed in the character's own words, add
`"updates": { "1.3.0": "..." }`.

## The Lounge sprite

The Pocket Garden's **Lounge** ([console/js/lounge.js](../../console/js/lounge.js)) is a
little JRPG bar where the characters of the games you have played (or have a
save in) hang out, and the player is the bartender. Each character walks there
on its own sprite, `avatar/sprite.png`: a 96×200 sheet of 32×40 cells, five
rows of facings (S, SE, E, NE, N; the Lounge mirrors SE, E and NE for SW, W and
NW, so they walk eight ways) by three walk frames (left step, stand, right
step).

The sprites are painted with **ElevenLabs** (`recraft-v4.1-flash`, 16:9, one
generation each, about 48 credits) from the shared prompt in
[dev/sprite-style.json](../../dev/sprite-style.json): a one-row SNES-style
turnaround of five full-body views (front, three-quarter front right, right
profile, three-quarter back, back) on a flat background, with the character's
`portrait.subject` filled in. A character with green in it is painted on
magenta instead of green. When the portrait's wording doesn't suit a
full-body figure (it sits on something, has copies trailing behind it, is only
a head), write a better one as `sprite.subject`; it is kept in avatar.json so a
repaint comes out the same way. Recraft follows that one-row layout far more
reliably than a 5×3 grid, and the walk frames are drawn from the standing pose.

```bash
python3 dev/make-sprites.py --src path/to/folder --only game-NNN   # game-NNN.webp -> avatar/sprite.png
python3 dev/make-sprites.py --src dir --only game-NNN --preview out/  # look first (4× previews)
python3 dev/make-sprites.py --cast                                 # console/lounge-cast.json
python3 dev/make-sprites.py --sheet                                # every sprite in one picture
node dev/check-avatars.mjs                                         # sprite size, avatar.json entry, cast
```

`make-sprites.py` clears the background with a flood fill from the edges (the
figures' dark outlines stop it, so a green goblin keeps its skin), cuts the
inked width into five slots at the emptiest columns, drops floating specks,
scales the figures to 34 px on a shared baseline with a small palette and a
dark outline, and draws the walk frames. A painting whose figures don't come
out even is reported and skipped; paint it again, or use `--loose` when two
figures only touch (a held bowl). `console/lounge-cast.json` lists every
character with a sprite and its save keys, so the Lounge can tell which games
you have saved without loading every avatar.json.

### In Messages

The Lounge shares the friendship hearts with Messages (`grow(id, pts,
'serve')`, up to 24 points a day): 2, 4 or 6 for one to three stars, +3 for the
character's favourite (chosen from words in its character sheet, else by its
id) and +4 when they asked for it. What you made each friend is remembered
(`console.lounge`), and a few hours later they text to thank you for it
("Thanks for the ☕ coffee yesterday…"). Now and then a friend texts to ask for
something; the message has a **🍹 Go to the Lounge** button that opens it with
them walking in to order exactly that. **🍹 Come to the Lounge!** is a quick
reply too. These lines are shared by every character
([console/js/lounge-data.js](../../console/js/lounge-data.js)); while they hang
out, the characters chat with their own `chat` lines.
