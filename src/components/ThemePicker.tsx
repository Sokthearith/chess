import { useEffect, useId, useRef, useState } from 'react'
import { Piece } from '../board/Piece'
import type { Color, PieceType } from '../game/types'
import { THEMES, type Theme } from '../theme/themes'
import { loadThemeFonts, setTheme, useTheme } from '../theme/useTheme'
import { updateSettings, useSettings } from '../settings/useSettings'

/** A 4 x 2 corner of a board: Black's rook and knight above White's pawn and queen. */
const PREVIEW: (readonly [PieceType, Color] | null)[] = [['r', 'b'], ['n', 'b'], null, ['k', 'b'], null, ['p', 'w'], ['q', 'w'], ['b', 'w']]

export function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <span className="theme-card__board" aria-hidden="true">
      {PREVIEW.map((p, i) => {
        const dark = (Math.floor(i / 4) + (i % 4)) % 2 === 1
        return (
          <span key={i} className={`theme-card__sq${dark ? ' sq--dark' : ''}`}>
            {p ? <Piece type={p[0]} color={p[1]} set={theme.pieces} /> : null}
          </span>
        )
      })}
    </span>
  )
}

const GROUPS: { scheme: Theme['scheme']; title: string }[] = [
  { scheme: 'light', title: 'Light' },
  { scheme: 'dark', title: 'Dark' },
]

/** Every theme as a radio card, grouped light and dark. */
export function ThemeGrid() {
  const theme = useTheme()
  return (
    <>
      {GROUPS.map((g) => (
        <fieldset key={g.scheme} className="themes__list">
          <legend className="themes__group mono mono--sm">{g.title}</legend>
          {THEMES.filter((t) => t.scheme === g.scheme).map((t) => (
            <label key={t.id} className={`theme-option${t.id === theme.id ? ' theme-option--on' : ''}`}>
              <input type="radio" name="site-theme" className="visually-hidden" value={t.id} checked={t.id === theme.id} onChange={() => setTheme(t.id)} />
              <span className="theme-card" data-theme={t.id}>
                <ThemePreview theme={t} />
                <span className="theme-card__name">{t.name}</span>
                <span className="theme-card__blurb">{t.blurb}</span>
              </span>
              <span className="theme-option__state mono mono--sm" aria-hidden="true">
                {t.id === theme.id ? 'In use' : 'Use'}
              </span>
            </label>
          ))}
        </fieldset>
      ))}
    </>
  )
}

export function BoardOptions() {
  const s = useSettings()
  const opts = [
    { key: 'coords' as const, label: 'Coordinates', sub: 'a–h and 1–8 on the board edge' },
    { key: 'hints' as const, label: 'Legal-move dots', sub: 'Show where a picked-up piece can go' },
    { key: 'autoQueen' as const, label: 'Auto-queen', sub: 'Promote to a queen without asking' },
  ]
  return (
    <fieldset className="board-opts">
      <legend className="mono mono--sm">Board</legend>
      {opts.map((o) => (
        <label key={o.key} className="check check--card">
          <input type="checkbox" checked={s[o.key]} onChange={(e) => updateSettings({ [o.key]: e.target.checked })} />
          <span>
            <span className="check__label">{o.label}</span>
            <span className="check__sub">{o.sub}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

/** The nav's theme switch: a button that opens a panel of every theme, each previewed in its own colours, type and pieces, plus board options. */
export function ThemePicker() {
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    for (const t of THEMES) loadThemeFonts(t)
    panel.current?.querySelector<HTMLInputElement>('input:checked')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <>
      <button ref={button} type="button" className="nav__theme" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <span className="nav__swatch" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
        <span>
          Theme<span className="nav__theme-name"> — {theme.name}</span>
        </span>
      </button>
      <div ref={panel} id={panelId} className="themes" hidden={!open} role="dialog" aria-label="Choose a theme">
        <div className="container themes__inner">
          <div className="themes__head">
            <p className="mono">Theme — {THEMES.length} looks; the board and pieces change with them</p>
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              onClick={() => {
                setOpen(false)
                button.current?.focus()
              }}
            >
              Done
            </button>
          </div>
          <ThemeGrid />
          <BoardOptions />
        </div>
      </div>
    </>
  )
}
