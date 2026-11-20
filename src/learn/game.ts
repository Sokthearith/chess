import { useSyncExternalStore } from 'react'
import type { PieceType } from '../game/types'
import { getProgressSnapshot } from './progress'
import { toast } from './toasts'

/**
 * The game layer over learning: XP, levels, a daily goal and streak, daily
 * quests, personal bests. Built from what the research on gamified learning
 * supports (DESIGN.md §13): levels and streaks over points for their own sake,
 * XP that pays for new learning rather than repetition, personal bests instead
 * of a leaderboard, and a streak freeze so one missed day is not a punishment.
 *
 * Everything lives in this browser (localStorage `counterplay.game.v1`).
 */

/* ------------------------------------------------------------------ dates */

const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + n))
}

/* ----------------------------------------------------------------- levels */

export interface Rank {
  title: string
  piece: PieceType
  from: number
}

/** Every five levels the rank becomes the next piece up: pawn to king. */
export const RANKS: Rank[] = [
  { title: 'Pawn', piece: 'p', from: 1 },
  { title: 'Knight', piece: 'n', from: 5 },
  { title: 'Bishop', piece: 'b', from: 10 },
  { title: 'Rook', piece: 'r', from: 15 },
  { title: 'Queen', piece: 'q', from: 20 },
  { title: 'King', piece: 'k', from: 30 },
]

/** Total XP needed to reach a level: 0, 50, 150, 300, 500… each level 50 XP longer than the last. */
export const xpForLevel = (level: number) => 25 * level * (level - 1)

export interface LevelView {
  level: number
  rank: Rank
  /** XP into this level, and the size of the level. */
  into: number
  span: number
  toNext: number
}

export function levelOf(xp: number): LevelView {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  const rank = [...RANKS].reverse().find((r) => level >= r.from)!
  const floor = xpForLevel(level)
  const span = xpForLevel(level + 1) - floor
  return { level, rank, into: xp - floor, span, toNext: span - (xp - floor) }
}

/* ------------------------------------------------------------------ state */

export const GOALS = [
  { xp: 10, name: 'Casual' },
  { xp: 25, name: 'Regular' },
  { xp: 50, name: 'Serious' },
  { xp: 100, name: 'Intense' },
]

export interface GameState {
  xp: number
  /** XP earned per day. */
  days: Record<string, number>
  /** Per-day counters that quests read: puzzles, clean, xp, lessonSteps, theme:fork… */
  counts: Record<string, Record<string, number>>
  goal: number
  /** Streak freezes held (at most 2). One is earned every 7 days of streak. */
  freezes: number
  /** Days a freeze covered. */
  frozen: string[]
  /** Last day missed days were checked for freezes. */
  checked: string
  /** Badge id → when it was earned. */
  badges: Record<string, number>
  /** Personal bests: rush, streak. */
  best: Record<string, number>
  /** Quest ids already rewarded, per day. */
  claimed: Record<string, string[]>
  /** Lifetime counters. */
  totals: Record<string, number>
}

const KEY = 'counterplay.game.v1'
const listeners = new Set<() => void>()

/** First visit: turn learning already done into XP, so nobody starts at zero after weeks of puzzles. */
function seed(): GameState {
  const p = getProgressSnapshot()
  const openings = Object.values(p.openings)
  const carried =
    p.solved.length * 8 + p.lessons.length * 25 + openings.filter((v) => v === 'learned').length * 15 + openings.filter((v) => v === 'mastered').length * 45 + p.endgames.length * 30
  return {
    xp: carried,
    days: {},
    counts: {},
    goal: 25,
    freezes: 0,
    frozen: [],
    checked: dayKey(),
    badges: {},
    best: {},
    claimed: {},
    totals: { puzzles: p.solved.length, lessons: p.lessons.length, endgames: p.endgames.length, carried },
  }
}

function read(): GameState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...seed(), ...(JSON.parse(raw) as Partial<GameState>) }
  } catch {
    /* fall through */
  }
  return seed()
}

let state: GameState = read()

function save(next: GameState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode: lasts this visit */
  }
  for (const l of listeners) l()
}

export const getGame = () => state

export function useGame(): GameState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => state,
    () => state,
  )
}

/* ----------------------------------------------------------------- streak */

const metGoal = (s: GameState, day: string) => (s.days[day] ?? 0) >= s.goal || s.frozen.includes(day)

/** Days in a row with the goal met (or frozen). Today counts once it is met; until then the streak runs to yesterday. */
export function streakOf(s: GameState, today = dayKey()): number {
  let day = metGoal(s, today) ? today : addDays(today, -1)
  let n = 0
  while (metGoal(s, day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}

/**
 * Spend freezes on days missed since the last check, so a streak survives a day
 * off. Only days after the last active day are covered, oldest first, and only
 * while the streak behind them is worth keeping.
 */
function applyFreezes(s: GameState): GameState {
  const today = dayKey()
  if (s.checked === today) return s
  let next = { ...s, frozen: [...s.frozen], checked: today }
  const yesterday = addDays(today, -1)
  // Missed days between the last check and yesterday, oldest first.
  const missed: string[] = []
  for (let d = s.checked; d <= yesterday; d = addDays(d, 1)) if (!metGoal(next, d)) missed.push(d)
  const before = missed.length ? streakOf(next, addDays(missed[0], -1)) : 0
  if (before > 0 && missed.length <= next.freezes) {
    for (const d of missed) next.frozen.push(d)
    next = { ...next, freezes: next.freezes - missed.length }
    if (missed.length) toast({ kind: 'streak', title: `Streak frozen — ${missed.length} day${missed.length > 1 ? 's' : ''} covered`, sub: `${before}-day streak kept` })
  }
  return next
}

if (typeof window !== 'undefined') state = applyFreezes(state)

/* ----------------------------------------------------------------- quests */

export interface Quest {
  id: string
  title: string
  metric: string
  target: number
  xp: number
}

const QUEST_THEMES: [string, string][] = [
  ['fork', 'fork'],
  ['pin', 'pin'],
  ['skewer', 'skewer'],
  ['mateIn2', 'mate-in-two'],
  ['discoveredAttack', 'discovered attack'],
  ['hangingPiece', 'hanging piece'],
  ['backRankMate', 'back-rank mate'],
  ['deflection', 'deflection'],
]

/** A small seeded generator, so a day's quests are the same on every visit. */
function rng(seedText: string) {
  let h = 2166136261
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/** Three quests a day: one puzzle quest, one skill quest, one from the rest of the site. */
export function questsFor(day: string, goal: number): Quest[] {
  const r = rng(day)
  const pickOne = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const [theme, word] = pickOne(QUEST_THEMES)
  const puzzle = pickOne<Quest>([
    { id: 'solve', title: 'Solve 5 puzzles', metric: 'puzzles', target: 5, xp: 15 },
    { id: 'clean', title: 'Solve 3 puzzles without a mistake', metric: 'clean', target: 3, xp: 15 },
    { id: 'hard', title: 'Solve a puzzle rated above you', metric: 'hard', target: 1, xp: 20 },
  ])
  const skill = pickOne<Quest>([
    { id: `theme-${theme}`, title: `Solve 2 ${word} puzzles`, metric: `theme:${theme}`, target: 2, xp: 15 },
    { id: 'rush', title: 'Score 8 in Puzzle Rush', metric: 'rushBest', target: 8, xp: 20 },
    { id: 'pstreak', title: 'Reach 5 in Puzzle Streak', metric: 'streakBest', target: 5, xp: 20 },
  ])
  const other = pickOne<Quest>([
    { id: 'steps', title: 'Clear 3 lesson steps', metric: 'lessonSteps', target: 3, xp: 15 },
    { id: 'endgame', title: 'Win an endgame drill', metric: 'endgames', target: 1, xp: 20 },
    { id: 'opening', title: 'Play through an opening', metric: 'openings', target: 1, xp: 15 },
    { id: 'xp', title: `Earn ${Math.round(goal * 1.5)} XP`, metric: 'xp', target: Math.round(goal * 1.5), xp: 15 },
  ])
  return [puzzle, skill, other]
}

export const questProgress = (s: GameState, q: Quest, day = dayKey()) => Math.min(q.target, s.counts[day]?.[q.metric] ?? 0)

/* ------------------------------------------------------------------ award */

export interface Award {
  xp: number
  /** Counters to add to (today and lifetime). */
  add?: Record<string, number>
  /** Counters to raise to at least this value (today, and personal bests). */
  max?: Record<string, number>
  /** Short label for the toast: "Puzzle", "Lesson step". */
  label: string
}

/**
 * The one way XP is earned. Applies the XP and counters, then settles what
 * follows from them: level-ups, the daily goal, a new streak freeze, quests.
 */
export function award({ xp, add = {}, max = {}, label }: Award) {
  const day = dayKey()
  let s = applyFreezes(state)
  const levelBefore = levelOf(s.xp).level
  const metBefore = metGoal(s, day)
  const counts = { ...(s.counts[day] ?? {}) }
  const totals = { ...s.totals }
  for (const [k, v] of Object.entries(add)) {
    counts[k] = (counts[k] ?? 0) + v
    totals[k] = (totals[k] ?? 0) + v
  }
  for (const [k, v] of Object.entries(max)) counts[k] = Math.max(counts[k] ?? 0, v)
  counts.xp = (counts.xp ?? 0) + xp
  const best = { ...s.best }
  for (const [k, v] of Object.entries(max)) best[k] = Math.max(best[k] ?? 0, v)
  s = { ...s, xp: s.xp + xp, days: { ...s.days, [day]: (s.days[day] ?? 0) + xp }, counts: { ...s.counts, [day]: counts }, totals, best }
  if (xp > 0) toast({ kind: 'xp', title: `+${xp} XP`, sub: label, xp })

  // Quests: reward each once, the moment its counter reaches the target.
  const claimed = new Set(s.claimed[day] ?? [])
  let questXp = 0
  for (const q of questsFor(day, s.goal)) {
    if (claimed.has(q.id) || (counts[q.metric] ?? 0) < q.target) continue
    claimed.add(q.id)
    questXp += q.xp
    toast({ kind: 'quest', title: 'Quest complete', sub: `${q.title} — +${q.xp} XP` })
  }
  if (questXp) {
    const all = questsFor(day, s.goal).every((q) => claimed.has(q.id))
    const bonus = all ? 25 : 0
    if (all) toast({ kind: 'quest', title: 'All three quests done', sub: `+${bonus} XP bonus` })
    s = { ...s, xp: s.xp + questXp + bonus, days: { ...s.days, [day]: (s.days[day] ?? 0) + questXp + bonus }, claimed: { ...s.claimed, [day]: [...claimed] } }
  }

  // The daily goal, and the streak it extends.
  if (!metBefore && metGoal(s, day)) {
    const streak = streakOf(s, day)
    let freezes = s.freezes
    let sub = streak > 1 ? `${streak}-day streak` : 'Streak started'
    if (streak > 0 && streak % 7 === 0 && freezes < 2) {
      freezes++
      sub += ' — streak freeze earned'
    }
    s = { ...s, freezes, best: { ...s.best, dayStreak: Math.max(s.best.dayStreak ?? 0, streak) } }
    toast({ kind: 'goal', title: 'Daily goal reached', sub })
  }

  const after = levelOf(s.xp)
  if (after.level > levelBefore) {
    const promoted = after.rank.from === after.level && after.level > 1
    toast({ kind: 'level', title: `Level ${after.level}${promoted ? ` — you are a ${after.rank.title}` : ''}`, sub: promoted ? 'A new rank' : `${after.rank.title} rank` })
  }
  save(prune(s))
}

/** Keep two months of day logs and a fortnight of counters. */
function prune(s: GameState): GameState {
  const cut = addDays(dayKey(), -60)
  const cutCounts = addDays(dayKey(), -14)
  const days = Object.fromEntries(Object.entries(s.days).filter(([d]) => d >= cut))
  const counts = Object.fromEntries(Object.entries(s.counts).filter(([d]) => d >= cutCounts))
  const claimed = Object.fromEntries(Object.entries(s.claimed).filter(([d]) => d >= cutCounts))
  return { ...s, days, counts, claimed, frozen: s.frozen.filter((d) => d >= cut) }
}

export function setGoal(xp: number) {
  save({ ...state, goal: xp })
}

/** Record a badge as earned. Returns true the first time. */
export function markBadge(id: string): boolean {
  if (state.badges[id]) return false
  save({ ...state, badges: { ...state.badges, [id]: Date.now() } })
  return true
}

export function resetGame() {
  save({ ...seed(), xp: 0, totals: {} })
}

/* --------------------------------------------------------------- XP rules */

/** A first clean solve pays by difficulty against your rating; repeats and assisted solves pay little. */
export function puzzleXp(puzzleRating: number, playerRating: number, firstTime: boolean): number {
  if (!firstTime) return 2
  return Math.max(5, Math.min(20, 10 + Math.round((puzzleRating - playerRating) / 100) * 2))
}
