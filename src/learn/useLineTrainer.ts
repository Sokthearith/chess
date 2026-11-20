import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playLan, playMove } from '../analysis/variation'
import type { PgnMove } from '../analysis/pgn'
import { legalTargets, needsPromotion, positionFromFen, resultOf } from '../game/rules'
import type { Color, MoveIntent, Promotion, Square } from '../game/types'
import { moveSound, play } from '../sound/sounds'

export type TrainerStatus = 'playing' | 'solved' | 'revealed'

export interface LineTrainerOptions {
  /** Changing the key restarts the trainer. */
  key: string
  startFen: string
  /** The whole line in long algebraic, both sides. */
  moves: string[]
  /** The side the student plays. */
  user: Color
  /** On the last move, accept any move that mates (puzzles can have several). */
  acceptAnyMate?: boolean
  /** On the last move, also accept these moves (long algebraic). */
  acceptLast?: string[]
  /** Pause before the other side's reply. */
  replyDelay?: number
}

/**
 * Walk a fixed line: the student must find each of their moves; the other
 * side's moves are played for them. A wrong move is refused (the piece goes
 * back) and counted.
 */
export function useLineTrainer({ key, startFen, moves, user, acceptAnyMate = false, acceptLast, replyDelay = 520 }: LineTrainerOptions) {
  const [played, setPlayed] = useState<PgnMove[]>([])
  const [status, setStatus] = useState<TrainerStatus>('playing')
  const [mistakes, setMistakes] = useState(0)
  const [wrong, setWrong] = useState<{ square: Square; n: number; fenAfter: string } | null>(null)
  const [selected, setSelected] = useState<Square | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [hinted, setHinted] = useState(false)
  const revealing = useRef(false)

  // Restart on a new line.
  useEffect(() => {
    setPlayed([])
    setStatus('playing')
    setMistakes(0)
    setWrong(null)
    setSelected(null)
    setPendingPromotion(null)
    setHinted(false)
    revealing.current = false
  }, [key])

  const index = played.length
  const fen = index ? played[index - 1].fenAfter : startFen
  const turn: Color = fen.split(' ')[1] === 'b' ? 'b' : 'w'
  const last = index ? played[index - 1] : null
  const position = useMemo(() => positionFromFen(fen, last ? { from: last.from, to: last.to } : null), [fen, last])
  const finished = index >= moves.length

  const push = useCallback((m: PgnMove) => {
    setPlayed((p) => [...p, m])
    setSelected(null)
    setPendingPromotion(null)
    setHinted(false)
  }, [])

  // The other side replies by itself.
  useEffect(() => {
    if (status === 'solved' || finished || turn === user) return
    const lan = moves[index]
    const t = window.setTimeout(() => {
      const m = playLan(fen, lan, index + 1)
      if (!m) return
      play(moveSound(m.san))
      push(m)
    }, index === 0 ? 650 : replyDelay)
    return () => window.clearTimeout(t)
  }, [fen, turn, user, index, finished, moves, status, push, replyDelay])

  // Solved once the line runs out on the student's move.
  useEffect(() => {
    if (status !== 'playing' || !finished || !played.length) return
    setStatus('solved')
  }, [finished, status, played.length])

  // Reveal: play the rest of the line, both sides, one move at a time.
  useEffect(() => {
    if (status !== 'revealed' || finished) return
    const t = window.setTimeout(() => {
      const m = playLan(fen, moves[index], index + 1)
      if (!m) return
      play(moveSound(m.san))
      push(m)
    }, 650)
    return () => window.clearTimeout(t)
  }, [status, fen, index, finished, moves, push])

  const attemptMove = useCallback(
    (intent: MoveIntent): boolean => {
      if (status !== 'playing' || finished || turn !== user) return false
      if (!intent.promotion && needsPromotion(fen, intent)) {
        setPendingPromotion({ from: intent.from, to: intent.to })
        return true
      }
      const expected = moves[index]
      const m = playMove(fen, intent, index + 1)
      if (!m) return false
      const isLast = index === moves.length - 1
      const ok = m.lan === expected || (isLast && !!acceptLast?.includes(m.lan)) || (acceptAnyMate && isLast && resultOf(m.fenAfter)?.status === 'checkmate')
      if (!ok) {
        setMistakes((n) => n + 1)
        setWrong({ square: intent.to, n: Date.now(), fenAfter: m.fenAfter })
        setSelected(null)
        setPendingPromotion(null)
        play('mistake')
        return false
      }
      play(moveSound(m.san))
      setWrong(null)
      push(m)
      return true
    },
    [status, finished, turn, user, fen, moves, index, acceptAnyMate, acceptLast, push],
  )

  const targets = useMemo(() => (selected && status === 'playing' ? legalTargets(fen, selected) : []), [selected, fen, status])

  return {
    fen,
    position,
    played,
    index,
    turn,
    status,
    mistakes,
    /** The square of the last refused move, for a moment of red. */
    wrong,
    selected,
    targets,
    pendingPromotion,
    /** The move the student should play now, or null when it is not their turn. */
    expected: status === 'playing' && !finished && turn === user ? moves[index] : null,
    hinted,
    select: (sq: Square | null) => {
      setSelected(sq)
      setPendingPromotion(null)
    },
    attemptMove,
    promote: (piece: Promotion) => pendingPromotion && attemptMove({ ...pendingPromotion, promotion: piece }),
    cancelPromotion: () => {
      setPendingPromotion(null)
      setSelected(null)
    },
    hint: () => {
      setHinted(true)
      const e = status === 'playing' && !finished && turn === user ? moves[index] : null
      if (e) setSelected(e.slice(0, 2))
    },
    reveal: () => {
      if (status === 'playing') setStatus('revealed')
    },
    /** Take the line back to its start (keeps the mistake count at zero for a clean retry). */
    restart: () => {
      setPlayed([])
      setStatus('playing')
      setMistakes(0)
      setWrong(null)
      setSelected(null)
      setHinted(false)
    },
  }
}
