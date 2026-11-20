import { useCallback, useMemo, useReducer } from 'react'
import { START_FEN, legalTargets, needsPromotion, positionFromFen, resultOf, tryMove } from './rules'
import type { Color, GameResult, MoveIntent, MoveRecord, Position, Promotion, Square } from './types'

export interface GameState {
  startFen: string
  fen: string
  history: MoveRecord[]
  /** null = live position; otherwise the ply index being viewed (0 = start). */
  viewPly: number | null
  selected: Square | null
  pendingPromotion: { from: Square; to: Square } | null
  result: GameResult | null
  orientation: Color
}

type Action =
  | { type: 'select'; square: Square | null }
  | { type: 'move'; record: MoveRecord }
  | { type: 'await-promotion'; from: Square; to: Square }
  | { type: 'cancel-promotion' }
  | { type: 'undo' }
  | { type: 'reset' }
  | { type: 'view'; ply: number | null }
  | { type: 'flip' }
  | { type: 'end'; result: GameResult }

const initial: GameState = {
  startFen: START_FEN,
  fen: START_FEN,
  history: [],
  viewPly: null,
  selected: null,
  pendingPromotion: null,
  result: null,
  orientation: 'w',
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'select':
      return { ...state, selected: action.square, pendingPromotion: null }
    case 'move': {
      const history = [...state.history, action.record]
      return {
        ...state,
        fen: action.record.fenAfter,
        history,
        selected: null,
        pendingPromotion: null,
        viewPly: null,
        result: resultOf(action.record.fenAfter),
      }
    }
    case 'await-promotion':
      return { ...state, pendingPromotion: { from: action.from, to: action.to } }
    case 'cancel-promotion':
      return { ...state, pendingPromotion: null, selected: null }
    case 'undo': {
      if (!state.history.length) return state
      const history = state.history.slice(0, -1)
      const fen = history.length ? history[history.length - 1].fenAfter : state.startFen
      return { ...state, fen, history, selected: null, pendingPromotion: null, viewPly: null, result: null }
    }
    case 'reset':
      return { ...initial, orientation: state.orientation }
    case 'view':
      return { ...state, viewPly: action.ply, selected: null, pendingPromotion: null }
    case 'flip':
      return { ...state, orientation: state.orientation === 'w' ? 'b' : 'w' }
    case 'end':
      return state.result ? state : { ...state, result: action.result, selected: null, pendingPromotion: null }
  }
}

export function useGame(startFen: string = START_FEN, orientation: Color = 'w') {
  const [state, dispatch] = useReducer(reducer, { ...initial, startFen, fen: startFen, orientation })

  const isLive = state.viewPly === null
  const viewedFen = isLive
    ? state.fen
    : state.viewPly === 0
      ? state.startFen
      : state.history[state.viewPly! - 1].fenAfter
  const viewedLast = isLive
    ? state.history.length
      ? { from: state.history[state.history.length - 1].from, to: state.history[state.history.length - 1].to }
      : null
    : state.viewPly! > 0
      ? { from: state.history[state.viewPly! - 1].from, to: state.history[state.viewPly! - 1].to }
      : null

  const position: Position = useMemo(() => positionFromFen(viewedFen, viewedLast), [viewedFen, viewedLast])

  const targets = useMemo(
    () => (state.selected && isLive && !state.result ? legalTargets(state.fen, state.selected) : []),
    [state.selected, state.fen, isLive, state.result],
  )

  const canPlay = isLive && !state.result

  const attemptMove = useCallback(
    (intent: MoveIntent): boolean => {
      if (!canPlay) return false
      if (!intent.promotion && needsPromotion(state.fen, intent)) {
        dispatch({ type: 'await-promotion', from: intent.from, to: intent.to })
        return true
      }
      const res = tryMove(state.fen, intent)
      if (!res) return false
      dispatch({ type: 'move', record: res.record })
      return true
    },
    [canPlay, state.fen],
  )

  const select = useCallback((square: Square | null) => dispatch({ type: 'select', square }), [])
  const promote = useCallback(
    (piece: Promotion) => {
      if (!state.pendingPromotion) return
      attemptMove({ ...state.pendingPromotion, promotion: piece })
    },
    [attemptMove, state.pendingPromotion],
  )
  const cancelPromotion = useCallback(() => dispatch({ type: 'cancel-promotion' }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])
  const view = useCallback((ply: number | null) => dispatch({ type: 'view', ply }), [])
  const flip = useCallback(() => dispatch({ type: 'flip' }), [])
  const end = useCallback((result: GameResult) => dispatch({ type: 'end', result }), [])

  return {
    state,
    position,
    targets,
    canPlay,
    isLive,
    attemptMove,
    select,
    promote,
    cancelPromotion,
    undo,
    reset,
    view,
    flip,
    end,
  }
}
