import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clearRecent, useRecentGames } from '../analysis/library'
import { Footer } from '../components/Footer'
import { Nav } from '../components/Nav'
import { BoardOptions, ThemeGrid } from '../components/ThemePicker'
import { DEFAULT_CONFIG, TIME_CONTROLS, readConfig, saveConfig, type PlayConfig } from '../game/playConfig'
import { LEVELS } from '../game/useComputer'
import { resetProgress, useProgress } from '../learn/progress'
import { clearSaved, useSavedGames } from '../library/saved'
import { DEFAULT_SETTINGS, updateSettings, useSettings } from '../settings/useSettings'
import { play } from '../sound/sounds'
import { useSoundSetting } from '../sound/useSound'
import { loadThemeFonts, setTheme, useTheme } from '../theme/useTheme'
import { DEFAULT_THEME, THEMES } from '../theme/themes'

const BEST_PREF = 'counterplay.bestArrow'
const USER_KEY = 'counterplay.chesscom.username'

const SECTIONS = [
  { id: 'look', title: 'Look' },
  { id: 'board', title: 'Board' },
  { id: 'sound', title: 'Sound' },
  { id: 'games', title: 'New games' },
  { id: 'review', title: 'Review' },
  { id: 'data', title: 'Your data' },
]

/** A destructive action: the first press arms it, the second (within four seconds) does it. */
function ConfirmButton({ label, confirm, done, onConfirm, disabled }: { label: string; confirm: string; done: string; onConfirm: () => void; disabled?: boolean }) {
  const [state, setState] = useState<'idle' | 'armed' | 'done'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const t = window.setTimeout(() => setState('idle'), state === 'armed' ? 4000 : 2500)
    return () => window.clearTimeout(t)
  }, [state])
  return (
    <button
      type="button"
      className={`btn btn--sm${state === 'armed' ? '' : ' btn--quiet'}`}
      disabled={disabled}
      aria-live="polite"
      onClick={() => {
        if (state === 'armed') {
          onConfirm()
          setState('done')
        } else setState('armed')
      }}
    >
      {state === 'armed' ? confirm : state === 'done' ? done : label}
    </button>
  )
}

function Toggle({ label, sub, checked, onChange }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check check--card">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="check__label">{label}</span>
        <span className="check__sub">{sub}</span>
      </span>
    </label>
  )
}

export function Settings() {
  const s = useSettings()
  const theme = useTheme()
  const { muted, toggle } = useSoundSetting()
  const [config, setConfig] = useState<PlayConfig>(readConfig)
  const [bestOn, setBestOn] = useState(() => {
    try {
      return localStorage.getItem(BEST_PREF) !== 'off'
    } catch {
      return true
    }
  })
  const [p] = useProgress()
  const saved = useSavedGames()
  const recent = useRecentGames()
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem(USER_KEY) ?? ''
    } catch {
      return ''
    }
  })

  useEffect(() => {
    for (const t of THEMES) loadThemeFonts(t)
  }, [])

  const setPlay = <K extends keyof PlayConfig>(k: K, v: PlayConfig[K]) => {
    const next = { ...config, [k]: v }
    setConfig(next)
    saveConfig(next)
  }
  const setBest = (v: boolean) => {
    setBestOn(v)
    try {
      localStorage.setItem(BEST_PREF, v ? 'on' : 'off')
    } catch {
      /* private mode */
    }
  }

  return (
    <>
      <Nav />
      <main id="main" className="container learn settings">
        <header className="learn__head">
          <h1>Settings</h1>
          <p className="lead">Everything here is saved in this browser and applies at once. Nothing is sent anywhere.</p>
          <nav className="chips settings__jump" aria-label="Settings sections">
            {SECTIONS.map((x) => (
              <a key={x.id} className="chip" href={`#${x.id}`}>
                {x.title}
              </a>
            ))}
          </nav>
        </header>

        <section id="look" className="settings__sec" aria-labelledby="look-h">
          <div className="shelf__head">
            <h2 id="look-h">Look</h2>
            <p className="mono mono--sm mono--mute">Theme — {theme.name}</p>
          </div>
          <p className="settings__note">A theme changes the whole site at once: colours, type, the board and the pieces.</p>
          <div className="settings__themes">
            <ThemeGrid />
          </div>
        </section>

        <section id="board" className="settings__sec" aria-labelledby="board-h">
          <div className="shelf__head">
            <h2 id="board-h">Board</h2>
          </div>
          <div className="settings__grid">
            <BoardOptions />
            <Toggle label="Last-move highlight" sub="Tint the two squares of the last move" checked={s.lastMove} onChange={(v) => updateSettings({ lastMove: v })} />
            <Toggle label="Animation" sub="Pieces slide, a mated king falls, grades pop in" checked={s.animation} onChange={(v) => updateSettings({ animation: v })} />
          </div>
          <p className="settings__note">
            Drawing: right-click a square to mark it, right-drag to draw an arrow (Shift, Alt or Ctrl for other colours). On a touch screen, press and hold a square, then tap another.
          </p>
        </section>

        <section id="sound" className="settings__sec" aria-labelledby="sound-h">
          <div className="shelf__head">
            <h2 id="sound-h">Sound</h2>
          </div>
          <div className="settings__grid">
            <Toggle label="Sound" sub="Moves, captures, checks, the clock under ten seconds" checked={!muted} onChange={() => toggle()} />
            <label className="check check--card settings__range">
              <span>
                <span className="check__label">Volume — {Math.round(s.volume * 100)}%</span>
                <input type="range" min={0} max={1} step={0.05} value={s.volume} disabled={muted} onChange={(e) => updateSettings({ volume: Number(e.target.value) })} onPointerUp={() => play('move')} onKeyUp={() => play('move')} />
              </span>
            </label>
          </div>
          <div className="play__controls">
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => play('move')} disabled={muted}>
              Test — move
            </button>
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => play('capture')} disabled={muted}>
              Test — capture
            </button>
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => play('check')} disabled={muted}>
              Test — check
            </button>
          </div>
        </section>

        <section id="games" className="settings__sec" aria-labelledby="games-h">
          <div className="shelf__head">
            <h2 id="games-h">New games</h2>
            <p className="mono mono--sm mono--mute">What the Play page starts with</p>
          </div>
          <div className="settings__form">
            <label className="field">
              <span className="mono mono--sm">Opponent</span>
              <select className="select" value={config.opponent} onChange={(e) => setPlay('opponent', e.target.value as PlayConfig['opponent'])}>
                <option value="computer">Computer (Stockfish)</option>
                <option value="friend">A friend, same device</option>
              </select>
            </label>
            <label className="field">
              <span className="mono mono--sm">Computer level</span>
              <select className="select" value={config.level} onChange={(e) => setPlay('level', Number(e.target.value))}>
                {LEVELS.map((l) => (
                  <option key={l.level} value={l.level}>
                    {l.level} — {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="mono mono--sm">You play</span>
              <select className="select" value={config.side} onChange={(e) => setPlay('side', e.target.value as PlayConfig['side'])}>
                <option value="w">White</option>
                <option value="random">Random</option>
                <option value="b">Black</option>
              </select>
            </label>
            <label className="field">
              <span className="mono mono--sm">Time control</span>
              <select className="select" value={config.time} onChange={(e) => setPlay('time', e.target.value)}>
                {TIME_CONTROLS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} — {t.kind}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="settings__grid">
            <Toggle label="Evaluation bar while playing" sub="Off by default, so the engine does not play for you" checked={config.showEval} onChange={(v) => setPlay('showEval', v)} />
          </div>
          <p>
            <Link className="btn btn--sm" to="/play">
              Play with these settings
            </Link>
          </p>
        </section>

        <section id="review" className="settings__sec" aria-labelledby="review-h">
          <div className="shelf__head">
            <h2 id="review-h">Review</h2>
          </div>
          <div className="settings__grid">
            <Toggle label="Best-move arrow" sub="Show Stockfish's first and second choice on the board" checked={bestOn} onChange={setBest} />
          </div>
          <p className="settings__note">
            Reviews run Stockfish 19 in your browser: every position at depth 16, then every critical move again at depth 20. Grades follow winning chances lost, with mates, only-moves and sacrifices judged on the engine’s own terms.
          </p>
        </section>

        <section id="data" className="settings__sec" aria-labelledby="data-h">
          <div className="shelf__head">
            <h2 id="data-h">Your data</h2>
            <p className="mono mono--sm mono--mute">Stored in this browser only</p>
          </div>
          <ul className="data-rows">
            <li className="data-row">
              <span>
                <span className="check__label">Learning progress</span>
                <span className="check__sub">
                  Puzzle rating {p.puzzleRating}, {p.solved.length} puzzles solved, {p.lessons.length} lessons, {Object.keys(p.openings).length} openings, {p.endgames.length} endgames
                </span>
              </span>
              <ConfirmButton label="Reset" confirm="Reset progress?" done="Reset" onConfirm={resetProgress} />
            </li>
            <li className="data-row">
              <span>
                <span className="check__label">Saved games</span>
                <span className="check__sub">{saved.length} saved</span>
              </span>
              <ConfirmButton label="Clear" confirm="Delete all saved?" done="Cleared" onConfirm={clearSaved} disabled={!saved.length} />
            </li>
            <li className="data-row">
              <span>
                <span className="check__label">Recently analysed</span>
                <span className="check__sub">{recent.length} games</span>
              </span>
              <ConfirmButton label="Clear" confirm="Clear the list?" done="Cleared" onConfirm={clearRecent} disabled={!recent.length} />
            </li>
            <li className="data-row">
              <span>
                <span className="check__label">Chess.com username</span>
                <span className="check__sub">{username || 'none remembered'}</span>
              </span>
              <ConfirmButton
                label="Forget"
                confirm="Forget it?"
                done="Forgotten"
                disabled={!username}
                onConfirm={() => {
                  try {
                    localStorage.removeItem(USER_KEY)
                  } catch {
                    /* ignore */
                  }
                  setUsername('')
                }}
              />
            </li>
            <li className="data-row">
              <span>
                <span className="check__label">All settings</span>
                <span className="check__sub">Theme, board, sound, new-game defaults (games and progress are kept)</span>
              </span>
              <ConfirmButton
                label="Restore defaults"
                confirm="Restore defaults?"
                done="Restored"
                onConfirm={() => {
                  updateSettings(DEFAULT_SETTINGS)
                  setTheme(DEFAULT_THEME)
                  setBest(true)
                  if (muted) toggle()
                  setConfig(DEFAULT_CONFIG)
                  saveConfig(DEFAULT_CONFIG)
                }}
              />
            </li>
          </ul>
        </section>
      </main>
      <Footer />
    </>
  )
}
