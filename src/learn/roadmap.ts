import { useEffect, useMemo, useState } from 'react'
import { ENDGAMES } from './endgames'
import { LESSONS } from './lessons'
import { ENDGAME_THEMES, MOTIFS } from './motifs'
import { OPENINGS } from './openings'
import { useProgress, type Progress } from './progress'
import { loadPuzzles } from './puzzles'

/**
 * The roadmap: every lesson, drill, opening and puzzle set on the site, put in
 * the order a new player should meet them, in four stages. Nothing is locked;
 * the road only says what to do next. Completion is read from the progress
 * already kept for each trainer, so work done before the roadmap counts.
 */
export type RoadStep =
  | { kind: 'lesson'; id: string }
  | { kind: 'opening'; id: string }
  | { kind: 'endgame'; id: string }
  | { kind: 'puzzles'; theme: string; goal: number }
  | { kind: 'rating'; goal: number }

export interface Stage {
  id: string
  title: string
  /** Who it is for, roughly. */
  band: string
  goal: string
  steps: RoadStep[]
}

const lesson = (id: string): RoadStep => ({ kind: 'lesson', id })
const opening = (id: string): RoadStep => ({ kind: 'opening', id })
const endgame = (id: string): RoadStep => ({ kind: 'endgame', id })
const puzzles = (theme: string, goal: number): RoadStep => ({ kind: 'puzzles', theme, goal })

export const STAGES: Stage[] = [
  {
    id: 'foundations',
    title: 'Foundations',
    band: 'New to chess',
    goal: 'Learn every rule, what the pieces are worth, and how to finish a won game.',
    steps: [lesson('pawns'), lesson('line-pieces'), lesson('knight-king'), lesson('special-moves'), lesson('check-mate'), lesson('piece-values'), puzzles('mateIn1', 5), endgame('queen-mate'), endgame('two-rooks')],
  },
  {
    id: 'club',
    title: 'Club player',
    band: 'Rated about 600 to 1200',
    goal: 'Stop losing pieces and start winning them. A first opening as White, simple tactics, basic endings.',
    steps: [
      lesson('opening-principles'),
      lesson('blunder-check'),
      puzzles('hangingPiece', 5),
      puzzles('fork', 5),
      puzzles('pin', 5),
      puzzles('skewer', 3),
      puzzles('backRankMate', 3),
      opening('italian'),
      opening('london'),
      endgame('rook-mate'),
      endgame('blockade'),
      endgame('catch-pawn'),
      puzzles('mateIn2', 5),
      { kind: 'rating', goal: 1300 },
    ],
  },
  {
    id: 'patterns',
    title: 'Patterns and plans',
    band: 'Rated about 1200 to 1600',
    goal: 'See combinations before they happen, win king and pawn endings, and know an answer to 1.e4 and 1.d4.',
    steps: [
      lesson('mating-patterns'),
      puzzles('discoveredAttack', 5),
      puzzles('doubleCheck', 3),
      puzzles('deflection', 5),
      puzzles('capturingDefender', 3),
      puzzles('trappedPiece', 3),
      puzzles('smotheredMate', 3),
      lesson('opposition'),
      endgame('key-squares'),
      endgame('pawn-sixth'),
      endgame('opposition-defence'),
      endgame('breakthrough'),
      opening('queens-gambit'),
      opening('caro-kann'),
      opening('qgd'),
      { kind: 'rating', goal: 1600 },
    ],
  },
  {
    id: 'advanced',
    title: 'Advanced',
    band: 'Rated 1600 and up',
    goal: 'Calculate sacrifices, use the quiet move and the in-between move, and play the endings that decide tournaments.',
    steps: [
      lesson('classic-sacrifices'),
      puzzles('attraction', 3),
      puzzles('clearance', 3),
      puzzles('interference', 3),
      puzzles('xRayAttack', 3),
      puzzles('intermezzo', 3),
      puzzles('quietMove', 3),
      puzzles('zugzwang', 3),
      puzzles('mateIn3', 5),
      endgame('lucena'),
      endgame('philidor'),
      endgame('queen-pawn'),
      endgame('two-bishops'),
      endgame('bishop-knight'),
      opening('ruy-lopez'),
      opening('sicilian-najdorf'),
      opening('kings-indian'),
      opening('nimzo-indian'),
      { kind: 'rating', goal: 1900 },
    ],
  },
]

const THEME_TITLE = new Map<string, string>([...MOTIFS.map((m) => [m.theme, m.title] as const), ...ENDGAME_THEMES.map((t) => [t.theme, t.title] as const)])

export interface StepView {
  key: string
  kind: 'Lesson' | 'Puzzles' | 'Endgame' | 'Opening' | 'Rating'
  title: string
  body: string
  to: string
  done: boolean
  /** "3 of 5", "mastered", "1240 of 1300". */
  state: string | null
}

const firstSentence = (s: string) => s.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? s

/** Puzzles solved per theme, once the puzzle set has loaded. */
export function useSolvedByTheme(solved: string[]): Map<string, number> | null {
  const [byId, setById] = useState<Map<string, string[]> | null>(null)
  useEffect(() => {
    void loadPuzzles().then((all) => setById(new Map(all.map((p) => [p.id, p.themes]))))
  }, [])
  return useMemo(() => {
    if (!byId) return null
    const m = new Map<string, number>()
    for (const id of solved) for (const t of byId.get(id) ?? []) m.set(t, (m.get(t) ?? 0) + 1)
    return m
  }, [byId, solved])
}

export function viewStep(s: RoadStep, p: Progress, solved: Map<string, number> | null): StepView {
  switch (s.kind) {
    case 'lesson': {
      const l = LESSONS.find((x) => x.id === s.id)!
      return { key: `l:${s.id}`, kind: 'Lesson', title: l.title, body: l.blurb, to: `/learn/lessons/${s.id}`, done: p.lessons.includes(s.id), state: `${l.steps.length} steps` }
    }
    case 'opening': {
      const o = OPENINGS.find((x) => x.id === s.id)!
      const st = p.openings[s.id]
      return { key: `o:${s.id}`, kind: 'Opening', title: o.name, body: o.blurb, to: `/learn/openings/${s.id}`, done: !!st, state: st ?? `${Math.ceil(o.line.length / 2)} moves` }
    }
    case 'endgame': {
      const d = ENDGAMES.find((x) => x.id === s.id)!
      return { key: `e:${s.id}`, kind: 'Endgame', title: d.title, body: firstSentence(d.lesson), to: `/learn/endgames/${s.id}`, done: p.endgames.includes(s.id), state: null }
    }
    case 'puzzles': {
      const n = solved?.get(s.theme) ?? 0
      const motif = MOTIFS.find((m) => m.theme === s.theme)
      return {
        key: `p:${s.theme}`,
        kind: 'Puzzles',
        title: THEME_TITLE.get(s.theme) ?? s.theme,
        body: motif ? `${motif.idea} Solve ${s.goal}.` : `Solve ${s.goal}.`,
        to: `/learn/puzzles?theme=${s.theme}`,
        done: n >= s.goal,
        state: solved ? `${Math.min(n, s.goal)} of ${s.goal}` : null,
      }
    }
    case 'rating':
      return {
        key: `r:${s.goal}`,
        kind: 'Rating',
        title: `Puzzle rating ${s.goal}`,
        body: `Mixed puzzles, every theme, until your puzzle rating reaches ${s.goal}. It proves the patterns stick when nobody tells you which one to look for.`,
        to: '/learn/puzzles',
        done: p.puzzleRating >= s.goal,
        state: `${p.puzzleRating} of ${s.goal}`,
      }
  }
}

export interface RoadmapView {
  stages: { stage: Stage; steps: StepView[]; done: number }[]
  total: number
  done: number
  /** The first step not yet done, and its stage. */
  next: { step: StepView; stage: Stage; index: number } | null
}

export function useRoadmap(): RoadmapView {
  const [p] = useProgress()
  const solved = useSolvedByTheme(p.solved)
  return useMemo(() => {
    let next: RoadmapView['next'] = null
    let total = 0
    let done = 0
    const stages = STAGES.map((stage) => {
      const steps = stage.steps.map((s) => viewStep(s, p, solved))
      steps.forEach((v, index) => {
        total++
        if (v.done) done++
        else next ??= { step: v, stage, index }
      })
      return { stage, steps, done: steps.filter((v) => v.done).length }
    })
    return { stages, total, done, next }
  }, [p, solved])
}
