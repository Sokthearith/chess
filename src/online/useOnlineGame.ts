import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { START_FEN, legalTargets, needsPromotion, positionFromFen, tryMove } from '../game/rules'
import type { MoveIntent, MoveRecord, Position, Promotion, Square } from '../game/types'
import { onMessage, send, watchGame } from './connection'
import type { ChatLine, GameView, Side } from './protocol'

/** Every move from the start, as the records the board and move list already understand. */
export function replay(moves: string[]): MoveRecord[] {
  const out: MoveRecord[] = []
  let fen = START_FEN
  for (const uci of moves) {
    const res = tryMove(fen, { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] as Promotion | undefined) ?? undefined })
    if (!res) break
    out.push(res.record)
    fen = res.fen
  }
  return out
}

/** Re-render every `ms` while `on`. */
function useTicker(on: boolean, ms = 100) {
  const [, setN] = useState(0)
  useEffect(() => {
    if (!on) return
    const t = window.setInterval(() => setN((n) => n + 1), ms)
    return () => window.clearInterval(t)
  }, [on, ms])
}

/**
 * One online game: subscribes to it on the shared socket, keeps the board
 * state (selection, promotion, history view), shows our move before the
 * server confirms it, and counts the clocks down between server updates.
 */
export function useOnlineGame(id: string) {
  const [view, setView] = useState<GameView | null>(null)
  const [gone, setGone] = useState(false)
  const [chat, setChat] = useState<ChatLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ ply: number; uci: string } | null>(null)
  const [selected, setSelected] = useState<Square | null>(null)
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null)
  const [viewPly, setViewPly] = useState<number | null>(null)
  const [flipped, setFlipped] = useState(false)
  const receivedAt = useRef(0)

  useEffect(() => {
    setView(null)
    setGone(false)
    setChat([])
    setError(null)
    setPending(null)
    setSelected(null)
    setPromo(null)
    setViewPly(null)
    const off = onMessage((m) => {
      if (m.t === 'game' && m.game.id === id) {
        receivedAt.current = performance.now()
        setView(m.game)
        // Our move is settled once the server's move count moves past it (or the game stops);
        // an unrelated update (a draw offer, a spectator) leaves it showing.
        setPending((p) => (p && (m.game.moves.length !== p.ply || m.game.status !== 'live') ? null : p))
      } else if (m.t === 'gone' && m.id === id) setGone(true)
      else if (m.t === 'chat.history' && m.id === id) setChat(m.lines)
      else if (m.t === 'chat' && m.id === id) setChat((c) => [...c.slice(-199), m.line])
      else if (m.t === 'error' && m.id === id) {
        setPending(null)
        setError(m.message)
      }
    })
    const unwatch = watchGame(id)
    return () => {
      off()
      unwatch()
    }
  }, [id])

  useEffect(() => {
    if (!error) return
    const t = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(t)
  }, [error])

  // A move the server never answered (a dropped socket): give the board back after a while.
  useEffect(() => {
    if (!pending) return
    const t = window.setTimeout(() => setPending(null), 6000)
    return () => window.clearTimeout(t)
  }, [pending])

  const serverMoves = view?.moves
  const moves = useMemo(() => {
    const base = serverMoves ?? []
    return pending && pending.ply === base.length ? [...base, pending.uci] : base
  }, [serverMoves, pending])
  const movesKey = moves.join(' ')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const history = useMemo(() => replay(moves), [movesKey])
  const plies = history.length
  const liveFen = plies ? history[plies - 1].fenAfter : START_FEN
  const liveTurn: Side = liveFen.split(' ')[1] === 'b' ? 'b' : 'w'
  const isLive = viewPly === null

  // Stay on the live position when moves arrive, unless the player is looking back.
  useEffect(() => {
    if (viewPly !== null && viewPly >= plies) setViewPly(null)
  }, [plies, viewPly])

  const viewedFen = isLive ? liveFen : viewPly === 0 ? START_FEN : history[viewPly - 1].fenAfter
  const lastIdx = isLive ? plies - 1 : viewPly - 1
  const last = lastIdx >= 0 ? history[lastIdx] : null
  const lastFrom = last?.from
  const lastTo = last?.to
  const position: Position = useMemo(
    () => positionFromFen(viewedFen, lastFrom && lastTo ? { from: lastFrom, to: lastTo } : null),
    [viewedFen, lastFrom, lastTo],
  )

  const you = view?.you ?? null
  const live = view?.status === 'live'
  const canMove = live && !!you && liveTurn === you && !pending && isLive
  const targets = useMemo(() => (selected && canMove ? legalTargets(liveFen, selected) : []), [selected, canMove, liveFen])

  // Clocks: the server's numbers, minus the time since they arrived for the side that is thinking.
  const ticking = live && (view?.running !== null || view?.firstMoveMs !== null || view?.claimInMs !== null)
  useTicker(!!ticking)
  const since = performance.now() - receivedAt.current
  const clocks = { w: view?.clocks.w ?? 0, b: view?.clocks.b ?? 0 }
  if (view?.running && !pending) clocks[view.running] = Math.max(0, clocks[view.running] - since)
  const firstMoveMs = view?.firstMoveMs != null ? Math.max(0, view.firstMoveMs - since) : null
  const claimInMs = view?.claimInMs != null ? Math.max(0, view.claimInMs - since) : null

  const attemptMove = useCallback(
    (intent: MoveIntent): boolean => {
      if (!canMove) return false
      if (!intent.promotion && needsPromotion(liveFen, intent)) {
        setPromo({ from: intent.from, to: intent.to })
        return true
      }
      const res = tryMove(liveFen, intent)
      if (!res) return false
      const uci = `${res.record.from}${res.record.to}${res.record.promotion ?? ''}`
      const ply = view!.moves.length
      send({ t: 'move', id, uci, ply })
      setPending({ ply, uci })
      setSelected(null)
      setPromo(null)
      return true
    },
    [canMove, liveFen, view, id],
  )

  const promote = useCallback((piece: Promotion) => promo && attemptMove({ ...promo, promotion: piece }), [promo, attemptMove])

  return {
    view,
    gone,
    chat,
    error,
    history,
    plies,
    position,
    liveTurn,
    isLive,
    viewPly,
    selected,
    targets,
    canMove,
    pendingPromotion: promo,
    clocks,
    firstMoveMs,
    claimInMs,
    orientation: ((you === 'b') !== flipped ? 'b' : 'w') as Side,
    select: (sq: Square | null) => {
      setSelected(sq)
      setPromo(null)
    },
    attemptMove,
    promote,
    cancelPromotion: () => {
      setPromo(null)
      setSelected(null)
    },
    viewAt: (ply: number | null) => {
      setViewPly(ply)
      setSelected(null)
      setPromo(null)
    },
    flip: () => setFlipped((f) => !f),
    resign: () => send({ t: 'resign', id }),
    abort: () => send({ t: 'abort', id }),
    draw: (accept: boolean) => send({ t: 'draw', id, accept }),
    rematch: (accept: boolean) => send({ t: 'rematch', id, accept }),
    claim: () => send({ t: 'claim', id }),
    say: (text: string) => send({ t: 'chat', id, text }),
    acceptChallenge: () => send({ t: 'challenge.accept', id }),
    cancelChallenge: () => send({ t: 'challenge.cancel', id }),
  }
}

export type OnlineGame = ReturnType<typeof useOnlineGame>
