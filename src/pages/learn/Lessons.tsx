import { Chess } from 'chess.js'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Footer } from '../../components/Footer'
import { Nav } from '../../components/Nav'
import { LearnTabs } from './LearnTabs'
import { resultOf } from '../../game/rules'
import type { Color } from '../../game/types'
import { LESSONS, type LessonStep, type StepLesson } from '../../learn/lessons'
import { useProgress } from '../../learn/progress'
import { award } from '../../learn/game'
import { STAGES, useRoadmap } from '../../learn/roadmap'
import { useLineTrainer } from '../../learn/useLineTrainer'
import { play } from '../../sound/sounds'
import { Prompt, TrainerShell } from './TrainerShell'

const NAMES: Record<Color, string> = { w: 'White', b: 'Black' }

/** The stage a lesson sits in on the roadmap. */
const stageOf = (id: string) => STAGES.find((s) => s.steps.some((x) => x.kind === 'lesson' && x.id === id))

/** A step as the trainer needs it: start FEN and the line in long algebraic. */
function compile(step: LessonStep) {
  const c = new Chess(step.fen)
  if (step.from) for (const m of step.from) c.move(m)
  const fen = c.fen()
  const moves = step.moves.map((san) => c.move(san).lan)
  let acceptLast: string[] | undefined
  if (step.alt?.length) {
    const back = new Chess(fen)
    for (const lan of moves.slice(0, -1)) back.move({ from: lan.slice(0, 2), to: lan.slice(2, 4), promotion: lan[4] })
    acceptLast = step.alt.map((san) => new Chess(back.fen()).move(san).lan)
  }
  return { fen, moves, acceptLast, user: (fen.split(' ')[1] === 'b' ? 'b' : 'w') as Color }
}

export function LessonsIndex() {
  const [p] = useProgress()
  return (
    <>
      <Nav />
      <LearnTabs />
      <main id="main" className="container learn">
        <header className="learn__head">
          <p className="mono mono--sm">
            <Link to="/learn">Learn</Link> — lessons
          </p>
          <h1>Lessons</h1>
          <p className="lead">Short guided lessons, one idea at a time. Each step is a position and a task: find the move, read why it works, go on.</p>
        </header>
        {STAGES.map((s, si) => {
          const ls = LESSONS.filter((l) => stageOf(l.id)?.id === s.id)
          if (!ls.length) return null
          return (
            <section key={s.id} className="shelf" aria-labelledby={`ls-${s.id}`}>
              <div className="shelf__head">
                <h2 id={`ls-${s.id}`}>
                  {String(si + 1).padStart(2, '0')} {s.title}
                </h2>
                <p className="mono mono--sm mono--mute">{s.band}</p>
              </div>
              <ol className="rows">
                {ls.map((l) => {
                  const done = p.lessons.includes(l.id)
                  return (
                    <li key={l.id}>
                      <Link to={`/learn/lessons/${l.id}`} className="row">
                        <span className="row__eco mono mono--sm mono--mute">{l.steps.length} steps</span>
                        <span className="row__title">{l.title}</span>
                        <span className="row__body">{l.blurb}</span>
                        <span className={`row__state mono mono--sm${done ? '' : ' mono--mute'}`}>{done ? 'done' : 'start'}</span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}
      </main>
      <Footer />
    </>
  )
}

export function LessonPage() {
  const { id = '' } = useParams()
  const lesson = LESSONS.find((l) => l.id === id)
  if (!lesson) return <LessonsIndex />
  return <Lesson key={lesson.id} lesson={lesson} />
}

function Lesson({ lesson }: { lesson: StepLesson }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [attempt, setAttempt] = useState(0)
  /** Steps finished in this visit (solved or shown). */
  const [cleared, setCleared] = useState<Set<number>>(new Set())
  const [progress, update] = useProgress()
  const road = useRoadmap()
  const step = lesson.steps[stepIndex]
  const c = useMemo(() => compile(step), [step])
  const t = useLineTrainer({ key: `${lesson.id}:${stepIndex}:${attempt}`, startFen: c.fen, moves: c.moves, user: c.user, acceptAnyMate: step.anyMate, acceptLast: c.acceptLast, replyDelay: 600 })
  const stage = stageOf(lesson.id)
  const complete = cleared.size === lesson.steps.length

  // A finished step counts; the last one finishes the lesson.
  useEffect(() => {
    if (t.status === 'playing') return
    if (t.status === 'solved') play('great', 180)
    if (t.status === 'solved' && !cleared.has(stepIndex)) award({ xp: t.mistakes ? 1 : 3, add: { lessonSteps: 1 }, label: t.mistakes ? 'Lesson step' : 'Lesson step, first try' })
    setCleared((s) => (s.has(stepIndex) ? s : new Set(s).add(stepIndex)))
  }, [t.status]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!complete) return
    if (progress.lessons.includes(lesson.id)) {
      award({ xp: 5, label: 'Lesson, reviewed' })
      return
    }
    play('brilliant', 260)
    award({ xp: 25, add: { lessons: 1 }, label: `Lesson — ${lesson.title}` })
    update((p) => ({ ...p, lessons: [...p.lessons, lesson.id] }))
  }, [complete]) // eslint-disable-line react-hooks/exhaustive-deps

  const [flash, setFlash] = useState<{ square: string; n: number; fenAfter: string } | null>(null)
  useEffect(() => {
    if (!t.wrong) return
    setFlash(t.wrong)
    const id = window.setTimeout(() => setFlash(null), 1000)
    return () => window.clearTimeout(id)
  }, [t.wrong])

  const go = (i: number) => {
    setStepIndex(i)
    setAttempt((a) => a + 1)
  }
  const lastStep = stepIndex === lesson.steps.length - 1
  const nextOpen = lesson.steps.findIndex((_, i) => !cleared.has(i) && i !== stepIndex)
  const arrows = t.hinted && t.expected ? [{ from: t.expected.slice(0, 2), to: t.expected.slice(2, 4), tone: 'best' as const }] : []
  const lastUser = [...t.played].reverse().find((m) => m.color === c.user)
  const annotation = flash
    ? { square: flash.square, kind: 'mistake' as const, key: `w${flash.n}` }
    : lastUser && t.status === 'solved'
      ? { square: lastUser.to, kind: (t.mistakes ? 'best' : 'great') as 'great' | 'best', key: `${stepIndex}:${attempt}` }
      : null

  const prompt = (() => {
    if (t.status === 'solved') return { head: t.mistakes ? 'Got it' : 'Correct', sub: step.done, tone: 'done' as const }
    if (t.status === 'revealed') return { head: 'Here is the move', sub: step.done ?? 'Watch it, then try the step again or go on.', tone: 'bad' as const }
    if (flash) {
      const r = resultOf(flash.fenAfter)
      if (r?.status === 'stalemate') return { head: 'That is stalemate', sub: 'No check and no legal move: the game would be a draw. Find a move that gives check.', tone: 'bad' as const }
      return { head: 'Not that one', sub: `Try again: ${step.task.toLowerCase()}.`, tone: 'bad' as const }
    }
    if (t.turn !== c.user) return { head: t.index ? 'Good. The reply…' : `${NAMES[t.turn]} moves…`, tone: t.index ? ('good' as const) : null }
    return { head: step.task }
  })()

  // After the last step: where the roadmap goes next (skipping this lesson).
  const after = road.next && !(road.next.step.key === `l:${lesson.id}`) ? road.next.step : null

  return (
    <TrainerShell
      title={lesson.title}
      corners={{ tl: ['Lesson', lesson.title], tr: ['You play', NAMES[c.user]], bl: ['Step', `${stepIndex + 1} of ${lesson.steps.length}`], br: ['Stage', stage?.title ?? '—'] }}
      position={t.position}
      orientation={c.user}
      selected={t.selected}
      targets={t.targets}
      interactive={t.status === 'playing' && t.turn === c.user}
      pendingPromotion={t.pendingPromotion}
      onSelect={t.select}
      onMove={t.attemptMove}
      onPromote={t.promote}
      onCancelPromotion={t.cancelPromotion}
      annotation={annotation}
      arrows={arrows}
      mated={resultOf(t.fen)?.status === 'checkmate' ? t.position.checkSquare : null}
      boardLabel={`${lesson.title}, step ${stepIndex + 1}: ${step.task}. You play ${NAMES[c.user]}.`}
      side={
        <>
          <p className="mono mono--sm">
            <Link to="/learn/lessons">Lessons</Link> — <Link to="/learn/roadmap">{stage?.title.toLowerCase() ?? 'roadmap'}</Link>
          </p>
          <h2 className="trainer__title">{lesson.title}</h2>
          <ol className="steps" aria-label="Steps">
            {lesson.steps.map((s, i) => (
              <li key={s.task}>
                <button type="button" className={`steps__pip${i === stepIndex ? ' steps__pip--on' : ''}${cleared.has(i) ? ' steps__pip--done' : ''}`} aria-current={i === stepIndex ? 'step' : undefined} aria-label={`Step ${i + 1}: ${s.task}${cleared.has(i) ? ', done' : ''}`} onClick={() => go(i)}>
                  {i + 1}
                </button>
              </li>
            ))}
          </ol>
          <Prompt {...prompt} />
          {complete && t.status !== 'playing' && (lastStep || nextOpen < 0) ? (
            <div className="trainer__note">
              <p className="mono mono--sm">Lesson complete — remember</p>
              <ul className="ideas">
                {lesson.takeaways.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="trainer__note">
              <p>{step.text}</p>
            </div>
          )}
          <div className="play__controls">
            {t.status === 'playing' ? (
              <>
                <button type="button" className="btn btn--quiet btn--sm" onClick={t.hint} disabled={t.turn !== c.user}>
                  Hint
                </button>
                <button type="button" className="btn btn--quiet btn--sm" onClick={t.reveal}>
                  Show me
                </button>
              </>
            ) : (
              <>
                {!lastStep ? (
                  <button type="button" className="btn btn--sm" onClick={() => go(stepIndex + 1)} autoFocus>
                    Next step
                  </button>
                ) : nextOpen >= 0 ? (
                  <button type="button" className="btn btn--sm" onClick={() => go(nextOpen)} autoFocus>
                    Step {nextOpen + 1} is left
                  </button>
                ) : after ? (
                  <Link className="btn btn--sm" to={after.to} autoFocus>
                    Next — {after.title}
                  </Link>
                ) : (
                  <Link className="btn btn--sm" to="/learn/roadmap" autoFocus>
                    Back to the roadmap
                  </Link>
                )}
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => setAttempt((a) => a + 1)}>
                  Again
                </button>
              </>
            )}
          </div>
        </>
      }
    />
  )
}
