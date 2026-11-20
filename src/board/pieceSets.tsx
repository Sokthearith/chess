import type { Color, PieceType } from '../game/types'
import { PIECES } from './pieces'

/**
 * Piece sets, one per theme. Four share the silhouette drawing and differ only
 * in paint (src/styles/themes.css sets fill, line, glow per theme); three are
 * drawn differently: geometric primitives, pixel bitmaps, and FEN letters.
 */
export type PieceSetId = 'silhouette' | 'carved' | 'neon' | 'outline' | 'geometric' | 'pixel' | 'letter' | 'glyph' | 'pop'

type Drawing = 'silhouette' | 'geometric' | 'pixel' | 'letter' | 'glyph'

export const DRAWING: Record<PieceSetId, Drawing> = {
  silhouette: 'silhouette',
  carved: 'silhouette',
  neon: 'silhouette',
  outline: 'silhouette',
  geometric: 'geometric',
  pixel: 'pixel',
  letter: 'letter',
  glyph: 'glyph',
  pop: 'silhouette',
}

/* ------------------------------------------------------------ geometric */

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`
const G_BASE = 'M10 35h25v5h-25z'

/** Bauhaus primitives on the same 45 x 45 grid: one shape per piece. */
export const GEOMETRIC: Record<PieceType, { body: string; detail?: string }> = {
  p: { body: [G_BASE, 'M20 30h5v5h-5z', circle(22.5, 24.5, 7.5)].join('') },
  r: { body: [G_BASE, 'M15 31h15v4h-15z', 'M12.5 12h20v20h-20z'].join(''), detail: circle(22.5, 22, 3.6) },
  b: { body: [G_BASE, 'M22.5 6L34.5 35H10.5z'].join(''), detail: circle(22.5, 26, 3.2) },
  n: { body: [G_BASE, 'M11.5 35V8h10v17h12.5v10z'].join(''), detail: circle(16.5, 13.5, 2.3) },
  q: {
    body: [G_BASE, 'M10.5 33a12 12 0 0 1 24 0v2h-24z', circle(12, 15, 3.4), circle(22.5, 10, 3.4), circle(33, 15, 3.4), 'M14 22l-2-7h3l7.5-5 7.5 5h3l-2 7z'].join(''),
    detail: circle(22.5, 28.5, 2.6),
  },
  k: { body: [G_BASE, 'M19 4h7v8h9v7.5h-9V35h-7V19.5h-9V12h9z'].join(''), detail: 'M20.5 13.5h4v4.5h-4z' },
}

/* ---------------------------------------------------------------- pixel */

/**
 * 12 x 14 bitmaps: # body, o detail (painted in the line colour). The outline
 * ring is computed, so every piece gets a one-pixel border, holes included.
 */
const BITMAPS: Record<PieceType, string[]> = {
  p: [
    '............',
    '............',
    '............',
    '............',
    '.....##.....',
    '....####....',
    '....####....',
    '.....##.....',
    '....####....',
    '.....##.....',
    '....####....',
    '...######...',
    '..########..',
    '..########..',
  ],
  r: [
    '............',
    '..##.##.##..',
    '..##.##.##..',
    '..########..',
    '...######...',
    '...##oo##...',
    '...######...',
    '...######...',
    '...######...',
    '...######...',
    '..########..',
    '..oooooooo..',
    '.##########.',
    '.##########.',
  ],
  n: [
    '............',
    '.....#.#....',
    '....######..',
    '...########.',
    '..##o######.',
    '.##########.',
    '.####.#####.',
    '..##..#####.',
    '.....#####..',
    '....######..',
    '...#######..',
    '..oooooooo..',
    '.##########.',
    '.##########.',
  ],
  b: [
    '.....##.....',
    '....####....',
    '...###.##...',
    '...##.###...',
    '...######...',
    '....####....',
    '.....##.....',
    '...######...',
    '....####....',
    '....####....',
    '...######...',
    '..oooooooo..',
    '.##########.',
    '.##########.',
  ],
  q: [
    '#....##....#',
    '##..####..##',
    '.##.####.##.',
    '.##########.',
    '..########..',
    '..##oooo##..',
    '...######...',
    '....####....',
    '...######...',
    '....####....',
    '...######...',
    '..oooooooo..',
    '.##########.',
    '.##########.',
  ],
  k: [
    '.....##.....',
    '....####....',
    '.....##.....',
    '..##.##.##..',
    '.##########.',
    '.####oo####.',
    '..########..',
    '...######...',
    '....####....',
    '...######...',
    '...######...',
    '..oooooooo..',
    '.##########.',
    '.##########.',
  ],
}

/** Pixel art on a 16 x 16 grid: the 12 x 14 bitmap sits at (2, 1). */
export interface PixelArt {
  ring: string
  body: string
  detail: string
}

function rects(cells: [number, number][]): string {
  return cells.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join('')
}

function pixelArt(rows: string[]): PixelArt {
  const filled = new Set<string>()
  const body: [number, number][] = []
  const detail: [number, number][] = []
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return
      const cell: [number, number] = [x + 2, y + 1]
      filled.add(`${cell[0]},${cell[1]}`)
      ;(ch === 'o' ? detail : body).push(cell)
    }),
  )
  const ring: [number, number][] = []
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (filled.has(`${x},${y}`)) continue
      let near = false
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = filled.has(`${x + dx},${y + dy}`)
      if (near) ring.push([x, y])
    }
  return { ring: rects(ring), body: rects(body), detail: rects(detail) }
}

export const PIXEL: Record<PieceType, PixelArt> = Object.fromEntries(
  (Object.keys(BITMAPS) as PieceType[]).map((t) => [t, pixelArt(BITMAPS[t])]),
) as Record<PieceType, PixelArt>

/* ---------------------------------------------------------------- glyph */

/** Classic Staunton shapes from the Unicode chess block, set in Noto Sans Symbols 2. */
export const GLYPHS: Record<PieceType, string> = { k: '\u265A\uFE0E', q: '\u265B\uFE0E', r: '\u265C\uFE0E', b: '\u265D\uFE0E', n: '\u265E\uFE0E', p: '\u265F\uFE0E' }
export const GLYPH_FONT = 'family=Noto+Sans+Symbols+2&text=%E2%99%9A%E2%99%9B%E2%99%9C%E2%99%9D%E2%99%9E%E2%99%9F'

/* --------------------------------------------------------------- render */

/** The inside of one piece's <svg>. The viewBox comes from `viewBoxOf`. */
export function PieceArt({ set, type, color }: { set: PieceSetId; type: PieceType; color: Color }) {
  const drawing = DRAWING[set]
  if (drawing === 'pixel') {
    const art = PIXEL[type]
    return (
      <g shapeRendering="crispEdges">
        <path className="piece__ring" d={art.ring} />
        <path className="piece__fill" d={art.body} />
        <path className="piece__px" d={art.detail} />
      </g>
    )
  }
  if (drawing === 'glyph') {
    // The solid (black) chess glyphs for both sides, painted per colour; U+FE0E keeps the pawn out of emoji.
    return (
      <text className="piece__glyph piece__glyph--staunton" x="22.5" y="40" textAnchor="middle">
        {GLYPHS[type]}
      </text>
    )
  }
  if (drawing === 'letter') {
    const ch = color === 'w' ? type.toUpperCase() : type
    return (
      <text className="piece__glyph" x="22.5" y="34" textAnchor="middle">
        {ch}
      </text>
    )
  }
  const shape = drawing === 'geometric' ? GEOMETRIC[type] : PIECES[type]
  return (
    <>
      <path className="piece__halo" d={shape.body} />
      <path className="piece__fill" d={shape.body} />
      {shape.detail ? <path className="piece__detail" d={shape.detail} /> : null}
    </>
  )
}

export const viewBoxOf = (set: PieceSetId) => (DRAWING[set] === 'pixel' ? '0 0 16 16' : '0 0 45 45')
