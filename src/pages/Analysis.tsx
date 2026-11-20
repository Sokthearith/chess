import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { parsePgn } from '../analysis/pgn'
import { useChessComGame } from '../chesscom/useArchive'
import { Footer } from '../components/Footer'
import { Nav } from '../components/Nav'
import type { Color } from '../game/types'
import { ERAS, FAMOUS_GAMES, famousPgn, famousPlayers, type FamousGame } from '../analysis/famousGames'
import { SavedList } from '../components/SavedList'
import { useSavedGames } from '../library/saved'
import { forgetRecent, loadPgn, storePgn, useRecentGames } from '../analysis/library'
import { ReviewPage } from './Review'

export { PGN_PREFIX, hashKey } from '../analysis/library'

const RESULT_TEXT: Record<FamousGame['result'], string> = { '1-0': 'White won', '0-1': 'Black won', '1/2-1/2': 'Drawn' }

function titleOf(pgn: string, fallback: string) {
  try {
    const h = parsePgn(pgn).headers
    return h.White && h.Black ? `${h.White} v ${h.Black}` : fallback
  } catch {
    return fallback
  }
}

function ago(at: number) {
  const m = Math.round((Date.now() - at) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

/** The famous-games shelf: filter by player, era or a search, then review any game. */
function FamousLibrary({ onPick }: { onPick: (g: FamousGame) => void }) {
  const [player, setPlayer] = useState<string | null>(null)
  const [era, setEra] = useState<FamousGame['era'] | null>(null)
  const [q, setQ] = useState('')
  const players = useMemo(famousPlayers, [])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return FAMOUS_GAMES.filter((g) => (!player || g.players.includes(player)) && (!era || g.era === era))
      .filter((g) => !needle || `${g.title} ${g.white} ${g.black} ${g.event} ${g.year} ${g.story}`.toLowerCase().includes(needle))
      .sort((a, b) => a.year - b.year)
  }, [player, era, q])
  return (
    <section className="library" aria-labelledby="lib-head">
      <div className="shelf__head">
        <h2 id="lib-head">Famous games</h2>
        <p className="mono mono--sm mono--mute">
          {FAMOUS_GAMES.length} classics, 1750 to today — pick one and Stockfish grades every move
        </p>
      </div>
      <div className="library__filters">
        <label className="library__search">
          <span className="visually-hidden">Search famous games</span>
          <input type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a player, an event, a year…" />
        </label>
        <div className="chips" role="group" aria-label="Player">
          <button type="button" className={`chip${player === null ? ' chip--on' : ''}`} aria-pressed={player === null} onClick={() => setPlayer(null)}>
            All players
          </button>
          {players.map((p) => (
            <button key={p.name} type="button" className={`chip${player === p.name ? ' chip--on' : ''}`} aria-pressed={player === p.name} onClick={() => setPlayer(player === p.name ? null : p.name)}>
              {p.name} <span className="mono--mute">{p.count}</span>
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Era">
          <button type="button" className={`chip${era === null ? ' chip--on' : ''}`} aria-pressed={era === null} onClick={() => setEra(null)}>
            Every era
          </button>
          {ERAS.map((e) => (
            <button key={e.id} type="button" className={`chip${era === e.id ? ' chip--on' : ''}`} aria-pressed={era === e.id} onClick={() => setEra(era === e.id ? null : e.id)}>
              {e.title}
            </button>
          ))}
        </div>
      </div>
      <p className="mono mono--sm mono--mute" role="status">
        {shown.length === FAMOUS_GAMES.length ? `All ${shown.length} games` : `${shown.length} of ${FAMOUS_GAMES.length} games`}
      </p>
      {shown.length ? (
        <ol className="fgames">
          {shown.map((g) => (
            <li key={g.id} className="fgame">
              <p className="mono mono--sm mono--mute">
                {g.year} — {g.event}
              </p>
              <h3 className="fgame__title">{g.title}</h3>
              <p className="fgame__players">
                <span>{g.white}</span> <span className="mono--mute">v</span> <span>{g.black}</span>
              </p>
              <p className="fgame__story">{g.story}</p>
              <div className="fgame__foot">
                <span className="mono mono--sm">
                  {RESULT_TEXT[g.result]} · {Math.ceil(g.moves.split(/\s+/).filter((t) => !/^\d+\./.test(t)).length / 2)} moves
                </span>
                <button type="button" className="btn btn--sm" onClick={() => onPick(g)}>
                  Review
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="library__empty">
          No game matches.{' '}
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setQ('')
              setPlayer(null)
              setEra(null)
            }}
          >
            Clear the filters
          </button>
        </p>
      )}
    </section>
  )
}

function RecentList() {
  const recent = useRecentGames()
  const saved = useSavedGames()
  if (!recent.length && !saved.length) return null
  return (
    <div className="recent-col">
      {saved.length ? (
        <section className="recent" aria-labelledby="saved-head">
          <h2 id="saved-head" className="recent__head">
            Saved games
          </h2>
          <SavedList />
        </section>
      ) : null}
      {recent.length ? <RecentInner recent={recent} /> : null}
    </div>
  )
}

function RecentInner({ recent }: { recent: ReturnType<typeof useRecentGames> }) {
  return (
    <section className="recent" aria-labelledby="recent-head">
      <h2 id="recent-head" className="recent__head">
        Recently analysed
      </h2>
      <ol className="recent__list">
        {recent.map((r) => (
          <li key={r.key} className="recent__row">
            <Link to={`/analysis/pgn/${r.key}`} className="recent__link">
              <span className="recent__title">{r.title}</span>
              <span className="mono mono--sm mono--mute">
                {r.source} · {ago(r.at)}
              </span>
            </Link>
            <button type="button" className="recent__x" aria-label={`Remove ${r.title} from the list`} onClick={() => forgetRecent(r.key)}>
              ×
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** The analysis index at /analysis: paste or open a PGN, reopen a recent review, or pick a famous game. */
function PasteForm() {
  const navigate = useNavigate()
  const [pgn, setPgn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const go = (text: string, title?: string, source = 'Pasted') => {
    try {
      parsePgn(text)
    } catch (err) {
      setError((err as Error).message)
      return
    }
    try {
      navigate(`/analysis/pgn/${storePgn(text, title ?? titleOf(text, 'Pasted game'), source)}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    go(pgn)
  }
  const loadFile = (file: File | undefined) => {
    if (!file) return
    if (file.size > 2_000_000) {
      setError('That file is too big for one game. Export a single game as PGN and try again.')
      return
    }
    void file.text().then((text) => {
      setPgn(text)
      setError(null)
    })
  }
  const fromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) {
        setError('The clipboard is empty. Copy a PGN first.')
        return
      }
      setPgn(text)
      setError(null)
    } catch {
      setError('The browser would not share the clipboard. Paste into the box with Ctrl+V or ⌘V.')
    }
  }
  return (
    <>
      <Nav />
      <main id="main" className="container games analysis-home">
        <header className="games__head">
          <h1>Analyse a game</h1>
          <p className="lead">Paste a PGN, open a file, or pick a famous game below. Stockfish grades every move, from brilliant to blunder, and you can explore any position.</p>
        </header>
        <div className="analysis-home__top">
          <form className="connect connect--pgn" onSubmit={submit}>
            <label htmlFor="pgn" className="mono">
              Your game — PGN
            </label>
            <textarea
              id="pgn"
              name="pgn"
              rows={9}
              value={pgn}
              onChange={(e) => {
                setPgn(e.target.value)
                setError(null)
              }}
              spellCheck={false}
              required
              aria-invalid={!!error || undefined}
              aria-describedby="pgn-help"
              placeholder={'[White "You"]\n[Black "Them"]\n\n1. e4 e5 2. Nf3 ...'}
            />
            <div className="connect__row">
              <button type="submit" className="btn">
                Review with Stockfish
              </button>
              <label className="btn btn--quiet file-btn">
                Open a .pgn file
                <input type="file" accept=".pgn,.txt,application/x-chess-pgn,text/plain" className="visually-hidden" onChange={(e) => loadFile(e.target.files?.[0])} />
              </label>
              <button type="button" className="btn btn--quiet" onClick={() => void fromClipboard()}>
                Paste
              </button>
            </div>
            <p id="pgn-help" className={`connect__help mono mono--sm${error ? ' connect__help--error' : ' mono--mute'}`} aria-live="polite">
              {error ?? (
                <>
                  Export PGN from Chess.com, lichess or any chess app, or pull your games straight from <Link to="/games">Chess.com</Link>. Played here? Finish a game and press Review game.
                </>
              )}
            </p>
          </form>
          <RecentList />
        </div>
        <FamousLibrary onPick={(g) => go(famousPgn(g), `${g.title}: ${g.white} v ${g.black}`, `Famous game, ${g.year}`)} />
      </main>
      <Footer />
    </>
  )
}

function ChessComReview() {
  const { username = '', year = '', month = '', id = '' } = useParams()
  const { game, status, error } = useChessComGame(username.toLowerCase(), Number(year), Number(month), id)
  const parsed = useMemo(() => {
    if (!game) return null
    try {
      return parsePgn(game.pgn)
    } catch {
      return null
    }
  }, [game])
  if (status === 'loading' || status === 'idle') return <Loading text="Fetching the game from Chess.com…" />
  if (!game || !parsed) return <Loading text={error ?? 'That game could not be read.'} back />
  const me: Color = game.black.username.toLowerCase() === username.toLowerCase() ? 'b' : 'w'
  return (
    <ReviewPage
      gameKey={`chesscom:${id}`}
      parsed={parsed}
      title={`${game.white.username} v ${game.black.username}`}
      orientation={me}
      external={{ href: game.url, label: 'Open on Chess.com' }}
    />
  )
}

function PgnReview() {
  const { key = '' } = useParams()
  const pgn = useMemo(() => loadPgn(key), [key])
  const parsed = useMemo(() => {
    if (!pgn) return null
    try {
      return parsePgn(pgn)
    } catch {
      return null
    }
  }, [pgn])
  if (!parsed) return <Loading text="That game is no longer in this browser’s memory. Paste it again, or pick it from the list." back />
  // Games played on this site name the player "You": show the board from their side.
  const h = parsed.headers
  const orientation: Color = h.Black === 'You' && h.White !== 'You' ? 'b' : 'w'
  const title = h.White && h.Black ? `${h.White} v ${h.Black}` : 'Pasted game'
  return <ReviewPage gameKey={`pgn:${key}`} parsed={parsed} title={title} orientation={orientation} />
}

function Loading({ text, back = false }: { text: string; back?: boolean }) {
  return (
    <>
      <Nav />
      <main id="main" className="container games">
        <section className="games__head">
          <p className="lead" role="status">
            {text}
          </p>
          {back ? (
            <p className="mono">
              <Link to="/analysis">Analyse another game</Link> — <Link to="/games">your Chess.com games</Link>
            </p>
          ) : null}
        </section>
      </main>
      <Footer />
    </>
  )
}

export function Analysis() {
  const params = useParams()
  if ('key' in params) return <PgnReview />
  if ('id' in params) return <ChessComReview />
  return <PasteForm />
}
