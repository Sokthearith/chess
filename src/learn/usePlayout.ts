import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { staticExchange } from '../analysis/classify'
import type { PgnMove } from '../analysis/pgn'
import { playLan, playMove } from '../analysis/variation'
import { createEngine, type EngineAdapter } from '../engine'
import { legalTargets, needsPromotion, positionFromFen, resultOf } from '../game/rules'
import type { Color, MoveIntent, Promotion, Square } from '../game/types'
import { moveSound, play } from '../sound/sounds'
import type { DrillGoal } from './endgames'

export type PlayoutStatus = 'playing' | 'won' | 'lost'

/**
 * Play a position out against Stockfish at full strength, with a goal:
 * mate, promote safely, or hold the draw for a number of moves.
 */
export function usePlayout({ key, fen: startFen, user, goal }: { key: string; fen: string; user: Color; goal: DrillGoal }) {
  const engine = useRef<EngineAdapter | null>(null)
  const [played, setPlayed] = useState<PgnMove[]>([])
  const [status, setStatus] = useState<PlayoutStatus>('playing')
  const [reason, setReason] = useState('')
  const [thinking, setThinking] = useState(false)
  const [engineName, setEngineName] = useState('stockfish')
  const [selected, setSelected] = useState<Square | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    const e = createEngine()
    engine.current = e
    setEngineName(e.name)
    return () => e.dispose()
  }, [])

  useEffect(() => {
    setPlayed([])
    setStatus('playing')
    setReason('')
    setSelected(null)
    setPendingPromotion(null)
    setHint(null)
  }, [key])

  const fen = played.length ? played[played.length - 1].fenAfter : startFen
  const turn: Color = fen.split(' ')[1] === 'b' ? 'b' : 'w'
  const last = played.length ? played[played.length - 1] : null
  const position = useMemo(() => positionFromFen(fen, last ? { from: last.from, to: last.to } : null), [fen, last])
  const userMoves = played.filter((m) => m.color === user).length

  const finish = useCallback((won: boolean, why: string) => {
    setStatus(won ? 'won' : 'lost')
    setReason(why)
    play(won ? 'brilliant' : 'blunder', 260)
  }, [])

  /** Did this move settle the drill? */
  const judge = useCallback(
    (m: PgnMove, count: number) => {
      const result = resultOf(m.fenAfter)
      const byUser = m.color === user
      if (result) {
        if (result.status === 'checkmate') {
          if (byUser) finish(true, goal.kind === 'mate' ? `Checkmate in ${count} moves.` : 'Checkmate — even better.')
          else finish(false, 'You were checkmated.')
        } else if (goal.kind === 'hold') finish(true, `Draw by ${result.reason}. Held.`)
        else finish(false, `Draw by ${result.reason}. The win slipped away.`)
        return
      }
      if (m.lan.length === 5 && staticExchange(m.fenAfter, m.to) === 0) {
        if (byUser && goal.kind === 'promote') return finish(true, `Promoted safely in ${count} moves.`)
        if (byUser && goal.kind === 'hold') return finish(true, 'You even promoted. Held.')
        if (!byUser) return finish(false, 'The pawn promoted.')
      }
      if (byUser && goal.kind === 'hold' && count >= goal.moves) return finish(true, `Held for ${goal.moves} moves.`)
      if (byUser && goal.kind !== 'hold' && count >= goal.moves) return finish(false, `Out of moves: the goal was ${goal.kind === 'mate' ? 'mate' : 'a safe promotion'} within ${goal.moves}.`)
    },
    [user, goal, finish],
  )

  // Stockfish answers.
  useEffect(() => {
    if (status !== 'playing' || turn === user) return
    const e = engine.current
    if (!e) return
    let cancelled = false
    setThinking(true)
    const started = performance.now()
    e.analyse(fen, { depth: 18 })
      .then((ev) => {
        if (cancelled || !ev?.bestMove || ev.bestMove.length < 4) return
        const wait = Math.max(0, 380 - (performance.now() - started))
        window.setTimeout(() => {
          if (cancelled) return
          const m = playLan(fen, ev.bestMove!, played.length + 1)
          if (!m) return
          play(moveSound(m.san))
          setPlayed((p) => [...p, m])
          setThinking(false)
          judge(m, userMoves)
        }, wait)
      })
      .catch(() => setThinking(false))
    return () => {
      cancelled = true
      setThinking(false)
    }
  }, [fen, turn, user, status]) // eslint-disable-line react-hooks/exhaustive-deps

  const attemptMove = useCallback(
    (intent: MoveIntent): boolean => {
      if (status !== 'playing' || turn !== user) return false
      if (!intent.promotion && needsPromotion(fen, intent)) {
        setPendingPromotion({ from: intent.from, to: intent.to })
        return true
      }
      const m = playMove(fen, intent, played.length + 1)
      if (!m) return false
      play(moveSound(m.san))
      setPlayed((p) => [...p, m])
      setSelected(null)
      setPendingPromotion(null)
      setHint(null)
      judge(m, userMoves + 1)
      return true
    },
    [status, turn, user, fen, played.length, judge, userMoves],
  )

  const askHint = useCallback(async () => {
    const e = engine.current
    if (!e || status !== 'playing' || turn !== user) return
    const ev = await e.analyse(fen, { depth: 16 })
    if (ev?.bestMove && ev.bestMove.length >= 4) setHint(ev.bestMove)
  }, [fen, status, turn, user])

  return {
    fen,
    position,
    played,
    turn,
    status,
    reason,
    thinking,
    engineName,
    userMoves,
    hint,
    selected,
    targets: useMemo(() => (selected && status === 'playing' ? legalTargets(fen, selected) : []), [selected, fen, status]),
    pendingPromotion,
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
    askHint,
    /** Take back your last move and Stockfish's reply. */
    takeBack: () => {
      if (thinking) return
      setPlayed((p) => {
        let n = p.length
        if (n && p[n - 1].color !== user) n--
        if (n && p[n - 1].color === user) n--
        return p.slice(0, n)
      })
      setStatus('playing')
      setReason('')
      setHint(null)
    },
  }
}
