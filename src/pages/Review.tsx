import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Board, type BoardArrow } from '../board/Board'
import { GradeIcon } from '../board/GradeIcon'
import type { ParsedGame, PgnMove } from '../analysis/pgn'
import { JUDGEMENT_PLURAL, JUDGEMENT_WORD, gradeMove, type GameReview, type Judgement, type MoveReview } from '../analysis/review'
import { useLiveEval } from '../analysis/useLiveEval'
import { useReview } from '../analysis/useReview'
import { numberLine, playLan, playMove, pvToSan } from '../analysis/variation'
import { Corner } from '../components/Corner'
import { useCountUp } from '../components/CountUp'
import { EvalBar } from '../components/EvalBar'
import { EvalGraph } from '../components/EvalGraph'
import { Footer } from '../components/Footer'
import { GradeSummary } from '../components/GradeSummary'
import { Nav } from '../components/Nav'
import { ReviewMoveList } from '../components/ReviewMoveList'
import { formatEvaluation, type Evaluation } from '../engine'
import { legalTargets, needsPromotion, positionFromFen, resultOf, sanOf } from '../game/rules'
import type { Color, MoveIntent, Promotion, Square } from '../game/types'
import { moveSound, play, type SoundKind } from '../sound/sounds'
import { DrawHint } from '../components/DrawHint'
import { SaveToggle } from '../components/SaveToggle'
import { pgnFromParsed } from '../analysis/pgn'
import { useLocation } from 'react-router-dom'

/** Grades loud enough to hear. Excellent and good stay quiet so a clean game is not a chorus. */
const GRADE_SOUND: Partial<Record<Judgement, SoundKind>> = {
  brilliant: 'brilliant',
  great: 'great',
  best: 'best',
  book: 'book',
  inaccuracy: 'inaccuracy',
  mistake: 'mistake',
  miss: 'miss',
  blunder: 'blunder',
}

const SUMMARY: Judgement[] = ['brilliant', 'great', 'miss', 'blunder', 'mistake', 'inaccuracy']

function summaryLine(sum: GameReview['white']): string {
  const parts = SUMMARY.filter((j) => sum[j] > 0).map((j) => `${sum[j]} ${sum[j] === 1 ? JUDGEMENT_WORD[j].replace(' move', '') : JUDGEMENT_PLURAL[j]}`)
  return parts.length ? parts.join(' — ') : 'no mistakes'
}

const BEST_PREF = 'oukplay.bestArrow'
function readBestPref(): boolean {
  try {
    return localStorage.getItem(BEST_PREF) !== 'off'
  } catch {
    return true
  }
}

function Accuracy({ value, label }: { value: number | null; label: string }) {
  const shown = useCountUp(value)
  const landed = value !== null && shown !== null && Math.round(shown) === Math.round(value)
  return (
    <output className={`accuracy${landed ? ' accuracy--landed' : ''}`} aria-label={label}>
      <span aria-hidden={value !== null && !landed ? true : undefined}>{shown === null ? '—' : Math.round(shown)}</span>
      <span className="mono mono--sm">acc</span>
    </output>
  )
}

const moveLabel = (ply: number, san: string) => `${Math.ceil(ply / 2)}${ply % 2 ? '.' : '…'} ${san}`

const VERDICT: Record<Judgement, string> = {
  brilliant: 'is brilliant',
  great: 'is a great move',
  best: 'is best',
  excellent: 'is excellent',
  good: 'is good',
  book: 'is a book move',
  inaccuracy: 'is an inaccuracy',
  mistake: 'is a mistake',
  miss: 'is a miss',
  blunder: 'is a blunder',
}

interface EngineLinesProps {
  fen: string
  ply: number
  evaluation: Evaluation | null
  thinking: boolean
  onPlay: (lan: string) => void
}

/** The engine's two candidate moves for the position on the board. Each line plays its first move when pressed. */
function EngineLines({ fen, ply, evaluation, thinking, onPlay }: EngineLinesProps) {
  const over = resultOf(fen)
  if (over) return <div className="lines mono mono--sm mono--mute">Game over — {over.reason}</div>
  if (!evaluation?.bestMove || evaluation.bestMove.length < 4) {
    return <div className="lines mono mono--sm mono--mute">{thinking ? 'Stockfish is thinking…' : 'No engine line yet'}</div>
  }
  const first = pvToSan(fen, evaluation.pv?.length ? evaluation.pv : [evaluation.bestMove], 7)
  const second = evaluation.second?.move ? pvToSan(fen, [evaluation.second.move], 1) : []
  return (
    <div className="lines" aria-label="Best moves">
      <button type="button" className="line line--best" onClick={() => onPlay(evaluation.bestMove!)}>
        <span className="line__score">{formatEvaluation(evaluation)}</span>
        <span className="line__moves">{numberLine(first, ply + 1)}</span>
      </button>
      {evaluation.second && second.length ? (
        <button type="button" className="line line--alt" onClick={() => onPlay(evaluation.second!.move!)}>
          <span className="line__score">{formatEvaluation(evaluation.second)}</span>
          <span className="line__moves">{numberLine(second, ply + 1)}</span>
        </button>
      ) : null}
      {thinking ? <span className="lines__note mono mono--sm mono--mute">deeper…</span> : null}
    </div>
  )
}

export interface ReviewPageProps {
  gameKey: string
  parsed: ParsedGame
  title: string
  /** Which side to show at the bottom. */
  orientation: Color
  external?: { href: string; label: string }
}

interface Variation {
  /** Main-line ply the variation branches from. */
  base: number
  moves: PgnMove[]
}

export function ReviewPage({ gameKey, parsed, title, orientation: initial, external }: ReviewPageProps) {
  const { pathname } = useLocation()
  const saveInfo = useMemo(() => {
    const h = parsed.headers
    return {
      id: gameKey,
      title,
      source: gameKey.startsWith('chesscom:') ? 'Chess.com' : h.Event && h.Event !== '?' ? h.Event : 'Pasted',
      to: pathname,
      pgn: gameKey.startsWith('chesscom:') ? undefined : pgnFromParsed(parsed),
      result: h.Result && h.Result !== '*' ? h.Result : undefined,
      date: h.Date && !h.Date.startsWith('?') ? h.Date.replace(/\.\?\?/g, '') : undefined,
    }
  }, [gameKey, parsed, title, pathname])
  const { fens, moves } = parsed
  const review = useReview(gameKey, fens, moves)
  const graded = review.graded
  const total = fens.length
  const [ply, setPly] = useState(0)
  const [orientation, setOrientation] = useState<Color>(initial)
  const [variation, setVariation] = useState<Variation | null>(null)
  const [at, setAt] = useState(0)
  const [selected, setSelected] = useState<Square | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [showBest, setShowBest] = useState(readBestPref)

  const clearHand = () => {
    setSelected(null)
    setPendingPromotion(null)
  }
  const seek = useCallback(
    (p: number) => {
      setVariation(null)
      setAt(0)
      setSelected(null)
      setPendingPromotion(null)
      setPly(Math.max(0, Math.min(total - 1, p)))
    },
    [total],
  )
  const exitVariation = useCallback(() => {
    if (variation) seek(variation.base)
  }, [variation, seek])

  // ---- where we are
  const varMove = variation && at > 0 ? variation.moves[at - 1] : null
  const fen = variation ? (varMove ? varMove.fenAfter : fens[variation.base]) : fens[ply]
  const curPly = variation ? variation.base + at : ply
  const lastPlayed: PgnMove | null = varMove ?? ((variation ? variation.base : ply) > 0 ? moves[(variation ? variation.base : ply) - 1] : null)
  const lastMove = lastPlayed ? { from: lastPlayed.from, to: lastPlayed.to } : null
  const position = useMemo(() => positionFromFen(fen, lastMove), [fen, lastMove?.from, lastMove?.to]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- evaluations: the review's for main-line positions, a live engine for the rest
  const mainIndex = useMemo(() => new Map(fens.map((f, i) => [f, i])), [fens])
  const reviewEval = (f: string): Evaluation | null | undefined => {
    const i = mainIndex.get(f)
    return i === undefined ? undefined : review.evals[i]
  }
  const needLive = reviewEval(fen) == null && (variation !== null || review.status !== 'running')
  const live = useLiveEval(fen, needLive)
  const evalFor = (f: string) => reviewEval(f) ?? live.lookup(f) ?? null
  const evaluation = evalFor(fen)

  // ---- grades for the user's own moves
  const varGrades: (MoveReview | null)[] = []
  if (variation) {
    variation.moves.forEach((m, k) => {
      const before = evalFor(m.fenBefore)
      const after = evalFor(m.fenAfter)
      if (!before || !after) {
        varGrades.push(null)
        return
      }
      const prevMove = k > 0 ? variation.moves[k - 1] : moves[variation.base - 1]
      const prevReview = k > 0 ? varGrades[k - 1] : graded[variation.base - 1]
      varGrades.push(gradeMove(m, before, after, { prevMove, prevReview }))
    })
  }
  const grade: MoveReview | null = variation ? (at > 0 ? varGrades[at - 1] : variation.base > 0 ? graded[variation.base - 1] ?? null : null) : ply > 0 ? graded[ply - 1] ?? null : null
  const gradedMove = lastPlayed
  const bestSan = grade?.bestMove && gradedMove ? sanOf(gradedMove.fenBefore, grade.bestMove) : null
  const mated = useMemo(() => (resultOf(fen)?.status === 'checkmate' ? position.checkSquare : null), [fen, position.checkSquare])

  // ---- the board's hand: select, move, promote
  const targets = useMemo(() => (selected ? legalTargets(fen, selected) : []), [selected, fen])
  const attemptMove = useCallback(
    (intent: MoveIntent): boolean => {
      if (!intent.promotion && needsPromotion(fen, intent)) {
        setPendingPromotion({ from: intent.from, to: intent.to })
        return true
      }
      const m = playMove(fen, intent, curPly + 1)
      if (!m) return false
      setSelected(null)
      setPendingPromotion(null)
      if (!variation) {
        // Playing the game's own move just steps forward.
        if (moves[ply]?.lan === m.lan) setPly(ply + 1)
        else {
          setVariation({ base: ply, moves: [m] })
          setAt(1)
        }
        return true
      }
      if (at === 0 && moves[variation.base]?.lan === m.lan) {
        seek(variation.base + 1)
        return true
      }
      if (variation.moves[at]?.lan === m.lan) {
        setAt(at + 1)
        return true
      }
      setVariation({ base: variation.base, moves: [...variation.moves.slice(0, at), m] })
      setAt(at + 1)
      return true
    },
    [fen, curPly, variation, at, moves, ply, seek],
  )
  const playEngineMove = (lan: string) => {
    const m = playLan(fen, lan, curPly + 1)
    if (m) attemptMove({ from: m.from, to: m.to, promotion: (lan[4] as Promotion | undefined) || undefined })
  }

  // ---- sound: each step sounds its move; arriving forward on a graded move adds the grade, even if the grade lands later
  const prevFen = useRef(fen)
  const owesGrade = useRef(false)
  useEffect(() => {
    const prev = prevFen.current
    prevFen.current = fen
    if (prev === fen) return
    owesGrade.current = false
    if (!lastPlayed) return
    const forward = lastPlayed.fenBefore === prev
    play(forward ? moveSound(lastPlayed.san) : 'move')
    if (forward) owesGrade.current = true
    if (forward && mated) play('end', 520)
  }, [fen]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!owesGrade.current || !grade) return
    owesGrade.current = false
    const s = GRADE_SOUND[grade.judgement]
    if (s) play(s, grade.judgement === 'book' ? 60 : 170)
  }, [grade?.judgement, fen]) // eslint-disable-line react-hooks/exhaustive-deps
  const prevStatus = useRef(review.status)
  useEffect(() => {
    if (prevStatus.current === 'running' && review.status === 'done') play('done')
    prevStatus.current = review.status
  }, [review.status])

  // Arrow keys belong to the board's cursor only when the board was reached by keyboard.
  // Chrome marks any focused element :focus-visible once a key is pressed, so track the modality ourselves.
  const keyboardModality = useRef(false)
  useEffect(() => {
    const onPointer = () => (keyboardModality.current = false)
    const onTab = (e: KeyboardEvent) => {
      if (e.key === 'Tab') keyboardModality.current = true
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onTab, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onTab, true)
    }
  }, [])

  // ---- keys: Left/Right step (through the variation when one is open), Home/End, Escape leaves a variation, F flips.
  // Captured before the board sees them, unless the board has keyboard focus for its own cursor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [role="dialog"]')) return
      if (t?.closest('[role="grid"]') && keyboardModality.current) return
      let handled = true
      if (e.key === 'ArrowLeft') {
        if (variation) {
          if (at > 0) setAt(at - 1)
          else exitVariation()
          clearHand()
        } else seek(ply - 1)
      } else if (e.key === 'ArrowRight') {
        if (variation) {
          if (at < variation.moves.length) setAt(at + 1)
          clearHand()
        } else seek(ply + 1)
      } else if (e.key === 'Home') seek(0)
      else if (e.key === 'End') seek(total - 1)
      else if (e.key === 'Escape' && variation && !selected) exitVariation()
      else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) setOrientation((o) => (o === 'w' ? 'b' : 'w'))
      else handled = false
      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [ply, seek, total, variation, at, exitVariation, selected])

  // ---- arrows
  const arrows: BoardArrow[] = []
  if (showBest && evaluation?.bestMove && evaluation.bestMove.length >= 4 && !resultOf(fen)) {
    const alt = evaluation.second?.move
    if (alt && alt.length >= 4 && alt !== evaluation.bestMove) arrows.push({ from: alt.slice(0, 2), to: alt.slice(2, 4), tone: 'alt' })
    arrows.push({ from: evaluation.bestMove.slice(0, 2), to: evaluation.bestMove.slice(2, 4), tone: 'best' })
  }
  const toggleBest = () => {
    setShowBest((v) => {
      try {
        localStorage.setItem(BEST_PREF, v ? 'off' : 'on')
      } catch {
        /* the toggle still works for this page */
      }
      return !v
    })
  }

  // ---- words
  const h = parsed.headers
  const white = h.White ?? 'White'
  const black = h.Black ?? 'Black'
  const sans = moves.map((m) => m.san)
  const opening = useMemo(() => {
    for (let i = graded.length - 1; i >= 0; i--) if (graded[i]?.opening) return graded[i].opening!
    return null
  }, [graded])

  const verdictText = (() => {
    if (!gradedMove) return { head: 'Start position', sub: `Evaluation — ${formatEvaluation(evaluation)}` }
    const label = moveLabel(curPly, gradedMove.san)
    if (!grade) return { head: label, sub: variation && at > 0 ? 'Stockfish is grading your move…' : review.status === 'running' ? 'Grading…' : formatEvaluation(evaluation) }
    let sub = ''
    if (grade.judgement === 'book' && grade.opening) sub = grade.opening.replace(/^[A-E]\d\d /, '')
    else if (!['best', 'brilliant', 'great', 'book'].includes(grade.judgement) && bestSan) sub = `Best was ${bestSan}`
    return { head: `${label} ${VERDICT[grade.judgement]}`, sub: [sub, formatEvaluation(evaluation)].filter(Boolean).join(' — ') }
  })()

  const side = (c: Color, slot: 'top' | 'bottom') => {
    const sum: GameReview['white'] | undefined = c === 'w' ? review.review?.white : review.review?.black
    return (
      <div className={`player player--${slot}`}>
        <div className="player__name">
          <span className="mono">
            {c === 'w' ? 'White' : 'Black'} — {c === 'w' ? white : black}
            {h[c === 'w' ? 'WhiteElo' : 'BlackElo'] ? ` (${h[c === 'w' ? 'WhiteElo' : 'BlackElo']})` : ''}
          </span>
          <span className="mono mono--sm mono--mute">{sum ? summaryLine(sum) : review.status === 'running' ? 'grading…' : ' '}</span>
        </div>
        <Accuracy value={sum ? sum.accuracy : null} label={`${c === 'w' ? 'White' : 'Black'} accuracy${sum ? ` ${Math.round(sum.accuracy)}` : ''}`} />
      </div>
    )
  }

  const progress =
    review.status === 'running'
      ? review.phase === 'verify'
        ? `checking ${review.verified} of ${review.toVerify} at depth 20`
        : `${review.done} of ${review.total}`
      : review.status === 'done'
        ? `done — depth 16, critical moves at 20`
        : review.status === 'failed'
          ? 'engine failed to load'
          : 'waiting'

  return (
    <>
      <Nav />
      <main id="main" className="container play play--review">
        <h1 className="visually-hidden">{title}</h1>
        <div className="play__frame">
          <Corner pos="tl" label="Game" value={`${white} v ${black}`} cross />
          <Corner pos="tr" label="Date" value={h.Date ?? h.UTCDate ?? 'unknown'} cross />
          <Corner pos="bl" label={opening && review.status === 'done' ? 'Opening' : 'Review'} value={opening && review.status === 'done' ? opening : progress} />
          <Corner pos="br" label="Engine" value={variation ? `${review.engineName}, live` : review.engineName} mute />

          <div className="play__main">
            <div className="board-stage">
              <Board
                position={position}
                orientation={orientation}
                selected={selected}
                targets={targets}
                interactive
                pendingPromotion={pendingPromotion}
                onSelect={(sq) => {
                  setSelected(sq)
                  setPendingPromotion(null)
                }}
                onMove={attemptMove}
                onPromote={(piece) => pendingPromotion && attemptMove({ ...pendingPromotion, promotion: piece })}
                onCancelPromotion={clearHand}
                label={variation ? 'Your variation — move any piece to explore' : 'Game position — move any piece to explore'}
                annotation={grade && gradedMove ? { square: gradedMove.to, kind: grade.judgement, key: fen } : null}
                mated={mated}
                arrows={arrows}
              />
            </div>
            <EvalBar evaluation={evaluation} orientation={orientation} />
          </div>

          <aside className="play__side play__side--review" aria-label="Review">
            {side(orientation === 'w' ? 'b' : 'w', 'top')}
            <EvalGraph evals={review.evals} moves={graded} total={total} current={variation ? variation.base : ply} sans={sans} onSeek={seek} />
            <div className={`verdict${grade ? ` verdict--${grade.judgement}` : ''}`}>
              {grade ? <GradeIcon key={`${fen}${grade.judgement}`} kind={grade.judgement} className="verdict__icon" /> : <span className="verdict__icon verdict__icon--empty" aria-hidden="true" />}
              <p className="verdict__text" role="status" aria-live="polite">
                <span className="verdict__head">{verdictText.head}</span>
                <span className="verdict__sub mono mono--sm mono--mute">{verdictText.sub}</span>
              </p>
            </div>
            <EngineLines fen={fen} ply={curPly} evaluation={evaluation} thinking={needLive && live.thinking} onPlay={playEngineMove} />
            {variation ? (
              <div className="variation" aria-label="Your variation">
                <div className="variation__head">
                  <span className="mono mono--sm">Variation — from {variation.base ? moveLabel(variation.base, sans[variation.base - 1]) : 'the start'}</span>
                  <button type="button" className="btn btn--quiet btn--sm" onClick={exitVariation}>
                    Back to game
                  </button>
                </div>
                <ol className="variation__moves">
                  {variation.moves.map((m, k) => {
                    const g = varGrades[k]
                    return (
                      <li key={`${k}${m.lan}`}>
                        <button type="button" className={`moves__ply${g ? ` moves__ply--${g.judgement}` : ' moves__ply--pending'}`} aria-current={at === k + 1 ? 'true' : undefined} onClick={() => setAt(k + 1)} aria-label={`${moveLabel(m.ply, m.san)}${g ? `, ${JUDGEMENT_WORD[g.judgement]}` : ''}`}>
                          {g ? <GradeIcon kind={g.judgement} /> : null}
                          {(m.ply % 2 === 1 || k === 0) ? <span className="moves__num">{moveLabel(m.ply, '').trim()}</span> : null}
                          {m.san}
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>
            ) : null}
            <ReviewMoveList sans={sans} reviews={graded} grading={review.status === 'running'} current={variation ? null : ply} onSeek={seek} />
            {side(orientation, 'bottom')}
            <div className="play__controls">
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => seek(0)} disabled={!variation && ply === 0} aria-label="Start">
                |&lt;
              </button>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => (variation ? (at > 0 ? setAt(at - 1) : exitVariation()) : seek(ply - 1))} disabled={!variation && ply === 0} aria-label="Previous move">
                &lt;
              </button>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => (variation ? setAt(Math.min(variation.moves.length, at + 1)) : seek(ply + 1))} disabled={variation ? at >= variation.moves.length : ply >= total - 1} aria-label="Next move">
                &gt;
              </button>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => seek(total - 1)} disabled={!variation && ply >= total - 1} aria-label="End">
                &gt;|
              </button>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}>
                Flip
              </button>
              <button type="button" className="btn btn--quiet btn--sm" onClick={toggleBest} aria-pressed={showBest}>
                Best move — {showBest ? 'on' : 'off'}
              </button>
              <SaveToggle game={saveInfo} />
              {external ? (
                <a className="btn btn--quiet btn--sm" href={external.href} target="_blank" rel="noreferrer">
                  {external.label}
                </a>
              ) : null}
            </div>
            <DrawHint />
          </aside>
        </div>
        <GradeSummary graded={graded} white={white} black={black} running={review.status === 'running'} />
      </main>
      <Footer />
    </>
  )
}
