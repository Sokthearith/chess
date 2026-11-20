import type { CSSProperties } from 'react'
import type { Color, PieceType } from '../game/types'
import { useTheme } from '../theme/useTheme'
import { DRAWING, PieceArt, viewBoxOf, type PieceSetId } from './pieceSets'

interface Props {
  type: PieceType
  color: Color
  className?: string
  style?: CSSProperties
  /** Draw in this set instead of the active theme's (the theme picker's previews). */
  set?: PieceSetId
}

/**
 * One piece, drawn in the active theme's set. Silhouette and geometric pieces
 * are drawn twice: a fat stroke in the contrasting colour (the halo), then a
 * flat fill on top that covers the seams between subpaths. Pixel pieces get a
 * computed one-pixel ring instead; letter pieces a stroked glyph.
 */
export function Piece({ type, color, className = '', style, set }: Props) {
  const theme = useTheme()
  const s = set ?? theme.pieces
  return (
    <span className={`piece piece--${color} piece--${DRAWING[s]} ${className}`} style={style} aria-hidden="true">
      <svg viewBox={viewBoxOf(s)} focusable="false">
        <PieceArt set={s} type={type} color={color} />
      </svg>
    </span>
  )
}
