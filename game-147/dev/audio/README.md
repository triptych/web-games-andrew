# Inn Over My Head — music, sound and voices (ElevenLabs)

Every sound in `../../audio/` was generated on 2026-11-23 with **ElevenLabs** (flow "Inn Over My Head — game art &
audio") and encoded by `process.py` (ffmpeg):

```bash
python3 -I game-147/dev/audio/process.py RAW game-147/audio
```

Music: 80 kbps stereo with a fade at the loop seam. Effects: silence trimmed, 96 kbps mono. Voices: one take per
character with the lines separated by `[long pause]`, split at the pauses (Goldmaw's take by hand-placed cuts, since her
lines have pauses inside them), 64 kbps mono. 4.2 MB in all. A Web Audio synth stands in for any effect that fails to
load.

## Music (`eleven_music_v2_5`, instrumental)

| File | Length | Prompt (short) |
|---|---:|---|
| `music-title` | 50 s | a warm 3/4 waltz: music box and celesta, strings, oboe and flute, harp |
| `music-inn` | 75 s | cozy acoustic: fingerpicked guitar, accordion, glockenspiel, brushed percussion, a whistled countermelody, 100 BPM |
| `music-battle` | 60 s | bouncy orchestral: pizzicato, brass stabs, piccolo, xylophone, 140 BPM, never scary |
| `music-boss` | 60 s | big and playful: brass fanfares, galloping strings, timpani, a cheeky bassoon and tuba, 150 BPM |
| `jingle-victory` | 8 s | brass and xylophone flourish, glockenspiel finish |
| `jingle-paid` | 8 s | a cash-register ding, a ragtime piano run and a grand chord (an installment paid) |

## Effects (`eleven_text_to_sound_v2`, 2–6 credits each)

`hit` (a rolling pin bopping a cushion) · `slash` · `crit` · `fire` · `water` (soapy sploosh) · `leaf` · `wind` · `star`
(sugary sparkle) · `heal` · `buff` · `stagger` (a crack, a boing, tweeting birds) · `chain` · `poof` (a dust bunny
shooed) · `coins` · `bell` (the front desk) · `sizzle` · `perfect` (a perfect stir) · `door` (the inn door and its bell) ·
`levelup` · `flee` (scrambling feet and a slide whistle) · `defeat` (a squeaky toy deflating) · `page` (the ledger).

## Voices (`eleven_v4`, one take per character)

| Character | Voice | Lines |
|---|---|---|
| Maple | Ayla (bubbly, cute, expressive) | welcome, battle, skill, guard, heal, chain, victory, hurt, flee, cook, clean, pay, shock ("Forty THOUSAND?!"), levelup, deed |
| Ember | Milly (cheerful, playful) | hello, battle, skill, skill2, chain ("Order up! Extra crispy!"), victory, hurt, cook, perfect, joined, flee |
| Kit | Kai (energetic anime hero) | hello, battle, skill, steal, chain, victory, hurt, checkin, joined, flee |
| Fern | Libby (warm storybook soprano) | hello, battle, skill, heal, chain ("Bloom, little ones!"), victory, hurt, harvest, joined |
| Bru | Ruby B (playful, warm London) | hello ("UNACCEPTABLE!"), battle, skill, skill2, chain, victory, hurt, clean, joined, buff |
| Madame Goldmaw | Andrea (knowing British character voice) | intro, debt, keepup, paid, late, coin, deed, friend |

Story scenes play the matching line as their text appears (`SCENE_VO` in `js/ui.js`); battles bark at most one line
every 2.5 s.

**Spend:** music about 3,900 credits, effects about 75, voices about 3,600.
