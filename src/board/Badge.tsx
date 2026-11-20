import type { Judgement } from '../analysis/review'
import { GradeIcon } from './GradeIcon'

export type BadgeKind = Judgement

interface Props {
  kind: BadgeKind
  /** Keeps the badge inside the board on the outer file and rank. */
  edge?: 'right'
  top?: boolean
}

/**
 * The grade pinned to the corner of a square. It pops in; a brilliant or
 * great move throws rays out from the square, a blunder shudders once.
 */
export function Badge({ kind, edge, top }: Props) {
  const cls = ['badge', `badge--${kind}`, edge === 'right' ? 'badge--edge-right' : '', top ? 'badge--edge-top' : ''].filter(Boolean).join(' ')
  return (
    <>
      {kind === 'brilliant' || kind === 'great' ? (
        <span className={`burst burst--${kind}`} aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="burst__ray" style={{ ['--a' as string]: `${i * 45}deg` }} />
          ))}
        </span>
      ) : null}
      <span className={cls} aria-hidden="true">
        <GradeIcon kind={kind} />
      </span>
    </>
  )
}
