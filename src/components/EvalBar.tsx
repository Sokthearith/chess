import type { CSSProperties } from 'react'
import { evaluationToShare, formatEvaluation, type Evaluation } from '../engine'
import type { Color } from '../game/types'

interface Props {
  evaluation: Evaluation | null
  orientation: Color
}

/**
 * Tall ink/paper bar with a red mark at even. Ink is Black's share and sits
 * at the top when White is at the bottom of the board.
 */
export function EvalBar({ evaluation, orientation }: Props) {
  const white = evaluationToShare(evaluation)
  const black = 1 - white
  const flipped = orientation === 'b'
  return (
    <div
      className={`eval${flipped ? ' eval--flipped' : ''}`}
      role="meter"
      aria-label="Evaluation"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(white * 100)}
      aria-valuetext={evaluation ? formatEvaluation(evaluation) : 'even, no engine running'}
    >
      <div className="eval__ink" style={{ '--share': black.toFixed(3) } as CSSProperties} />
      <div className="eval__mark" />
    </div>
  )
}
