import { useEffect, useRef } from 'react'
import type { MoveRecord } from '../game/types'

interface Props {
  history: MoveRecord[]
  /** null = live; else the ply index being viewed. */
  viewPly: number | null
  onView: (ply: number | null) => void
}

export function MoveList({ history, viewPly, onView }: Props) {
  const ref = useRef<HTMLOListElement>(null)
  const currentPly = viewPly ?? history.length

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [currentPly, history.length])

  const rows: { n: number; w?: MoveRecord; b?: MoveRecord; wPly: number }[] = []
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ n: i / 2 + 1, w: history[i], b: history[i + 1], wPly: i + 1 })
  }

  if (!rows.length) {
    return (
      <div className="moves" aria-label="Moves">
        <p className="moves__empty mono mono--mute">Moves — none yet</p>
      </div>
    )
  }

  return (
    <ol ref={ref} className="moves" aria-label="Moves">
      {rows.map((r) => (
        <li key={r.n} className="moves__row">
          <span className="moves__num">{r.n}.</span>
          {r.w ? (
            <button
              type="button"
              className="moves__ply"
              aria-current={currentPly === r.wPly ? 'true' : undefined}
              onClick={() => onView(r.wPly === history.length ? null : r.wPly)}
            >
              {r.w.san}
            </button>
          ) : (
            <span />
          )}
          {r.b ? (
            <button
              type="button"
              className="moves__ply"
              aria-current={currentPly === r.wPly + 1 ? 'true' : undefined}
              onClick={() => onView(r.wPly + 1 === history.length ? null : r.wPly + 1)}
            >
              {r.b.san}
            </button>
          ) : (
            <span />
          )}
        </li>
      ))}
    </ol>
  )
}
