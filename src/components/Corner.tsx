import { Crosshair } from './Crosshair'

type Pos = 'tl' | 'tr' | 'bl' | 'br'

interface Props {
  pos: Pos
  label: string
  value: string
  cross?: boolean
  mute?: boolean
  live?: boolean
}

/** Corner micro-copy: `LABEL — VALUE`, mono, uppercase, wide. */
export function Corner({ pos, label, value, cross = false, mute = false, live = false }: Props) {
  const text = (
    <span className={`mono mono--sm ${mute ? 'mono--mute' : ''}`} aria-live={live ? 'polite' : undefined}>
      {label} — <b>{value}</b>
    </span>
  )
  const right = pos === 'tr' || pos === 'br'
  return (
    <div className={`corner corner--${pos}`}>
      {cross && !right ? <Crosshair /> : null}
      {text}
      {cross && right ? <Crosshair /> : null}
    </div>
  )
}
