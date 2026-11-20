import type { ReactNode } from 'react'
import type { Judgement } from '../analysis/review'

const stroke = (d: string, w = 2.6) => (
  <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const GLYPH: Record<Judgement, ReactNode> = {
  brilliant: '!!',
  great: '!',
  best: (
    <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
      <path d="M10 2.4 12.2 7.3 17.6 7.8 13.5 11.4 14.7 16.7 10 13.9 5.3 16.7 6.5 11.4 2.4 7.8 7.8 7.3Z" fill="currentColor" stroke="currentColor" strokeWidth={0.8} strokeLinejoin="round" />
    </svg>
  ),
  excellent: (
    <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
      <path d="M3.2 9h2.9v7.6H3.2zM7.4 16.6h6.4c.8 0 1.4-.5 1.6-1.2l1.3-4.8c.3-1-.5-2-1.5-2h-3.4l.5-2.9c.1-.7-.2-1.4-.8-1.7l-.7-.4L7.4 8.5z" fill="currentColor" />
    </svg>
  ),
  good: stroke('M4.5 10.4 8.3 14 15.5 6.2', 2.8),
  book: (
    <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
      <path d="M10 5.4C8.3 4.2 5.8 3.8 3.2 4.2v11.2c2.6-.4 5.1 0 6.8 1.2 1.7-1.2 4.2-1.6 6.8-1.2V4.2c-2.6-.4-5.1 0-6.8 1.2Z" fill="currentColor" />
      <path d="M10 5.6v10.8" stroke="var(--grade-bg, #000)" strokeWidth={1.2} />
    </svg>
  ),
  inaccuracy: '?!',
  mistake: '?',
  miss: stroke('M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5', 2.8),
  blunder: '??',
}

interface Props {
  kind: Judgement
  className?: string
  /** Accessible name; without it the icon is decorative. */
  label?: string
}

/**
 * The grade as a coloured disc with a white mark, the convention players know
 * from Chess.com. Size it with `--g` (any length); everything scales from it.
 */
export function GradeIcon({ kind, className = '', label }: Props) {
  return (
    <span className={`grade grade--${kind} ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <span className="grade__glyph">{GLYPH[kind]}</span>
    </span>
  )
}
