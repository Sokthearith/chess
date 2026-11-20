import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { Color, Promotion } from '../game/types'
import { Piece } from './Piece'
import { PIECE_NAMES } from './pieces'

interface Props {
  color: Color
  /** 0..7 column of the destination file in display order. */
  fileIndex: number
  /** Whether the chooser hangs from the top edge (promotion rank is at the top of the board). */
  fromTop: boolean
  onChoose: (piece: Promotion) => void
  onCancel: () => void
}

const CHOICES: Promotion[] = ['q', 'r', 'b', 'n']

/**
 * Four pieces stacked over the destination file, the way a printed diagram
 * would annotate it. Focus is trapped inside until a choice or Escape.
 */
export function PromotionChooser({ color, fileIndex, fromTop, onChoose, onCancel }: Props) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // After a mouse-triggered move the browser's mousedown focus lands last; wait a frame.
    const id = requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('button')?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
      return
    }
    if (e.key === 'Tab') {
      const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      if (!buttons.length) return
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const next = e.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : i >= buttons.length - 1 ? 0 : i + 1
      e.preventDefault()
      buttons[next].focus()
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const next = e.key === 'ArrowDown' ? Math.min(buttons.length - 1, i + 1) : Math.max(0, i - 1)
      e.preventDefault()
      buttons[next]?.focus()
    }
  }

  const order = fromTop ? CHOICES : [...CHOICES].reverse()

  return (
    <div
      ref={root}
      className={`promo${fromTop ? ' promo--top' : ' promo--bottom'}`}
      style={{ left: `${fileIndex * 12.5}%` }}
      role="dialog"
      aria-modal="true"
      aria-label="Promote the pawn: choose a piece"
      onKeyDown={onKeyDown}
    >
      {order.map((p) => (
        <button key={p} type="button" className="promo__btn" aria-label={PIECE_NAMES[p]} onClick={() => onChoose(p)}>
          <Piece type={p} color={color} />
        </button>
      ))}
    </div>
  )
}
