import { useEffect } from 'react'
import type { PieceType } from '../game/types'
import { ENDGAMES } from './endgames'
import { award, levelOf, markBadge, streakOf, useGame, type GameState } from './game'
import { LESSONS } from './lessons'
import { MOTIFS } from './motifs'
import { useProgress, type Progress } from './progress'
import { useRoadmap, useSolvedByTheme, type RoadmapView } from './roadmap'
import { toast } from './toasts'

/**
 * Achievements: each one names a real piece of chess progress (a rating, a
 * stage of the roadmap, a set of endings), so the badge tells you what you can
 * now do. They are derived from progress already kept, so work done before
 * badges existed counts.
 */
export interface Badge {
  id: string
  group: 'Puzzles' | 'Arcade' | 'Habit' | 'Study' | 'Roadmap' | 'Rank'
  title: string
  desc: string
  piece: PieceType
  /** Current value and target. */
  value: (c: Ctx) => number
  target: number
  /** Where the progress bar starts (puzzle ratings start at 1200, not 0). */
  from?: number
  /** Show progress as a percentage (roadmap stages). */
  percent?: boolean
  /** XP paid once when earned (roadmap stages). */
  bonus?: number
}

interface Ctx {
  p: Progress
  g: GameState
  road: RoadmapView
  byTheme: Map<string, number> | null
}

const MATE_THEMES = ['mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'backRankMate', 'smotheredMate', 'anastasiaMate', 'arabianMate', 'hookMate', 'bodenMate', 'doubleBishopMate', 'dovetailMate']
const motifThemes = new Set(MOTIFS.map((m) => m.theme))

const stage = (c: Ctx, id: string) => {
  const s = c.road.stages.find((x) => x.stage.id === id)
  return s ? s.done / s.steps.length : 0
}

export const BADGES: Badge[] = [
  { id: 'first-solve', group: 'Puzzles', title: 'First blood', desc: 'Solve your first puzzle.', piece: 'p', value: (c) => c.p.solved.length, target: 1 },
  { id: 'solver-25', group: 'Puzzles', title: 'Problem solver', desc: 'Solve 25 puzzles.', piece: 'n', value: (c) => c.p.solved.length, target: 25 },
  { id: 'solver-100', group: 'Puzzles', title: 'Tactician', desc: 'Solve 100 puzzles.', piece: 'b', value: (c) => c.p.solved.length, target: 100 },
  { id: 'solver-500', group: 'Puzzles', title: 'Puzzle machine', desc: 'Solve 500 puzzles.', piece: 'q', value: (c) => c.p.solved.length, target: 500 },
  { id: 'rating-1400', group: 'Puzzles', title: 'Club strength', desc: 'Reach a puzzle rating of 1400.', piece: 'n', value: (c) => c.p.puzzleRating, target: 1400, from: 1200 },
  { id: 'rating-1600', group: 'Puzzles', title: 'Sharp eye', desc: 'Reach a puzzle rating of 1600.', piece: 'b', value: (c) => c.p.puzzleRating, target: 1600, from: 1200 },
  { id: 'rating-1800', group: 'Puzzles', title: 'Expert vision', desc: 'Reach a puzzle rating of 1800.', piece: 'r', value: (c) => c.p.puzzleRating, target: 1800, from: 1200 },
  { id: 'rating-2000', group: 'Puzzles', title: 'Master tactics', desc: 'Reach a puzzle rating of 2000.', piece: 'q', value: (c) => c.p.puzzleRating, target: 2000, from: 1200 },
  { id: 'hot-hand', group: 'Puzzles', title: 'Hot hand', desc: 'Solve 10 rated puzzles in a row without a mistake.', piece: 'n', value: (c) => c.p.bestStreak, target: 10 },
  { id: 'collector', group: 'Puzzles', title: 'Pattern collector', desc: 'Solve puzzles in 10 different tactical themes.', piece: 'b', value: (c) => (c.byTheme ? [...c.byTheme.keys()].filter((t) => motifThemes.has(t)).length : 0), target: 10 },
  { id: 'mate-hunter', group: 'Puzzles', title: 'Mate hunter', desc: 'Solve 25 mating puzzles.', piece: 'k', value: (c) => (c.byTheme ? MATE_THEMES.reduce((n, t) => n + (c.byTheme!.get(t) ?? 0), 0) : 0), target: 25 },

  { id: 'rush-10', group: 'Arcade', title: 'Quick fingers', desc: 'Score 10 in Puzzle Rush.', piece: 'p', value: (c) => c.g.best.rushBest ?? 0, target: 10 },
  { id: 'rush-20', group: 'Arcade', title: 'Blitz brain', desc: 'Score 20 in Puzzle Rush.', piece: 'n', value: (c) => c.g.best.rushBest ?? 0, target: 20 },
  { id: 'rush-30', group: 'Arcade', title: 'Lightning', desc: 'Score 30 in Puzzle Rush.', piece: 'q', value: (c) => c.g.best.rushBest ?? 0, target: 30 },
  { id: 'streak-10', group: 'Arcade', title: 'Unbroken', desc: 'Reach 10 in Puzzle Streak.', piece: 'b', value: (c) => c.g.best.streakBest ?? 0, target: 10 },
  { id: 'streak-25', group: 'Arcade', title: 'Iron nerves', desc: 'Reach 25 in Puzzle Streak.', piece: 'r', value: (c) => c.g.best.streakBest ?? 0, target: 25 },

  { id: 'days-3', group: 'Habit', title: 'Warming up', desc: 'Meet your daily goal 3 days in a row.', piece: 'p', value: (c) => Math.max(c.g.best.dayStreak ?? 0, streakOf(c.g)), target: 3 },
  { id: 'days-7', group: 'Habit', title: 'A week of chess', desc: 'Meet your daily goal 7 days in a row.', piece: 'r', value: (c) => Math.max(c.g.best.dayStreak ?? 0, streakOf(c.g)), target: 7 },
  { id: 'days-30', group: 'Habit', title: 'Habit formed', desc: 'Meet your daily goal 30 days in a row.', piece: 'k', value: (c) => Math.max(c.g.best.dayStreak ?? 0, streakOf(c.g)), target: 30 },

  { id: 'first-lesson', group: 'Study', title: 'First lesson', desc: 'Finish a lesson.', piece: 'p', value: (c) => c.p.lessons.length, target: 1 },
  { id: 'all-lessons', group: 'Study', title: 'Well read', desc: `Finish all ${LESSONS.length} lessons.`, piece: 'b', value: (c) => c.p.lessons.length, target: LESSONS.length },
  { id: 'first-opening', group: 'Study', title: 'Opening move', desc: 'Learn your first opening line.', piece: 'p', value: (c) => Object.keys(c.p.openings).length, target: 1 },
  { id: 'repertoire', group: 'Study', title: 'Repertoire', desc: 'Master 5 openings from memory, no mistakes.', piece: 'n', value: (c) => Object.values(c.p.openings).filter((v) => v === 'mastered').length, target: 5 },
  { id: 'first-endgame', group: 'Study', title: 'Finisher', desc: 'Win an endgame drill against Stockfish.', piece: 'k', value: (c) => c.p.endgames.length, target: 1 },
  { id: 'rook-endings', group: 'Study', title: 'Lucena and Philidor', desc: 'Win both classic rook endings.', piece: 'r', value: (c) => ['lucena', 'philidor'].filter((id) => c.p.endgames.includes(id)).length, target: 2 },
  { id: 'all-endgames', group: 'Study', title: 'Endgame virtuoso', desc: `Complete all ${ENDGAMES.length} endgame drills.`, piece: 'q', value: (c) => c.p.endgames.length, target: ENDGAMES.length },

  { id: 'stage-foundations', group: 'Roadmap', title: 'Foundations laid', desc: 'Finish stage 1 of the roadmap.', piece: 'p', value: (c) => stage(c, 'foundations'), target: 1, percent: true, bonus: 100 },
  { id: 'stage-club', group: 'Roadmap', title: 'Club player', desc: 'Finish stage 2 of the roadmap.', piece: 'n', value: (c) => stage(c, 'club'), target: 1, percent: true, bonus: 150 },
  { id: 'stage-patterns', group: 'Roadmap', title: 'Pattern master', desc: 'Finish stage 3 of the roadmap.', piece: 'r', value: (c) => stage(c, 'patterns'), target: 1, percent: true, bonus: 200 },
  { id: 'stage-advanced', group: 'Roadmap', title: 'The whole road', desc: 'Finish stage 4 of the roadmap.', piece: 'k', value: (c) => stage(c, 'advanced'), target: 1, percent: true, bonus: 300 },

  { id: 'rank-knight', group: 'Rank', title: 'Knight', desc: 'Reach level 5.', piece: 'n', value: (c) => levelOf(c.g.xp).level, target: 5 },
  { id: 'rank-bishop', group: 'Rank', title: 'Bishop', desc: 'Reach level 10.', piece: 'b', value: (c) => levelOf(c.g.xp).level, target: 10 },
  { id: 'rank-rook', group: 'Rank', title: 'Rook', desc: 'Reach level 15.', piece: 'r', value: (c) => levelOf(c.g.xp).level, target: 15 },
  { id: 'rank-queen', group: 'Rank', title: 'Queen', desc: 'Reach level 20.', piece: 'q', value: (c) => levelOf(c.g.xp).level, target: 20 },
  { id: 'rank-king', group: 'Rank', title: 'King', desc: 'Reach level 30.', piece: 'k', value: (c) => levelOf(c.g.xp).level, target: 30 },
]

export interface BadgeView {
  badge: Badge
  value: number
  earned: boolean
  /** When it was recorded as earned. */
  at?: number
}

/** How far along a badge is, 0 to 1, from its own starting point. */
export function badgeFraction(v: BadgeView): number {
  const from = v.badge.from ?? 0
  return Math.max(0, Math.min(1, (v.value - from) / (v.badge.target - from)))
}

export function useBadges(): BadgeView[] {
  const [p] = useProgress()
  const g = useGame()
  const road = useRoadmap()
  const byTheme = useSolvedByTheme(p.solved)
  const c: Ctx = { p, g, road, byTheme }
  return BADGES.map((badge) => {
    const value = badge.value(c)
    return { badge, value, earned: value >= badge.target, at: g.badges[badge.id] }
  })
}

/**
 * Records badges as they are earned and announces them. Mounted on every learn
 * page. A first visit can unlock many at once (old progress): those arrive as
 * one summary instead of a flood.
 */
export function useBadgeWatcher() {
  const views = useBadges()
  const fresh = views.filter((v) => v.earned && !v.at)
  const sig = fresh.map((v) => v.badge.id).join(',')
  useEffect(() => {
    if (!fresh.length) return
    const newly = fresh.filter((v) => markBadge(v.badge.id))
    if (!newly.length) return
    if (newly.length > 3) toast({ kind: 'badge', title: `${newly.length} badges unlocked`, sub: 'See them on the Learn page' })
    else for (const v of newly) toast({ kind: 'badge', title: `Badge — ${v.badge.title}`, sub: v.badge.desc })
    const bonus = newly.reduce((n, v) => n + (v.badge.bonus ?? 0), 0)
    if (bonus) award({ xp: bonus, label: 'Roadmap stage complete' })
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
}
