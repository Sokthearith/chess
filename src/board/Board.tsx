import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import type { Color, MoveIntent, PieceOn, Position, Promotion, Square } from '../game/types'
import { FILES, RANKS, isDarkSquare } from '../game/types'
import { Badge, type BadgeKind } from './Badge'
import { diffPositions, type Motion } from './motion'
import { Piece } from './Piece'
import { PIECE_NAMES } from './pieces'
import { PromotionChooser } from './PromotionChooser'
import { getSettings } from '../settings/useSettings'

export interface BoardProps {
  position: Position
  orientation: Color
  selected: Square | null
  targets: { to: Square; capture: boolean }[]
  /** When false the board is read-only (viewing history, game over). */
  interactive: boolean
  pendingPromotion: { from: Square; to: Square } | null
  onSelect: (square: Square | null) => void
  onMove: (intent: MoveIntent) => boolean
  onPromote: (piece: Promotion) => void
  onCancelPromotion: () => void
  /** Accessible name for the grid. */
  label?: string
  /** A review grade pinned to a square (the destination of the move it grades). */
  annotation?: { square: Square; kind: BadgeKind; key: string | number } | null
  /** The mated king's square: it tips over. */
  mated?: Square | null
  /** Engine arrows: `best` is the first choice, `alt` the second. */
  arrows?: BoardArrow[]
  /** Whose pieces can be picked up. Defaults to the side to move; online play sets it to the player, for premoves. */
  mover?: Color
  /** A move queued for the player's next turn: both squares are marked. */
  premove?: { from: Square; to: Square } | null
  /** Right-click or Escape drops the queued premove. */
  onCancelPremove?: () => void
}

export interface BoardArrow {
  from: Square
  to: Square
  tone: 'best' | 'alt'
}

/** An arrow from square centre to square centre, in board units (one square = 1). */
function arrowPath(x1: number, y1: number, x2: number, y2: number, shaft: number, head: number, headLen: number): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  // Start a little off the origin centre, end at the target centre.
  const sx = x1 + ux * 0.28
  const sy = y1 + uy * 0.28
  const bx = x2 - ux * headLen
  const by = y2 - uy * headLen
  const p = (x: number, y: number) => `${x.toFixed(3)},${y.toFixed(3)}`
  return `M${p(sx + px * shaft, sy + py * shaft)} L${p(bx + px * shaft, by + py * shaft)} L${p(bx + px * head, by + py * head)} L${p(x2, y2)} L${p(bx - px * head, by - py * head)} L${p(bx - px * shaft, by - py * shaft)} L${p(sx - px * shaft, sy - py * shaft)} Z`
}

/**
 * A knight's arrow bends like the move: two squares straight along the long
 * leg, then one square to the side, with the head on the target. Drawn as
 * one L-shaped polygon so the translucent fill never doubles at the corner.
 */
function knightArrowPath(x1: number, y1: number, x2: number, y2: number, shaft: number, head: number, headLen: number): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const longX = Math.abs(dx) > Math.abs(dy)
  // u: the long leg's direction; v: the short leg's.
  const u = longX ? [Math.sign(dx), 0] : [0, Math.sign(dy)]
  const v = longX ? [0, Math.sign(dy)] : [Math.sign(dx), 0]
  const cx = longX ? x2 : x1
  const cy = longX ? y1 : y2
  const sx = x1 + u[0] * 0.28
  const sy = y1 + u[1] * 0.28
  const bx = x2 - v[0] * headLen
  const by = y2 - v[1] * headLen
  const p = (x: number, y: number) => `${x.toFixed(3)},${y.toFixed(3)}`
  const w = shaft
  return [
    `M${p(sx - v[0] * w, sy - v[1] * w)}`,
    `L${p(cx + u[0] * w - v[0] * w, cy + u[1] * w - v[1] * w)}`,
    `L${p(bx + u[0] * w, by + u[1] * w)}`,
    `L${p(bx + u[0] * head, by + u[1] * head)}`,
    `L${p(x2, y2)}`,
    `L${p(bx - u[0] * head, by - u[1] * head)}`,
    `L${p(bx - u[0] * w, by - u[1] * w)}`,
    `L${p(cx - u[0] * w + v[0] * w, cy - u[1] * w + v[1] * w)}`,
    `L${p(sx + v[0] * w, sy + v[1] * w)}`,
    'Z',
  ].join(' ')
}

const isKnightJump = (dx: number, dy: number) => {
  const a = Math.abs(dx)
  const b = Math.abs(dy)
  return (a === 1 && b === 2) || (a === 2 && b === 1)
}

/** Pen colours for drawings: right-click alone, or with Shift, Alt, Ctrl/Cmd. */
export type PenColor = 'main' | 'green' | 'blue' | 'yellow'

const penOf = (e: { shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }): PenColor =>
  e.ctrlKey || e.metaKey ? 'yellow' : e.altKey ? 'blue' : e.shiftKey ? 'green' : 'main'

interface Drawn {
  arrows: { from: Square; to: Square; color: PenColor }[]
  squares: Record<Square, PenColor>
}
const NO_DRAWINGS: Drawn = { arrows: [], squares: {} }

/** Toggle one drawing: the same mark again removes it, another colour replaces it. */
function toggleDrawing(d: Drawn, from: Square, to: Square, color: PenColor): Drawn {
  if (from === to) {
    const squares = { ...d.squares }
    if (squares[from] === color) delete squares[from]
    else squares[from] = color
    return { ...d, squares }
  }
  const i = d.arrows.findIndex((a) => a.from === from && a.to === to)
  if (i >= 0 && d.arrows[i].color === color) return { ...d, arrows: d.arrows.filter((_, k) => k !== i) }
  const arrows = d.arrows.filter((_, k) => k !== i)
  return { ...d, arrows: [...arrows, { from, to, color }] }
}

interface DragState {
  from: Square
  dx: number
  dy: number
  startX: number
  startY: number
  moved: boolean
}

function describe(square: Square, piece: PieceOn | null): string {
  if (!piece) return `${square}, empty`
  return `${square}, ${piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[piece.type]}`
}

/**
 * Presentation only. It renders a Position and emits intents; it never
 * decides legality. Pointer play is tap-tap, with drag as an enhancement for
 * mouse and pen; keyboard play is a cursor moved with the arrows, Enter or
 * Space to pick up and drop, Escape to cancel.
 */
export function Board({
  position,
  orientation,
  selected,
  targets,
  interactive,
  pendingPromotion,
  onSelect,
  onMove,
  onPromote,
  onCancelPromotion,
  label = 'Chess board',
  annotation = null,
  mated = null,
  arrows = [],
  mover,
  premove = null,
  onCancelPremove,
}: BoardProps) {
  const side = mover ?? position.turn
  const gridRef = useRef<HTMLDivElement>(null)
  const helpId = useId()
  const [cursor, setCursor] = useState<Square>(orientation === 'w' ? 'e1' : 'e8')
  const [drag, setDrag] = useState<DragState | null>(null)
  const [motion, setMotion] = useState<Motion | null>(null)
  // Drawings: highlighted squares and arrows the player marks up. They belong to one position and clear on the next move.
  const [drawn, setDrawn] = useState<Drawn>(NO_DRAWINGS)
  const [pen, setPen] = useState<{ from: Square; to: Square; color: PenColor } | null>(null)
  /** Touch: the square a long press picked as an arrow's start. */
  const [penFrom, setPenFrom] = useState<Square | null>(null)
  const longPress = useRef<{ timer: number; x: number; y: number } | null>(null)
  useEffect(() => {
    setDrawn(NO_DRAWINGS)
    setPen(null)
    setPenFrom(null)
  }, [position.fen])
  const hasDrawings = drawn.arrows.length > 0 || Object.keys(drawn.squares).length > 0
  const cancelLongPress = () => {
    if (longPress.current) window.clearTimeout(longPress.current.timer)
    longPress.current = null
  }
  const prevGrid = useRef(position.grid)
  /** The square a drag just dropped on: that piece is already there, so it must not slide. */
  const dropped = useRef<Square | null>(null)
  const prevPromotion = useRef(pendingPromotion)

  // Display order of files and ranks for the current orientation.
  const files = orientation === 'w' ? [...FILES] : [...FILES].reverse()
  const ranks = orientation === 'w' ? [...RANKS] : [...RANKS].reverse()

  const pieceAt = useCallback(
    (square: Square): PieceOn | null => {
      const f = FILES.indexOf(square[0] as (typeof FILES)[number])
      const r = RANKS.indexOf(square[1] as (typeof RANKS)[number])
      return position.grid[r]?.[f] ?? null
    },
    [position.grid],
  )

  const targetFor = (square: Square) => targets.find((t) => t.to === square)

  /** With auto-queen on, a pawn reaching the last rank becomes a queen without the chooser. */
  const move = (intent: MoveIntent) => {
    const p = pieceAt(intent.from)
    const last = intent.to[1] === '8' || intent.to[1] === '1'
    return onMove(p?.type === 'p' && last && !intent.promotion && getSettings().autoQueen ? { ...intent, promotion: 'q' } : intent)
  }

  const focusSquare = useCallback((square: Square) => {
    const el = gridRef.current?.querySelector<HTMLButtonElement>(`[data-square="${square}"]`)
    el?.focus({ preventScroll: true })
  }, [])

  // Animate whatever changed between the last position and this one: a FLIP in
  // CSS custom properties. Diffing the grids (rather than reading lastMove)
  // moves both pieces when castling, takes the right pawn en passant, and
  // runs backwards when a review steps back.
  // Keyed on the FEN, not the grid: callers may rebuild an identical Position every render.
  useLayoutEffect(() => {
    const before = prevGrid.current
    prevGrid.current = position.grid
    const m = diffPositions(before, position.grid, orientation, dropped.current)
    dropped.current = null
    setMotion(m)
    if (!m) return
    const t = window.setTimeout(() => setMotion(null), 420)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.fen])

  // When the promotion chooser closes, hand focus back to the destination square.
  useEffect(() => {
    const prev = prevPromotion.current
    prevPromotion.current = pendingPromotion
    // A drop onto the promotion rank leaves the pawn at home until the piece is chosen: let it slide.
    if (pendingPromotion) dropped.current = null
    if (prev && !pendingPromotion) {
      setCursor(prev.to)
      focusSquare(prev.to)
    }
  }, [pendingPromotion, focusSquare])

  const squareFromPoint = (clientX: number, clientY: number): Square | null => {
    const el = gridRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const size = rect.width / 8
    const fx = Math.floor((clientX - rect.left) / size)
    const ry = Math.floor((clientY - rect.top) / size)
    if (fx < 0 || fx > 7 || ry < 0 || ry > 7) return null
    return `${files[fx]}${ranks[ry]}`
  }

  const act = (square: Square) => {
    if (!interactive) return
    const piece = pieceAt(square)
    if (selected) {
      if (square === selected) {
        onSelect(null)
        return
      }
      if (targetFor(square)) {
        move({ from: selected, to: square })
        return
      }
      if (piece && piece.color === side) {
        onSelect(square)
        return
      }
      onSelect(null)
      return
    }
    if (piece && piece.color === side) onSelect(square)
  }

  // ---- pointer: tap-tap everywhere, drag for mouse and pen ----
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, square: Square) => {
    // Right button: start a drawing (a square on release in place, an arrow on release elsewhere).
    if (e.button === 2) {
      if (premove && onCancelPremove) {
        e.preventDefault()
        onCancelPremove()
        return
      }
      if (pendingPromotion || drag) return
      e.preventDefault()
      setPen({ from: square, to: square, color: penOf(e) })
      gridRef.current?.setPointerCapture(e.pointerId)
      return
    }
    if (e.button !== 0) return
    // Touch, after a long press: this tap ends the drawing.
    if (penFrom) {
      setDrawn((d) => toggleDrawing(d, penFrom, square, 'main'))
      setPenFrom(null)
      return
    }
    if (hasDrawings) setDrawn(NO_DRAWINGS)
    if (e.pointerType === 'touch' && !pendingPromotion) {
      cancelLongPress()
      longPress.current = {
        x: e.clientX,
        y: e.clientY,
        timer: window.setTimeout(() => {
          longPress.current = null
          onSelect(null)
          setPenFrom(square)
          navigator.vibrate?.(12)
        }, 450),
      }
    }
    if (pendingPromotion) {
      onCancelPromotion()
      return
    }
    if (!interactive) return
    setCursor(square)
    const piece = pieceAt(square)
    if (square === selected) {
      onSelect(null)
      return
    }
    if (piece && piece.color === side && e.pointerType !== 'touch') {
      onSelect(square)
      setDrag({ from: square, dx: 0, dy: 0, startX: e.clientX, startY: e.clientY, moved: false })
      gridRef.current?.setPointerCapture(e.pointerId)
      e.preventDefault()
      focusSquare(square)
    } else {
      act(square)
    }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (longPress.current && Math.hypot(e.clientX - longPress.current.x, e.clientY - longPress.current.y) > 10) cancelLongPress()
    if (pen) {
      const to = squareFromPoint(e.clientX, e.clientY)
      if (to && to !== pen.to) setPen({ ...pen, to })
      return
    }
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    setDrag({ ...drag, dx, dy, moved: drag.moved || Math.hypot(dx, dy) > 6 })
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    cancelLongPress()
    if (pen) {
      const to = squareFromPoint(e.clientX, e.clientY) ?? pen.to
      setDrawn((d) => toggleDrawing(d, pen.from, to, pen.color))
      setPen(null)
      return
    }
    if (!drag) return
    const target = squareFromPoint(e.clientX, e.clientY)
    const d = drag
    setDrag(null)
    if (!d.moved) return // a tap: the piece stays selected for tap-tap
    if (target && target !== d.from && targetFor(target)) {
      dropped.current = target
      if (!move({ from: d.from, to: target })) dropped.current = null
    }
    else if (target && target !== d.from) onSelect(null)
  }
  const onPointerCancel = () => {
    cancelLongPress()
    setPen(null)
    setDrag(null)
  }

  // ---- keyboard: a roving cursor ----
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (pendingPromotion) return
    const fi = files.indexOf(cursor[0] as never)
    const ri = ranks.indexOf(cursor[1] as never)
    let nf = fi
    let nr = ri
    switch (e.key) {
      case 'ArrowLeft':
        nf = Math.max(0, fi - 1)
        break
      case 'ArrowRight':
        nf = Math.min(7, fi + 1)
        break
      case 'ArrowUp':
        nr = Math.max(0, ri - 1)
        break
      case 'ArrowDown':
        nr = Math.min(7, ri + 1)
        break
      case 'Home':
        nf = 0
        break
      case 'End':
        nf = 7
        break
      case 'PageUp':
        nr = 0
        break
      case 'PageDown':
        nr = 7
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        act(cursor)
        return
      case 'Escape':
        e.preventDefault()
        onSelect(null)
        onCancelPremove?.()
        setDrawn(NO_DRAWINGS)
        setPenFrom(null)
        return
      default:
        return
    }
    e.preventDefault()
    const next = `${files[nf]}${ranks[nr]}`
    setCursor(next)
    focusSquare(next)
  }

  useEffect(() => {
    if (!FILES.includes(cursor[0] as never)) setCursor(orientation === 'w' ? 'e1' : 'e8')
  }, [cursor, orientation])

  const dragStyle: CSSProperties | undefined = drag
    ? ({ '--dx': `${drag.dx}px`, '--dy': `${drag.dy}px` } as CSSProperties)
    : undefined

  const promoFile = pendingPromotion ? files.indexOf(pendingPromotion.to[0] as never) : 0
  const promoFromTop = pendingPromotion ? ranks.indexOf(pendingPromotion.to[1] as never) === 0 : true

  return (
    <div className="board-wrap">
      <p id={helpId} className="visually-hidden">
        Arrow keys move between squares. Enter or Space picks a piece up and puts it down. Escape cancels and clears drawings. With a mouse, right-click a square to highlight it or right-drag to draw an arrow; on a touch screen, press and hold a square, then tap another.
      </p>
      <div
        ref={gridRef}
        className={`board${drag?.moved ? ' board--dragging' : ''}`}
        role="grid"
        aria-label={label}
        aria-describedby={helpId}
        aria-readonly={!interactive}
        onKeyDown={onKeyDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {ranks.map((rank, ri) => (
          <div role="row" key={rank} style={{ display: 'contents' }}>
            {files.map((file, fi) => {
              const square = `${file}${rank}`
              const realF = FILES.indexOf(file)
              const realR = RANKS.indexOf(rank)
              const piece = pieceAt(square)
              const dark = isDarkSquare(realF, realR)
              const t = targetFor(square)
              const isLast = position.lastMove?.from === square || position.lastMove?.to === square
              const isSel = selected === square
              const isCheck = position.checkSquare === square
              const isCursor = cursor === square
              const cls = [
                'sq',
                dark ? 'sq--dark' : 'sq--light',
                isLast ? 'sq--last' : '',
                isSel ? 'sq--selected' : '',
                premove && (premove.from === square || premove.to === square) ? 'sq--premove' : '',
                isCheck ? 'sq--check' : '',
                penFrom === square ? 'sq--pen' : '',
                t ? (t.capture ? 'sq--capture' : 'sq--target') : '',
              ]
                .filter(Boolean)
                .join(' ')
              const isDragging = drag?.moved && drag.from === square
              const slide = motion?.slides.get(square)
              const ghost = motion?.ghosts.get(square)
              const appears = motion?.appears.has(square)
              const pieceStyle: CSSProperties | undefined = isDragging
                ? dragStyle
                : slide
                  ? ({ '--from-x': `${slide.dx * 100}%`, '--from-y': `${slide.dy * 100}%` } as CSSProperties)
                  : undefined
              const pieceClass = [
                isDragging ? 'piece--drag' : slide ? 'piece--moved' : appears ? 'piece--appear' : '',
                isSel && !isDragging ? 'piece--lifted' : '',
                mated === square && piece?.type === 'k' ? 'piece--toppled' : '',
              ]
                .filter(Boolean)
                .join(' ')
              const badge = annotation?.square === square ? annotation : null
              return (
                <button
                  key={square}
                  type="button"
                  role="gridcell"
                  data-square={square}
                  className={cls}
                  tabIndex={isCursor ? 0 : -1}
                  aria-label={describe(square, piece)}
                  aria-selected={isSel || undefined}
                  aria-disabled={!interactive || undefined}
                  onPointerDown={(e) => onPointerDown(e, square)}
                  onFocus={() => setCursor(square)}
                >
                  {drawn.squares[square] ? <span className={`sq__paint sq__paint--${drawn.squares[square]}`} aria-hidden="true" /> : null}
                  {fi === 0 ? <span className="sq__coord sq__coord--rank">{rank}</span> : null}
                  {ri === 7 ? <span className="sq__coord sq__coord--file">{file}</span> : null}
                  {ghost ? <Piece key={`g${motion!.id}`} type={ghost.type} color={ghost.color} className="piece--ghost" /> : null}
                  {piece ? (
                    <Piece
                      key={slide || appears ? `m${motion!.id}` : 'still'}
                      type={piece.type}
                      color={piece.color}
                      className={pieceClass}
                      style={pieceStyle}
                    />
                  ) : null}
                  {badge ? <Badge key={badge.key} kind={badge.kind} edge={fi === 7 ? 'right' : undefined} top={ri === 0} /> : null}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {arrows.length || drawn.arrows.length || (pen && pen.from !== pen.to) ? (
        <svg className="arrows" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
          {[...drawn.arrows, ...(pen && pen.from !== pen.to ? [{ ...pen, preview: true }] : [])].map((a) => {
            const fx = files.indexOf(a.from[0] as never) + 0.5
            const fy = ranks.indexOf(a.from[1] as never) + 0.5
            const tx = files.indexOf(a.to[0] as never) + 0.5
            const ty = ranks.indexOf(a.to[1] as never) + 0.5
            const draw = isKnightJump(tx - fx, ty - fy) ? knightArrowPath : arrowPath
            const preview = 'preview' in a
            return <path key={`d${a.from}${a.to}${preview ? 'p' : ''}`} className={`arrow arrow--pen arrow--pen-${a.color}${preview ? ' arrow--preview' : ''}`} d={draw(fx, fy, tx, ty, 0.08, 0.22, 0.34)} />
          })}
          {arrows.map((a) => {
            const fx = files.indexOf(a.from[0] as never) + 0.5
            const fy = ranks.indexOf(a.from[1] as never) + 0.5
            const tx = files.indexOf(a.to[0] as never) + 0.5
            const ty = ranks.indexOf(a.to[1] as never) + 0.5
            if (fx < 0 || tx < 0) return null
            const big = a.tone === 'best'
            const draw = isKnightJump(tx - fx, ty - fy) ? knightArrowPath : arrowPath
            return <path key={`${a.tone}${a.from}${a.to}`} className={`arrow arrow--${a.tone}`} d={draw(fx, fy, tx, ty, big ? 0.09 : 0.065, big ? 0.24 : 0.18, big ? 0.36 : 0.3)} />
          })}
        </svg>
      ) : null}
      {pendingPromotion ? (
        <PromotionChooser
          color={position.turn}
          fileIndex={promoFile}
          fromTop={promoFromTop}
          onChoose={onPromote}
          onCancel={onCancelPromotion}
        />
      ) : null}
    </div>
  )
}
