import { useEffect, useRef } from 'react'
import { JUDGEMENT_WORD, type MoveReview } from '../analysis/review'
import { GradeIcon } from '../board/GradeIcon'

interface Props {
  sans: string[]
  /** Grades so far (index = ply - 1); may be shorter than `sans` while a review runs. */
  reviews: MoveReview[]
  /** True while the engine is still working, so ungraded moves show as pending. */
  grading: boolean
  /** The ply on the main line being shown, or null while a variation is open. */
  current: number | null
  onSeek: (ply: number) => void
}

export function ReviewMoveList({ sans, reviews, grading, current, onSeek }: Props) {
  const ref = useRef<HTMLOListElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const rows: { n: number; w: number; b?: number }[] = []
  for (let i = 0; i < sans.length; i += 2) rows.push({ n: i / 2 + 1, w: i + 1, b: i + 1 < sans.length ? i + 2 : undefined })

  const ply = (p: number) => {
    const r = reviews[p - 1]
    const cls = ['moves__ply', r ? `moves__ply--${r.judgement}` : grading ? 'moves__ply--pending' : ''].filter(Boolean).join(' ')
    return (
      <button type="button" className={cls} aria-current={current === p ? 'true' : undefined} onClick={() => onSeek(p)} aria-label={`${sans[p - 1]}${r ? `, ${JUDGEMENT_WORD[r.judgement]}` : ''}`}>
        {r ? <GradeIcon kind={r.judgement} /> : null}
        {sans[p - 1]}
      </button>
    )
  }

  return (
    <ol ref={ref} className="moves moves--review" aria-label="Moves">
      {rows.map((r) => (
        <li key={r.n} className="moves__row">
          <span className="moves__num">{r.n}.</span>
          {ply(r.w)}
          {r.b ? ply(r.b) : <span />}
        </li>
      ))}
    </ol>
  )
}
