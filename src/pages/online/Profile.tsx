import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Footer } from '../../components/Footer'
import { Nav } from '../../components/Nav'
import { profile as fetchProfile } from '../../online/api'
import { useOnline } from '../../online/connection'
import { REASON_WORDS, SPEEDS, type Profile as ProfileData } from '../../online/protocol'

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

function dateOf(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function Profile() {
  const { name = '' } = useParams()
  const { user } = useOnline()
  const [data, setData] = useState<ProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setData(null)
    setError(null)
    fetchProfile(name)
      .then((p) => live && setData(p))
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [name])

  const mine = !!user && !user.guest && user.name.toLowerCase() === name.toLowerCase()

  return (
    <>
      <Nav />
      <main id="main" className="container games">
        {error ? (
          <section className="online-empty">
            <h1>{name}</h1>
            <p className="lead">{error}</p>
            <Link className="btn" to="/online">
              Play online
            </Link>
          </section>
        ) : !data ? (
          <p className="mono mono--mute waiting-dot" role="status">
            Loading {name}
          </p>
        ) : (
          <>
            <section className="player-card" aria-labelledby="player-head">
              <div className="player-card__who">
                <h1 id="player-head">{data.name}</h1>
                <p className="mono mono--mute">
                  Joined {dateOf(data.createdAt)} — {data.record.win} won, {data.record.loss} lost, {data.record.draw} drawn
                  {data.online ? ' — online now' : ''}
                </p>
                <div className="play__controls">
                  {data.playing ? (
                    <Link className="btn btn--sm" to={`/game/${data.playing}`}>
                      {mine ? 'Return to your game' : 'Watch their game'}
                    </Link>
                  ) : null}
                  {mine ? (
                    <Link className="btn btn--quiet btn--sm" to="/account">
                      Account
                    </Link>
                  ) : null}
                </div>
                {mine && user && user.recovery === false ? (
                  <p className="online__banner">
                    You have no recovery code, so a forgotten password would lose this account. <Link to="/account">Make one now</Link>
                  </p>
                ) : null}
              </div>
              <div className="stats">
                {SPEEDS.map((s) => {
                  const r = data.ratings[s]
                  return (
                    <div key={s} className="stat">
                      <span className="stat__figure display">
                        {r.rating}
                        {r.provisional ? '?' : ''}
                      </span>
                      <span className="mono mono--sm">{cap(s)}</span>
                      <span className="mono mono--sm mono--mute">
                        {r.games} {r.games === 1 ? 'game' : 'games'}
                        {r.provisional ? ' — provisional' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="archive" aria-labelledby="hist-head">
              <div className="archive__bar">
                <h2 id="hist-head">Recent games</h2>
              </div>
              {data.games.length === 0 ? <p className="mono mono--mute archive__empty">No finished games yet.</p> : null}
              {data.games.length ? (
                <ol className="index" aria-label="Games">
                  {data.games.map((g) => {
                    const outcome = g.winner === null ? 'draw' : g.winner === g.side ? 'win' : 'loss'
                    const opp = g.side === 'w' ? g.black : g.white
                    const oppRating = g.side === 'w' ? g.blackRating : g.whiteRating
                    return (
                      <li key={g.id} className={`index__row index__row--${outcome}`}>
                        <Link to={`/game/${g.id}`} className="index__link">
                          <span className="index__date mono mono--sm mono--mute">{dateOf(g.endedAt)}</span>
                          <span className="index__outcome display">{outcome}</span>
                          <span className="index__who">
                            <span className="mono">
                              {g.side === 'w' ? 'White' : 'Black'} v {opp}
                              {oppRating ? ` (${oppRating})` : ''}
                            </span>
                            <span className="mono mono--sm mono--mute">
                              {g.winner === 'w' ? '1-0' : g.winner === 'b' ? '0-1' : '½-½'} by {REASON_WORDS[g.reason]} — {Math.ceil(g.plies / 2)} moves
                            </span>
                          </span>
                          <span className="index__meta mono mono--sm mono--mute">
                            {g.tc} {g.rated ? 'rated' : 'casual'}
                            {g.diff !== null ? ` — ${g.diff >= 0 ? '+' : ''}${g.diff}` : ''}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              ) : null}
            </section>
          </>
        )}
      </main>
      <Footer />
    </>
  )
}
