import { useEffect, useRef, useState } from 'react'
import { createEngine, type Evaluation } from '../engine'
import type { PgnMove } from './pgn'
import { bookLine, loadOpeningBook } from './openings'
import { buildReview, gradeMove, type GameReview, type MoveReview } from './review'

/** First pass: every position. */
const DEPTH = 16
/** Second pass: both positions around every move whose grade is a verdict (anything but best/excellent/good/book). */
const VERIFY_DEPTH = 20
/** Two lines per position: the gap between them is what makes a move "great". */
const MULTI_PV = 2
/** v4: depth 16 + a depth-20 check of every critical move; mate, tie and sacrifice rules of 2026-11-10. Older cached reviews are re-run. */
const CACHE_PREFIX = 'oukplay.review.v4.'

/** Grades that change the story of a game, and moves close to the inaccuracy line, are checked again deeper. */
function isCritical(r: MoveReview): boolean {
  if (r.judgement === 'book') return false
  if (['brilliant', 'great', 'miss', 'inaccuracy', 'mistake', 'blunder'].includes(r.judgement)) return true
  return r.loss >= 7
}

function readCache(key: string): GameReview | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key)
    return raw ? (JSON.parse(raw) as GameReview) : null
  } catch {
    return null
  }
}

function writeCache(key: string, review: GameReview) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(review))
  } catch {
    /* quota or private mode: the review still lives in memory */
  }
}

export interface ReviewState {
  review: GameReview | null
  /** Evaluations gathered so far, index = ply. */
  evals: (Evaluation | null)[]
  done: number
  total: number
  /** Moves graded so far while the review runs (index = ply - 1). Equals review.moves once done. */
  graded: MoveReview[]
  /** Scan = first pass over every position; verify = the deeper re-check of critical moves. */
  phase: 'scan' | 'verify'
  /** Verify pass progress. */
  verified: number
  toVerify: number
  status: 'idle' | 'running' | 'done' | 'failed'
  engineName: string
}

/**
 * Runs Stockfish over every position of the game once, in order, then grades
 * the moves. Partial results stream in so the bar and graph fill as it goes.
 */
export function useReview(key: string, fens: string[], moves: PgnMove[]): ReviewState {
  const [state, setState] = useState<ReviewState>(() => {
    const cached = key ? readCache(key) : null
    return cached
      ? { review: cached, evals: cached.evals, graded: cached.moves, phase: 'verify', verified: 0, toVerify: 0, done: fens.length, total: fens.length, status: 'done', engineName: 'stockfish' }
      : { review: null, evals: [], graded: [], phase: 'scan', verified: 0, toVerify: 0, done: 0, total: fens.length, status: 'idle', engineName: 'none' }
  })
  const started = useRef<string | null>(null)

  useEffect(() => {
    if (!key || !fens.length) return
    if (started.current === key) return
    const cached = readCache(key)
    if (cached) {
      setState({ review: cached, evals: cached.evals, graded: cached.moves, phase: 'verify', verified: 0, toVerify: 0, done: fens.length, total: fens.length, status: 'done', engineName: 'stockfish' })
      return
    }
    started.current = key
    const engine = createEngine()
    let cancelled = false
    setState({ review: null, evals: [], graded: [], phase: 'scan', verified: 0, toVerify: 0, done: 0, total: fens.length, status: 'running', engineName: engine.name })
    const bookReady = loadOpeningBook()
    ;(async () => {
      try {
        await engine.init()
      } catch {
        if (!cancelled) setState((s) => ({ ...s, status: 'failed', engineName: 'none' }))
        return
      }
      if (engine.name === 'none') {
        setState((s) => ({ ...s, status: 'failed' }))
        return
      }
      // The book loads alongside the engine; it is small next to the first search.
      const book = bookLine(await bookReady, moves.map((m) => m.fenAfter))
      if (cancelled) return
      const evals: (Evaluation | null)[] = []
      const graded: MoveReview[] = []
      for (let i = 0; i < fens.length; i++) {
        if (cancelled) return
        const ev = await engine.analyse(fens[i], { depth: DEPTH, multiPv: MULTI_PV })
        if (cancelled) return
        evals[i] = ev
        // Grade each move as soon as the positions either side of it are known.
        if (i > 0) {
          const k = i - 1
          graded[k] = gradeMove(moves[k], evals[k] ?? null, ev, { prevMove: moves[k - 1], prevReview: graded[k - 1], opening: book[k] })
        }
        setState((s) => ({ ...s, evals: [...evals], graded: [...graded], done: i + 1 }))
      }
      // Second pass: look again, deeper, at both sides of every critical move, then grade the whole game again
      // (a grade can depend on the move before it).
      const positions = new Set<number>()
      graded.forEach((r, k) => {
        if (isCritical(r)) {
          positions.add(k)
          positions.add(k + 1)
        }
      })
      const queue = [...positions].sort((a, b) => a - b)
      setState((s) => ({ ...s, phase: 'verify', verified: 0, toVerify: queue.length }))
      for (let q = 0; q < queue.length; q++) {
        if (cancelled) return
        const i = queue[q]
        const deep = await engine.analyse(fens[i], { depth: VERIFY_DEPTH, multiPv: MULTI_PV })
        if (cancelled) return
        if (deep) evals[i] = deep
        const regraded = buildReview({ moves, evals, depth: DEPTH, book }).moves
        setState((s) => ({ ...s, evals: [...evals], graded: regraded, verified: q + 1 }))
      }
      const review = buildReview({ moves, evals, depth: queue.length ? VERIFY_DEPTH : DEPTH, book })
      writeCache(key, review)
      setState((s) => ({ ...s, review, evals, graded: review.moves, done: fens.length, total: fens.length, status: 'done', engineName: engine.name }))
    })()
    return () => {
      cancelled = true
      engine.dispose()
      // Let a re-run (StrictMode, or a new key) start again.
      if (started.current === key) started.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}
