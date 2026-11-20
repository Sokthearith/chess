import { useEffect, useRef } from 'react'
import { Piece } from '../board/Piece'
import { getGame, levelOf } from '../learn/game'
import { dismiss, useToasts, type Toast } from '../learn/toasts'
import { play } from '../sound/sounds'

const SOUND: Partial<Record<Toast['kind'], Parameters<typeof play>[0]>> = { level: 'brilliant', badge: 'great', goal: 'great', quest: 'great' }

/** The pop-up stack, bottom right on wide screens and bottom centre on phones. */
export function Toasts() {
  const toasts = useToasts()
  const heard = useRef(new Set<number>())
  useEffect(() => {
    for (const t of toasts) {
      if (heard.current.has(t.id)) continue
      heard.current.add(t.id)
      const s = SOUND[t.kind]
      if (s) play(s, 80)
    }
  }, [toasts])
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          {t.kind === 'level' ? (
            <span className="toast__icon" aria-hidden="true">
              <Piece type={levelOf(getGame().xp).rank.piece} color="w" />
            </span>
          ) : t.kind === 'xp' ? (
            <span className="toast__xp" aria-hidden="true">
              XP
            </span>
          ) : (
            <span className="toast__mark" aria-hidden="true">
              {t.kind === 'badge' ? '★' : t.kind === 'goal' ? '✓' : t.kind === 'streak' ? '❄' : '!'}
            </span>
          )}
          <span className="toast__text">
            <span className="toast__title">{t.title}</span>
            {t.sub ? <span className="toast__sub">{t.sub}</span> : null}
          </span>
          <button type="button" className="toast__x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
