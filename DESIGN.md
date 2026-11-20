# DESIGN.md — Chess, editorial brutalist poster

Generated with ui-ux-pro-max (`--design-system "chess game website editorial brutalist poster"`,
variance 9 / motion 2 / density 5, stack `react` + `html-tailwind`), then constrained to the
poster reference. Where the tool and the reference disagreed, the reference wins.

Style match: **Brutalism** (raw, stark, high contrast, visible borders, asymmetric).
Accessibility profile from the tool: low risk, but it *requires* text contrast 4.5:1,
full keyboard operation, visible focus, and reduced-motion support. Those four are non-negotiable
below.

---

## 1. Idea

A Swiss poster that happens to be playable. Paper, ink, one drop of red. The page is set like a
printed sheet: a huge condensed headline, a strict column grid broken on purpose, tiny mono
annotations pinned to the corners, crosshair registration marks, and a king cut down the middle,
half light / half dark.

Nothing is decorated. Everything is typeset.

## 2. Palette (locked)

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#E8E4DC` | Page background, light squares, light pieces |
| `--ink` | `#111111` | Text, rules, dark squares, dark pieces, dark panels |
| `--accent` | `#B3201E` | **Only**: last-move squares, selected square, legal-target marks, king in check, the eval marker, a clock under 20 s, and in a review the blunder marks (`??` in the list, squares on the graph, the current blunder's fill, the blunder badge on the board). Nothing else, including the split king, and no other review grade. |
| `--paper-2` | `#DAD5CB` | Hairline fills on paper (hover on light squares, move-list rules) |
| `--ink-2` | `#2A2927` | Hover on dark squares, secondary dark surfaces |
| `--ink-mute` | `#5C5955` | Muted mono labels on paper (5.49:1) |
| `--paper-mute` | `#A8A49B` | Muted mono labels on ink (≥ 4.5:1) |
| `--grain` | SVG feTurbulence, 4–6% opacity | Paper grain overlay, never on the board |

Measured contrast (WCAG 2.2):

| Pair | Ratio | Use |
|---|---|---|
| ink on paper | 14.89 | all body & headline text |
| paper on ink | 14.89 | text on dark panels |
| red on paper | 5.27 | red text allowed (AA) |
| paper on red | 5.27 | cream text on red fill allowed |
| red on ink | 2.83 | **forbidden for text**; red on ink only as a ≥ 3px non-text marker |
| ink-mute on paper | 5.49 | mono micro-copy |

Rules:
- Red is a signal, not a brand colour. If red appears in a place that is not last-move,
  selection, check, or the eval marker, it is a bug.
- No greys other than the four listed. No gradients. No shadows. No rounded corners (0px).
- Dark mode: none. The poster is paper. `color-scheme: light` is declared.

## 3. Typography (locked)

| Role | Font | Weight | Size / tracking | Case |
|---|---|---|---|---|
| Display headline | **Anton** | 400 (single weight) | `clamp(4.5rem, 15vw, 15rem)`, line-height 1.0 (caps that wrap never go under 1.0), tracking −0.005em | UPPER |
| Section headline | Anton | 400 | `clamp(2.25rem, 4.5vw + 0.5rem, 4.75rem)`, line-height 1.0 | UPPER |
| Body | IBM Plex Sans | 400 / 500 | 16px (1rem) – 18px, line-height 1.5, max 62ch | Sentence |
| Micro-copy | **IBM Plex Mono** | 400 / 500 | 11px – 12px, line-height 1.4, tracking **+0.14em** | UPPER |
| Move list / clock | IBM Plex Mono | 400 / 500 | 13px – 14px list, `clamp(1.75rem, 4vw, 2.5rem)` clock, `font-variant-numeric: tabular-nums` | — |
| Board coordinates | IBM Plex Mono | 500 | 10px – 11px, tracking +0.08em | lower a–h, 1–8 |

Fallbacks: Anton → "Bebas Neue" → Impact → sans-serif condensed. IBM Plex Mono → ui-monospace.
Fonts are loaded from Google Fonts with `display=swap`; `size-adjust` fallback metrics are set
so the headline does not reflow on load.

Micro-copy convention: `LABEL — VALUE` with a short dash (U+2014 with hair spaces, rendered as
`—`), e.g. `MOVE — 14`, `CLOCK — 05:00`, `WHITE — YOU`. Never a colon.

Body text minimum 16px. Micro-copy may go to 11px only in mono, uppercase, high contrast.

## 4. Spacing & grid

Base unit 4px. Scale: `4 8 12 16 24 32 48 64 96 128 192`.

- Page gutter: 16px (≤ 640), 24px (641–1024), 40px (> 1024).
- Poster grid: 12 columns on desktop, 6 on tablet, 4 on mobile. Gap 16px / 24px.
- Rules (lines) are 1px ink at 100% opacity, or 2px for the major frame. Rules are the only
  "container" style; no cards, no boxes with fills except pure ink panels.
- Asymmetry: the headline block is offset (cols 1–9 top-left), the king sits cols 8–12
  bottom-right overlapping the headline baseline. Corner micro-copy occupies the four corners of
  the frame at a fixed 16px/24px inset.
- Crosshair ornament: 16×16, 1px ink, with a 3px gap at centre. Used at grid intersections and
  frame corners only. Max four per view.

## 5. Components

### Board
- 8×8, square, `min(92vw, 560px)` on mobile, up to 640px on desktop, never smaller than 320px.
- Light squares `--paper`, dark squares `--ink`. Flat. No texture on the board.
- Pieces: original silhouette SVGs on a 45×45 grid. Light pieces: fill `--paper`, stroke `--ink`
  1.6px. Dark pieces: fill `--ink`, stroke `--paper` 1.6px. The stroke is what makes a dark piece
  readable on a dark square, so it is always present.
- Piece scale: 82% of the square.
- Square states (drawn as inset rules so the colour reads on both square tones):
  - last move: 3px inset `--accent` rule + 18% `--accent` fill on paper squares. On ink squares
    the rule carries a 1px `--paper` edge outside it (red on ink is 2.83:1; the paper edge is
    what makes the mark pass 3:1) and the fill is 30%.
  - selected: 4px inset `--accent` rule, same paper edge on ink squares.
  - legal target: a 28% `--accent` square (empty) with a 2px `--paper` halo on ink squares;
    a 4px `--accent` ring (capture) with the paper edge on ink squares.
  - check: the king's square fills `--accent` mixed 80% with paper, identical on both square
    tones, so it is the brightest thing on the board. The king keeps its stroke.
  - keyboard focus: a 3px ring inset 3px from the square's edge (`outline-offset: −6px`),
    `--ink` on paper squares, `--paper` on ink squares. The gap is what separates the ring
    from the four neighbouring squares. Sits above every other state.
- Coordinates: inside the board, bottom row + left file, mono, never under 10px (11px at
  80px squares), colour inverted to the square.
- Touch target: on phones the board runs edge to edge inside its 2px frame (44px squares at a
  375px viewport, 38px at 320px). WCAG 2.2 Target Size AA (24px) is met everywhere.
- Interaction: tap-to-move (tap origin, tap destination) is the primary pattern. Drag is an
  enhancement for mouse and pen only, never the only way (WCAG 2.5.7); on touch the board
  keeps `touch-action: pan-y` so a swipe still scrolls the page. Tapping the selected piece
  again deselects it, by pointer and by Enter alike. Keyboard: Tab to the board,
  arrows move a cursor, Enter/Space select & move, Esc cancels, each square is a `gridcell`
  with an `aria-label` like "e4, white knight".
- Promotion: four pieces stacked over the destination file, one square wide, hanging from the
  promotion rank. Focus moves into it, Tab cycles inside it, Escape or a tap elsewhere cancels,
  and focus returns to the destination square afterwards.
- Game over: an ink card over the board, Anton headline (`WHITE WINS`, `DRAW`), mono reason,
  one `New game` button that takes focus.

### Move list
- Mono 13–14px, two columns (white / black) per move row, move number in `--ink-mute`.
- Current move: `--ink` fill, `--paper` text. No red.
- Scrolls inside a 1px-ruled column; newest move auto-scrolled into view.

### Clock
- Anton or mono? **Mono**, tabular numerals, `clamp(1.75rem, 4vw, 2.5rem)`.
- Active side: ink fill, paper text. Inactive: paper, ink text. Under 20s: text turns `--accent`
  on paper (5.27:1) — the fourth allowed red (it is a "check"-class warning). Below 10s, also a
  slow 1Hz opacity pulse unless reduced motion.

### Evaluation bar
- Vertical, 12px wide on desktop (full board height), horizontal 8px tall above the board on
  mobile. Two fills: ink (black's share) and paper (white's share), with a 1px ink frame.
- The 50% mark is a 2px `--accent` tick. The bar is driven by an `EngineAdapter`; Stockfish
  19 lite runs in a Web Worker (`VITE_ENGINE_WORKER`). Without it the `NullEngine` returns
  `null` and the bar rests at 50% with the red marker. The fill moves with `transform` only.
- `role="meter"`, `aria-valuemin/-max/-now`, `aria-label="Evaluation"`.

### Buttons
- Primary: ink fill, paper text, mono uppercase 12px, 44px min height, 1px ink border.
- Secondary: paper fill, ink text, 1px ink border.
- Hover: swap fill/text (instant, 0ms is allowed by the style; we use 120ms for comfort).
- Focus-visible: 3px ink outline offset 3px (on ink buttons: 3px paper outline offset −6px inside
  a 1px frame so it reads).
- Disabled: 55% opacity, cursor `not-allowed`, the native attribute.
- Destructive controls (`New game` mid-game, `Resign`) arm on the first press and fire on the
  second within 4 s; the armed state is an ink fill and the label says `Confirm …`.

### Games index (Chess.com archive)
- Rows parted by hairlines, 64px minimum, the whole row one link. Columns on desktop: date (mono
  muted), outcome (Anton, `WIN` / `LOSS` / `DRAW`, loss in `--ink-mute`), who (mono, two lines),
  meta (mono muted). On phones the outcome moves to the right edge and the rest stacks.
- Player card: name in Anton, ratings as four figures with their records, parted by hairlines.
- One `<select>` for the month, mono, zero radius, an ink chevron.
- 50 rows at a time; a quiet "Show more" button after that.

### Review (analysis page)
- Same frame as the play page. The side column holds, top to bottom: far player with accuracy,
  the evaluation graph, the status line (move, judgement, best move, score), the annotated move
  list, the near player with accuracy, the controls.
- Evaluation graph: 120px tall, ink box, paper area from the floor up to White's winning
  chances, a 1px red line at even, 6px red squares with a paper edge on blunders, a paper-and-ink
  cursor at the current ply, a mono tooltip. Click seeks. The move list is its table.
- Judgement marks in the move list: `!!` brilliant (ink tile), `!` great, `?!` inaccuracy,
  `?` mistake (underlined), `×` miss, `??` blunder (red); best, great and brilliant in weight 500;
  book moves in `--ink-mute` with an inline open-book glyph. Excellent and good carry no mark.
- Accuracy is set like a clock: mono, tabular, ruled box, with `acc` as its unit. It counts up
  from zero (1.1 s, ease-out cubic) when a review lands, then settles with one 1.06 pulse.
- The far/near player line lists only the grades that happened, good news first:
  `1 brilliant — 2 great — 1 blunder`, or `no mistakes`.
- The bottom-left corner names the game's opening (`OPENING — C41 PHILIDOR DEFENSE`) once graded.

### Review grades (added 2026-11-02)

Ten grades, decided in this order (`src/analysis/review.ts`):

| Grade | Rule |
|---|---|
| book | the position after the move is on a named line of the lichess `chess-openings` set (CC0), and every move before it was book |
| brilliant | best or excellent, offers ≥ 2 pawns of material (static exchange on the moved piece, or a piece newly left en prise), mover was < 95% before and ≥ 50% after |
| great | the engine's first choice with its second choice ≥ 15 points worse (MultiPV 2); not mate in one, a recapture, a reply to check, or taking material the opponent just blundered |
| miss | an inaccuracy or worse right after the opponent's mistake (≥ 20 points), mover still ≥ 35% |
| best / excellent / good | engine's first choice / < 3 points lost / < 10 |
| inaccuracy / mistake / blunder | ≥ 10 / ≥ 20 / ≥ 30 points of winning chances lost |

### Grade icons (revised 2026-11-02, at the user's request)
The user could not pick out the paper/ink tiles and chose Chess.com's convention instead. This is
a deliberate, scoped exception to §2: a **grade scale** of ten colours, used only on grade icons,
grade markers on the graph, the best-move arrow and engine-line chips. Nowhere else.

| Grade | Token | Hex | Mark |
|---|---|---|---|
| brilliant | `--grade-brilliant` | #26C2A3 | `!!` |
| great | `--grade-great` | #749BBF | `!` |
| best | `--grade-best` | #81B64C | star |
| excellent | `--grade-excellent` | #81B64C | thumb |
| good | `--grade-good` | #95B776 | tick |
| book | `--grade-book` | #A88865 | open book |
| inaccuracy | `--grade-inaccuracy` | #F7C631 | `?!` |
| mistake | `--grade-mistake` | #FFA459 | `?` |
| miss | `--grade-miss` | #FF7769 | × |
| blunder | `--grade-blunder` | #FA412D | `??` |

- A disc (the one place with a radius), white mark, sized by `--g`. The colour is never the only
  channel: every icon sits next to the grade's name or carries it as its accessible label.
- Shown on the board (46% of a square, hung off the destination square, 2px paper ring), beside
  every move in the list and the variation, large (2.4rem) in the verdict line, and in the
  per-player tally table under the review. Moves still waiting for the engine show a dashed ring.
- Text set in a grade colour is mixed ≥ 45% with ink so it keeps 4.5:1 on paper.

### Explore and best moves
- The review board is live: any move from any position opens a variation from that point; the
  game's own move simply steps forward. A paper-2 box lists the variation with its grades and a
  `Back to game` button; Escape or Left at its start also returns.
- Positions the review did not see are analysed live (depth 16, two lines) and graded the same way.
- `Best move — on/off` toggles the arrows: the first choice as a thick green arrow, the second
  as a thinner blue one. The two engine lines sit under the verdict; pressing one plays its move.
- Left/Right always step the game after a mouse click on the board; the board keeps them for its
  own cursor only when it was reached with Tab.

### Learn (added 2026-11-02)
- `/learn` hub: four doors (puzzles, openings, middlegame, endgames) in a 2×2 ruled grid,
  Anton titles, progress line in mono.
- Lists (`.rows`): hairline rows, a mono key column, Anton title, plain body, a ruled state tag.
- Trainers reuse the play frame. The side column holds: a big `.prompt` (Anton, green when
  solved, red and one shudder when a move is refused), notes, then controls.
- Refused moves snap back and flash a mistake icon on the square they tried.
- Roadmap (added 2026-11-04): `/learn/roadmap` lists four stages, each an ordered path of
  steps (lesson, puzzle set, endgame drill, opening, puzzle rating). A 2px ink rule runs down
  the path; each step has an 18px square mark, ink-filled with a tick when done. The next step
  is the one inverted row (ink fill, paper text). Stages not yet reached show an outlined Anton
  numeral. Progress bars are flat 8px ruled meters in ink. No red anywhere on the roadmap.
- The hub leads with an ink roadmap panel (next step, meter, Continue) above the trainer doors;
  the first door spans both columns.
- Step lessons (`/learn/lessons/:id`) use the trainer frame with a row of numbered step pips.

### Crosshair / ornament
- Pure CSS or inline SVG, `aria-hidden`.

## 6. Motion

Motion dial 5/10 (raised from 2 on 2026-11-02 at the user's request: play should feel physical,
a review should feel like a reveal). Still transform and opacity only, still no scroll animation.

- Page load: headline and king fade/rise 12px over 350ms `cubic-bezier(.2,.7,.2,1)`, staggered
  60ms. That is the only reveal. No scroll-triggered animation.
- Selected piece: lifts (−4% y, scale 1.07) over 120ms.
- Piece move, 200ms (`--dur-move`): picked up at scale 1.08, carried, set down with a 0.95 press,
  released. The board diffs the two positions, so castling moves both pieces, en passant takes
  the right pawn, promotion slides the new piece from the pawn's square, and stepping back
  through a review runs the move in reverse (the taken piece fades back in). A jump of more than
  one move cuts. A piece dropped by drag does not slide.
- Capture: the taken piece shrinks to 0.5 with a −14° turn and fades, starting as the attacker lands.
- Check: the king flinches (three damped shakes, 420ms) and a 1/16-square ink ring closes on it once.
- Checkmate: the mated king falls on its side (760ms, a small bounce) and stays down; the result
  card rises 14px after 700ms so the fall is seen first.
- Legal targets scale in over 120ms; capture rings fade in from 1.25.
- Promotion chooser drops 10px into place.
- Grade badge: pops from 0 with a −20° turn to 1.16, settles (380ms), after the move lands.
  Brilliant throws eight rules out from the square and the glyph glints; great throws eight
  short ones; blunder shudders once.
- Hover: 120ms colour swap.
- `@media (prefers-reduced-motion: reduce)`: all durations → 0ms, pulse off, pieces jump,
  ghosts and rays are not drawn, badges appear without the pop. Sound is unaffected (it has its
  own switch).
- No parallax, no scroll-jacking, no marquee.

### Sound (added 2026-11-02)

All synthesised with Web Audio in `src/sound/sounds.ts`; no audio files. A move is a short
band-passed noise burst (the click of felt on wood) over a falling sine body (the board).

| Event | Sound |
|---|---|
| move | one knock |
| capture | brighter, louder knock and a second small knock 22ms later |
| castle | two knocks 95ms apart |
| check | knock and an A5 bell |
| promote | knock and a rising E5–B5 |
| new game | G4–D5 bells |
| game over | G5–E5–C5 bells, after the mating move |
| clock under 10s | a dry tick each second |
| brilliant | a C-major run of four bells with air on top |
| great | E5–B5 bells |
| best | one G5 bell |
| book | a turned page (noise sweep) |
| inaccuracy / mistake | one dull D4 / falling E4–C4 |
| miss | a falling whoosh |
| blunder | a low thud and a falling three-note line |
| review finished | C–E–G chord |

- A review step sounds the move; stepping forward onto a graded move adds its grade 170ms later.
  Excellent and good are silent so a clean game is not a chorus.
- Repeats of one sound closer than 45ms are dropped (holding an arrow key).
- `SOUND — ON / OFF` in the nav, `aria-pressed`, stored in `localStorage` (`counterplay.sound`).
  Audio starts suspended and is unlocked by the first pointer or key press.

## 7. UX rules for a game board (from the ux domain search, applied)

1. Target size: web AA minimum 24px; we use ≥ 40px squares and ≥ 44px buttons.
2. Adjacent targets: squares are adjacent by nature; selection confirmation (highlight) makes
   mis-taps recoverable. Tap-outside / Esc cancels.
3. Keyboard: complete play without a pointer; tab order = visual order; no traps.
4. Focus: visible on every control, never obscured by sticky UI.
5. Dragging: never the only option.
6. Contrast: all text ≥ 4.5:1, all non-text state indicators ≥ 3:1 against both square tones.
7. Reduced motion respected.
8. Colour is never the only channel: check also sets a text status ("CHECK") in the status line;
   last move is also in the move list; selected square has an outline *and* `aria-selected`.
9. One live region per page: the status line is `role="status"` and announces moves, check
   and results. Corner copy repeats it visually but is not live.
10. Reserve space: board and panels have fixed aspect/height so nothing shifts when fonts load;
    on phones the wrapping status corner sits below the board, never above it.
11. Keyboard: Tab reaches the board once (roving cursor); arrows, Home/End, PageUp/PageDown move
    it; Left/Right outside the board walk the move list.

## 8. Anti-patterns (do not)

- No card UI, no drop shadows, no border radius, no gradients, no 3D.
- No colour other than paper / ink / red / the two muted tones.
- No emoji, no icon fonts; inline SVG only.
- No red for buttons, links, hover, or decoration.
- No grey-on-grey text.
- No animation on scroll.
- No copy from the reference poster.

## 9. Tech constraints

- React 19 + Vite + Tailwind 4 (`@theme` tokens mirror section 2 and 3).
- `chess.js` is the only rules source. The board renders from a FEN/position snapshot and emits
  intents (`{from, to, promotion?}`); it never mutates the game.
- Layers: `src/board/` (presentation), `src/game/` (state, chess.js wrapper, clock), `src/engine/`
  (`EngineAdapter` interface + `NullEngine`; Stockfish WASM Web Worker adapter to plug in later).

## 10. Themes (added 2026-11-10, at the user's request)

The site now ships thirteen themes (seven added 2026-11-10 morning, six more the same afternoon). **Typography** is the system described in §§1–9 and stays the default; the others are alternatives the visitor picks from the nav (`Theme` button → picker panel). The palette and type locks in §2–§3 apply to Typography only.

| Theme | Palette | Type | Board | Pieces |
|---|---|---|---|---|
| Typography | paper `#E8E4DC`, ink `#111`, red `#B3201E` | Anton / IBM Plex | paper and ink | silhouette |
| Clubhouse | ivory, walnut ink, green accent | Fraunces / Source Sans 3 | maple and walnut with grain, 6px frame | silhouette in ivory and ebony, drop shadow |
| Night Shift | midnight, lavender ink, magenta accent | Chakra Petch / Space Grotesk | two midnight blues, magenta glowing frame | silhouette lit cyan (White) and magenta (Black) |
| Bauhaus | bone, black, red, blue, yellow | Outfit / DM Mono | bone and blue | geometric: circle, square, triangle, L, dome, cross |
| Arcade | deep purple, pink-red accent | Pixelify Sans / Space Mono | handheld greens | 12×14 pixel bitmaps with a computed ring |
| Terminal | black, phosphor green, amber accent | VT323 / IBM Plex Mono | dark greens | FEN letters: capitals White, lower case Black |
| Blueprint | drafting blue, white line, yellow accent | Space Grotesk / Space Mono | blue grid, hatched dark squares | silhouette, White solid, Black in outline |
| Tournament | off-white, green accent, sentence case labels | Archivo / Inter | buff and green vinyl | Staunton glyphs (Noto Sans Symbols 2) |
| Marble | stone, gold accent | Cormorant Garamond / Karla | veined white and grey marble, gold frame | silhouette, alabaster and onyx with gold detail |
| Gazette | newsprint, ink-blue accent | Playfair Display / Source Serif 4 | book diagram: plain light squares, hatched dark squares | Staunton glyphs |
| Pop Art | yellow with halftone, red accent | Bangers / Nunito | white and electric blue, hard shadow | silhouette, thick outline, hard shadow |
| Sunset | chocolate, cream, orange accent | Shrikhand / DM Sans | mustard and burnt orange, rounded | silhouette in cream and chocolate |
| High Contrast | black, white, yellow marks and focus | Atkinson Hyperlegible | white and mid grey | silhouette with 4px outlines; labels in sentence case |

**How it works.** `src/theme/themes.ts` lists the themes (piece set, fonts, copy); `src/theme/useTheme.ts` stores the choice in `localStorage` (`counterplay.theme`), sets `<html data-theme>`, loads that theme's Google Fonts on demand, and updates `theme-color`. An inline script in `index.html` sets the attribute before first paint. Every themable token lives in `src/styles/themes.css` in a `:root, [data-theme]` block (Typography values) followed by one block per theme. Derived tokens (board, pieces, eval) are declared in the same block as the palette, so a picker card with `data-theme="arcade"` renders Arcade inside any page. Piece drawings are in `src/board/pieceSets.tsx`; `<Piece>` draws in the active theme's set unless given `set`.

**Rules for adding a theme.** Define every palette, board and piece token; keep White's pieces lighter than Black's in every theme (players read colour by lightness); keep square marks (`--mark`) visible on both square colours; check the hero headline wraps before the king at 1440px; check text contrast for body copy on `--color-paper` and for `--color-paper` on `--color-ink` (inverted bands).

**Copy per theme.** The landing headline, the board sentence, the motto under the statement and the footer colophon come from the theme, so the page never describes a look it is not showing.

**Board options** (in the theme panel, stored in `counterplay.settings.v1`): coordinates, legal-move dots, auto-queen. Coordinates and dots are `data-coords` / `data-hints` switches on `<html>`; auto-queen is read by `Board` when a pawn reaches the last rank.

**Knight arrows** bend like the move: two squares along the long leg, then one to the side (`knightArrowPath` in `Board.tsx`), drawn as one polygon so the translucent fill never doubles at the corner.

## 11. Play and Analysis (added 2026-11-10)

- **Play** opens on a setup form: opponent (computer or a friend on the same device), computer level 1–8 (`src/game/useComputer.ts`: Stockfish Skill Level plus depth/movetime, and a share of random moves at levels 1–3), your colour (White, Black, Random), time control (none, 1+0 to 30+0, with increments), evaluation bar on or off (off by default so it does not play for you). In game: take back (two plies against the computer), flip, draw by agreement (friend games), resign and leave both confirm with a second press. The result card offers Rematch, Review game and New setup.
- **Analysis** home: paste, open a `.pgn` file, or paste from the clipboard; "Recently analysed" (last eight, `src/analysis/library.ts`, kept in localStorage); and a famous-games library (`src/analysis/famousGames.ts`, 20 games 1750–2013) filtered by player chips (world champions plus Morphy and Anderssen), era, or free-text search. `npm run check:famous` replays every game with chess.js and confirms each claimed mate.
- Unknown URLs render a 404 page; phones get a Menu button instead of a three-row nav.

**Drawing on the board** (added 2026-11-10, every board): right-click a square to mark it, right-drag for an arrow (knight jumps draw as an L); Shift, Alt and Ctrl/Cmd switch pen colour (green, blue, yellow; plain is orange). The same mark again removes it; a left-click, Escape or the next move clears all. On touch: press and hold a square (450 ms), then tap another for an arrow or the same one for a mark. Pen colours (`--pen-*`) are fixed across themes, like a felt pen. Lives in `Board.tsx` (`toggleDrawing`, `penOf`); the hint line is `components/DrawHint.tsx`.

## 12. Home, saved games, settings, grading (added 2026-11-10)

- **Home** keeps the poster hero (three actions: Play, Review, Learn) and the live board, and adds: six "ways in" cards (Play, Review, Learn, Puzzles, Famous games, Your games) with live stats; a grade explainer (all ten grade icons, one line each); three featured famous games; a strip of all themes that switches the look on click.
- **Saved games** (`src/library/saved.ts`, localStorage `counterplay.saved.v1`): a star on every Chess.com archive row, a Save button on every review and on the end-of-game card. Each saved game keeps its own PGN (Chess.com games keep their route), so it survives the recent list rolling over. Listed at the top of Your games and beside the Analysis form.
- **Settings** (`/settings`, gear in the nav): theme grid; board (coordinates, legal-move dots, auto-queen, last-move highlight, animation); sound on/off, volume, test sounds; new-game defaults (opponent, level, colour, time, eval bar); review (best-move arrow); your data (reset learning progress, clear saved/recent, forget the Chess.com username, restore defaults), each destructive action confirmed by a second press.
- **Grading** (`src/analysis/review.ts`), checked against real Stockfish on famous games with a node harness: a mating move, a move that keeps the fastest forced mate, or the engine's second line scoring the same as its first is **best**; a sacrifice counts as **brilliant** when the mover would not already be winning without it (judged by the engine's second choice, or it is the only way to a forced mate) and stands no worse than about −0.5 after (Kasparov's 24.Rxd4); a quiet only-move that leaves an attacked piece en prise counts too (Fischer's 17...Be6); a pseudo-sacrifice that wins the material straight back does not (Fischer's 18.Nd4 v Spassky); walking into a forced mate is a **blunder**, softened to mistake below −7 and inaccuracy below −10 (the lichess rule); letting a forced mate go is a **miss** while still above +7, otherwise a blunder.

## 13. Learn, gamified (added 2026-11-10)

Designed from the research on gamified learning: meta-analyses find levels carry most of the effect and points or badges alone little; streaks are the feature learners rate most useful; XP farming is the documented failure mode; leaderboards are contested (and there is no server). So:

- **XP pays for new learning** (`src/learn/game.ts`, `award()` is the only way in): a first clean puzzle solve 5–20 XP by difficulty against your rating, a repeat 2, solved after a slip 2; lesson step 3 (1 with a slip), lesson 25 (5 on review); opening 15, mastered 30 (repeats 4–5); endgame 30 (repeat 6); Arcade 2 per solve + 10 for a personal best; roadmap stages 100–300 once. Existing progress converts to XP on first visit.
- **Levels and ranks**: level n needs 25·n·(n−1) XP in all (50, 150, 300, 500…); ranks every few levels from Pawn to King (5 Knight, 10 Bishop, 15 Rook, 20 Queen, 30 King), shown as a piece medal.
- **Daily goal and streak**: goal 10/25/50/100 XP; the streak counts days the goal was met; a streak freeze is earned every 7 days (hold two) and spent automatically on a missed day.
- **Daily quests**: three a day, seeded by the date (one puzzle quest, one skill quest, one from the rest of the site), +15–20 XP each, +25 for all three.
- **Badges** (`src/learn/badges.ts`): 35, each naming a real skill (rating milestones, roadmap stages, Lucena and Philidor, 25 mating puzzles…), derived from progress so past work counts; progress bars start from the badge's own baseline (ratings from 1200).
- **Arcade** (`/learn/arcade`, unrated): Puzzle Rush, 3:00, difficulty rising with each solve, combo of correct moves adds time at 5/12/20/30 (+3/+5/+7/+10 s), a miss costs 10 s and resets the combo; Puzzle Streak, no clock, harder each puzzle, one miss ends it (the solution is shown), one skip.
- **Feedback**: a HUD on every learn page (rank, XP bar, streak flame, goal ring); toasts for XP (merged when quick), quests, goal, level-ups and badges, with sounds for the big ones. XP gold `--xp`, flame `--flame`, frost `--frost` are fixed colours like the grade scale.

## 14. Online play (added 2026-11-20)

Asked for "playable with people just like chess.com", ahead of a deploy. The user chose: a single Node server (any host), accounts plus guests, and quick pairing, friend links, lobby with spectating, and chat for launch.

**Pages**
- `/online` (the lobby, "Online" in the nav after Play): head (`PLAY ONLINE`, who is online, who you are playing as); a two-column grid on desktop: **Quick pairing** (Rated / Casual switch, ten time-control tiles 1+0 to 30+0 in a 4-up grid, Anton numerals, speed below in mono) and **Play a friend** (time, side, Create a link); then **Open seeks** and **Live games** as ruled lists with one button per row. Phone: everything stacks; the tiles go two-up.
- `/game/:id`: the Play frame (`play__frame`, corners `ONLINE — 3 + 2 RATED BLITZ`, `WATCHING — n`, `STATUS — …`, `SERVER — CONNECTED / RECONNECTING…`), board, both players with name, rating (`?` when provisional) and clock, the move list, controls and a **chat** panel at the foot of the side column. On desktop the side column is a flex column that may grow past the board's height to fit the chat. Waiting challenges use the setup layout: board preview left, the link with Copy, and Cancel (creator), or Accept and play (anyone else).
- `/login` (`?mode=signup`, `?next=` same-site paths only): one card, a two-tab segmented control, username and password, the error line in the existing `connect__help--error`.
- `/u/:name`: the Games-page player card (name at `--text-3xl`, not the page-hero size), four rating tiles (bullet, blitz, rapid, classical) and the finished games in the `index` list, linking back to `/game/:id`.
- Nav gains `ONLINE`, an account link (`SIGN IN` or the username, mono at `--text-xs`) and, while you have a live game elsewhere, an ink-filled `YOUR GAME` link.

**Rules**
- No new colours. Red stays where §2 puts it: board marks, the clock under 20 s, error text. Rating changes are `+12` in weight 600 and `−8` muted, never green or red. Searching pulses the tile's label; waiting states end in a stepped square (`.waiting-dot`); both stop under `prefers-reduced-motion`.
- Controls confirm like Play: Resign and Draw arm on the first press. Abort appears only before both sides have moved; Accept draw / Decline replace Draw while an offer is open; Claim the win appears after the opponent has been gone 30 s.
- The result card is the Play card: You win / You lose / Draw / Aborted, the reason and rating change, then Rematch (or Accept rematch / Rematch offered — cancel), New opponent (re-seeks the same clock), Review game (opens the Stockfish review), View board.
- The sticky start button is a Play-setup rule only; the lobby, login and challenge pages keep it in the flow.

**Game rules (server)**: clocks start after Black's first move; each side has 30 s for its first move or the game is aborted (aborted games are not stored); checkmate, stalemate, threefold, fifty-move and insufficient material end the game at once; a flag against a lone king or king and one minor is a draw; draw offers lapse when the other side moves, one per four plies. Ratings are Glicko-2 per speed, updated each game (lichess's τ 0.75, RD 45–350, provisional above RD 110); guests play casual only. Only players can chat; 140 characters, five lines per ten seconds.
