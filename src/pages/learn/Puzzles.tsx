import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GradeIcon } from '../../board/GradeIcon'
import { ENDGAME_THEMES, MOTIFS } from '../../learn/motifs'
import { ratePuzzle, useProgress } from '../../learn/progress'
import { award, puzzleXp } from '../../learn/game'
import { loadPuzzles, nextPuzzle, openingName, type Puzzle } from '../../learn/puzzles'
import { useLineTrainer } from '../../learn/useLineTrainer'
import { STAGES, useSolvedByTheme } from '../../learn/roadmap'
import { START_FEN, resultOf } from '../../game/rules'
import type { Color } from '../../game/types'
import { play } from '../../sound/sounds'
import { Prompt, TrainerShell } from './TrainerShell'

const THEME_TITLE = new Map<string, string>([...MOTIFS.map((m) => [m.theme, m.title] as const), ...ENDGAME_THEMES.map((t) => [t.theme, t.title] as const)])
const NAMES: Record<Color, string> = { w: 'White', b: 'Black' }

export function Puzzles() {
  const [params, setParams] = useSearchParams()
  const theme = params.get('theme')
  const opening = params.get('opening')
  const [all, setAll] = useState<Puzzle[] | null>(null)
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [progress, update] = useProgress()
  const [delta, setDelta] = useState<number | null>(null)
  const scored = useRef<string | null>(null)

  useEffect(() => {
    void loadPuzzles().then(setAll)
  }, [])

  const pick = (skip: string | null = null) => {
    if (!all) return
    setPuzzle(nextPuzzle(all, { theme, opening }, progress.puzzleRating, new Set(progress.solved), skip))
    setDelta(null)
  }
  // A new filter or the first load: pick a puzzle.
  useEffect(() => {
    pick()
  }, [all, theme, opening]) // eslint-disable-line react-hooks/exhaustive-deps

  const user: Color = puzzle ? (puzzle.fen.split(' ')[1] === 'w' ? 'b' : 'w') : 'w'
  const t = useLineTrainer({ key: puzzle?.id ?? 'none', startFen: puzzle?.fen ?? START_FEN, moves: puzzle?.moves ?? [], user, acceptAnyMate: true })

  // Score once per puzzle: the first mistake or a reveal is a loss, a clean solve a win.
  const settle = (won: boolean) => {
    if (!puzzle || scored.current === puzzle.id) return
    scored.current = puzzle.id
    const next = ratePuzzle(progress, puzzle.rating, won)
    setDelta(next - progress.puzzleRating)
    if (won) {
      const firstTime = !progress.solved.includes(puzzle.id)
      award({
        xp: puzzleXp(puzzle.rating, progress.puzzleRating, firstTime),
        add: { puzzles: 1, clean: 1, ...(puzzle.rating > progress.puzzleRating ? { hard: 1 } : {}), ...Object.fromEntries(puzzle.themes.map((t) => [`theme:${t}`, 1])) },
        label: firstTime ? `Puzzle ${puzzle.rating}` : 'Puzzle, solved before',
      })
    }
    update((p) => {
      const streak = won ? p.streak + 1 : 0
      return {
        ...p,
        puzzleRating: next,
        attempted: p.attempted + 1,
        solved: won && !p.solved.includes(puzzle.id) ? [...p.solved, puzzle.id] : p.solved,
        streak,
        bestStreak: Math.max(p.bestStreak, streak),
      }
    })
  }
  useEffect(() => {
    if (!puzzle) return
    if (t.mistakes > 0 || t.status === 'revealed') settle(false)
    else if (t.status === 'solved') settle(true)
  }, [t.mistakes, t.status]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (t.status === 'solved') play(t.mistakes ? 'best' : 'great', 200)
    // Finished after a slip: a little XP for seeing it through, and it counts toward "solve N puzzles".
    if (t.status === 'solved' && t.mistakes && puzzle) award({ xp: 2, add: { puzzles: 1 }, label: 'Puzzle, solved with help' })
  }, [t.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // A refused move flashes a mistake badge on its square for a moment.
  const [flash, setFlash] = useState<{ square: string; n: number } | null>(null)
  useEffect(() => {
    if (!t.wrong) return
    setFlash(t.wrong)
    const id = window.setTimeout(() => setFlash(null), 1000)
    return () => window.clearTimeout(id)
  }, [t.wrong])

  const lastUser = [...t.played].reverse().find((m) => m.color === user)
  const annotation = flash
    ? { square: flash.square, kind: 'mistake' as const, key: `w${flash.n}` }
    : lastUser
      ? { square: lastUser.to, kind: (t.status === 'solved' && !t.mistakes ? 'great' : 'best') as 'great' | 'best', key: `${lastUser.ply}${t.status}` }
      : null

  const filterLabel = theme ? THEME_TITLE.get(theme) ?? theme : opening ? openingName(opening) : 'Mixed'
  const options = useMemo(
    () => [
      { value: '', label: 'Mixed — every theme' },
      ...MOTIFS.map((m) => ({ value: `theme:${m.theme}`, label: m.title })),
      ...ENDGAME_THEMES.map((m) => ({ value: `theme:${m.theme}`, label: m.title })),
      ...['Italian_Game', 'Ruy_Lopez', 'Sicilian_Defense', 'French_Defense', 'Caro-Kann_Defense', 'Queens_Gambit_Declined', 'Slav_Defense', 'Kings_Indian_Defense', 'London_System', 'Scandinavian_Defense', 'Scotch_Game', 'Nimzo-Indian_Defense'].map((o) => ({ value: `opening:${o}`, label: `Opening — ${openingName(o)}` })),
    ],
    [],
  )
  const motif = MOTIFS.find((m) => m.theme === theme)
  const solvedByTheme = useSolvedByTheme(progress.solved)
  const roadGoal = theme ? STAGES.flatMap((s) => s.steps).find((s) => s.kind === 'puzzles' && s.theme === theme) : undefined

  const prompt = (() => {
    if (!puzzle) return { head: all ? 'No puzzle matches this filter.' : 'Loading puzzles…' }
    if (t.status === 'solved') return { head: t.mistakes ? 'Solved, with help' : 'Solved', sub: puzzle.themes.map((x) => THEME_TITLE.get(x)).filter(Boolean).slice(0, 3).join(' — ') || undefined, tone: 'done' as const }
    if (t.status === 'revealed') return { head: 'Here is the solution', sub: 'Watch the line, then try the next one.', tone: 'bad' as const }
    if (flash) return { head: 'Not that one', sub: 'Try again. Checks, captures, threats.', tone: 'bad' as const }
    if (t.turn !== user) return { head: t.index === 0 ? `${NAMES[t.turn]} moves…` : 'Good. Keep going…', tone: t.index ? ('good' as const) : null }
    const mateGoal = puzzle.themes.find((x) => /^mateIn\d$/.test(x))
    return { head: `Find the best move for ${NAMES[user]}`, sub: mateGoal ? `Mate in ${mateGoal.slice(-1)}.` : undefined }
  })()

  return (
    <TrainerShell
      title="Puzzles"
      corners={{ tl: ['Puzzle', puzzle ? `#${puzzle.id}` : '—'], tr: ['Rating', puzzle ? String(puzzle.rating) : '—'], bl: ['Set', filterLabel], br: ['Source', 'lichess puzzle database'] }}
      position={t.position}
      orientation={user}
      selected={t.selected}
      targets={t.targets}
      interactive={t.status === 'playing' && t.turn === user}
      pendingPromotion={t.pendingPromotion}
      onSelect={t.select}
      onMove={t.attemptMove}
      onPromote={t.promote}
      onCancelPromotion={t.cancelPromotion}
      annotation={annotation}
      mated={resultOf(t.fen)?.status === 'checkmate' ? t.position.checkSquare : null}
      boardLabel={`Puzzle, ${NAMES[user]} to play`}
      side={
        <>
          <div className="trainer__score">
            <div>
              <span className="mono mono--sm mono--mute">Your rating</span>
              <output className="accuracy" aria-label={`Puzzle rating ${progress.puzzleRating}`}>
                {progress.puzzleRating}
                {delta !== null ? <span className={`delta ${delta >= 0 ? 'delta--up' : 'delta--down'}`}>{delta >= 0 ? `+${delta}` : delta}</span> : null}
              </output>
            </div>
            <div className="trainer__streak">
              <span className="mono mono--sm mono--mute">Streak</span>
              <span className="trainer__streak-n">{progress.streak}</span>
            </div>
          </div>
          <Prompt {...prompt} />
          {motif ? (
            <div className="trainer__note">
              <p className="mono mono--sm">{motif.title}</p>
              <p>{motif.idea}</p>
              <p className="mono mono--sm mono--mute">Look for — {motif.look}</p>
              {roadGoal?.kind === 'puzzles' && solvedByTheme ? (
                <p className="mono mono--sm">
                  Roadmap — {Math.min(solvedByTheme.get(motif.theme) ?? 0, roadGoal.goal)} of {roadGoal.goal} solved
                  {(solvedByTheme.get(motif.theme) ?? 0) >= roadGoal.goal ? ' · step done' : ''}
                </p>
              ) : null}
            </div>
          ) : null}
          <label className="trainer__filter">
            <span className="mono mono--sm">Train</span>
            <select
              value={theme ? `theme:${theme}` : opening ? `opening:${opening}` : ''}
              onChange={(e) => {
                const [k, v] = e.target.value.split(':')
                setParams(k ? { [k]: v } : {})
              }}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="play__controls">
            {t.status === 'playing' ? (
              <>
                <button type="button" className="btn btn--quiet btn--sm" onClick={t.hint} disabled={t.turn !== user}>
                  Hint
                </button>
                <button type="button" className="btn btn--quiet btn--sm" onClick={t.reveal}>
                  Solution
                </button>
              </>
            ) : (
              <button type="button" className="btn btn--sm" onClick={() => pick(puzzle?.id ?? null)} autoFocus>
                Next puzzle
              </button>
            )}
            {t.status !== 'playing' || t.mistakes ? (
              <button type="button" className="btn btn--quiet btn--sm" onClick={t.restart}>
                Retry
              </button>
            ) : null}
            {t.status === 'playing' ? (
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => pick(puzzle?.id ?? null)}>
                Skip
              </button>
            ) : null}
          </div>
          {t.status !== 'playing' && puzzle ? (
            <p className="mono mono--sm mono--mute">
              <GradeIcon kind={t.status === 'solved' && !t.mistakes ? 'great' : t.status === 'solved' ? 'best' : 'miss'} /> Puzzle {puzzle.rating} —{' '}
              <a href={`https://lichess.org/training/${puzzle.id}`} target="_blank" rel="noreferrer">
                open on lichess
              </a>
            </p>
          ) : null}
        </>
      }
    />
  )
}
