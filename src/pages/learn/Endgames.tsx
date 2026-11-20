import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Footer } from '../../components/Footer'
import { Nav } from '../../components/Nav'
import { LearnTabs } from './LearnTabs'
import { ENDGAMES, type EndgameDrill } from '../../learn/endgames'
import { ENDGAME_THEMES } from '../../learn/motifs'
import { getProgressSnapshot, useProgress } from '../../learn/progress'
import { award } from '../../learn/game'
import { usePlayout } from '../../learn/usePlayout'
import { resultOf } from '../../game/rules'
import type { Color } from '../../game/types'
import { useThemeCounts } from './Middlegame'
import { Prompt, TrainerShell } from './TrainerShell'

const NAMES: Record<Color, string> = { w: 'White', b: 'Black' }
const LEVELS: { id: EndgameDrill['level']; title: string }[] = [
  { id: 'basic', title: 'Basic' },
  { id: 'core', title: 'Must know' },
  { id: 'advanced', title: 'Advanced' },
]

const goalText = (d: EndgameDrill) =>
  d.goal.kind === 'mate' ? `Mate within ${d.goal.moves} moves` : d.goal.kind === 'promote' ? `Promote safely within ${d.goal.moves} moves` : `Hold the draw for ${d.goal.moves} moves`

export function EndgamesIndex() {
  const [p] = useProgress()
  const counts = useThemeCounts()
  return (
    <>
      <Nav />
      <LearnTabs />
      <main id="main" className="container learn">
        <header className="learn__head">
          <p className="mono mono--sm">
            <Link to="/learn">Learn</Link> — endgames
          </p>
          <h1>Endgames</h1>
          <p className="lead">Play each position out against Stockfish at full strength. It defends perfectly, so a win is a real win.</p>
        </header>
        {LEVELS.map((l) => (
          <section key={l.id} className="shelf" aria-labelledby={`e-${l.id}`}>
            <div className="shelf__head">
              <h2 id={`e-${l.id}`}>{l.title}</h2>
            </div>
            <ol className="rows">
              {ENDGAMES.filter((d) => d.level === l.id).map((d) => (
                <li key={d.id}>
                  <Link to={`/learn/endgames/${d.id}`} className="row">
                    <span className="row__eco mono mono--sm mono--mute">{NAMES[d.side]}</span>
                    <span className="row__title">{d.title}</span>
                    <span className="row__body">
                      {d.lesson} <span className="mono--mute">{goalText(d)}.</span>
                    </span>
                    <span className={`row__state mono mono--sm${p.endgames.includes(d.id) ? '' : ' mono--mute'}`}>{p.endgames.includes(d.id) ? 'done' : 'play'}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
        <section className="shelf" aria-labelledby="e-puzzles">
          <div className="shelf__head">
            <h2 id="e-puzzles">Endgame puzzles</h2>
            <p className="mono mono--sm mono--mute">Positions from real games where the ending is decided by one exact move.</p>
          </div>
          <ol className="rows">
            {ENDGAME_THEMES.map((t) => (
              <li key={t.theme}>
                <Link to={`/learn/puzzles?theme=${t.theme}`} className="row">
                  <span className="row__eco mono mono--sm mono--mute">{counts?.get(t.theme) ?? '…'}</span>
                  <span className="row__title">{t.title}</span>
                  <span className="row__body" />
                  <span className="row__state mono mono--sm">Train</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <Footer />
    </>
  )
}

export function EndgameDrillPage() {
  const { id = '' } = useParams()
  const drill = ENDGAMES.find((d) => d.id === id)
  if (!drill) return <EndgamesIndex />
  return <Drill key={drill.id} drill={drill} />
}

function Drill({ drill }: { drill: EndgameDrill }) {
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState(0)
  const [, update] = useProgress()
  const g = usePlayout({ key: `${drill.id}:${attempt}`, fen: drill.fen, user: drill.side, goal: drill.goal })

  useEffect(() => {
    if (g.status !== 'won') return
    const first = !getProgressSnapshot().endgames.includes(drill.id)
    award({ xp: first ? 30 : 6, add: { endgames: 1 }, label: `Endgame — ${drill.title}` })
    update((p) => (p.endgames.includes(drill.id) ? p : { ...p, endgames: [...p.endgames, drill.id] }))
  }, [g.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextDrill = ENDGAMES[(ENDGAMES.findIndex((d) => d.id === drill.id) + 1) % ENDGAMES.length]
  const arrows = g.hint ? [{ from: g.hint.slice(0, 2), to: g.hint.slice(2, 4), tone: 'best' as const }] : []
  const last = g.played[g.played.length - 1]
  const prompt =
    g.status === 'won'
      ? { head: 'Done', sub: g.reason, tone: 'done' as const }
      : g.status === 'lost'
        ? { head: 'Not this time', sub: `${g.reason} Take back a move or start again.`, tone: 'bad' as const }
        : g.turn === drill.side
          ? { head: `Your move — ${goalText(drill).toLowerCase()}`, sub: `Move ${g.userMoves + 1} of ${drill.goal.moves}` }
          : { head: 'Stockfish is thinking…', sub: `Move ${g.userMoves} of ${drill.goal.moves}` }

  return (
    <TrainerShell
      title={drill.title}
      corners={{ tl: ['Endgame', drill.title], tr: ['You play', NAMES[drill.side]], bl: ['Goal', goalText(drill)], br: ['Opponent', `${g.engineName}, full strength`] }}
      position={g.position}
      orientation={drill.side}
      selected={g.selected}
      targets={g.targets}
      interactive={g.status === 'playing' && g.turn === drill.side}
      pendingPromotion={g.pendingPromotion}
      onSelect={g.select}
      onMove={g.attemptMove}
      onPromote={g.promote}
      onCancelPromotion={g.cancelPromotion}
      arrows={arrows}
      annotation={g.status === 'won' && last ? { square: last.to, kind: 'brilliant', key: 'won' } : g.status === 'lost' && last ? { square: last.to, kind: 'blunder', key: 'lost' } : null}
      mated={resultOf(g.fen)?.status === 'checkmate' ? g.position.checkSquare : null}
      boardLabel={`${drill.title}, you play ${NAMES[drill.side]}`}
      side={
        <>
          <p className="mono mono--sm">
            <Link to="/learn/endgames">Endgames</Link> — {drill.level}
          </p>
          <h2 className="trainer__title">{drill.title}</h2>
          <Prompt {...prompt} />
          <div className="trainer__note">
            <p>{drill.lesson}</p>
            <ul className="ideas">
              {drill.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="play__controls">
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => void g.askHint()} disabled={g.status !== 'playing' || g.turn !== drill.side}>
              Hint
            </button>
            <button type="button" className="btn btn--quiet btn--sm" onClick={g.takeBack} disabled={!g.played.some((m) => m.color === drill.side) || g.thinking}>
              Take back
            </button>
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setAttempt((a) => a + 1)}>
              Restart
            </button>
            {g.status === 'won' ? (
              <button type="button" className="btn btn--sm" onClick={() => navigate(`/learn/endgames/${nextDrill.id}`)} autoFocus>
                Next — {nextDrill.title}
              </button>
            ) : null}
          </div>
        </>
      }
    />
  )
}
