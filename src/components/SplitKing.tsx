import { useId } from 'react'
import { DRAWING, GEOMETRIC, GLYPHS, PIXEL } from '../board/pieceSets'
import { PIECES } from '../board/pieces'
import { useTheme } from '../theme/useTheme'

/**
 * The poster's motif: one king, cut down the middle, light on the left,
 * dark on the right. It is drawn in the active theme's piece set.
 */
export function SplitKing({ className = '' }: { className?: string }) {
  const theme = useTheme()
  const id = useId().replace(/:/g, '')
  const drawing = DRAWING[theme.pieces]
  const pixel = drawing === 'pixel'
  const w = pixel ? 16 : 45
  const half = w / 2
  const viewBox = pixel ? '0 0 16 16' : drawing === 'letter' || drawing === 'glyph' ? '0 0 45 45' : '2 0 41 42'

  let light: React.ReactNode
  let dark: React.ReactNode
  if (drawing === 'glyph') {
    light = (
      <text className="king-split__light king-split__staunton" x="22.5" y="40" textAnchor="middle">
        {GLYPHS.k}
      </text>
    )
    dark = (
      <text className="king-split__dark king-split__staunton" x="22.5" y="40" textAnchor="middle">
        {GLYPHS.k}
      </text>
    )
  } else if (drawing === 'letter') {
    light = (
      <text className="king-split__light king-split__glyph" x="22.5" y="38" textAnchor="middle">
        K
      </text>
    )
    dark = (
      <text className="king-split__dark king-split__glyph" x="22.5" y="38" textAnchor="middle">
        K
      </text>
    )
  } else if (pixel) {
    const art = PIXEL.k
    const d = art.body + art.detail
    light = (
      <g shapeRendering="crispEdges">
        <path className="king-split__ring" d={art.ring} />
        <path className="king-split__light king-split__px" d={d} />
      </g>
    )
    dark = (
      <g shapeRendering="crispEdges">
        <path className="king-split__ring" d={art.ring} />
        <path className="king-split__dark" d={d} />
      </g>
    )
  } else {
    const d = (drawing === 'geometric' ? GEOMETRIC : PIECES).k.body
    light = <path className="king-split__light" d={d} strokeLinejoin="round" />
    dark = <path className="king-split__dark" d={d} />
  }

  return (
    <svg className={`king-split king-split--${drawing} ${className}`} viewBox={viewBox} role="img" aria-label="A chess king, half light and half dark">
      <defs>
        <clipPath id={`${id}l`}>
          <rect x="-5" y="-5" width={half + 5} height={w + 10} />
        </clipPath>
        <clipPath id={`${id}r`}>
          <rect x={half} y="-5" width={half + 5} height={w + 10} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}l)`}>{light}</g>
      <g clipPath={`url(#${id}r)`}>{dark}</g>
    </svg>
  )
}
