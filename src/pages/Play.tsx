import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Board } from '../board/Board'
import { Clock } from '../components/Clock'
import { Corner } from '../components/Corner'
import { DrawHint } from '../components/DrawHint'
import { SaveToggle } from '../components/SaveToggle'
import { EvalBar } from '../components/EvalBar'
import { MoveList } from '../components/MoveList'
import { Nav } from '../components/Nav'
import { formatEvaluation } from '../engine'
import { useEngine } from '../engine/useEngine'
import { START_FEN, positionFromFen } from '../game/rules'
import type { Color } from '../game/types'
import { useClock } from '../game/useClock'
import { LEVELS, levelOf, useComputer } from '../game/useComputer'
import { useGame } from '../game/useGame'
import { TIME_CONTROLS, readConfig, saveConfig, type PlayConfig } from '../game/playConfig'
import { moveSound, play } from '../sound/sounds'
import { storePgn } from '../analysis/library'

const NAMES: Record<Color, string> = { w: 'White', b: 'Black' }
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')

/* ------------------------------------------------------------------ setup */

/** A row of mutually exclusive buttons, announced as a radio group. */
function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; sub?: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="seg">
      <legend className="mono mono--sm">{label}</legend>
      <div className="seg__row">
        {options.map((o) => (
          <label key={String(o.value)} className={`seg__opt${o.value === value ? ' seg__opt--on' : ''}`}>
            <input type="radio" className="visually-hidden" name={label} checked={o.value === value} onChange={() => onChange(o.value)} />
            <span className="seg__label">{o.label}</span>
            {o.sub ? <span className="seg__sub">{o.sub}</span> : null}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Setup({ config, onChange, onStart }: { config: PlayConfig; onChange: (c: PlayConfig) => void; onStart: () => void }) {
  const set = <K extends keyof PlayConfig>(k: K, v: PlayConfig[K]) => onChange({ ...config, [k]: v })
  const level = levelOf(config.level)
  const preview = useMemo(() => positionFromFen(START_FEN), [])
  const tc = TIME_CONTROLS.find((t) => t.id === config.time) ?? TIME_CONTROLS[0]
  return (
    <>
      <Nav />
      <main id="main" className="container play">
        <h1 className="visually-hidden">Play: set up a game</h1>
        <div className="play__frame">
          <Corner pos="tl" label="New game" value={config.opponent === 'computer' ? `v Stockfish, level ${level.level}` : 'v a friend'} cross />
          <Corner pos="tr" label="Clock" value={tc.id === 'none' ? 'none' : tc.label} cross />
          <div className="play__main play__main--solo setup__preview">
            <div className="board-stage">
              <Board
                position={preview}
                orientation={config.side === 'b' ? 'b' : 'w'}
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
          <form
            className="play__side setup"
            aria-label="Game setup"
            onSubmit={(e) => {
              e.preventDefault()
              onStart()
            }}
          >
            <h2 className="setup__title">New game</h2>
            <p className="setup__note setup__online">
              Want a human opponent? <Link to="/online">Play online</Link> against anyone, or send a friend a link.
            </p>
            <Segmented
              label="Opponent"
              value={config.opponent}
              onChange={(v) => set('opponent', v)}
              options={[
                { value: 'computer', label: 'Computer', sub: 'Stockfish, 8 levels' },
                { value: 'friend', label: 'A friend', sub: 'Same device, take turns' },
              ]}
            />
            {config.opponent === 'computer' ? (
              <>
                <fieldset className="seg">
                  <legend className="mono mono--sm">
                    Level — {level.level}, {level.name}
                  </legend>
                  <div className="seg__row seg__row--levels">
                    {LEVELS.map((l) => (
                      <label key={l.level} className={`seg__opt seg__opt--num${l.level === config.level ? ' seg__opt--on' : ''}`} title={l.name}>
                        <input type="radio" className="visually-hidden" name="level" checked={l.level === config.level} onChange={() => set('level', l.level)} />
                        <span className="seg__label">{l.level}</span>
                        <span className="visually-hidden">{l.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="setup__note">{level.note}</p>
                </fieldset>
                <Segmented
                  label="You play"
                  value={config.side}
                  onChange={(v) => set('side', v)}
                  options={[
                    { value: 'w', label: 'White' },
                    { value: 'random', label: 'Random' },
                    { value: 'b', label: 'Black' },
                  ]}
                />
              </>
            ) : null}
            <fieldset className="seg">
              <legend className="mono mono--sm">Time — minutes + seconds a move</legend>
              <div className="seg__row seg__row--time">
                {TIME_CONTROLS.map((t) => (
                  <label key={t.id} className={`seg__opt${t.id === config.time ? ' seg__opt--on' : ''}`}>
                    <input type="radio" className="visually-hidden" name="time" checked={t.id === config.time} onChange={() => set('time', t.id)} />
                    <span className="seg__label">{t.label}</span>
                    <span className="seg__sub">{t.kind}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="check">
              <input type="checkbox" checked={config.showEval} onChange={(e) => set('showEval', e.target.checked)} />
              <span>Show the evaluation bar while playing</span>
            </label>
            <button type="submit" className="btn setup__start">
              Start game
            </button>
          </form>
        </div>
      </main>
    </>
  )
}

/* ------------------------------------------------------------------- game */

function statusLine(game: ReturnType<typeof useGame>, thinking: boolean): string {
  const { state, position, isLive } = game
  if (state.result) {
    const r = state.result
    if (r.winner) return `${NAMES[r.winner]} wins by ${r.reason}`
    return `Draw by ${r.reason}`
  }
  if (!isLive) return `Viewing move ${Math.ceil((state.viewPly ?? 0) / 2)} — press Back to live to play on`
  if (thinking) return 'Stockfish is thinking…'
  const side = NAMES[position.turn]
  if (position.checkSquare) return `${side} to move, in check`
  return `${side} to move`
}

/** A button that asks once: first press arms it, second press within 4s fires. */
function useArmed(timeoutMs = 4000) {
  const [armed, setArmed] = useState<string | null>(null)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(null), timeoutMs)
    return () => window.clearTimeout(t)
  }, [armed, timeoutMs])
  return { armed, arm: setArmed, disarm: () => setArmed(null) }
}

interface GameProps {
  config: PlayConfig
  /** The side the player has (computer games); in friend games, the side at the bottom. */
  you: Color
  onRematch: () => void
  onSetup: () => void
}

function Game({ config, you, onRematch, onSetup }: GameProps) {
  const navigate = useNavigate()
  const game = useGame(START_FEN, you)
  const { state, position } = game
  const vsComputer = config.opponent === 'computer'
  const tc = TIME_CONTROLS.find((t) => t.id === config.time) ?? TIME_CONTROLS[0]
  const timed = tc.minutes > 0
  const level = levelOf(config.level)

  const onFlag = useCallback(
    (loser: Color) => game.end({ status: 'timeout', winner: other(loser), reason: 'time' }),
    [game],
  )
  const { clock, press, pause } = useClock({ initialMs: Math.max(1, tc.minutes) * 60_000, incrementMs: tc.increment * 1000 }, timed ? onFlag : undefined)
  const { evaluation, engineName, engineStatus } = useEngine(state.fen, game.isLive && config.showEval)
  const { armed, arm, disarm } = useArmed()
  const resultButton = useRef<HTMLButtonElement>(null)
  const startedAt = useRef(Date.now())
  const plies = state.history.length

  const computerSide: Color | null = vsComputer ? other(you) : null
  const computerToMove = !!computerSide && position.turn === computerSide && game.isLive && !state.result && !state.pendingPromotion
  // The live turn, not the viewed one: the computer only ever moves in the live position.
  const liveTurn: Color = state.fen.split(' ')[1] === 'b' ? 'b' : 'w'
  const computerActive = !!computerSide && liveTurn === computerSide && !state.result
  const { thinking, fallback } = useComputer(state.fen, computerActive, config.level, (m) => {
    game.attemptMove(m)
  })

  // The clock follows the game: it starts on White's first move and stops when the game ends.
  useEffect(() => {
    if (plies === 0 || !timed) return
    press(state.history[plies - 1].color)
  }, [plies]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state.result) {
      pause()
      resultButton.current?.focus()
    }
  }, [state.result, pause])

  // Sound follows the game.
  const prevPlies = useRef(plies)
  useEffect(() => {
    const prev = prevPlies.current
    prevPlies.current = plies
    if (plies > prev) play(moveSound(state.history[plies - 1].san))
    else if (plies < prev) play('move')
  }, [plies]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state.result) play('end', state.result.status === 'checkmate' ? 420 : 120)
  }, [state.result])
  useEffect(() => {
    if (state.viewPly === null) return
    if (state.viewPly > 0) play(moveSound(state.history[state.viewPly - 1].san))
  }, [state.viewPly]) // eslint-disable-line react-hooks/exhaustive-deps
  const runningSide = state.result || !timed ? null : clock.running
  const secondsLeft = runningSide ? Math.ceil(clock[runningSide] / 1000) : null
  useEffect(() => {
    if (secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 10) play('tick')
  }, [secondsLeft])

  // Left and right arrows walk the move list when focus is outside the board.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const t = e.target as HTMLElement | null
      if (t?.closest('[role="grid"], [role="dialog"], input, textarea, select')) return
      e.preventDefault()
      const current = state.viewPly ?? plies
      const next = e.key === 'ArrowLeft' ? Math.max(0, current - 1) : Math.min(plies, current + 1)
      game.view(next === plies ? null : next)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [game, plies, state.viewPly])

  const inProgress = plies > 0 && !state.result

  const takeback = () => {
    if (!game.isLive || !plies) return
    // Against the computer, take back your own last move too, so it is your turn again.
    if (vsComputer && liveTurn === you && plies >= 2) {
      game.undo()
      game.undo()
    } else game.undo()
  }
  const leave = (then: () => void) => {
    if (inProgress && armed !== 'leave') {
      arm('leave')
      return
    }
    disarm()
    then()
  }
  const resign = () => {
    if (!inProgress) return
    if (armed !== 'resign') {
      arm('resign')
      return
    }
    disarm()
    const loser = vsComputer ? you : liveTurn
    game.end({ status: 'resigned', winner: other(loser), reason: 'resignation' })
  }
  const offerDraw = () => {
    if (!inProgress) return
    if (armed !== 'draw') {
      arm('draw')
      return
    }
    disarm()
    game.end({ status: 'draw', winner: null, reason: 'agreement' })
  }

  const nameOf = (c: Color) => (vsComputer ? (c === you ? 'You' : `Stockfish — level ${level.level}`) : NAMES[c])
  const pgn = () => {
    const r = state.result
    const res = r ? (r.winner === 'w' ? '1-0' : r.winner === 'b' ? '0-1' : '1/2-1/2') : '*'
    const white = vsComputer ? (you === 'w' ? 'You' : `Stockfish level ${level.level}`) : 'White'
    const black = vsComputer ? (you === 'b' ? 'You' : `Stockfish level ${level.level}`) : 'Black'
    const moves = state.history.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m.san}` : m.san)).join(' ')
    const d = new Date()
    const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    return `[Event "Oukplay game"]\n[Date "${date}"]\n[White "${white}"]\n[Black "${black}"]\n[Result "${res}"]\n\n${moves} ${res}`
  }
  const review = () => {
    const text = pgn()
    const title = vsComputer ? `You v Stockfish level ${level.level}` : 'White v Black'
    try {
      navigate(`/analysis/pgn/${storePgn(text, title, 'Played here')}`)
    } catch {
      /* storage refused: stay on the board */
    }
  }

  const top: Color = other(state.orientation)
  const bottom: Color = state.orientation
  const running = state.result ? null : plies ? liveTurn : null
  const status = statusLine(game, thinking)
  const moveNo = Math.floor(plies / 2) + 1

  const result = state.result
  const player = (c: Color, slot: 'top' | 'bottom') => (
    <div className={`player player--${slot}`}>
      <div className="player__name">
        <span className="mono">
          {nameOf(c)}
          {vsComputer ? <span className="mono--mute"> · {NAMES[c].toLowerCase()}</span> : null}
        </span>
        <span className="mono mono--sm mono--mute">{!result && liveTurn === c ? (vsComputer && c === computerSide ? 'thinking' : 'to move') : 'waiting'}</span>
      </div>
      {timed ? <Clock ms={clock[c]} active={running === c} label={NAMES[c]} /> : null}
    </div>
  )

  const youWon = vsComputer && result?.winner === you
  const headline = !result ? '' : result.winner ? (vsComputer ? (youWon ? 'You win' : 'Stockfish wins') : `${NAMES[result.winner]} wins`) : 'Draw'
  const engineLabel = !config.showEval
    ? 'bar off'
    : engineStatus === 'loading'
      ? `${engineName}, loading`
      : engineStatus === 'failed'
        ? 'failed to load'
        : engineStatus === 'ready' && evaluation
          ? `${formatEvaluation(evaluation)}${evaluation.depth ? ` at depth ${evaluation.depth}` : ''}`
          : engineName

  return (
    <>
      <Nav />
      <main id="main" className="container play">
        <h1 className="visually-hidden">Play</h1>
        <div className="play__frame">
          <Corner pos="tl" label="Move" value={String(moveNo)} cross />
          <Corner pos="tr" label={vsComputer ? `Level ${level.level}` : 'Clock'} value={timed ? tc.label : 'no clock'} cross />
          <Corner pos="bl" label="Status" value={status} />
          <Corner pos="br" label="Eval" value={fallback && vsComputer ? 'engine off, random moves' : engineLabel} mute />

          <div className={`play__main${config.showEval ? '' : ' play__main--solo'}`}>
            <div className="board-stage">
              <Board
                position={position}
                orientation={state.orientation}
                selected={state.selected}
                targets={game.targets}
                interactive={game.canPlay && !computerToMove && !thinking}
                pendingPromotion={state.pendingPromotion}
                onSelect={game.select}
                onMove={game.attemptMove}
                onPromote={game.promote}
                onCancelPromotion={game.cancelPromotion}
                mated={result?.status === 'checkmate' && game.isLive ? position.checkSquare : null}
              />
              {result ? (
                <div className="result" role="dialog" aria-labelledby="result-head" aria-describedby="result-why">
                  <div className="result__card on-ink">
                    <h2 id="result-head">{headline}</h2>
                    <p id="result-why" className="mono mono--mute">
                      By {result.reason} — move {Math.ceil(plies / 2)}
                    </p>
                    <div className="result__actions">
                      <button ref={resultButton} type="button" className="btn" onClick={onRematch}>
                        Rematch
                      </button>
                      {plies ? (
                        <button type="button" className="btn btn--quiet" onClick={review}>
                          Review game
                        </button>
                      ) : null}
                      <button type="button" className="btn btn--quiet" onClick={onSetup}>
                        New setup
                      </button>
                      {plies ? <SaveToggle game={{ id: `played:${startedAt.current}`, title: vsComputer ? `You v Stockfish level ${level.level}` : 'White v Black', source: 'Played here', pgn: pgn(), result: result.winner === 'w' ? '1-0' : result.winner === 'b' ? '0-1' : '½-½', date: new Date(startedAt.current).toISOString().slice(0, 10) }} /> : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            {config.showEval ? <EvalBar evaluation={evaluation} orientation={state.orientation} /> : null}
          </div>

          <aside className="play__side" aria-label="Game">
            {player(top, 'top')}
            <p className="status mono mono--sm mono--mute" role="status" aria-live="polite">
              {status}
            </p>
            <MoveList history={state.history} viewPly={state.viewPly} onView={game.view} />
            {player(bottom, 'bottom')}
            <div className="play__controls">
              {!game.isLive ? (
                <button type="button" className="btn btn--sm" onClick={() => game.view(null)}>
                  Back to live
                </button>
              ) : null}
              <button type="button" className="btn btn--quiet btn--sm" onClick={takeback} disabled={!plies || !game.isLive || !!result}>
                Take back
              </button>
              <button type="button" className="btn btn--quiet btn--sm" onClick={game.flip}>
                Flip
              </button>
              {!vsComputer ? (
                <button type="button" className="btn btn--quiet btn--sm" onClick={offerDraw} disabled={!inProgress} aria-pressed={armed === 'draw' || undefined}>
                  {armed === 'draw' ? 'Confirm draw' : 'Draw'}
                </button>
              ) : null}
              <button type="button" className="btn btn--quiet btn--sm" onClick={resign} disabled={!inProgress} aria-pressed={armed === 'resign' || undefined}>
                {armed === 'resign' ? 'Confirm resign' : 'Resign'}
              </button>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => leave(onSetup)} aria-pressed={armed === 'leave' || undefined}>
                {armed === 'leave' ? 'Leave this game?' : 'New game'}
              </button>
              {plies && result ? (
                <button type="button" className="btn btn--quiet btn--sm" onClick={review}>
                  Review game
                </button>
              ) : null}
            </div>
            {armed ? (
              <p className="mono mono--sm mono--mute" role="status">
                Press again to confirm.
              </p>
            ) : null}
            <DrawHint />
          </aside>
        </div>
      </main>
    </>
  )
}

/* ------------------------------------------------------------------- page */

export function Play() {
  const [config, setConfig] = useState<PlayConfig>(readConfig)
  const [phase, setPhase] = useState<'setup' | 'playing'>('setup')
  const [round, setRound] = useState(0)
  const [you, setYou] = useState<Color>('w')

  const save = (c: PlayConfig) => {
    setConfig(c)
    saveConfig(c)
  }
  const start = () => {
    const side: Color = config.opponent === 'friend' ? 'w' : config.side === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : config.side
    setYou(side)
    setRound((r) => r + 1)
    setPhase('playing')
    play('start')
  }
  const rematch = () => {
    // Against the computer a rematch swaps colours when the side was random.
    if (config.opponent === 'computer' && config.side === 'random') setYou((y) => other(y))
    setRound((r) => r + 1)
    play('start')
  }

  if (phase === 'setup') return <Setup config={config} onChange={save} onStart={start} />
  return <Game key={round} config={config} you={you} onRematch={rematch} onSetup={() => setPhase('setup')} />
}
