import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { formatEvaluation, type Evaluation } from '../engine'
import { winPercent, type MoveReview } from '../analysis/review'

interface Props {
  evals: (Evaluation | null)[]
  moves: MoveReview[] | null
  total: number
  /** Ply on the main line; null while exploring a variation (the cursor stays at the branch point). */
  current: number
  sans: string[]
  onSeek: (ply: number) => void
}

const H = 120

/**
 * White's winning chances over the game: paper from the floor up to the line,
 * ink above it, the same reading as the eval bar laid on its side. Red marks
 * the even line and the blunders. Hover reads a move; click seeks to it.
 */
export function EvalGraph({ evals, moves, total, current, sans, onSeek }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = Math.max(1, total - 1)
  const x = (ply: number) => (ply / n) * width
  const y = (wp: number) => H - (wp / 100) * H
  const known = evals.length

  let area = ''
  if (width && known > 0) {
    const pts: string[] = []
    for (let i = 0; i < known; i++) pts.push(`${x(i).toFixed(1)},${y(winPercent(evals[i] ?? null)).toFixed(1)}`)
    area = `M0,${H} L${pts.join(' L')} L${x(known - 1).toFixed(1)},${H} Z`
  }

  const plyAt = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || !rect.width) return 0
    return Math.round(((clientX - rect.left) / rect.width) * n)
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => setHover(Math.min(known - 1, Math.max(0, plyAt(e.clientX))))
  const onClick = (e: PointerEvent<HTMLDivElement>) => onSeek(Math.min(known - 1, Math.max(0, plyAt(e.clientX))))

  const MARKED = ['brilliant', 'great', 'mistake', 'miss', 'blunder']
  const marked = (moves ?? []).filter((m) => m && MARKED.includes(m.judgement))
  const blunders = marked.filter((m) => m.judgement === 'blunder')
  const brilliants = marked.filter((m) => m.judgement === 'brilliant' || m.judgement === 'great')
  const label = (ply: number) => {
    if (ply === 0) return `Start, ${formatEvaluation(evals[0] ?? null)}`
    const moveNo = Math.ceil(ply / 2)
    const dots = ply % 2 ? '.' : '…'
    return `${moveNo}${dots} ${sans[ply - 1] ?? ''}, ${formatEvaluation(evals[ply] ?? null)}`
  }

  const tip = hover ?? current
  const tipX = x(tip)
  const tipLeft = width ? Math.min(Math.max(0, tipX - 60), Math.max(0, width - 120)) : 0

  return (
    <div className="graph">
      <div
        ref={ref}
        className="graph__plot"
        role="img"
        aria-label={`White's winning chances over ${total - 1} plies; ${blunders.length} blunder${blunders.length === 1 ? '' : 's'}, ${brilliants.length} brilliant or great move${brilliants.length === 1 ? '' : 's'}.`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onPointerDown={onClick}
      >
        {width ? (
          <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} aria-hidden="true" focusable="false">
            <path className="graph__area" d={area} />
            <line className="graph__even" x1={0} x2={width} y1={H / 2} y2={H / 2} />
            {marked.map((m) => (
              <circle key={m.ply} className={`graph__mark graph__mark--${m.judgement}`} cx={x(m.ply)} cy={y(winPercent(evals[m.ply] ?? null))} r={m.judgement === 'brilliant' || m.judgement === 'blunder' ? 4.5 : 3.5} />
            ))}
            {hover !== null ? <line className="graph__hover" x1={x(hover)} x2={x(hover)} y1={0} y2={H} /> : null}
            <line className="graph__cursor-halo" x1={x(current)} x2={x(current)} y1={0} y2={H} />
            <line className="graph__cursor" x1={x(current)} x2={x(current)} y1={0} y2={H} />
          </svg>
        ) : null}
        {width && known > 0 ? (
          <div className="graph__tip mono mono--sm" style={{ left: tipLeft }} aria-hidden="true">
            {label(tip)}
          </div>
        ) : null}
      </div>
    </div>
  )
}
