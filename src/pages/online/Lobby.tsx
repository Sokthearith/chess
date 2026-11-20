import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Footer } from '../../components/Footer'
import { Nav } from '../../components/Nav'
import { clearError, onMessage, send, subscribeLobby, useOnline } from '../../online/connection'
import { ONLINE_TIME_CONTROLS, timeControl, type ColorChoice } from '../../online/protocol'
import { playerLabel } from './OnlineGame'

const PREF_KEY = 'oukplay.online.v1'

interface Prefs {
  rated: boolean
  friendTc: string
  friendColor: ColorChoice
}

function readPrefs(): Prefs {
  const d: Prefs = { rated: true, friendTc: '10+0', friendColor: 'random' }
  try {
    return { ...d, ...(JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') as Partial<Prefs>) }
  } catch {
    return d
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p))
  } catch {
    /* private mode */
  }
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

export function Lobby() {
  const online = useOnline()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [prefs, setPrefsState] = useState<Prefs>(readPrefs)
  const setPrefs = (p: Partial<Prefs>) => {
    const next = { ...prefs, ...p }
    setPrefsState(next)
    savePrefs(next)
  }
  const user = online.user
  const guest = !user || user.guest
  const rated = prefs.rated && !guest

  useEffect(() => subscribeLobby(), [])
  useEffect(() => clearError, [])

  // A friend challenge was created: go to its page, which shows the link.
  useEffect(
    () =>
      onMessage((m) => {
        if (m.t === 'challenge.created') navigate(`/game/${m.id}`)
      }),
    [navigate],
  )

  // "New opponent" from a finished game arrives as ?seek=3+2&rated=1.
  const seekParam = params.get('seek')
  const ratedParam = params.get('rated')
  useEffect(() => {
    if (!seekParam || !user) return
    if (timeControl(seekParam)) send({ t: 'seek', tc: seekParam, rated: ratedParam === '1' && !user.guest })
    setParams({}, { replace: true })
  }, [seekParam, ratedParam, user, setParams])

  const seeking = online.seeking
  const seek = (tc: string) => {
    clearError()
    if (seeking && seeking.tc === tc && seeking.rated === rated) send({ t: 'seek.cancel' })
    else send({ t: 'seek', tc, rated })
  }
  const challenge = () => {
    clearError()
    send({ t: 'challenge', tc: prefs.friendTc, rated, color: prefs.friendColor })
  }

  const lobby = online.lobby
  const others = lobby?.seeks.filter((s) => s.by.id !== user?.id) ?? []
  const playingNow = online.current

  return (
    <>
      <Nav />
      <main id="main" className="container online">
        <section className="online__head">
          <h1>Play online</h1>
          <p className="lead">
            Pick a clock and we find you an opponent, or send a friend a link. {lobby ? `${lobby.online} online, ${lobby.playing} playing now.` : ''}
          </p>
          <p className="mono mono--sm online__who">
            {online.status === 'open' || online.status === 'connecting' ? null : <span className="online__warn">Server — reconnecting. </span>}
            {user ? (
              guest ? (
                <>
                  Playing as {user.name} — casual games only. <Link to="/login?next=/online">Sign in</Link> or <Link to="/login?mode=signup&next=/online">create an account</Link> to play rated.
                </>
              ) : (
                <>
                  Signed in as <Link to={`/u/${user.name}`}>{user.name}</Link>
                  {user.ratings ? ` — bullet ${user.ratings.bullet.rating}, blitz ${user.ratings.blitz.rating}, rapid ${user.ratings.rapid.rating}` : ''}
                </>
              )
            ) : (
              'Connecting…'
            )}
          </p>
          {playingNow ? (
            <p className="online__banner">
              You have a game in progress. <Link to={`/game/${playingNow}`}>Return to it</Link>
            </p>
          ) : null}
          {online.error ? (
            <p className="connect__help--error mono mono--sm" role="alert">
              {online.error}
            </p>
          ) : null}
        </section>

        <section className="online__grid">
          <div className="quick" aria-labelledby="quick-head">
            <div className="shelf__head">
              <h2 id="quick-head">Quick pairing</h2>
              <div className="seg__row online__mode" role="radiogroup" aria-label="Game type">
                <label className={`seg__opt${rated ? ' seg__opt--on' : ''}${guest ? ' seg__opt--off' : ''}`} title={guest ? 'Sign in to play rated games' : undefined}>
                  <input type="radio" className="visually-hidden" name="mode" checked={rated} disabled={guest} onChange={() => setPrefs({ rated: true })} />
                  <span className="seg__label">Rated</span>
                </label>
                <label className={`seg__opt${!rated ? ' seg__opt--on' : ''}`}>
                  <input type="radio" className="visually-hidden" name="mode" checked={!rated} onChange={() => setPrefs({ rated: false })} />
                  <span className="seg__label">Casual</span>
                </label>
              </div>
            </div>
            <ul className="quick__grid">
              {ONLINE_TIME_CONTROLS.map((tc) => {
                const on = seeking?.tc === tc.id && seeking.rated === rated
                const waiting = lobby?.seeks.filter((s) => s.tc === tc.id && s.rated === rated && s.by.id !== user?.id).length ?? 0
                return (
                  <li key={tc.id}>
                    <button type="button" className={`quick__tile${on ? ' quick__tile--on' : ''}`} aria-pressed={on} onClick={() => seek(tc.id)} disabled={!!playingNow}>
                      <span className="quick__tc display">
                        {tc.minutes} + {tc.increment}
                      </span>
                      <span className="mono mono--sm">{on ? 'Searching — tap to stop' : cap(tc.speed)}</span>
                      {!on && waiting ? <span className="quick__wait mono mono--sm">{waiting} waiting</span> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
            {seeking ? (
              <p className="mono mono--sm waiting-dot" role="status">
                Looking for a {seeking.rated ? 'rated' : 'casual'} {seeking.tc} opponent
                {seeking.rated ? ' near your rating' : ''}. Keep this tab open.
              </p>
            ) : null}
          </div>

          <form
            className="friend"
            aria-labelledby="friend-head"
            onSubmit={(e) => {
              e.preventDefault()
              challenge()
            }}
          >
            <div className="shelf__head">
              <h2 id="friend-head">Play a friend</h2>
            </div>
            <fieldset className="seg">
              <legend className="mono mono--sm">Time</legend>
              <div className="seg__row seg__row--time">
                {ONLINE_TIME_CONTROLS.map((tc) => (
                  <label key={tc.id} className={`seg__opt${tc.id === prefs.friendTc ? ' seg__opt--on' : ''}`}>
                    <input type="radio" className="visually-hidden" name="friend-tc" checked={tc.id === prefs.friendTc} onChange={() => setPrefs({ friendTc: tc.id })} />
                    <span className="seg__label">
                      {tc.minutes} + {tc.increment}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="seg">
              <legend className="mono mono--sm">You play</legend>
              <div className="seg__row">
                {(['w', 'random', 'b'] as ColorChoice[]).map((c) => (
                  <label key={c} className={`seg__opt${c === prefs.friendColor ? ' seg__opt--on' : ''}`}>
                    <input type="radio" className="visually-hidden" name="friend-color" checked={c === prefs.friendColor} onChange={() => setPrefs({ friendColor: c })} />
                    <span className="seg__label">{c === 'w' ? 'White' : c === 'b' ? 'Black' : 'Random'}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="mono mono--sm mono--mute">{rated ? 'Rated — both of you need accounts.' : 'Casual — no rating change. Anyone can join.'}</p>
            <button type="submit" className="btn setup__start" disabled={!!playingNow}>
              Create a link
            </button>
          </form>
        </section>

        <section className="online__lists">
          <div aria-labelledby="seeks-head">
            <div className="shelf__head">
              <h2 id="seeks-head">Open seeks</h2>
              <p className="mono mono--sm mono--mute">{others.length ? `${others.length} waiting` : 'none right now'}</p>
            </div>
            {others.length ? (
              <ul className="lobby-list">
                {others.map((s) => {
                  const blocked = (s.rated && guest) || !!playingNow
                  return (
                    <li key={s.id} className="lobby-row">
                      <span className="lobby-row__who mono">{playerLabel(s.by)}</span>
                      <span className="mono mono--sm mono--mute">
                        {s.tc} {s.rated ? 'rated' : 'casual'}
                      </span>
                      <button type="button" className="btn btn--sm" disabled={blocked} title={s.rated && guest ? 'Sign in to play rated games' : undefined} onClick={() => send({ t: 'seek.accept', id: s.id })}>
                        Play
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mono mono--sm mono--mute lobby-empty">When someone is waiting for a game, they show up here. Start a seek above and others will see yours.</p>
            )}
          </div>
          <div aria-labelledby="live-head">
            <div className="shelf__head">
              <h2 id="live-head">Live games</h2>
              <p className="mono mono--sm mono--mute">{lobby?.games.length ? `${lobby.games.length} on` : 'none right now'}</p>
            </div>
            {lobby?.games.length ? (
              <ul className="lobby-list">
                {lobby.games.map((g) => (
                  <li key={g.id} className="lobby-row">
                    <span className="lobby-row__who mono">
                      {playerLabel(g.white)} v {playerLabel(g.black)}
                    </span>
                    <span className="mono mono--sm mono--mute">
                      {g.tc} {g.rated ? 'rated' : 'casual'} — move {Math.floor(g.plies / 2) + 1}
                      {g.spectators ? ` — ${g.spectators} watching` : ''}
                    </span>
                    <Link className="btn btn--quiet btn--sm" to={`/game/${g.id}`}>
                      Watch
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mono mono--sm mono--mute lobby-empty">No games being played. Be the first.</p>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
