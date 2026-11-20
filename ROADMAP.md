# Oukplay roadmap: what to add next, and how to store it

**Status (2026-11-20):** Phases 0–2 are done: migrations, per-move clocks, rating history, saved chat, nightly backups, premoves, lag compensation, ping, `%clk` in PGNs, recovery codes, password changes and the account page. Phases 3–5 are next, each to be agreed before it is built.

## Context
Online play works: pairing, friend links, lobby, watching, chat, accounts, Glicko ratings. It runs as one Node server with one SQLite file (`server/db.ts`). Before real players arrive, these are missing:
- premoves, which matter most in bullet
- adjusting clocks for network lag
- password reset (there is no email)
- block, report and moderation
- anti-cheat

There is also a storage gap that gets worse every day the site is live:
- **Chat** is kept only in memory (`GameRoom.chat`, `server/game.ts:94`).
- **Move times** are not saved; `games.moves` is a list of moves only.
- **Rating history** is not kept; `users.ratings` holds only the current rating.
- **Schema changes:** tables are made with `CREATE TABLE IF NOT EXISTS`, so there is no safe way to change them later.

The plan has 6 phases, in order. Phase 0 and Phase 1 are the first job; later phases each get their own approval.

---

## Phase 0: Storage groundwork ✅ done

**0.1 Migrations** in `server/db.ts`
- Keep the current `CREATE TABLE`s as migration 1.
- Add `const MIGRATIONS: string[]`.
- Store the version in `meta('schema_version')`.
- At boot, if migrations are pending:
  1. Make a backup copy with `VACUUM INTO DATA_DIR/backups/pre-vN-<date>.db`.
  2. Run each pending migration in `BEGIN…COMMIT`.
- Every later phase adds tables only through this.

**0.2 Start saving data now** (migration 2), so it is already there when features need it:

| What | Storage | Written by |
|---|---|---|
| Clock after each move | `games.clocks TEXT` (centiseconds, space-separated, matches `moves`) | `saveProgress` / `finishGame` |
| Rating history | `rating_history(user_id, speed, rating, rd, game_id, at)`, index `(user_id, speed, at)` | `GameRoom.applyRatings` |
| Chat | `chat_lines(game_id, user_id, text, at)`, index `game_id` | `GameRoom.say` (also restores `chat.history` after a restart) |
| Users | add `role TEXT NOT NULL DEFAULT 'user'` | reserved for moderation |

**Retention:**
- Delete `chat_lines` 30 days after the game ends, unless the game has an open report.
- Run this in the existing once-a-minute `Hub` sweep, throttled to once an hour.

**0.3 Daily backups**
- `setup.sh` installs a cron entry that runs `deploy/backup.sh` every day.
- It keeps 14 days of copies, with a printed reminder to copy them off the server.

---

## Phase 1: Premoves and lag ✅ done

### 1.1 Premoves (client only; the server is unchanged)
**Where it lives:** state in `src/online/useOnlineGame.ts`; never stored or sent until it is played.

**Rules:**
- One premove at a time, like lichess.
- Set it by clicking your own piece, then a target, while it is the opponent's turn.

**Which targets to offer:**
- New pure function `premoveTargets(position, square)` in `src/game/premove.ts`.
- Uses the piece's movement pattern and ignores blockers:
  - knight jumps
  - full rook, bishop and queen lines
  - king one step, plus castling if king and rook are on their home squares
  - pawn: one and two steps forward and both forward diagonals
- Tested in a new `scripts/check-premove.ts`.

**When the opponent's move arrives (`game` message):**
- If the premove is now legal (check with chess.js on the new position), send it straight away through the same path as `attemptMove`.
- If not, cancel it quietly.
- Promotion premoves always promote to a queen.

**Cancelling:** click an empty square, press Escape, or right-click the board.

**On the board:**
- `src/board/Board.tsx` gets an optional `premove: {from, to} | null` prop.
- Shown with the existing selection outline on both squares, dashed. No new colour; it is noted in DESIGN.md.
- `Board`'s `targets` already render dots, so they reuse it with the premove targets.

**Setting:**
- `premoves: boolean` (default on) in `src/settings/useSettings.ts` (stored in `oukplay.settings.v1`).
- A switch in the Settings page next to auto-queen.

### 1.2 Lag compensation (server)
**Measuring lag:**
- While a game is live, the server sends `{t:'lag', n}` every 3 s to each player's connection.
- The client answers `{t:'lag', n}` right away.
- `Conn.rtt` is a moving average of the round trip (the newest reading counts 25%).
- New message pair in `src/online/protocol.ts`, handled in `Hub.handle`.

**Giving time back** in `GameRoom.move`:
- Credit = `min(rtt/2, 500 ms, bank[side])`, added back to the mover's clock.
- `bank` starts at 1.5 s per player, gains 100 ms per move, and is capped at 3 s. It lives in memory only (a restored game starts with a fresh bank).
- This is the same idea lichess uses: it smooths out ordinary lag, but nobody can fake lag for unlimited time.

**Client:**
- `GameView` gets `ping: Record<Side, number|null>`.
- The player strip shows `PING 84` in small mono text, next to the existing connected or away marker.

### 1.3 Show the stored clocks
- Online games' PGN export (`OnlineGame.tsx`, event block near line 57) adds `{[%clk 0:02:31]}` after each move.
- Profile "recent games" stays as it is.

---

## Phase 2: Account safety (no email needed) ✅ done

**Recovery code instead of email:**
- At sign-up, show a one-time 12-character recovery code (with a "Copy" button and a confirm checkbox).
- Store it hashed with the existing `hashPassword` (`server/auth.ts`) in `users.recovery_hash`.
- `/login` gets "Forgot password": username, recovery code and new password.
  - On success: set the new password, issue a new code, delete all of that user's sessions.
  - Rate limited with the existing `authLimit`.
- Existing users without a code see a banner on their own profile: "Create a recovery code".

**Change password** on your own profile: `POST /api/password` (current + new). It ends the other sessions.

**Email reset** can come later, through an SMTP provider. Not now.

---

## Phase 3: Block, report, moderate

**Tables (one migration):**
- `blocks(blocker_id, blocked_id, at, PRIMARY KEY(blocker_id, blocked_id))`
- `reports(id, reporter_id, target_id, game_id NULL, reason CHECK IN ('cheating','abuse','sandbagging','other'), note TEXT ≤500, status 'open'|'closed', created_at, handled_by, handled_at, outcome)`
- `mod_log(id, mod_id, target_id, action, note, at)`
- `users` gains: `muted_until INTEGER`, `banned_at INTEGER`, `ban_reason TEXT`, `mark TEXT NULL` (`'engine'` or `'boost'`).

**Blocking** (players with accounts):
- Blocked pairs are never paired. `Hub.matchmake` gets a `blocked(a, b)` check that reads an in-memory set loaded at boot.
- They can't accept each other's seeks or challenges, and their seeks don't show to each other.
- In a game already under way, the blocked player's chat is hidden.
- Block or Unblock button on a profile.

**Reporting:**
- "Report" on a profile and in a finished game's menu: a reason, and an optional note.
- Limited to 5 a day per reporter. Guests can't report.

**Mute and ban** are checked in `Hub.handle`:
- A muted user's chat is rejected with an error.
- A banned user's sessions are deleted and logging in is refused.
- An `'engine'` mark:
  - the user is paired only with other marked users
  - their ratings are hidden on their profile
  - games against them stop changing the opponent's rating

**Moderator page `/mod`** (shown when `role` is `mod` or `admin`):
- List of open reports, with the game link, its saved chat (`chat_lines`) and the player's recent games.
- Actions: dismiss, warn, mute 24 h / 7 d, mark engine, ban. Each action writes to `mod_log`.
- **First admin:** env `ADMIN_USERS=name1,name2` sets the role at boot; no admin UI is needed for that.
- DESIGN.md gets a section for the report dialog and the mod page.

**Chat filter:**
- A small word list in `server/chat-filter.ts` masks slurs.
- 3 hits in one day gives an automatic 24 h mute.

---

## Phase 4: Anti-cheat (realistic for one small server)

No automatic bans. The tools help a person decide.

**Signals the server already has (cheap):**
- A rating rise much faster than the player's history (`rating_history`).
- Move times that are unusually even (`games.clocks`).

These add a note to the mod page; they never act on their own.

**Engine check on demand:**
- On `/mod`, "Analyse" runs the existing in-browser Stockfish review (`src/analysis/*`, `useReview`) on the reported player's last 10 rated games, in the moderator's browser. This puts no load on the server.
- It stores, per side:
  - `game_analysis(game_id, side, acpl, top1_pct, moves, avg_ms, sd_ms, at)`
- It shows them next to the player's normal numbers.

**Not doing:** tab-focus tracking or browser fingerprinting. They catch innocent players and miss real cheats.

---

## Phase 5: More to play (pick later)

| Feature | Storage |
|---|---|
| Rating graph on profile | `rating_history` (from Phase 0) |
| Leaderboard per speed | generated columns `blitz_rating` etc. on `users` from `json_extract(ratings, …)`, plus an index |
| Follow players + challenge a user directly | `follows(follower_id, followee_id, at)`; `challenge` gets an optional `to` field and the target sees it in the lobby |
| Your online game history on `/games` next to Chess.com | existing `gamesOf` |
| Installable app (PWA) | manifest + service worker caching `assets/` |
| Arena tournaments | `tournaments`, `tournament_players`; pairing in `Hub` |
| **Ouk Chatrang (Cambodian chess) as a variant** | needs its own move rules (chess.js can't do it), a `variant` column on `games`, and new piece art; this is the biggest item and fits the new name |

---
