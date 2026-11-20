import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Footer } from '../../components/Footer'
import { Nav } from '../../components/Nav'
import { START_FEN, resultOf } from '../../game/rules'
import type { Color } from '../../game/types'
import { award, useGame } from '../../learn/game'
import { loadPuzzles, type Puzzle } from '../../learn/puzzles'
import { useLineTrainer } from '../../learn/useLineTrainer'
import { play } from '../../sound/sounds'
import { LearnTabs } from './LearnTabs'
import { Prompt, TrainerShell } from './TrainerShell'

type Mode = 'rush' | 'streak'

const RUSH_MS = 180_000
const MISS_PENALTY_MS = 10_000
/** Correct moves in a row that pay a time bonus, and how much. After the last, every 10 more pay 10 s. */
const COMBO_STEPS: [number, number][] = [
  [5, 3],
  [12, 5],
  [20, 7],
  [30, 10],
]
function comboBonus(combo: number): number {
  for (const [at, s] of COMBO_STEPS) if (combo === at) return s
  return combo > 30 && combo % 10 === 0 ? 10 : 0
}
function nextComboAt(combo: number): number {
  for (const [at] of COMBO_STEPS) if (combo < at) return at
  return Math.ceil((combo + 1) / 10) * 10
}

const MODES: Record<Mode, { title: string; blurb: string; rules: string[] }> = {
  rush: {
    title: 'Puzzle Rush',
    blurb: 'Three minutes. Solve as many as you can.',
    rules: ['Puzzles start easy and get harder with every solve.', 'Correct moves fill the combo bar: a full bar adds time (+3 s, +5 s, +7 s, +10 s).', 'A wrong move costs 10 seconds and resets the combo. You move on to the next puzzle.'],
  },
  streak: {
    title: 'Puzzle Streak',
    blurb: 'No clock. One mistake and it is over.',
    rules: ['Each puzzle is a little harder than the last.', 'Take your time: there is no clock.', 'One skip per run, for the one you cannot see.'],
  },
}

/** The next puzzle for a run: near the target rating, short enough for speed, not seen this run. */
function pickPuzzle(all: Puzzle[], target: number, used: Set<string>, maxMoves: number): Puzzle | null {
  const pool = all.filter((p) => !used.has(p.id) && p.moves.length <= maxMoves)
  if (!pool.length) return null
  const near = [...pool].sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target)).slice(0, 10)
  return near[Math.floor(Math.random() * near.length)]
}

interface Played {
  id: string
  rating: number
  ok: boolean
}

export function Arcade() {
  const g = useGame()
  const [mode, setMode] = useState<Mode | null>(null)
  const [run, setRun] = useState(0)
  const [result, setResult] = useState<{ mode: Mode; played: Played[]; score: number; best: number; pb: boolean; xp: number } | null>(null)

  if (mode) return <Run key={run} mode={mode} onEnd={(r) => { setResult(r); setMode(null) }} onQuit={() => setMode(null)} />

  return (
    <>
      <Nav />
      <LearnTabs />
      <main id="main" className="container learn arcade">
        <header className="learn__head">
          <h1>Arcade</h1>
          <p className="lead">Fast puzzle modes for sharp eyes. They do not touch your puzzle rating; they chase your personal best.</p>
        </header>

        {result ? (
          <section className="arcade__result on-ink" aria-labelledby="res-h">
            <p className="mono mono--sm mono--mute">{MODES[result.mode].title} — run over</p>
            <h2 id="res-h" className="arcade__score">
              {result.score}
            </h2>
            <p>{result.pb ? 'A new personal best.' : `Personal best — ${result.best}`} +{result.xp} XP.</p>
            <ol className="arcade__trail" aria-label="Puzzles this run">
              {result.played.map((p, i) => (
                <li key={`${p.id}${i}`} className={`arcade__pip${p.ok ? ' arcade__pip--ok' : ' arcade__pip--miss'}`} title={`${p.rating}${p.ok ? ' solved' : ' missed'}`}>
                  <a href={`https://lichess.org/training/${p.id}`} target="_blank" rel="noreferrer">
                    {p.rating}
                  </a>
                </li>
              ))}
            </ol>
            <div className="play__controls">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setRun((r) => r + 1)
                  setMode(result.mode)
                }}
                autoFocus
              >
                Play again
              </button>
              <button type="button" className="btn btn--quiet" onClick={() => setResult(null)}>
                Choose a mode
              </button>
            </div>
          </section>
        ) : null}

        <div className="arcade__modes">
          {(['rush', 'streak'] as Mode[]).map((m) => {
            const best = m === 'rush' ? g.best.rushBest ?? 0 : g.best.streakBest ?? 0
            return (
              <article key={m} className="amode" aria-labelledby={`am-${m}`}>
                <p className="mono mono--sm mono--mute">{m === 'rush' ? '3:00 on the clock' : 'Sudden death'}</p>
                <h2 id={`am-${m}`} className="amode__title">
                  {MODES[m].title}
                </h2>
                <p className="amode__blurb">{MODES[m].blurb}</p>
                <ul className="amode__rules">
                  {MODES[m].rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <div className="amode__foot">
                  <span>
                    <span className="mono mono--sm mono--mute">Best</span>
                    <span className="amode__best">{best}</span>
                  </span>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setResult(null)
                      setRun((r) => r + 1)
                      setMode(m)
                    }}
                  >
                    Start
                  </button>
                </div>
              </article>
            )
          })}
        </div>
        <p className="mono mono--sm mono--mute">
          Puzzles from the lichess database (CC0). Rated practice lives on <Link to="/learn/puzzles">Puzzles</Link>.
        </p>
      </main>
      <Footer />
    </>
  )
}

function Run({ mode, onEnd, onQuit }: { mode: Mode; onEnd: (r: { mode: Mode; played: Played[]; score: number; best: number; pb: boolean; xp: number }) => void; onQuit: () => void }) {
  const g = useGame()
  const [all, setAll] = useState<Puzzle[] | null>(null)
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [played, setPlayed] = useState<Played[]>([])
  const [combo, setCombo] = useState(0)
  const [bonus, setBonus] = useState<{ s: number; n: number } | null>(null)
  const [skipped, setSkipped] = useState(false)
  const [over, setOver] = useState(false)
  const used = useRef(new Set<string>())
  const endAt = useRef(0)
  const [now, setNow] = useState(() => performance.now())
  const score = played.filter((p) => p.ok).length

  useEffect(() => {
    void loadPuzzles().then(setAll)
  }, [])

  const next = useCallback(
    (solvedSoFar: number) => {
      if (!all) return
      const target = mode === 'rush' ? 650 + solvedSoFar * 50 : 800 + solvedSoFar * 70
      const p = pickPuzzle(all, target, used.current, mode === 'rush' ? 6 : 8)
      if (!p) {
        setOver(true)
        return
      }
      used.current.add(p.id)
      setPuzzle(p)
    },
    [all, mode],
  )

  // Start: first puzzle, and the clock.
  useEffect(() => {
    if (!all || puzzle) return
    next(0)
    endAt.current = performance.now() + RUSH_MS
    play('start')
  }, [all]) // eslint-disable-line react-hooks/exhaustive-deps

  // The clock.
  useEffect(() => {
    if (mode !== 'rush' || over || !all) return
    const id = window.setInterval(() => {
      const t = performance.now()
      setNow(t)
      if (t >= endAt.current) setOver(true)
    }, 100)
    return () => window.clearInterval(id)
  }, [mode, over, all])
  const left = Math.max(0, endAt.current - now)
  const secs = Math.ceil(left / 1000)
  useEffect(() => {
    if (mode === 'rush' && !over && secs > 0 && secs <= 10) play('tick')
  }, [secs]) // eslint-disable-line react-hooks/exhaustive-deps

  const user: Color = puzzle ? (puzzle.fen.split(' ')[1] === 'w' ? 'b' : 'w') : 'w'
  const t = useLineTrainer({ key: puzzle?.id ?? 'none', startFen: puzzle?.fen ?? START_FEN, moves: puzzle?.moves ?? [], user, acceptAnyMate: true, replyDelay: 260 })

  // Every correct move of yours feeds the combo.
  const userMoves = t.played.filter((m) => m.color === user).length
  const seenMoves = useRef(0)
  useEffect(() => {
    if (!puzzle) return
    if (userMoves <= seenMoves.current) {
      seenMoves.current = userMoves
      return
    }
    seenMoves.current = userMoves
    if (mode !== 'rush' || t.mistakes) return
    setCombo((c) => {
      const n = c + 1
      const s = comboBonus(n)
      if (s) {
        endAt.current += s * 1000
        setBonus({ s, n: Date.now() })
      }
      return n
    })
  }, [userMoves]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    seenMoves.current = 0
  }, [puzzle?.id])

  // Solved: score and move on. Missed: the mode decides.
  const settled = useRef<string | null>(null)
  useEffect(() => {
    if (!puzzle || settled.current === puzzle.id || over) return
    if (t.status === 'solved' && !t.mistakes) {
      settled.current = puzzle.id
      const list = [...played, { id: puzzle.id, rating: puzzle.rating, ok: true }]
      setPlayed(list)
      play('great')
      window.setTimeout(() => next(list.filter((p) => p.ok).length), 280)
    } else if (t.mistakes > 0) {
      settled.current = puzzle.id
      const list = [...played, { id: puzzle.id, rating: puzzle.rating, ok: false }]
      setPlayed(list)
      play('illegal')
      if (mode === 'streak') {
        window.setTimeout(() => setOver(true), 1600)
      } else {
        endAt.current -= MISS_PENALTY_MS
        setCombo(0)
        setBonus({ s: -10, n: Date.now() })
        window.setTimeout(() => next(score), 500)
      }
    }
  }, [t.status, t.mistakes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Game over: personal best, XP, and back to the menu with the result.
  const ended = useRef(false)
  useEffect(() => {
    if (!over || ended.current) return
    ended.current = true
    const key = mode === 'rush' ? 'rushBest' : 'streakBest'
    const best = g.best[key] ?? 0
    const pb = score > best
    const xp = score * 2 + (pb && score > 0 ? 10 : 0)
    play('end')
    award({ xp, add: { puzzles: score }, max: { [key]: score }, label: `${MODES[mode].title}, ${score}` })
    window.setTimeout(() => onEnd({ mode, played, score, best: Math.max(best, score), pb, xp }), 900)
  }, [over]) // eslint-disable-line react-hooks/exhaustive-deps

  const showSolution = mode === 'streak' && t.mistakes > 0
  const prompt = useMemo(() => {
    if (!puzzle) return { head: all ? 'Out of puzzles' : 'Loading puzzles…' }
    if (over) return { head: mode === 'rush' ? 'Time' : 'Streak over', sub: `${score} solved`, tone: 'done' as const }
    if (showSolution) return { head: 'Not that one', sub: t.expected ? `The move was ${t.expected.slice(0, 2)}–${t.expected.slice(2, 4)}.` : undefined, tone: 'bad' as const }
    if (t.turn !== user) return { head: t.index === 0 ? 'Watch the move…' : 'Good — keep going', tone: t.index ? ('good' as const) : null }
    return { head: `${user === 'w' ? 'White' : 'Black'} to play`, sub: `Puzzle ${puzzle.rating}` }
  }, [puzzle, all, over, mode, score, showSolution, t.expected, t.turn, t.index, user])

  const toNext = nextComboAt(combo)
  const prevAt = [0, ...COMBO_STEPS.map(([a]) => a)].filter((a) => a <= combo).pop() ?? 0
  const comboPct = combo > 30 ? ((combo % 10) / 10) * 100 : ((combo - prevAt) / Math.max(1, toNext - prevAt)) * 100

  return (
    <TrainerShell
      title={MODES[mode].title}
      corners={{ tl: [MODES[mode].title, mode === 'rush' ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : `${score} in a row`], tr: ['Score', String(score)], bl: ['Puzzle', puzzle ? `${puzzle.rating} · #${puzzle.id}` : '—'], br: ['Best', String(mode === 'rush' ? g.best.rushBest ?? 0 : g.best.streakBest ?? 0)] }}
      position={t.position}
      orientation={user}
      selected={t.selected}
      targets={t.targets}
      interactive={!over && t.status === 'playing' && t.turn === user && !(mode === 'streak' && t.mistakes > 0)}
      pendingPromotion={t.pendingPromotion}
      onSelect={t.select}
      onMove={t.attemptMove}
      onPromote={t.promote}
      onCancelPromotion={t.cancelPromotion}
      annotation={t.wrong ? { square: t.wrong.square, kind: 'mistake', key: `w${t.wrong.n}` } : null}
      arrows={showSolution && t.expected ? [{ from: t.expected.slice(0, 2), to: t.expected.slice(2, 4), tone: 'best' }] : []}
      mated={resultOf(t.fen)?.status === 'checkmate' ? t.position.checkSquare : null}
      boardLabel={`${MODES[mode].title}, ${user === 'w' ? 'White' : 'Black'} to play`}
      side={
        <>
          <div className="run__top">
            {mode === 'rush' ? (
              <div className={`run__clock${secs <= 10 ? ' run__clock--low' : ''}`} role="timer" aria-label={`${secs} seconds left`}>
                {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
                {bonus ? (
                  <span key={bonus.n} className={`run__bonus${bonus.s < 0 ? ' run__bonus--minus' : ''}`}>
                    {bonus.s > 0 ? `+${bonus.s}s` : `${bonus.s}s`}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="run__score">
              <span className="mono mono--sm mono--mute">Score</span>
              <span className="run__score-n">{score}</span>
            </div>
          </div>
          {mode === 'rush' ? (
            <div className="run__combo">
              <span className="mono mono--sm">
                Combo — {combo} <span className="mono--mute">next bonus at {toNext}</span>
              </span>
              <span className="run__combo-bar" aria-hidden="true">
                <span style={{ width: `${comboPct}%` }} />
              </span>
            </div>
          ) : null}
          <Prompt {...prompt} />
          <ol className="arcade__trail arcade__trail--live" aria-label="This run">
            {played.map((p, i) => (
              <li key={`${p.id}${i}`} className={`arcade__pip${p.ok ? ' arcade__pip--ok' : ' arcade__pip--miss'}`}>
                {p.rating}
              </li>
            ))}
          </ol>
          <div className="play__controls">
            {mode === 'streak' && !skipped && !over && t.status === 'playing' && !t.mistakes ? (
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => {
                  setSkipped(true)
                  next(score)
                }}
              >
                Skip (once)
              </button>
            ) : null}
            {!over ? (
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setOver(true)}>
                End run
              </button>
            ) : null}
            <button type="button" className="btn btn--quiet btn--sm" onClick={onQuit}>
              Back to modes
            </button>
          </div>
        </>
      }
    />
  )
}
