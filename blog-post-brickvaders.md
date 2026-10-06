# BRICKVADERS: What If the Invaders Were Made of Bricks?

*By Andrew Wooldridge*

Game 060 started with a simple question: what if Breakout and Space Invaders were the same game? The answer is [BRICKVADERS](https://triptych.github.io/web-games-andrew/game-060/), a vertical arcade shooter that tries hard to feel like a cabinet you'd find glowing in a dark arcade in 1983.

## Bounce and shoot

The Brick Armada, aliens built out of living bricks, marches down on Earth in formation. You fly the STRIKER, which is half Breakout paddle and half laser base. Bounce the plasma ball into the formation to smash aliens and their brick armour, and fire your laser in between bounces. Hit things in a row before the ball comes back to the paddle and you build a chain worth up to ×5. Arkanoid-style capsules fall out of the wreckage: lasers, a wider paddle, a sticky paddle, multi-ball, a fireball that smashes through everything, and a Nova bomb that clears the screen.

The cast is all new: one-eyed goo blobs, scuttling beetles, bat-winged eyeballs, tanks that blast craters in your brick-fort shields, splitters, mirrors that bounce your lasers back, builders that lay new bricks, divers that swoop at you, and captors whose tractor beams steal your ball.

## Every pixel is a brick

The whole game is drawn into a 240×320 vertical "monitor", and every pixel on it is a tiny 3D cube. That means invaders really do shed pixels when you hit them, kills burst into cubes that tumble toward the glass, and each wave assembles itself from bricks flying in from all over the screen. On top of that sit bloom, phosphor trails and a curved CRT with scanlines.

The music follows the invaders: the four-note march is the bassline, and the whole song speeds up as the formation thins out.

## Five sectors, five bosses

You fight across the Moon, a neon nebula, an asteroid belt, a synthwave Synth City and the inside of the mothership. Each sector ends with a giant brick boss you have to dig through to reach its glowing core: King Krabbo, the Saucerator, Rockjaw, the Phantom Queen and the Overmind. There are Galaga-style challenging stages between sectors, an ending, and then a harder second loop.

## A proper cabinet

It has an attract mode with a demo played by a bot, a high-score table with three-letter initials, a CONTINUE? countdown, and two modes: CADET for younger players (more ships, slower aliens) and ARCADE for the real thing. On a phone you get a little control deck under the screen, with a spinner pad to slide the paddle and big FIRE and NOVA buttons.

Like every game in the collection, it has no asset files: every sprite, sound and backdrop is made in code. The `dev/` folder has a bot that clears every stage of two loops headlessly, plus a browser test that plays it on desktop and touch-only phones.

## Play it

[Play BRICKVADERS](https://triptych.github.io/web-games-andrew/game-060/), or find its statue near the hub of the [Garden of Games](https://triptych.github.io/web-games-andrew/). Try to beat 30,000. Have fun!
