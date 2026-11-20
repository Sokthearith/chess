import type { ReactNode } from 'react'
import { Board, type BoardArrow, type BoardProps } from '../../board/Board'
import type { BadgeKind } from '../../board/Badge'
import { Corner } from '../../components/Corner'
import { DrawHint } from '../../components/DrawHint'
import { Footer } from '../../components/Footer'
import { Nav } from '../../components/Nav'
import { LearnTabs } from './LearnTabs'
import type { Color, MoveIntent, Position, Promotion, Square } from '../../game/types'

interface Props {
  title: string
  corners: { tl: [string, string]; tr: [string, string]; bl: [string, string]; br: [string, string] }
  position: Position
  orientation: Color
  selected: Square | null
  targets: BoardProps['targets']
  interactive: boolean
  pendingPromotion: { from: Square; to: Square } | null
  onSelect: (sq: Square | null) => void
  onMove: (intent: MoveIntent) => boolean
  onPromote: (piece: Promotion) => void
  onCancelPromotion: () => void
  annotation?: { square: Square; kind: BadgeKind; key: string | number } | null
  arrows?: BoardArrow[]
  mated?: Square | null
  boardLabel: string
  side: ReactNode
  below?: ReactNode
}

/** The play frame, shared by every trainer: board left, a column of instructions and controls right. */
export function TrainerShell(p: Props) {
  return (
    <>
      <Nav />
      <LearnTabs />
      <main id="main" className="container play play--learn">
        <h1 className="visually-hidden">{p.title}</h1>
        <div className="play__frame">
          <Corner pos="tl" label={p.corners.tl[0]} value={p.corners.tl[1]} cross />
          <Corner pos="tr" label={p.corners.tr[0]} value={p.corners.tr[1]} cross />
          <Corner pos="bl" label={p.corners.bl[0]} value={p.corners.bl[1]} />
          <Corner pos="br" label={p.corners.br[0]} value={p.corners.br[1]} mute />
          <div className="play__main play__main--solo">
            <div className="board-stage">
              <Board
                position={p.position}
                orientation={p.orientation}
                selected={p.selected}
                targets={p.targets}
                interactive={p.interactive}
                pendingPromotion={p.pendingPromotion}
                onSelect={p.onSelect}
                onMove={p.onMove}
                onPromote={p.onPromote}
                onCancelPromotion={p.onCancelPromotion}
                annotation={p.annotation}
                arrows={p.arrows}
                mated={p.mated}
                label={p.boardLabel}
              />
            </div>
          </div>
          <aside className="play__side trainer" aria-label="Lesson">
            {p.side}
            <DrawHint />
          </aside>
        </div>
        {p.below}
      </main>
      <Footer />
    </>
  )
}

/** A big, plain instruction line with an optional coloured grade disc. */
export function Prompt({ head, sub, tone }: { head: string; sub?: string; tone?: 'good' | 'bad' | 'done' | null }) {
  return (
    <div className={`prompt${tone ? ` prompt--${tone}` : ''}`} role="status" aria-live="polite">
      <p className="prompt__head">{head}</p>
      {sub ? <p className="prompt__sub">{sub}</p> : null}
    </div>
  )
}
