import { formatClock } from '../game/useClock'

interface Props {
  ms: number
  active: boolean
  label: string
}

export function Clock({ ms, active, label }: Props) {
  const low = ms < 20_000
  const urgent = ms < 10_000 && ms > 0 && active
  const cls = ['clock', active ? 'clock--active' : '', low ? 'clock--low' : '', urgent ? 'clock--urgent' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <output className={cls} aria-label={`${label} clock`} aria-live={urgent ? 'polite' : 'off'}>
      {formatClock(ms)}
    </output>
  )
}
