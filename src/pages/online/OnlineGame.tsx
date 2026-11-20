import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Board } from '../../board/Board'
import { Clock } from '../../components/Clock'
import { Corner } from '../../components/Corner'
import { MoveList } from '../../components/MoveList'
import { Nav } from '../../components/Nav'
import { storePgn } from '../../analysis/library'
import { START_FEN, positionFromFen } from '../../game/rules'
import type { MoveRecord } from '../../game/types'
import { moveSound, play } from '../../sound/sounds'
import { useOnline } from '../../online/connection'
import { REASON_WORDS, timeControl, type ChatLine, type GameView, type PlayerInfo, type Side } from '../../online/protocol'
import { useOnlineGame, type OnlineGame as Game } from '../../online/useOnlineGame'

const NAMES: Record<Side, string> = { w: 'White', b: 'Black' }
const other = (s: Side): Side => (s === 'w' ? 'b' : 'w')

export function tcWords(tcId: string, rated: boolean): string {
  const tc = timeControl(tcId)
  if (!tc) return tcId
  return `${tc.minutes} + ${tc.increment} ${rated ? 'rated' : 'casual'} ${tc.speed}`
}

export function playerLabel(p: PlayerInfo | null): string {
  if (!p) return '…'
  return p.rating === null ? p.name : `${p.name} (${p.rating}${p.provisional ? '?' : ''})`
}

/** A button that asks once: first press arms it, a second press within 4s fires. */
function useArmed() {
  const [armed, setArmed] = useState<string | null>(null)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(null), 4000)
    return () => window.clearTimeout(t)
  }, [armed])
  return {
    armed,
    confirm(key: string, then: () => void) {
      if (armed === key) {
        setArmed(null)
        then()
      } else setArmed(key)
    },
  }
}

function pgnOf(view: GameView, history: MoveRecord[]): string {
  const r = view.result
  const res = !r ? '*' : r.winner === 'w' ? '1-0' : r.winner === 'b' ? '0-1' : '1/2-1/2'
  const d = new Date()
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  const tc = timeControl(view.tc)
  const moves = history.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m.san}` : m.san)).join(' ')
  const tags = [
    ['Event', `Counterplay ${view.rated ? 'rated' : 'casual'} game`],
    ['Site', `${location.origin}/game/${view.id}`],
    ['Date', date],
    ['White', view.white?.name ?? '?'],
    ['Black', view.black?.name ?? '?'],
    ['Result', res],
    ...(view.white?.rating ? [['WhiteElo', String(view.white.rating)]] : []),
    ...(view.black?.rating ? [['BlackElo', String(view.black.rating)]] : []),
    ...(tc ? [['TimeControl', `${tc.minutes * 60}+${tc.increment}`]] : []),
    ...(r ? [['Termination', REASON_WORDS[r.reason]]] : []),
  ]
  return `${tags.map(([k, v]) => `[${k} "${v.replace(/"/g, "'")}"]`).join('\n')}\n\n${moves} ${res}`
}

/* -------------------------------------------------------------------- chat */

const MUTE_KEY = 'counterplay.chat.muted'

function Chat({ lines, canChat, onSay }: { lines: ChatLine[]; canChat: boolean; onSay: (text: string) => void }) {
  const [draft, setDraft] = useState('')
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === '1'
    } catch {
      return false
    }
  })
  const log = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const el = log.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length, muted])
  const toggle = () => {
    setMuted((m) => {
      try {
        localStorage.setItem(MUTE_KEY, m ? '0' : '1')
      } catch {
        /* private mode */
      }
      return !m
    })
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    onSay(text)
    setDraft('')
  }
  return (
    <section className="chat" aria-label="Chat">
      <div className="chat__head">
        <h2 className="mono mono--sm">Chat</h2>
        <button type="button" className="chat__mute mono mono--sm" aria-pressed={muted} onClick={toggle}>
          {muted ? 'Hidden — show' : 'Hide'}
        </button>
      </div>
      {muted ? null : (
        <ol ref={log} className="chat__log" aria-live="polite">
          {lines.length === 0 ? <li className="mono mono--sm mono--mute">No messages.</li> : null}
          {lines.map((l, i) => (
            <li key={i} className="chat__line">
              <b className={l.side === 'w' ? 'chat__who chat__who--w' : 'chat__who'}>{l.from}</b> {l.text}
            </li>
          ))}
        </ol>
      )}
      {canChat && !muted ? (
        <form className="chat__form" onSubmit={submit}>
          <label htmlFor="chat-input" className="visually-hidden">
            Message
          </label>
          <input id="chat-input" className="input" value={draft} maxLength={140} autoComplete="off" placeholder="Say something nice" onChange={(e) => setDraft(e.target.value)} />
          <button type="submit" className="btn btn--sm">
            Send
          </button>
        </form>
      ) : null}
      {!canChat ? <p className="mono mono--sm mono--mute">Only the players can chat.</p> : null}
    </section>
  )
}

/* --------------------------------------------------------- waiting for friend */

function Waiting({ game, view }: { game: Game; view: GameView }) {
  const { user } = useOnline()
  const [copied, setCopied] = useState(false)
  const preview = useMemo(() => positionFromFen(START_FEN), [])
  const ch = view.challenge!
  const mine = user?.id === ch.by.id
  const url = `${location.origin}/game/${view.id}`
  const sideWords = ch.color === 'random' ? 'a random side' : mine ? NAMES[ch.color] : NAMES[other(ch.color)]
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      document.getElementById('challenge-url')?.focus()
      ;(document.getElementById('challenge-url') as HTMLInputElement | null)?.select()
    }
  }
  return (
    <div className="play__frame">
      <Corner pos="tl" label="Challenge" value={tcWords(view.tc, view.rated)} cross />
      <Corner pos="tr" label="Status" value="waiting" cross />
      <div className="play__main play__main--solo setup__preview">
        <div className="board-stage">
          <Board
            position={preview}
            orientation={mine ? (ch.color === 'b' ? 'b' : 'w') : ch.color === 'w' ? 'b' : 'w'}
            selected={null}
            targets={[]}
            interactive={false}
            pendingPromotion={null}
            onSelect={() => {}}
            onMove={() => false}
            onPromote={() => {}}
            onCancelPromotion={() => {}}
            label="Starting position"
          />
        </div>
      </div>
      <div className="play__side setup">
        {mine ? (
          <>
            <h2 className="setup__title">Send this link to a friend</h2>
            <p>The first person to open it and press Accept plays you. Keep this page open until they do.</p>
            <div className="connect">
              <label htmlFor="challenge-url" className="mono mono--sm">
                Link
              </label>
              <div className="connect__row">
                <input id="challenge-url" readOnly value={url} onFocus={(e) => e.target.select()} />
                <button type="button" className="btn" onClick={copy}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <p className="mono mono--sm mono--mute">
              {tcWords(view.tc, view.rated)} — you play {sideWords}
            </p>
            <p className="mono mono--sm waiting-dot" role="status">
              Waiting for your friend
            </p>
            <button type="button" className="btn btn--quiet" onClick={game.cancelChallenge}>
              Cancel challenge
            </button>
          </>
        ) : (
          <>
            <h2 className="setup__title">{playerLabel(ch.by)} challenges you</h2>
            <p>
              {tcWords(view.tc, view.rated)}. You play {sideWords}.
            </p>
            {view.rated && user?.guest ? (
              <>
                <p className="mono mono--sm">This game is rated, so you need an account to accept it.</p>
                <Link className="btn setup__start" to={`/login?next=${encodeURIComponent(`/game/${view.id}`)}`}>
                  Sign in to accept
                </Link>
              </>
            ) : (
              <button type="button" className="btn setup__start" onClick={game.acceptChallenge}>
                Accept and play
              </button>
            )}
            <Link to="/online" className="btn btn--quiet">
              No thanks
            </Link>
          </>
        )}
        {game.error ? (
          <p className="connect__help connect__help--error mono mono--sm" role="alert">
            {game.error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- game */

function statusLine(game: Game, view: GameView): string {
  const you = view.you
  if (view.result) {
    const r = view.result
    if (r.reason === 'aborted') return 'Game aborted'
    return r.winner ? `${NAMES[r.winner]} wins by ${REASON_WORDS[r.reason]}` : `Draw by ${REASON_WORDS[r.reason]}`
  }
  if (!game.isLive) return `Viewing move ${Math.ceil((game.viewPly ?? 0) / 2)} — Back to live to play on`
  if (you && view.drawOffer === other(you)) return 'Your opponent offers a draw'
  if (you && game.claimInMs !== null) {
    return game.claimInMs > 0 ? `Your opponent left — you can claim the win in ${Math.ceil(game.claimInMs / 1000)}s` : 'Your opponent left — claim the win, or wait'
  }
  if (game.firstMoveMs !== null) {
    const s = Math.ceil(game.firstMoveMs / 1000)
    if (you === game.liveTurn) return `Your first move — ${s}s or the game is aborted`
    return `${NAMES[game.liveTurn]} to make a first move — ${s}s`
  }
  const side = you === game.liveTurn ? 'Your move' : you ? 'Their move' : `${NAMES[game.liveTurn]} to move`
  return game.position.checkSquare && game.isLive ? `${side}, in check` : side
}

function Playing({ game, view }: { game: Game; view: GameView }) {
  const navigate = useNavigate()
  const { status: conn } = useOnline()
  const { armed, confirm } = useArmed()
  const you = view.you
  const live = view.status === 'live'
  const ended = view.status === 'ended'
  const result = view.result
  const resultBtn = useRef<HTMLButtonElement>(null)
  const [dialogOpen, setDialogOpen] = useState(true)

  // Sound follows the game.
  const prev = useRef({ plies: game.plies, status: view.status, first: true })
  useEffect(() => {
    const p = prev.current
    if (!p.first && game.plies > p.plies) play(moveSound(game.history[game.plies - 1].san))
    if (!p.first && view.status === 'ended' && p.status !== 'ended') {
      play('end', result?.reason === 'checkmate' ? 420 : 120)
      setDialogOpen(true)
    }
    if (p.first && live && game.plies === 0) play('start')
    prev.current = { plies: game.plies, status: view.status, first: false }
  }, [game.plies, view.status]) // eslint-disable-line react-hooks/exhaustive-deps
  const myClock = you && view.running === you ? Math.ceil(game.clocks[you] / 1000) : null
  useEffect(() => {
    if (myClock !== null && myClock > 0 && myClock <= 10) play('tick')
  }, [myClock])
  useEffect(() => {
    if (ended && dialogOpen) resultBtn.current?.focus()
  }, [ended, dialogOpen])

  // Both players asked for a rematch: go to it.
  useEffect(() => {
    if (view.rematchId && you) navigate(`/game/${view.rematchId}`)
  }, [view.rematchId, you, navigate])

  // Left and right arrows walk the move list when focus is outside the board.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const t = e.target as HTMLElement | null
      if (t?.closest('[role="grid"], [role="dialog"], input, textarea, select')) return
      e.preventDefault()
      const current = game.viewPly ?? game.plies
      const next = e.key === 'ArrowLeft' ? Math.max(0, current - 1) : Math.min(game.plies, current + 1)
      game.viewAt(next === game.plies ? null : next)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [game])

  const review = () => {
    const title = `${view.white?.name ?? 'White'} v ${view.black?.name ?? 'Black'}`
    try {
      navigate(`/analysis/pgn/${storePgn(pgnOf(view, game.history), title, 'Played online')}`)
    } catch {
      /* storage refused */
    }
  }
  const newOpponent = () => navigate(`/online?seek=${encodeURIComponent(view.tc)}&rated=${view.rated ? 1 : 0}`)

  const top: Side = other(game.orientation)
  const bottom: Side = game.orientation
  const status = statusLine(game, view)

  const player = (s: Side, slot: 'top' | 'bottom') => {
    const p = s === 'w' ? view.white : view.black
    const diff = result?.ratingDiff?.[s]
    const away = live && !view.connected[s]
    return (
      <div className={`player player--${slot}`}>
        <div className="player__name">
          <span className="mono">
            {p && !p.guest ? <Link to={`/u/${p.name}`}>{p.name}</Link> : (p?.name ?? '…')}
            {p?.rating != null ? (
              <span className="mono--mute">
                {' '}
                {p.rating}
                {p.provisional ? '?' : ''}
              </span>
            ) : null}
            {diff !== undefined ? <span className={diff >= 0 ? 'rating-up' : 'rating-down'}> {diff >= 0 ? `+${diff}` : diff}</span> : null}
          </span>
          <span className="mono mono--sm mono--mute">
            {NAMES[s].toLowerCase()}
            {you === s ? ' · you' : ''}
            {away ? ' · offline' : live && game.liveTurn === s ? ' · to move' : ''}
          </span>
        </div>
        <Clock ms={game.clocks[s]} active={view.running === s && !ended} label={NAMES[s]} />
      </div>
    )
  }

  const headline = !result
    ? ''
    : result.reason === 'aborted'
      ? 'Aborted'
      : !result.winner
        ? 'Draw'
        : you
          ? result.winner === you
            ? 'You win'
            : 'You lose'
          : `${NAMES[result.winner]} wins`
  const myDiff = you ? result?.ratingDiff?.[you] : undefined
  const rematchControl = () => {
    if (!you || !ended || result?.reason === 'aborted') return null
    if (view.rematchOffer === you)
      return (
        <button type="button" className="btn btn--quiet" onClick={() => game.rematch(false)}>
          Rematch offered — cancel
        </button>
      )
    if (view.rematchOffer === other(you))
      return (
        <button ref={resultBtn} type="button" className="btn" onClick={() => game.rematch(true)}>
          Accept rematch
        </button>
      )
    return (
      <button ref={resultBtn} type="button" className="btn" onClick={() => game.rematch(true)}>
        Rematch
      </button>
    )
  }

  return (
    <div className="play__frame">
      <Corner pos="tl" label="Online" value={tcWords(view.tc, view.rated)} cross />
      <Corner pos="tr" label="Watching" value={String(view.spectators)} cross />
      <Corner pos="bl" label="Status" value={status} live />
      <Corner pos="br" label="Server" value={conn === 'open' ? 'connected' : 'reconnecting…'} mute={conn === 'open'} />

      <div className="play__main play__main--solo">
        <div className="board-stage">
          <Board
            position={game.position}
            orientation={game.orientation}
            selected={game.selected}
            targets={game.targets}
            interactive={game.canMove}
            pendingPromotion={game.pendingPromotion}
            onSelect={game.select}
            onMove={game.attemptMove}
            onPromote={game.promote}
            onCancelPromotion={game.cancelPromotion}
            mated={result?.reason === 'checkmate' && game.isLive ? game.position.checkSquare : null}
            label={you ? `Board, you play ${NAMES[you]}` : 'Board'}
          />
          {ended && dialogOpen ? (
            <div className="result" role="dialog" aria-labelledby="result-head" aria-describedby="result-why">
              <div className="result__card on-ink">
                <h2 id="result-head">{headline}</h2>
                <p id="result-why" className="mono mono--mute">
                  {result?.reason === 'aborted' ? 'Nobody moved in time, or a player aborted' : `By ${REASON_WORDS[result!.reason]} — move ${Math.max(1, Math.ceil(game.plies / 2))}`}
                  {myDiff !== undefined ? ` — rating ${myDiff >= 0 ? `+${myDiff}` : myDiff}` : ''}
                </p>
                <div className="result__actions">
                  {rematchControl()}
                  {you ? (
                    <button type="button" className={`btn${rematchControl() ? ' btn--quiet' : ''}`} ref={rematchControl() ? undefined : resultBtn} onClick={newOpponent}>
                      New opponent
                    </button>
                  ) : null}
                  {game.plies ? (
                    <button type="button" className="btn btn--quiet" onClick={review}>
                      Review game
                    </button>
                  ) : null}
                  <button type="button" className="btn btn--quiet" ref={you ? undefined : resultBtn} onClick={() => setDialogOpen(false)}>
                    View board
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="play__side" aria-label="Game">
        {player(top, 'top')}
        <p className="status mono mono--sm mono--mute" role="status" aria-live="polite">
          {game.error ? <span className="connect__help--error">{game.error}</span> : status}
        </p>
        <MoveList history={game.history} viewPly={game.viewPly} onView={game.viewAt} />
        {player(bottom, 'bottom')}
        <div className="play__controls">
          {!game.isLive ? (
            <button type="button" className="btn btn--sm" onClick={() => game.viewAt(null)}>
              Back to live
            </button>
          ) : null}
          {you && live && view.moves.length < 2 ? (
            <button type="button" className="btn btn--quiet btn--sm" onClick={game.abort}>
              Abort
            </button>
          ) : null}
          {you && live && view.moves.length >= 2 ? (
            view.drawOffer === other(you) ? (
              <>
                <button type="button" className="btn btn--sm" onClick={() => game.draw(true)}>
                  Accept draw
                </button>
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => game.draw(false)}>
                  Decline
                </button>
              </>
            ) : view.drawOffer === you ? (
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => game.draw(false)}>
                Draw offered — cancel
              </button>
            ) : (
              <button type="button" className="btn btn--quiet btn--sm" aria-pressed={armed === 'draw' || undefined} onClick={() => confirm('draw', () => game.draw(true))}>
                {armed === 'draw' ? 'Offer draw?' : 'Draw'}
              </button>
            )
          ) : null}
          {you && live && view.moves.length >= 2 ? (
            <button type="button" className="btn btn--quiet btn--sm" aria-pressed={armed === 'resign' || undefined} onClick={() => confirm('resign', game.resign)}>
              {armed === 'resign' ? 'Confirm resign' : 'Resign'}
            </button>
          ) : null}
          {you && live && game.claimInMs === 0 ? (
            <button type="button" className="btn btn--sm" onClick={game.claim}>
              Claim the win
            </button>
          ) : null}
          <button type="button" className="btn btn--quiet btn--sm" onClick={game.flip}>
            Flip
          </button>
          {ended && !dialogOpen ? (
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setDialogOpen(true)}>
              Result
            </button>
          ) : null}
          {ended && game.plies ? (
            <button type="button" className="btn btn--quiet btn--sm" onClick={review}>
              Review game
            </button>
          ) : null}
          {!you && view.rematchId ? (
            <Link className="btn btn--sm" to={`/game/${view.rematchId}`}>
              Watch the rematch
            </Link>
          ) : null}
        </div>
        <Chat lines={game.chat} canChat={!!you} onSay={game.say} />
      </aside>
    </div>
  )
}

/* -------------------------------------------------------------------- page */

export function OnlineGame() {
  const { id = '' } = useParams()
  const game = useOnlineGame(id)
  const { status } = useOnline()
  const view = game.view

  let body
  if (game.gone) {
    body = (
      <section className="online-empty">
        <h2>No game here</h2>
        <p className="lead">This game does not exist, or it was aborted. Games nobody moved in are not kept.</p>
        <Link className="btn" to="/online">
          Find a game
        </Link>
      </section>
    )
  } else if (!view) {
    body = (
      <section className="online-empty">
        <p className="mono mono--mute waiting-dot" role="status">
          {status === 'reconnecting' ? 'Cannot reach the server, retrying' : 'Connecting'}
        </p>
      </section>
    )
  } else if (view.status === 'waiting') {
    body = <Waiting game={game} view={view} />
  } else if (!view.white || !view.black) {
    body = (
      <section className="online-empty">
        <h2>Challenge closed</h2>
        <p className="lead">This challenge was cancelled, or nobody accepted it in time.</p>
        <Link className="btn" to="/online">
          Back to the lobby
        </Link>
      </section>
    )
  } else body = <Playing game={game} view={view} />

  return (
    <>
      <Nav />
      <main id="main" className="container play play--online">
        <h1 className="visually-hidden">Online game</h1>
        {body}
      </main>
    </>
  )
}
