# Arena · Las Vegas Table Games

A play-money casino with five tables — **blackjack**, **craps**, **baccarat**,
**roulette** and **Ultimate Texas Hold'em** — dealt by the rules Aria runs in Las
Vegas in 2026, with the house edge shown on every bet. Everything you see and
hear is generated at runtime: the cards, chips, felt, wheel and room are vector
art, the dice are thrown by a physics engine, and every sound, from a clay chip
landing to the ball dropping into a pocket, is synthesised. There are no image
or audio assets at all.

## Running locally

You need **Node.js 20.19+ or 22.12+** (Vite 8's minimum) and npm.

```bash
npm install      # once, to fetch dependencies
npm run dev      # start the dev server
```

Then open **http://localhost:5173**. Sound starts off; press `M` or the speaker
button to hear the table. No configuration is required — the
games run as a guest against browser local storage. Supabase is optional; see
[Cloud sync](#cloud-sync-optional).

> **Windows PowerShell:** if `npm` fails with *"running scripts is disabled on
> this system"*, run `npm.cmd run dev` instead, or allow local scripts once with
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

| Command | What it does |
|---|---|
| `npm test` | 330 tests: engine rules, exact and long-run house edges, dice and wheel fairness |
| `npm run test:watch` | Tests in watch mode |
| `npm run lint` | Lint with oxlint |
| `npm run build` | Type-check and build a production bundle into `dist/` |
| `npm run preview` | Serve the production build locally |

The tables keep entirely separate bankrolls, statistics and histories. Walk
between them from the lobby, or with the **←** in the top-left of any table; a
table left mid-hand is exactly where you left it when you come back.

Every bet at every table carries its **house edge**, colour-coded the same way
everywhere — *Fair* (none), *Good* (under 2%), *Fair-ish* (under 5%), *Costly*
(under 10%), *Sucker* — on the rail, under the pointer and in each table's
reference card. Settings can hide them.

Each table's card in the lobby has a bankroll field whenever no hand or roll is
in play. Before your first hand it is **Buy in for**: type the bankroll you want
to sit down with. After that it shows **Your rack**, and typing a new amount
ends the current run (saved to your history, as busting out and buying back in
would) and starts a new one at that amount. Either way, the amount becomes what
*Buy back in* hands you later (changeable in Settings).

---

## Blackjack

You sit at a D-shaped table under the pendant light, heads-up against the
dealer. Cards are pitched from a six-deck shoe, turned face up in the air, and
raked into the discard rack when the hand is done — whose stack grows as the
shoe is dealt, the only penetration meter a real table has. Winning bets are
paid from the dealer's tray; losing ones are swept into it.

| | |
|---|---|
| Deal · rebet and deal · decline insurance | `Space` |
| Hit · Stand · Double · Split · Surrender | `H` `S` `D` `P` `R` |
| Take insurance | `I` · tick *Never ask again* on the prompt, or turn off *Offer insurance* in Settings, to skip the question |
| New bet after a hand | `N` |
| Stake a chip (rack order) | `1`–`6` · right-click a chip to take one back |
| Clear · double the bet | `C` · `X` |
| Strategy card | `?` |
| Mute | `M` |

### Rules — Aria, 2026

The default table is **Aria's high-limit shoe**: six decks, dealer stands on
all 17s, blackjack pays 3:2, double on any two cards, double after split, split
to four hands, resplit aces, late surrender, dealer peeks for a natural. The
other presets in Settings:

| Preset | What changes |
|---|---|
| Aria Main Floor | Dealer hits soft 17 |
| Aria Double Deck | Two decks, no surrender, no resplitting aces |
| Aria Low Limit | Hits soft 17 and pays **6:5** — included so the statistics show what that costs |
| Classic Strip / Downtown / Single Deck | The original presets, kept for comparison |

A profile still on the old generic default moves to the Aria default once;
a table chosen on purpose is kept.

Details covered by tests: a 21 made from a split is not a natural; the dealer
turns the hole card but draws nothing when every hand has busted or
surrendered; the second box of a split waits for its card until play reaches
it; an ace upcard opens insurance before any other decision; insurance loses
at any true count below +3.

### Training

- **The book** — the strategy card with your exact square lit, derived from the
  table's own rules: when the dealer hits soft 17 the six squares that changes
  (11 v A, 15 v A, 17 v A, soft 18 v 2, soft 19 v 6, 8-8 v A) change on the
  card and in the coach.
- **Coach** — marks the correct play on the controls; optionally holds a
  deviation so you can reconsider it.
- **Card counting** — Hi-Lo running and true count, decks left, the cut card,
  and a bet-spread suggestion. Derived from the shoe rather than accumulated,
  so it cannot drift, and it resets on a shuffle. Hover the count for what the
  numbers mean and the table's whole bet ramp, with the current step lit.
- **Statistics** — win rate, realised edge, strategy accuracy, streaks, and
  every hand logged with the decisions that departed from the book.

---

## Craps

You stand at the near-left rail. Your end of the Aria layout fills the left of
the frame — the L-shaped pass line, the field, the come box, the box numbers —
the stickman's prop box sits in the middle, and the far end runs off to the
right, where the dice come to rest after banking off the back wall.

Pick a chip, then **click the felt where the bet goes**. Hover any box for what
it pays, what wins and loses it, the house edge, and — for odds — the exact
ceiling. Once a point is up, clicking the line again takes odds behind it.

| | |
|---|---|
| Roll | `Space` |
| Pick a chip | `1`–`7` |
| Add to a bet · take it down | click its box · right-click it (or use the rail) |
| Take full odds on everything | `O` |
| Undo the last bet | `Ctrl`/`Cmd` + `Z` |
| Fold the bet rail | `B` |
| Reference card | `?` |

The **Place / Buy / Lay / Odds** switch says what a click on a box number
means, exactly as you would tell the dealer; the chip goes in the same box
either way. The stickman calls every roll on screen — "yo-leven", "hard
eight", "seven out, line away".

### Rules — Aria, 2026

**3-4-5x odds**; the field pays double on the 2 and **triple on the 12**; no Big
6/8; **All · Tall · Small** and the **Fire Bet** in the layout. Every legal bet is
on the felt: line and come bets with odds (the don't side may lay up to 6x the
line on any point), place / buy (5% up front, and again from each win that
stays up) / lay (5% of the win, $1 minimum), field, hardways, and the one-roll
centre bets.

Details covered by tests: place, buy, hardway and come-odds bets are off on a
come-out; a come-out seven leaves the place, buy and hardway bets up and returns
come odds with their come bet; a come bet travelling to the 6 on a
6 is not also paid by that roll; the twelve is barred for the don'ts; stakes
snap to what the dealer can pay; the pass line is a contract once a point is up.

### Learning aids

- **The rail** — every bet up, what wins and loses it, what it pays in dollars
  and its house edge from *Fair* to *Sucker*; what each of the eleven totals
  would do to your felt next roll, computed by the real settler; side-bet
  progress; one-click odds behind any travelled come bet.
- **The reference card** — every wager priced and ranked, with a primer on how
  a round works.
- **Roll history** — the current shoot at a glance, sevens in red, points in gold.

---

## Baccarat

Mini-baccarat on the blackjack table's walnut and felt: an eight-deck shoe at
the dealer's right, the Player and Banker hands turned over in their boxes, and
the seven bets printed along the apron. The tableau is the real one — the
Banker's third card depends on the Player's — and the dealer burns cards off
the top of each shoe the way the pit does.

| | |
|---|---|
| Deal · rebet and deal | `Space` |
| Pick a chip | `1`–`6` |
| Add to a bet · take it down | click its box · right-click it (or use the rail) |
| Clear · rebet | `C` · `R` |
| Fold the bet rail | `B` |
| Every bet, priced | `?` |

### Rules — Aria, 2026

Eight decks, cut card sixteen from the back. **Banker pays 19 to 20** (5%
commission, paid to the cent), Player even money, **Tie 8 to 1**; **Player Pair
and Banker Pair 11 to 1**; the **Dragon Bonus** on either side pays by margin of
victory — 30 to 1 on nine points down to even money on four, even money on a
winning natural, a push on a natural tie. Limits $25–$10,000, side bets
$5–$500.

| Bet | House edge |
|---|---|
| Banker | 1.06% |
| Player | 1.24% |
| Dragon Bonus · Player | 2.65% |
| Dragon Bonus · Banker | 9.37% |
| Player Pair · Banker Pair | 10.36% |
| Tie | 14.36% |

### Learning aids

- **The rail** — every bet with what it pays and its edge, the best price on
  the layout flagged, and the shoe's **live odds**: Player, Banker and Tie
  chances and every bet's edge recomputed exactly from the cards still in the
  shoe. Late in a shoe a side bet can tip to the player; its pill turns green
  when it does.
- **Last coup** — on the rail until the next coup is turned over: both hands
  card by card, why each side drew or stood by the tableau, every bet won, lost
  or pushed and why, and what it came to — bet, returned (stakes back plus
  winnings, after the Banker's commission) and net. Folds to one line.
- **The bead plate** — the shoe so far, naturals ringed and pairs marked, as
  the scoreboard over a real table shows it.
- **Every bet, priced** — the tableau, the Dragon pay table, and each bet's
  edge with the reasoning behind it.

---

## Roulette

The wheel is set into the felt at the left and the layout runs away from it.
The rotor turns all the time; a spin launches the ball against it, and it rides
the track, drops, rattles off the deflectors and settles in the pocket the
engine drew. The dolly goes down on the winning number before the losers are
swept and the winners paid.

Pick a chip and **click where the chip goes**: on a number for a straight up,
on a line for a split, a corner for four numbers, the edge of a row for a street
or a six line, or any outside box. Hovering lights every number the bet covers
and gives its payout, chance and edge.

| | |
|---|---|
| Spin · rebet and spin | `Space` |
| Pick a chip | `1`–`6` |
| Add to a bet · take it down | click it · right-click it |
| Clear · double · rebet | `C` · `D` · `R` |
| Fold the bet rail | `B` |
| Every bet, priced | `?` |

### Rules — Aria, 2026

Aria's main floor deals **double-zero** roulette: $15 minimum, $500 straight
up, $10,000 on the outside. Every bet costs **5.26%** except the five-number
**Top Line** (0-00-1-2-3), which pays 6 to 1 and costs **7.89%** — the rail
flags it. Settings switches to the **single-zero** wheel of the high-limit room
($100 minimum), where every bet, including the first four, costs **2.70%**.

### Learning aids

- **The rail** — your layout bet by bet with what each pays, how much of the
  wheel you cover, how many pockets leave you ahead, and what the whole layout
  costs per spin on average. With nothing down it is a price list.
- **The tote board** — the last spins, with red, black and zero counted.
- **Every bet, priced** — each bet against both wheels side by side.

---

## Ultimate Texas Hold'em

Heads-up against the dealer at the D table, a shuffler where the shoe stands —
a fresh deck every hand. Your four circles run along the rail: **Trips**,
**Ante**, **Blind** and **Play**.

| | |
|---|---|
| Deal · rebet and deal | `Space` |
| Pick a chip (between hands) | `1`–`5` |
| Ante (the Blind goes with it) · Trips | click the circle · right-click to take it back |
| Check | `C` |
| Bet 4x · 3x · 2x · 1x | `4` `3` `2` `1` |
| Fold | `F` |
| Clear · rebet | `C` · `R` (between hands) |
| The book | `?` |

### Rules — Aria, 2026

Equal **Ante and Blind**, optional **Trips**. One Play bet a hand: **4x or 3x**
the Ante before the flop, **2x** on the flop, **1x** on the river or fold. Best
five of seven. The dealer **opens with a pair or better**; if not, the Ante
pushes. The Blind pays only when you win with a straight or better (royal 500 to
1, straight flush 50, quads 10, full house 3, flush 3 to 2, straight 1) and
pushes on any lesser win. Trips is paid on your hand alone — even one you fold.
Ante $15–$1,000, Trips $5–$100.

The main game costs **2.19% of the Ante** played perfectly, which is **0.53%** of
everything put in action. Aria does not publish its Trips pay table, so the
table deals the one most often posted on the Strip, **50-40-30-8-6-5-3**
(**1.90%**), and Settings offers the other two you will meet: **9-7-4** (0.90%)
and **8-7-4** (3.50%). Trips edges are exact, counted over all 133,784,560
seven-card hands.

### The coach

- **On the buttons** — the book play is flagged on every street: the 4x chart
  before the flop (never 3x, unless the rack cannot cover 4x and the hand is
  still worth 3x); on the flop an exact call, worked out in a background worker
  over every turn, river and dealer hand, in the words of the Wizard of Odds'
  rule wherever the two agree; and on the river an exact call that scores all
  990 hands the dealer could hold. Flop and river show the value of each choice
  in Antes. Played that way the coach is perfect play, 2.185% of the Ante.
- **The scorecard** — each decision this hand against the book's, on the rail;
  statistics keep your share of book decisions and log every departure.
- **The book** — the full pre-flop chart, the flop and river rules, the Blind
  table and all three Trips tables priced.

---

## Sound and appearance

Only the table makes a sound, synthesised with the Web Audio API through a
generated room reverb: modal-synthesis clay chips, card snaps and riffle
shuffles, the puck, a roulette ball that rolls, drops and rattles home, and
dice whose every collision is voiced from the physics
simulation that threw them (felt, rubber wall or die-on-die, at the speed they
hit). There is no music, floor ambience, dealer voice or interface chime.

The room is drawn the same way: gilt-panelled walls with a sconce on every
pilaster, a bank of slot machines glowing along the far wall, chandeliers, and
the loud patterned carpet every casino floor has. The lobby looks across the
room under a marquee in chasing lights; taking a seat tilts the camera down
until the table sits in its own pool of light on the carpet.

Sound starts off; `M` turns it on and off, and Settings has its volume.
Settings also choose the felt (emerald, sapphire, crimson, amethyst, onyx) and
the card backs. Audio suspends while the tab is hidden, and the whole interface
honours the system's reduced-motion setting.

---

## Architecture

```
src/
  engine/         pure TypeScript rules — no React, no DOM, no ambient randomness
    craps/        bet catalogue, pay tables, state machine
    baccarat/     tableau, exact shoe odds, side bets
    roulette/     wheels, bet catalogue, layout summaries
    uth/          hand evaluator, pay tables, the coach
  store/          Zustand stores, profiles, persistence
  prefs/          player preferences shared by every table (sound, felt, backs)
  audio/          mixer and reverb, the table's sound library
  components/     cards, chips, chip stacks, drawers, controls, the stage
  lobby/          the front door
  blackjack/      table, cards, bets, billboards, dock, drawers
  craps/          layout, felt, click targets, bets, puck, rail, stickman
    dice/         physics simulation, face relabelling, WebGL overlay
  baccarat/       felt, shoe, cards, bets, bead plate, live odds
  roulette/       wheel and ball, layout, click targets, bets, tote board
  uth/            felt and pay tables, shuffler, cards, circles, coach
```

### The engine is pure

Every function in `src/engine` takes a state and returns a new one. The
renderer decides how long a deal or a throw takes and calls the engine when it
is ready; randomness comes only from an explicitly seeded PRNG. The rules are
exhaustively testable and a round is exactly reproducible from its seed.

### Rendering

Every table is a **tilted DOM plane**: the whole table is laid out flat in
logical pixels — SVG felt, printing and click targets — and rotated away from
the viewer with CSS 3D, so text stays crisp at any size and the browser does
the hit-testing. Things that stand up off the felt (chip stacks, totals, the
puck) are billboards drawn for the angle the felt is seen at; the shoe and
discard rack are CSS boxes. `Stage` scales each composition to the window,
keeping the playable part clear of the dock.

The craps **dice are WebGL**, in a transparent canvas over the felt. Its camera
is built from the same perspective distance, tilt and plane position the CSS
uses, so a die resting at a point on the felt is drawn over that point. A throw
is simulated with rigid-body physics (cannon-es) before it plays — thrown up the
table, banked off the back wall, tumbled to rest — and the recorded trajectory
is played back. The simulation does not know the result: the engine rolled the
numbers first, and the drawn dice are **relabelled** with a cube symmetry so
the engine's numbers land face up (tested for every face against 200 random
orientations). Real physics, provably fair dice.

### Correctness

`npm test` runs 329 tests. Beyond per-rule unit tests:

- **Blackjack** plays 200,000 hands of perfect basic strategy and checks the
  realised edge, and plays Aria's high-limit shoe and its 6:5 tables through the
  same loop, 150,000 hands each. Run for millions of hands, the engine lands
  within sampling error of the exact house edges, per initial bet: 0.27% for
  Aria's S17 shoe, 0.47% hitting soft 17, 1.98% at 6:5. Every strategy card (six-deck, two-deck
  and single-deck, S17 and H17) is walked square by square against the engine's
  own lookup, and the small-deck squares were checked against an exact
  calculation.
- **Craps** runs twelve bets to tens of thousands of resolutions each and checks
  the edge the dice deliver against the edge the reference card claims; odds
  are checked exactly by enumeration.
- **Baccarat** enumerates every way a coup can be dealt from eight decks,
  weighted by the cards in them, matches the published probabilities, holds
  the reference card to every edge it quotes, and deals a long run to check the
  Banker, Player and Tie rates against the enumeration.
- **Roulette** prices every bet on both wheels from what it covers and pays,
  and spins a long session to check every pocket comes up about equally often.
- **Ultimate Texas Hold'em** counts every five-card hand into the right
  category, checks best-five-of-seven frequencies against the full count,
  prices Trips exactly, checks the coach against the chart, the flop rule, the
  exact flop and river calculations and what the rack can cover, and plays a
  long session to check every chip moves where it should.

## Cloud sync (optional)

1. Create a Supabase project and run `supabase/schema.sql` against it.
2. `cp .env.example .env.local` and fill in the URL and anon key.

Sign-in is a passwordless email link, from blackjack's Settings. The Supabase
library is only downloaded when credentials exist. Local storage stays the
write-through cache, so the table never waits on the network. Craps and the
three newer tables are local-only for now: `runs` needs its `game` column
before their rows can be filed without mixing incomparable leaderboards.

## Development aids

In development builds only, `?gallery` shows every card and chip, and
`window.__arena` exposes the stores and sound library for scripted
walkthroughs of specific hands and rolls.
