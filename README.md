# Counterplay

A paper-and-ink chess board set like a Swiss poster.

| Route | What it is |
|---|---|
| `/` | The landing sheet |
| `/play` | A game against yourself with a clock, Stockfish keeping the evaluation bar |
| `/games` and `/games/:username` | Your Chess.com archive, month by month, straight from the public API (no login, just the username) |
| `/analysis` | Paste any PGN |
| `/analysis/chesscom/:username/:year/:month/:id` and `/analysis/pgn/:key` | The review: Stockfish grades every move, with an evaluation graph, accuracy per side, an annotated move list and a grade tally. Play any move on the board to explore a variation; arrows and two engine lines show the best moves |
| `/online` | Play people: quick pairing by time control (rated or casual), a link for a friend, open seeks, live games to watch |
| `/game/:id` | An online game (or a friend's challenge): server clocks, draw offers, resign, abort, rematch, chat, spectators |
| `/login`, `/u/:name` | Sign in or create an account; a player's ratings and finished games |
| `/learn` | A beginner-to-advanced roadmap, step lessons, puzzles (rated), opening lessons (White, and Black against 1.e4 and 1.d4), middlegame motifs, endgame drills against Stockfish |

```
npm install
npm run dev:all    # game server + Vite, http://localhost:5173 (or `npm run dev` for the site alone)
npm run build      # type-check (site and server) + production build into dist/
npm start          # the production server: dist/ + API + WebSocket on PORT (8787)
npm run check:online   # boots a throwaway server and plays real games against it
```

## Online play and deploying

Everything online runs in one Node process (`server/`, Node 22.18+ loads the TypeScript directly): it serves `dist/`, a small JSON API (`/api/me`, `/api/register`, `/api/login`, `/api/logout`, `/api/users/:name`) and the game WebSocket at `/ws`. The protocol is typed once in `src/online/protocol.ts` and shared by both sides. Games are server-authoritative: chess.js on the server validates every move and owns the clocks; the browser only shows its own move early.

| File | Owns |
|---|---|
| `server/index.ts` | HTTP, static files (brotli/gzip, immutable caching for `assets/`), the WebSocket upgrade, graceful shutdown |
| `server/hub.ts` | Connections, the lobby, seeks and matchmaking (same clock and rated flag; rated seeks within a rating window that widens 25 points a second), challenges, rematches |
| `server/game.ts` | One game room: moves, clocks, first-move abort, draws, resign, abandonment claims, chat, spectators |
| `server/db.ts` | SQLite via Node's built-in `node:sqlite` (no native build): users, sessions, games |
| `server/auth.ts` | scrypt passwords, session cookies, signed guest cookies, rate limits |
| `server/glicko.ts` | Glicko-2 ratings per speed |
| `src/online/` | The browser side: the shared socket (`connection.ts`), account calls (`api.ts`), the game hook (`useOnlineGame.ts`) |

**Deploy.** Step-by-step guides for a free Oracle Cloud server or your own PC with Cloudflare Tunnel, with HTTPS on your own domain, are in [`deploy/README.md`](deploy/README.md) (`deploy/setup.sh` does the server setup in one command). By hand: `docker build -t counterplay . && docker run -p 8080:8080 -v counterplay-data:/data counterplay`. Without Docker: `npm ci && npm run build && NODE_ENV=production npm start`. Whatever the host (Fly.io, Render, Railway, a VPS):

- **Mount a persistent volume at `DATA_DIR`** (`/data` in the image). The SQLite database lives there; without a volume every deploy wipes accounts and games.
- **Run exactly one instance.** Live games are held in that process's memory; two instances would split players between them. (A restart is fine: live games are saved on every move and on shutdown, and resume with the downtime not charged.)
- Serve it over **HTTPS**: in production the cookies are `Secure`. Set `SESSION_SECRET` to a long random string (otherwise one is generated and kept in the database). Behind a proxy or load balancer set `TRUST_PROXY=1` so rate limits see real addresses; the proxy must pass WebSocket upgrades on `/ws`.
- Other settings: `PORT`, `HOST`, `DIST_DIR`, `ALLOWED_ORIGINS` (comma-separated, only if the site is served from a different origin than the server). Health check: `GET /healthz`.

Not built yet: premoves, password reset (there is no email), reporting/blocking and moderation, anti-cheat, and lag compensation on the clock.

## Layout of the code

| Folder | Owns | Knows about |
|---|---|---|
| `src/board/` | Presentation: squares, piece silhouettes, keyboard cursor, tap/drag, promotion chooser, move animation, grade badges | a `Position` snapshot and move *intents* only |
| `src/game/` | State: the chess.js wrapper (`rules.ts`), the game reducer (`useGame.ts`), the clock (`useClock.ts`) | chess.js. Nothing in here renders |
| `src/engine/` | `EngineAdapter` interface, `NullEngine` (the placeholder), `StockfishWorkerEngine` (UCI over a Web Worker), `useEngine` | FEN in, evaluation out |
| `src/chesscom/` | The Chess.com public-API client and the hooks that cache a player's months | `fetch` only; nothing is stored but the username |
| `src/analysis/` | PGN parsing, the review maths (win chances, judgements, accuracy), static exchange and sacrifice detection (`classify.ts`), the opening book (`openings.ts`) and the review runner | `src/engine` and `chess.js` |
| `src/sound/` | The Web Audio synth and the mute setting | nothing but the browser |
| `src/learn/` | Roadmap, step lessons, puzzle set and loader, opening lessons, motifs, endgame drills, progress store, the line trainer and the play-out hook | `src/analysis`, `src/engine`, `src/game` |
| `src/components/` | Corner micro-copy, crosshair, split king, clock, move list, eval bar, eval graph, nav, footer | tokens from `DESIGN.md` |
| `src/pages/` | `Landing.tsx`, `Play.tsx` | composes the three layers |
| `src/styles/` | `tokens.css` (palette, type, spacing), `base.css`, `app.css` (page and component CSS, Hallmark stamp) | |

The board never mutates the game: it emits `{ from, to, promotion? }` and the page asks `useGame` whether that is legal. `rules.ts` is the only file in `src/game/` that imports chess.js; `src/analysis/` uses it directly for PGN parsing and static exchange.

## Stockfish

Stockfish 19 (the lite, single-threaded WASM build from the `stockfish` npm package, about 1.8 MB) runs in a Web Worker and drives the evaluation bar. `npm run dev` and `npm run build` copy the engine from `node_modules` into `public/engine/` first (`npm run engine:copy`), and `.env` points the app at it:

```
VITE_ENGINE_WORKER=/engine/stockfish-19-lite-single.js
```

The engine corner on the play page reads `ENGINE — STOCKFISH, +0.3 AT DEPTH 12` once it has an opinion. Remove the variable (or the files) and the app falls back to `NullEngine`: the bar rests at even with its red mark.

To use the full-strength engine instead, copy `stockfish-19-single.js` and its 94 MB `.wasm` and change the variable. The multi-threaded builds need cross-origin isolation headers, which a plain static host does not send.

## Reviewing games

A review runs Stockfish over every position of the game at depth 16 with two lines (MultiPV 2), then looks again at depth 20 at both sides of every move graded brilliant, great, miss, inaccuracy, mistake or blunder (or close to the inaccuracy line), and grades the game again. Grades appear in the list while the engine works. When the move played was one of the engine's two lines, it is scored from that same search rather than from a separate one, which removes most of the noise between searches. The review, converts each score to White's winning chances with the curve lichess uses, and grades every move by the chances its side gave away: 10 points is an inaccuracy (`?!`), 20 a mistake (`?`), 30 a blunder (`??`). A move that matches the engine's first choice is "best"; under 3 points lost is "excellent", under 10 "good". On top of that:

- **book**: still on a named opening line. The book is `src/analysis/openings.json`, built from the CC0 [lichess chess-openings](https://github.com/lichess-org/chess-openings) TSVs (7,981 positions, a lazy ~100 kB gzipped chunk). The game's opening is named in the corner.
- **brilliant** (`!!`): a best or near-best move that offers at least two pawns of material, by static exchange, from a position that was not already won.
- **great** (`!`): the only move, when the engine's second choice is at least 15 points worse.
- **miss** (`×`): failing to punish the opponent's mistake.

The full rules are in `DESIGN.md` §5 and `src/analysis/review.ts`. Accuracy per side is the mean of the per-move accuracy curve, so it is comparable to lichess's number, not to Chess.com's.

Reviews are cached in `sessionStorage` for the tab (under a `v3` key, so older reviews re-run). Left and Right arrows step through the game, Home and End jump, F flips the board; clicking the graph seeks.

## Learn

- **Roadmap** (`/learn/roadmap`): every lesson, puzzle set, drill and opening in the order a new player should meet them, in four stages (Foundations, Club player, Patterns and plans, Advanced; `src/learn/roadmap.ts`). Nothing is locked; completion is read from the progress each trainer already keeps.
- **Lessons** (`/learn/lessons/:id`): eleven guided lessons in `src/learn/lessons.ts`, from how the pawn moves to the Greek gift. Each step is a position and a task; the tactical steps were checked with Stockfish 19 so the solution is the best move and every accepted alternative is as good.
- **Puzzles** (`/learn/puzzles`): 1,959 positions from the [lichess puzzle database](https://database.lichess.org/#puzzles) (CC0), chosen for popularity ≥ 88, ≥ 800 plays and a settled rating, spread over ratings 600–2700, 28 motifs, six endgame types and 19 openings (`src/learn/puzzles.json`, a lazy ~95 kB gzipped chunk). Your puzzle rating moves by Elo against each puzzle's rating; any mating move is accepted on the last move.
- **Openings** (`/learn/openings/:id`): fourteen main lines in `src/learn/openings.ts`, each move with its reason. Learn mode shows the move as an arrow; practice mode asks for it from memory.
- **Middlegame** (`/learn/middlegame`): the motifs in `src/learn/motifs.ts`, each explained and trained on puzzles tagged with it.
- **Endgames** (`/learn/endgames/:id`): fourteen positions in `src/learn/endgames.ts` played out against Stockfish at depth 18, with a goal (mate, promote safely, or hold the draw for N moves). Each was checked with Stockfish (depth 24 to 28) to be the win or draw it claims; the one exception is bishop and knight against king, a known theoretical win that the engine scores only as +1.6 without tablebases.

`npm run check:learn` replays every opening line, lesson step and endgame FEN through chess.js and checks every id the roadmap points at.

Progress (puzzle rating, streaks, lessons, drills) lives in `localStorage` under `counterplay.learn.v1`.

## Sound and motion

Every sound is synthesised in `src/sound/sounds.ts` with Web Audio: no files to ship. Moves, captures, castling, check, promotion, game over, a clock tick under ten seconds, and one sound per review grade. `SOUND — ON/OFF` in the nav mutes it and remembers the choice. The board animates by diffing positions (`src/board/motion.ts`), so castling, en passant, promotion and stepping backwards all move the right pieces; check shakes the king, mate topples it, and review grades pop onto the board as badges (`src/board/Badge.tsx`). Everything respects `prefers-reduced-motion`. See `DESIGN.md` §6.

## Design

`DESIGN.md` is the locked system: paper `#E8E4DC`, ink `#111111`, one red `#B3201E` used only for the last move, the selected square, check, the eval mark and a clock under twenty seconds. Anton for headlines, IBM Plex Mono for micro-copy, IBM Plex Sans for body. No radius, no shadows, no gradients.
