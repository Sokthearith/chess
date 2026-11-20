import { Chess } from 'chess.js'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Footer } from '../../components/Footer'
import { Nav } from '../../components/Nav'
import { LearnTabs } from './LearnTabs'
import { OPENINGS, OPENING_GROUPS, type OpeningLesson } from '../../learn/openings'
import { useProgress } from '../../learn/progress'
import { award } from '../../learn/game'
import { useLineTrainer } from '../../learn/useLineTrainer'
import { openingName } from '../../learn/puzzles'
import { START_FEN } from '../../game/rules'
import type { Color } from '../../game/types'
import { play } from '../../sound/sounds'
import { storePgn } from '../../analysis/library'
import { Prompt, TrainerShell } from './TrainerShell'

const NAMES: Record<Color, string> = { w: 'White', b: 'Black' }

function lansOf(o: OpeningLesson): string[] {
  const c = new Chess()
  return o.line.map(([san]) => c.move(san).lan)
}

function pgnOf(o: OpeningLesson): string {
  return `[Event "${o.name}"]\n[White "${o.side === 'w' ? 'You' : 'Opponent'}"]\n[Black "${o.side === 'b' ? 'You' : 'Opponent'}"]\n\n${o.line.map(([san], i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san)).join(' ')}`
}

export function OpeningsIndex() {
  const [p] = useProgress()
  return (
    <>
      <Nav />
      <LearnTabs />
      <main id="main" className="container learn">
        <header className="learn__head">
          <p className="mono mono--sm">
            <Link to="/learn">Learn</Link> — openings
          </p>
          <h1>Openings</h1>
          <p className="lead">Each lesson walks one main line with the reason for every move. Learn it with the arrows on, then practise it from memory.</p>
        </header>
        {OPENING_GROUPS.map((g) => (
          <section key={g.id} className="shelf" aria-labelledby={`g-${g.id}`}>
            <div className="shelf__head">
              <h2 id={`g-${g.id}`}>{g.title}</h2>
              <p className="mono mono--sm mono--mute">{g.note}</p>
            </div>
            <ol className="rows">
              {OPENINGS.filter((o) => o.group === g.id).map((o) => (
                <li key={o.id}>
                  <Link to={`/learn/openings/${o.id}`} className="row">
                    <span className="row__eco mono mono--sm mono--mute">{o.eco}</span>
                    <span className="row__title">{o.name}</span>
                    <span className="row__body">{o.blurb}</span>
                    <span className={`row__state mono mono--sm${p.openings[o.id] ? '' : ' mono--mute'}`}>{p.openings[o.id] ?? `${Math.ceil(o.line.length / 2)} moves`}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </main>
      <Footer />
    </>
  )
}

export function OpeningLessonPage() {
  const { id = '' } = useParams()
  const lesson = OPENINGS.find((o) => o.id === id)
  if (!lesson) return <OpeningsIndex />
  return <Lesson key={lesson.id} lesson={lesson} />
}

function Lesson({ lesson }: { lesson: OpeningLesson }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'learn' | 'practice'>('learn')
  const [attempt, setAttempt] = useState(0)
  const [progress, update] = useProgress()
  const moves = useMemo(() => lansOf(lesson), [lesson])
  const t = useLineTrainer({ key: `${lesson.id}:${mode}:${attempt}`, startFen: START_FEN, moves, user: lesson.side, replyDelay: 650 })

  // Record progress when the line is finished.
  useEffect(() => {
    if (t.status !== 'solved') return
    play(mode === 'practice' && !t.mistakes ? 'brilliant' : 'great', 220)
    const was = progress.openings[lesson.id]
    const xp = mode === 'practice' && !t.mistakes ? (was === 'mastered' ? 5 : 30) : was ? 4 : 15
    award({ xp, add: { openings: 1 }, label: mode === 'practice' && !t.mistakes && was !== 'mastered' ? `Mastered — ${lesson.name}` : `Opening — ${lesson.name}` })
    update((p) => {
      const was = p.openings[lesson.id]
      const now = mode === 'practice' && t.mistakes === 0 ? 'mastered' : was === 'mastered' ? 'mastered' : 'learned'
      return { ...p, openings: { ...p.openings, [lesson.id]: now } }
    })
  }, [t.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const [flash, setFlash] = useState<{ square: string; n: number } | null>(null)
  useEffect(() => {
    if (!t.wrong) return
    setFlash(t.wrong)
    const id = window.setTimeout(() => setFlash(null), 1000)
    return () => window.clearTimeout(id)
  }, [t.wrong])

  const next = t.expected
  const nextNote = t.index < lesson.line.length ? lesson.line[t.index] : null
  const lastNote = t.index > 0 ? lesson.line[t.index - 1] : null
  const showArrow = mode === 'learn' || t.hinted
  const arrows = next && showArrow ? [{ from: next.slice(0, 2), to: next.slice(2, 4), tone: 'best' as const }] : []
  const last = t.played[t.played.length - 1]
  const annotation = flash
    ? { square: flash.square, kind: 'mistake' as const, key: `w${flash.n}` }
    : last
      ? { square: last.to, kind: 'book' as const, key: last.ply }
      : null

  const moveNo = (i: number) => `${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'}`
  const prompt = (() => {
    if (t.status === 'solved') return { head: mode === 'practice' && !t.mistakes ? 'Mastered' : 'Line complete', sub: mode === 'learn' ? 'Now play it from memory: no arrows.' : t.mistakes ? `${t.mistakes} slip${t.mistakes === 1 ? '' : 's'}. Once more without any and it is mastered.` : 'Played from memory without a slip.', tone: 'done' as const }
    if (flash) return { head: 'That is not the book move', sub: mode === 'practice' ? 'Try again, or ask for a hint.' : `Follow the arrow: ${nextNote?.[0]}.`, tone: 'bad' as const }
    if (next && nextNote) return { head: mode === 'learn' ? `Play ${moveNo(t.index)} ${nextNote[0]}` : `Your move as ${NAMES[lesson.side]}`, sub: mode === 'learn' ? nextNote[1] : undefined }
    return { head: `${NAMES[lesson.side === 'w' ? 'b' : 'w']} replies…` }
  })()

  const review = () => {
    const pgn = pgnOf(lesson)
    try {
      navigate(`/analysis/pgn/${storePgn(pgn, lesson.name, 'Opening lesson')}`)
    } catch {
      /* storage refused: stay here */
    }
  }

  return (
    <TrainerShell
      title={lesson.name}
      corners={{ tl: ['Opening', `${lesson.eco} ${lesson.name}`], tr: ['You play', NAMES[lesson.side]], bl: ['Mode', mode === 'learn' ? 'learn, with arrows' : 'practice, from memory'], br: ['Move', `${Math.min(t.index, lesson.line.length)} of ${lesson.line.length}`] }}
      position={t.position}
      orientation={lesson.side}
      selected={t.selected}
      targets={t.targets}
      interactive={t.status === 'playing' && t.turn === lesson.side}
      pendingPromotion={t.pendingPromotion}
      onSelect={t.select}
      onMove={t.attemptMove}
      onPromote={t.promote}
      onCancelPromotion={t.cancelPromotion}
      annotation={annotation}
      arrows={arrows}
      boardLabel={`${lesson.name}, you play ${NAMES[lesson.side]}`}
      side={
        <>
          <p className="mono mono--sm">
            <Link to="/learn/openings">Openings</Link> — {progress.openings[lesson.id] ?? 'new'}
          </p>
          <h2 className="trainer__title">{lesson.name}</h2>
          <Prompt {...prompt} />
          {lastNote && t.status !== 'solved' ? (
            <div className="trainer__note">
              <p className="mono mono--sm">
                {moveNo(t.index - 1)} {lastNote[0]}
              </p>
              <p>{lastNote[1]}</p>
            </div>
          ) : null}
          {t.status === 'solved' || mode === 'learn' ? (
            <div className="trainer__note">
              <p className="mono mono--sm">Plans to remember</p>
              <ul className="ideas">
                {lesson.ideas.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="play__controls">
            <button type="button" className={`btn btn--sm${mode === 'learn' ? '' : ' btn--quiet'}`} aria-pressed={mode === 'learn'} onClick={() => { setMode('learn'); setAttempt((a) => a + 1) }}>
              Learn
            </button>
            <button type="button" className={`btn btn--sm${mode === 'practice' ? '' : ' btn--quiet'}`} aria-pressed={mode === 'practice'} onClick={() => { setMode('practice'); setAttempt((a) => a + 1) }}>
              Practice
            </button>
            {mode === 'practice' && t.status === 'playing' ? (
              <button type="button" className="btn btn--quiet btn--sm" onClick={t.hint} disabled={!next}>
                Hint
              </button>
            ) : null}
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setAttempt((a) => a + 1)}>
              Restart
            </button>
          </div>
          <div className="play__controls">
            <button type="button" className="btn btn--quiet btn--sm" onClick={review}>
              Analyse this line
            </button>
            {lesson.family ? (
              <Link className="btn btn--quiet btn--sm" to={`/learn/puzzles?opening=${lesson.family}`}>
                {openingName(lesson.family)} tactics
              </Link>
            ) : null}
          </div>
        </>
      }
    />
  )
}
