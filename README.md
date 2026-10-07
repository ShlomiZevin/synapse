# Synapse

Teach a little glowing cell, and watch its brain learn.

The cell's brain is a real (tiny) neural network, drawn live on screen. You shine a light signal, the cell picks a move, and you answer with a treat or poison. The network changes its own weights from that reward alone, and you can see the lines thicken as it learns what each signal means.

## Play

Open `game.html` in a browser. It runs on its own, without sound.

Sound, saving and full screen come from the Plaxzy host (`/public/lib/plaxzy-sound-12.js` and the `Plaxzy` object). The game checks for both and works without them.

## Controls

| Key | Mouse / touch | What it does |
| --- | --- | --- |
| 1 to 8 | signal buttons | shine a light signal |
| G | left-click the pond, or TREAT | treat: that move was right |
| B | right-click the pond (long press on touch), or POISON | poison: that move was wrong |
| | drag the cell | move it anywhere in the pond |
| T | TEST | test the signal with learning switched off |
| F | SPEED | x1 / x2 |
| H | ? | how it works (a six-page guide in plain words) |
| Esc | MENU | pause, sound, start over |

## How it works

- **The network:** 9 inputs (8 signals and "no signal"), 27 hidden neurons, 10 outputs (the moves), about 540 weights.
- **Deciding:** a forward pass gives odds for each move (softmax); the cell samples from them, with a little random curiosity.
- **Learning:** reinforcement learning with an advantage actor-critic and real backpropagation. A treat is +1.2 and poison is -0.7; the total for one try is capped.
- **What is built in:** the cell is born knowing *how* to do its ten moves. It learns *which* move each signal means. Three hidden neurons start out tuned to each signal, and the biases are frozen, because otherwise one rewarded move takes over every signal.
- **Moves unlock with lessons:** the cell starts with three moves and gains one per signal, so early lessons are quick.

Everything drawn in the brain panel is the network's real state: line thickness is weight, the bars are the output odds, and the bright path is each neuron's actual vote for the chosen move.

## Files

- `src/core.js` the network, the learning rule and the cell's training cycle (no DOM)
- `src/game.js` drawing, input, lessons, the guide, sound and save
- `src/template.html` the page shell
- `tools/build.js` joins the three into `game.html`: `node tools/build.js`
- `tools/learn-test.js` headless check that simulated brains really learn all eight signals: `node tools/learn-test.js --lr 0.6`
- `tools/browser-test.js` plays lesson 1 in a real browser (needs `playwright-core`, Chrome and the game served on port 5190)
- `plan.json`, `visual.json` the design notes the game was built from

## Honest limits

- It is a small network learning a simple mapping. It does not plan or understand.
- In the headless test most simulated brains learn all eight signals, but not every one within the try limit when the teacher is sloppy.
- Sound and the phone layout have only been checked by automated checks.
