import { Link, useNavigate } from 'react-router-dom'
import { FAMOUS_GAMES, famousPgn } from '../analysis/famousGames'
import { storePgn } from '../analysis/library'
import { JUDGEMENT_WORD, type Judgement } from '../analysis/review'
import { Board } from '../board/Board'
import { GradeIcon } from '../board/GradeIcon'
import { Piece } from '../board/Piece'
import { Corner } from '../components/Corner'
import { Crosshair } from '../components/Crosshair'
import { Footer } from '../components/Footer'
import { Nav } from '../components/Nav'
import { SplitKing } from '../components/SplitKing'
import { ThemePreview } from '../components/ThemePicker'
import type { PieceType } from '../game/types'
import { useGame } from '../game/useGame'
import { useProgress } from '../learn/progress'
import { useRoadmap } from '../learn/roadmap'
import { useSavedGames } from '../library/saved'
import { THEMES } from '../theme/themes'
import { setTheme, useTheme } from '../theme/useTheme'

/** A quiet middlegame so the showcase board has something on it. */
const SHOWCASE_FEN = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 8'

const GRADE_NOTES: { kind: Judgement; note: string }[] = [
  { kind: 'brilliant', note: 'A sound sacrifice: material given for a winning attack.' },
  { kind: 'great', note: 'The only move that holds or wins; everything else is worse.' },
  { kind: 'best', note: 'Stockfish’s own choice, or one exactly as good.' },
  { kind: 'excellent', note: 'Almost as good as the best; nothing lost.' },
  { kind: 'good', note: 'A sensible move that gives a little away.' },
  { kind: 'book', note: 'Opening theory: a named line players know.' },
  { kind: 'inaccuracy', note: 'A small slip; the position gets harder.' },
  { kind: 'mistake', note: 'A real error that costs winning chances.' },
  { kind: 'miss', note: 'The opponent erred, or mate was there, and the chance slipped.' },
  { kind: 'blunder', note: 'Loses material, the game, or walks into mate.' },
]

const FEATURED = ['immortal', 'game-of-the-century', 'kasparov-topalov']

interface Door {
  to: string
  piece: PieceType
  title: string
  body: string
  stat: string
}

export function Landing() {
  const game = useGame(SHOWCASE_FEN)
  const theme = useTheme()
  const navigate = useNavigate()
  const [p] = useProgress()
  const road = useRoadmap()
  const saved = useSavedGames()
  const toMove = game.position.turn === 'w' ? 'White' : 'Black'

  const doors: Door[] = [
    { to: '/play', piece: 'k', title: 'Play', body: 'Stockfish at eight levels, from a first game to full strength, or a friend on the same screen. Bullet to classical, or no clock.', stat: 'vs computer · vs friend' },
    { to: '/analysis', piece: 'q', title: 'Review', body: 'Paste any game and Stockfish grades every move, brilliant to blunder, with the best line on the board.', stat: 'depth 16, critical moves 20' },
    {
      to: '/learn',
      piece: 'r',
      title: 'Learn',
      body: 'A roadmap from the first pawn move to the endings masters play: lessons, openings, tactics, endgames.',
      stat: road.done ? `${road.done} of ${road.total} steps done` : `${road.total} steps, 4 stages`,
    },
    { to: '/learn/puzzles', piece: 'n', title: 'Puzzles', body: 'Real positions from real games, matched to your rating. Find the move that wins.', stat: `Your rating — ${p.puzzleRating}` },
    { to: '/analysis#lib-head', piece: 'b', title: 'Famous games', body: 'The Immortal, the Opera Game, Fischer at thirteen, Kasparov’s Immortal: replay them with the engine.', stat: `${FAMOUS_GAMES.length} classics, 1750 on` },
    { to: '/games', piece: 'p', title: 'Your games', body: 'Pull your Chess.com archive by username, review any game, and star the ones worth keeping.', stat: saved.length ? `${saved.length} saved` : 'Chess.com archive' },
  ]

  const openFamous = (id: string) => {
    const g = FAMOUS_GAMES.find((x) => x.id === id)
    if (!g) return
    try {
      navigate(`/analysis/pgn/${storePgn(famousPgn(g), `${g.title}: ${g.white} v ${g.black}`, `Famous game, ${g.year}`)}`)
    } catch {
      navigate('/analysis')
    }
  }

  return (
    <>
      <Nav />
      <main id="main">
        <section className="hero" aria-labelledby="hero-head">
          <Corner pos="tl" label="Edition" value="01" cross />
          <Corner pos="tr" label="Theme" value={theme.name} cross />
          <Corner pos="bl" label="Rules" value="chess.js" mute />
          <Corner pos="br" label="Engine" value="Stockfish 19" mute />
          <div className="container hero__grid">
            <h1 id="hero-head" className="hero__head reveal" style={{ '--i': 0 } as React.CSSProperties}>
              {theme.headline}
            </h1>
            <div className="hero__lede reveal" style={{ '--i': 1 } as React.CSSProperties}>
              <p className="lead">Play Stockfish or a friend, review every move you make, and learn from the first pawn push to master endings. In the browser, free, nothing to install.</p>
              <div className="hero__actions">
                <Link to="/play" className="btn">
                  Play a game
                </Link>
                <Link to="/analysis" className="btn btn--quiet">
                  Review a game
                </Link>
                <Link to="/learn" className="btn btn--quiet">
                  Start learning
                </Link>
              </div>
            </div>
            <div className="hero__king reveal" style={{ '--i': 2 } as React.CSSProperties}>
              <SplitKing />
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="doors-head">
          <div className="container">
            <div className="head-block">
              <h2 id="doors-head">Everything on the board</h2>
              <p className="lead">Six ways in. Pick one; your progress, saved games and settings stay in this browser.</p>
            </div>
            <ul className="hdoors">
              {doors.map((d, i) => (
                <li key={d.to}>
                  <Link to={d.to} className="hdoor">
                    <span className="hdoor__top">
                      <span className="tcard__icon" aria-hidden="true">
                        <Piece type={d.piece} color={i % 2 ? 'b' : 'w'} />
                      </span>
                      <span className="mono mono--sm mono--mute">{String(i + 1).padStart(2, '0')}</span>
                    </span>
                    <span className="hdoor__title">{d.title}</span>
                    <span className="hdoor__body">{d.body}</span>
                    <span className="hdoor__stat mono mono--sm">
                      {d.stat} <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section section--rule" aria-labelledby="board-head">
          <div className="container grid12">
            <div className="head-block">
              <h2 id="board-head">The board, as drawn</h2>
              <p className="lead">{theme.boardLine} Try a move, draw an arrow with a right-click, or change the theme below.</p>
            </div>
            <div className="showcase" data-kind="product">
              <Corner pos="tl" label="To move" value={toMove} live />
              <Corner pos="tr" label="Ply" value={String(game.state.history.length)} />
              <Board
                position={game.position}
                orientation="w"
                selected={game.state.selected}
                targets={game.targets}
                interactive={game.canPlay}
                pendingPromotion={game.state.pendingPromotion}
                onSelect={game.select}
                onMove={game.attemptMove}
                onPromote={game.promote}
                onCancelPromotion={game.cancelPromotion}
                label="Sample board"
              />
              <Corner pos="bl" label="Last" value={game.state.history.at(-1)?.san ?? 'none'} mute />
              <Corner pos="br" label="Keys" value="arrows, enter, esc" mute />
            </div>
            <div className="showcase__note">
              <p className="mono mono--mute">Tap a piece, then a square. Or drag it.</p>
              <button type="button" className="btn btn--quiet btn--sm" onClick={game.reset} disabled={!game.state.history.length}>
                Reset the sample
              </button>
            </div>
          </div>
        </section>

        <section className="section section--rule" aria-labelledby="grades-head">
          <div className="container">
            <div className="head-block">
              <h2 id="grades-head">Every move, graded</h2>
              <p className="lead">Stockfish reads the whole game and marks each move the way players already know. Mates, only-moves and sacrifices are judged on the engine’s own terms.</p>
            </div>
            <ul className="hgrades">
              {GRADE_NOTES.map((g) => (
                <li key={g.kind} className="hgrade">
                  <GradeIcon kind={g.kind} className="hgrade__icon" />
                  <span>
                    <span className="hgrade__name">{JUDGEMENT_WORD[g.kind]}</span>
                    <span className="hgrade__note">{g.note}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="hsec__more">
              <Link className="btn" to="/analysis">
                Review a game
              </Link>
            </p>
          </div>
        </section>

        <section className="section section--rule" aria-labelledby="famous-head">
          <div className="container">
            <div className="head-block">
              <h2 id="famous-head">Replay the classics</h2>
              <p className="lead">Twenty famous games from 1750 to today, each with its story. Open one and watch the engine find the brilliancies.</p>
            </div>
            <ol className="fgames">
              {FEATURED.map((id) => FAMOUS_GAMES.find((g) => g.id === id)!).map((g) => (
                <li key={g.id} className="fgame">
                  <p className="mono mono--sm mono--mute">
                    {g.year} — {g.event}
                  </p>
                  <h3 className="fgame__title">{g.title}</h3>
                  <p className="fgame__players">
                    {g.white} <span className="mono--mute">v</span> {g.black}
                  </p>
                  <p className="fgame__story">{g.story}</p>
                  <div className="fgame__foot">
                    <span className="mono mono--sm">{g.result}</span>
                    <button type="button" className="btn btn--sm" onClick={() => openFamous(g.id)}>
                      Review
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <p className="hsec__more">
              <Link className="btn btn--quiet" to="/analysis#lib-head">
                All {FAMOUS_GAMES.length} famous games
              </Link>
            </p>
          </div>
        </section>

        <section className="section section--rule" aria-labelledby="themes-head">
          <div className="container">
            <div className="head-block">
              <h2 id="themes-head">{THEMES.length} looks, one click</h2>
              <p className="lead">Each theme restyles the whole site: colours, type, the board and the pieces. Try one now; it sticks until you change it.</p>
            </div>
            <ul className="hthemes" aria-label="Themes">
              {THEMES.map((t) => (
                <li key={t.id}>
                  <button type="button" className={`hthemes__btn${t.id === theme.id ? ' hthemes__btn--on' : ''}`} aria-pressed={t.id === theme.id} onClick={() => setTheme(t.id)}>
                    <span className="theme-card" data-theme={t.id}>
                      <ThemePreview theme={t} />
                      <span className="theme-card__name">{t.name}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="hsec__more">
              <Link className="btn btn--quiet" to="/settings">
                Board and sound settings
              </Link>
            </p>
          </div>
        </section>

        <section className="section section--rule" aria-labelledby="table-head">
          <div className="container grid12">
            <div className="head-block">
              <h2 id="table-head">What the table holds</h2>
            </div>
            <div className="rows">
              <div className="row">
                <h3 className="row__title">Rules</h3>
                <span className="row__num mono mono--mute">01</span>
                <p className="row__fact">Every move is checked by chess.js: castling, en passant, promotion, threefold repetition, the fifty-move rule.</p>
              </div>
              <div className="row">
                <h3 className="row__title">Clock</h3>
                <span className="row__num mono mono--mute">02</span>
                <p className="row__fact">Bullet, blitz, rapid or classical, with increments, or no clock at all. It starts on White’s first move and flags at zero.</p>
              </div>
              <div className="row">
                <h3 className="row__title">Engine</h3>
                <span className="row__num mono mono--mute">03</span>
                <p className="row__fact">Stockfish 19 runs in your browser beside the board: your opponent at eight levels, the evaluation bar, and the reviewer.</p>
              </div>
              <div className="row">
                <h3 className="row__title">Review</h3>
                <span className="row__num mono mono--mute">04</span>
                <p className="row__fact">
                  Pull your archive from <Link to="/games">Chess.com</Link> by username, paste a PGN, or finish a game here, and every move is graded.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="statement-head">
          <div className="container grid12">
            <div className="statement">
              <h2 id="statement-head">The whole game on one sheet.</h2>
              <p className="statement__by mono mono--mute">{theme.motto}</p>
            </div>
          </div>
        </section>

        <section className="band on-ink" aria-labelledby="band-head">
          <div className="container band__row">
            <h2 id="band-head">White moves first.</h2>
            <div className="band__cta">
              <p className="mono mono--mute">Stockfish — eight levels waiting</p>
              <Link to="/play" className="btn">
                Start a game
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <span className="visually-hidden">
        <Crosshair />
      </span>
    </>
  )
}
