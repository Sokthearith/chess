import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  gameIdFromUrl,
  normaliseUsername,
  outcomeFor,
  resultString,
  terminationWords,
  timeControlWords,
  type ArchiveMonth,
  type ChessComGame,
  type ChessComStatBlock,
} from '../chesscom/api'
import { SaveToggle } from '../components/SaveToggle'
import { SavedEmpty, SavedList } from '../components/SavedList'
import { useSavedGames } from '../library/saved'
import { rememberUsername, rememberedUsername, useMonth, usePlayer } from '../chesscom/useArchive'
import { Footer } from '../components/Footer'
import { Nav } from '../components/Nav'

const PAGE = 50
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function monthLabel(m: ArchiveMonth) {
  return `${MONTHS[m.month - 1]} ${m.year}`
}

function dateOf(game: ChessComGame) {
  const d = new Date(game.end_time * 1000)
  // Chess.com files games by UTC month, so the date column follows UTC too.
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`
}

function Rating({ label, block }: { label: string; block?: ChessComStatBlock }) {
  if (!block?.last) return null
  const r = block.record
  return (
    <div className="stat">
      <span className="stat__figure display">{block.last.rating}</span>
      <span className="mono mono--sm">{label}</span>
      {r ? (
        <span className="mono mono--sm mono--mute">
          {r.win} won — {r.loss} lost — {r.draw} drawn
        </span>
      ) : null}
    </div>
  )
}

export function Games() {
  const params = useParams<{ username?: string }>()
  const navigate = useNavigate()
  const username = params.username ? normaliseUsername(params.username) : ''
  const [draft, setDraft] = useState(username || rememberedUsername())
  const { data, status, error } = usePlayer(username)
  const [month, setMonth] = useState<ArchiveMonth | null>(null)
  const [shown, setShown] = useState(PAGE)

  useEffect(() => {
    if (!username && rememberedUsername()) navigate(`/games/${rememberedUsername()}`, { replace: true })
  }, [username, navigate])
  useEffect(() => {
    if (data) {
      rememberUsername(data.profile.username.toLowerCase())
      setMonth(data.archives[0] ?? null)
    }
  }, [data])

  const { games, status: monthStatus, error: monthError } = useMonth(username, month)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const u = normaliseUsername(draft)
    if (u) navigate(`/games/${u}`)
  }

  const stats = data?.stats
  const counts = useMemo(() => {
    if (!games) return null
    const c = { win: 0, loss: 0, draw: 0 }
    for (const g of games) {
      const o = outcomeFor(g, username)
      if (o) c[o]++
    }
    return c
  }, [games, username])

  return (
    <>
      <Nav />
      <main id="main" className="container games">
        <section className="games__head">
          <h1>Your games</h1>
          <p className="lead">Load your Chess.com archive to review any game with Stockfish, and star the ones you want to keep. Saved games stay in this browser.</p>
          <form className="connect" onSubmit={submit}>
            <label htmlFor="cc-user" className="mono">
              Chess.com — username
            </label>
            <div className="connect__row">
              <input
                id="cc-user"
                name="username"
                type="text"
                inputMode="text"
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="hikaru"
                required
              />
              <button type="submit" className="btn" aria-busy={status === 'loading' || undefined}>
                {status === 'loading' ? 'Loading' : 'Load games'}
              </button>
            </div>
            <p className="connect__help mono mono--sm mono--mute" aria-live="polite">
              {error ?? 'Public games only. Nothing is sent anywhere but Chess.com.'}
            </p>
          </form>
        </section>

        <SavedSection />

        {data ? (
          <>
            <section className="player-card" aria-labelledby="player-head">
              <div className="player-card__who">
                <h2 id="player-head">
                  {data.profile.title ? `${data.profile.title} ` : ''}
                  {data.profile.name ?? data.profile.username}
                </h2>
                <p className="mono mono--mute">
                  @{data.profile.username} — joined {new Date(data.profile.joined * 1000).getFullYear()} —{' '}
                  <a href={data.profile.url} target="_blank" rel="noreferrer">
                    profile on Chess.com
                  </a>
                </p>
              </div>
              <div className="stats">
                <Rating label="Bullet" block={stats?.chess_bullet} />
                <Rating label="Blitz" block={stats?.chess_blitz} />
                <Rating label="Rapid" block={stats?.chess_rapid} />
                <Rating label="Daily" block={stats?.chess_daily} />
              </div>
            </section>

            <section className="archive" aria-labelledby="archive-head">
              <div className="archive__bar">
                <h2 id="archive-head" className="visually-hidden">
                  Archive
                </h2>
                <label htmlFor="cc-month" className="mono">
                  Month
                </label>
                <select
                  id="cc-month"
                  className="select mono"
                  value={month ? `${month.year}-${month.month}` : ''}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split('-').map(Number)
                    setMonth({ year: y, month: m })
                    setShown(PAGE)
                  }}
                >
                  {data.archives.map((m) => (
                    <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
                {counts && games ? (
                  <p className="mono mono--sm mono--mute archive__count" aria-live="polite">
                    {games.length} games — {counts.win} won, {counts.loss} lost, {counts.draw} drawn
                  </p>
                ) : null}
              </div>

              {monthStatus === 'loading' ? <p className="mono mono--mute archive__empty">Loading the month…</p> : null}
              {monthStatus === 'error' ? <p className="mono archive__empty">{monthError}</p> : null}
              {games && games.length === 0 ? <p className="mono mono--mute archive__empty">No games that month.</p> : null}
              {games && games.length > 0 && month ? (
                <ol className="index" aria-label="Games">
                  {games.slice(0, shown).map((g) => {
                    const outcome = outcomeFor(g, username)
                    const me = g.white.username.toLowerCase() === username ? 'w' : 'b'
                    const opp = me === 'w' ? g.black : g.white
                    const id = gameIdFromUrl(g.url)
                    return (
                      <li key={g.uuid} className={`index__row index__row--${outcome ?? 'none'}`}>
                        <Link to={`/analysis/chesscom/${username}/${month.year}/${month.month}/${id}`} className="index__link">
                          <span className="index__date mono mono--sm mono--mute">{dateOf(g)}</span>
                          <span className="index__outcome display">{outcome ?? resultString(g)}</span>
                          <span className="index__who">
                            <span className="mono">
                              {me === 'w' ? 'White' : 'Black'} v {opp.username} ({opp.rating})
                            </span>
                            <span className="mono mono--sm mono--mute">
                              {resultString(g)} by {terminationWords(g)}
                            </span>
                          </span>
                          <span className="index__meta mono mono--sm mono--mute">
                            {g.time_class} — {timeControlWords(g)}
                            {g.accuracies ? ` — accuracy ${Math.round(me === 'w' ? g.accuracies.white : g.accuracies.black)}` : ''}
                          </span>
                        </Link>
                        <SaveToggle
                          small
                          game={{
                            id: `chesscom:${id}`,
                            title: `${g.white.username} v ${g.black.username}`,
                            source: `Chess.com, ${g.time_class}`,
                            to: `/analysis/chesscom/${username}/${month.year}/${month.month}/${id}`,
                            result: resultString(g),
                            date: dateOf(g),
                          }}
                        />
                      </li>
                    )
                  })}
                </ol>
              ) : null}
              {games && games.length > shown ? (
                <div className="archive__more">
                  <button type="button" className="btn btn--quiet" onClick={() => setShown((n) => n + PAGE)}>
                    Show {Math.min(PAGE, games.length - shown)} more of {games.length}
                  </button>
                </div>
              ) : null}
            </section>
          </>
        ) : status === 'idle' ? (
          <section className="games__empty">
            <p className="lead">Type a Chess.com username and the archive loads here, month by month. Or paste any game on the <Link to="/analysis">analysis page</Link>.</p>
          </section>
        ) : null}
      </main>
      <Footer />
    </>
  )
}

/** Starred games, above the archive so they are the first thing on the page. */
function SavedSection() {
  const n = useSavedGames().length
  return (
    <section className="saved" aria-labelledby="saved-head">
      <div className="shelf__head">
        <h2 id="saved-head">Saved games</h2>
        <p className="mono mono--sm mono--mute">{n ? `${n} kept` : 'none yet'}</p>
      </div>
      <SavedList empty={<SavedEmpty />} />
    </section>
  )
}
