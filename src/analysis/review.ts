import type { Evaluation, Score } from '../engine'
import type { Color } from '../game/types'
import { inCheck, largestHanging, sacrificeValue } from './classify'
import type { PgnMove } from './pgn'

export type Judgement =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'

/** Display order, best first. */
export const JUDGEMENTS: Judgement[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder']

export interface MoveReview {
  ply: number
  color: Color
  san: string
  judgement: Judgement
  /** Win probability for the mover before and after, 0..100. */
  winBefore: number
  winAfter: number
  /** Percentage points of winning chances given away. */
  loss: number
  accuracy: number
  /** Engine's preferred move in the position before, in long algebraic (e2e4). */
  bestMove?: string
  /** For book moves, the opening's ECO code and name. */
  opening?: string
  evalBefore: Evaluation | null
  evalAfter: Evaluation | null
}

export type SideSummary = { accuracy: number } & Record<Judgement, number>

export interface GameReview {
  evals: (Evaluation | null)[]
  moves: MoveReview[]
  white: SideSummary
  black: SideSummary
  depth: number
}

/** White's winning chances in percent, from a centipawn score. The curve lichess uses. */
export function winPercentFromCp(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1)
}

/** White's winning chances in percent from an evaluation. */
export function winPercent(ev: Score | null | undefined): number {
  if (!ev) return 50
  if (ev.kind === 'mate') {
    if (ev.value === 0) return ev.mated === 'w' ? 0 : 100
    return ev.value > 0 ? 100 : 0
  }
  return winPercentFromCp(ev.value)
}

/** Moves to mate for `side` in this evaluation (0 when `side` has just mated), or null if `side` is not mating. */
export function mateFor(ev: Score | null | undefined, side: Color): number | null {
  if (!ev || ev.kind !== 'mate') return null
  if (ev.value === 0) return ev.mated && ev.mated !== side ? 0 : null
  return ev.value > 0 === (side === 'w') ? Math.abs(ev.value) : null
}

/** Centipawns from `side`'s point of view, or null for a mate score. */
function cpFor(ev: Score | null | undefined, side: Color): number | null {
  if (!ev || ev.kind !== 'cp') return null
  return side === 'w' ? ev.value : -ev.value
}

const SEVERITY: Partial<Record<Judgement, number>> = { inaccuracy: 1, mistake: 2, miss: 2, blunder: 3 }
/** The harsher of two grades: a verdict never softens an existing one. */
function atLeast(current: Judgement, floor: Judgement): Judgement {
  return (SEVERITY[floor] ?? 0) > (SEVERITY[current] ?? 0) ? floor : current
}

/** The plain grade from winning chances lost. */
export function judge(loss: number, played: string, best?: string): Judgement {
  if (best && played === best) return 'best'
  if (loss >= 30) return 'blunder'
  if (loss >= 20) return 'mistake'
  if (loss >= 10) return 'inaccuracy'
  if (loss < 3) return 'excellent'
  return 'good'
}

export function moveAccuracy(loss: number): number {
  const a = 103.1668 * Math.exp(-0.04354 * Math.max(0, loss)) - 3.1669
  return Math.max(0, Math.min(100, a))
}

export interface ReviewInputs {
  moves: PgnMove[]
  evals: (Evaluation | null)[]
  depth: number
  /** Opening name per ply while the game is in book, null after it leaves. */
  book?: (string | null)[]
}

/**
 * Grades in priority order:
 * 1. book — the position after the move is on a named line, and every move before it was too;
 * 2. brilliant — a best or near-best move that offers at least two pawns of material, from a
 *    position that was not already won without it (judged by the engine's second choice), leaving
 *    the mover no worse than about half a pawn down;
 * 3. great — the engine's choice when its second choice is at least 15 points of winning chances
 *    worse: the only move. Mate in one, recaptures, replies to check and grabs of free material don't count;
 * 4. miss — the opponent's last move was a mistake or worse and this one hands at least 10 points
 *    of that back, without the mover ending up lost;
 * 5. otherwise best, excellent, good, inaccuracy, mistake or blunder by winning chances lost.
 * Mates and ties are judged by the engine's own terms, not by winning chances (which saturate at 100):
 * - a mating move, a move that keeps the fastest forced mate, or the engine's second line scoring the
 *   same as its first, is best;
 * - a sacrifice that is the only way to a forced mate can be brilliant even from a won position;
 * - walking into a forced mate the opponent did not have is a blunder;
 * - letting a forced mate slip while staying better is a miss.
 */
export interface GradeContext {
  /** The previous move (for recaptures). */
  prevMove?: { to: string } | null
  /** The previous move's review (for misses and free material). */
  prevReview?: MoveReview | null
  /** Opening name if this move is still in book. */
  opening?: string | null
}

/** Grade one move from the evaluations either side of it. Pure, so it runs per move as a review streams in, and on variations. */
export function gradeMove(m: PgnMove, before: Evaluation | null, after: Evaluation | null, ctx: GradeContext = {}): MoveReview {
  const wBefore = winPercent(before)
  const wAfter = winPercent(after)
  const mine = (w: number) => (m.color === 'w' ? w : 100 - w)
  const moverBefore = mine(wBefore)
  const moverAfter = mine(wAfter)
  const best = before?.bestMove
  // Score the played move from the same search as the best move whenever that search covered it:
  // two separate searches disagree by a few points even when the move is the engine's own choice.
  let loss: number
  if (best && m.lan === best) loss = 0
  else if (before?.second?.move && m.lan === before.second.move) loss = Math.max(0, moverBefore - mine(winPercent(before.second)))
  else loss = Math.max(0, moverBefore - moverAfter)

  let judgement = judge(loss, m.lan, best)
  const opening = ctx.opening ?? undefined
  const prev = ctx.prevReview ?? null
  const opp: Color = m.color === 'w' ? 'b' : 'w'
  const mateBefore = mateFor(before, m.color)
  const mateAfter = mateFor(after, m.color)
  // Ties and mates, judged on the engine's terms.
  const delivers = m.san.endsWith('#')
  const keepsFastestMate = mateBefore !== null && mateAfter !== null && mateAfter <= mateBefore - 1
  const tiesBest = Boolean(before?.second?.move) && m.lan === before!.second!.move && loss < 1
  if (delivers || keepsFastestMate || tiesBest) {
    judgement = 'best'
    loss = 0
  }

  if (opening) {
    judgement = 'book'
  } else if (before && after) {
    const nearBest = judgement === 'best' || judgement === 'excellent'
    const second = before.second
    const gap = second ? moverBefore - mine(winPercent(second)) : 0
    // A quiet only-move that leaves an attacked piece where it is (Fischer's 17...Be6) offers it as surely as moving it en prise.
    const leavesHanging = judgement === 'best' && !m.captured && !m.san.includes('+') && gap >= 15 ? largestHanging(m.fenAfter, m.color) : 0
    const sac = nearBest ? Math.max(sacrificeValue(m.fenBefore, m.fenAfter, m.to, m.color, m.captured), leavesHanging) : 0
    const recapture = Boolean(m.captured) && ctx.prevMove?.to === m.to
    const mates = m.san.endsWith('#')
    const freeMaterial = Boolean(m.captured) && sac === 0 && (prev?.judgement === 'blunder' || prev?.judgement === 'mistake')
    // From a won position a sacrifice only counts when it is the way to mate: no other line mates as fast.
    const secondMate = mateFor(second, m.color)
    const onlyWayToMate = mateBefore !== null && (judgement === 'best') && (secondMate === null || secondMate > mateBefore)
    // "Not already winning" is judged without the sacrifice: by the engine's second choice, when it has one.
    const withoutSac = second ? mine(winPercent(second)) : moverBefore
    // "Not in a bad position after": within about half a pawn of equal, by the deeper of the two readings.
    const standing = Math.max(moverAfter, moverBefore - loss)
    if (nearBest && sac >= 2 && (withoutSac < 95 || onlyWayToMate) && standing >= 45) {
      judgement = 'brilliant'
    } else if (judgement === 'best' && second && gap >= 15 && moverAfter >= 40 && !mates && !recapture && !freeMaterial && !inCheck(m.fenBefore)) {
      judgement = 'great'
    } else if ((judgement === 'inaccuracy' || judgement === 'mistake' || judgement === 'blunder') && prev && prev.loss >= 20 && moverAfter >= 35) {
      judgement = 'miss'
    }
    // Walking into a forced mate that was not there before: a blunder, softened only when the game was long lost
    // (the lichess rule: below -10 an inaccuracy, below -7 a mistake).
    if (mateFor(after, opp) !== null && mateFor(before, opp) === null) {
      const cp = cpFor(before, m.color)
      judgement = atLeast(judgement, cp !== null && cp < -999 ? 'inaccuracy' : cp !== null && cp < -700 ? 'mistake' : 'blunder')
    }
    // Letting a forced mate go: a miss while still winning big, a blunder if the advantage collapses.
    else if (mateBefore !== null && mateAfter === null) {
      const cp = cpFor(after, m.color)
      judgement = atLeast(judgement, cp !== null && cp > 700 ? 'miss' : 'blunder')
    }
  }

  return {
    ply: m.ply,
    color: m.color,
    san: m.san,
    judgement,
    winBefore: moverBefore,
    winAfter: moverAfter,
    loss,
    accuracy: moveAccuracy(loss),
    bestMove: best,
    opening,
    evalBefore: before,
    evalAfter: after,
  }
}

export function summarise(reviews: MoveReview[], c: Color): SideSummary {
  const own = reviews.filter((r) => r.color === c)
  const accuracy = own.length ? own.reduce((s, r) => s + r.accuracy, 0) / own.length : 0
  const counts = Object.fromEntries(JUDGEMENTS.map((j) => [j, own.filter((r) => r.judgement === j).length])) as Record<Judgement, number>
  return { accuracy, ...counts }
}

export function buildReview({ moves, evals, depth, book = [] }: ReviewInputs): GameReview {
  const reviews: MoveReview[] = []
  moves.forEach((m, i) => {
    reviews.push(gradeMove(m, evals[i] ?? null, evals[i + 1] ?? null, { prevMove: moves[i - 1], prevReview: reviews[i - 1], opening: book[i] }))
  })
  return { evals, moves: reviews, white: summarise(reviews, 'w'), black: summarise(reviews, 'b'), depth }
}

/** The move-list annotation. Book and the quiet grades have none. */
export const JUDGEMENT_MARK: Record<Judgement, string> = {
  brilliant: '!!',
  great: '!',
  best: '',
  excellent: '',
  good: '',
  book: '',
  inaccuracy: '?!',
  mistake: '?',
  miss: '×',
  blunder: '??',
}

export const JUDGEMENT_WORD: Record<Judgement, string> = {
  brilliant: 'brilliant',
  great: 'great move',
  best: 'best move',
  excellent: 'excellent',
  good: 'good move',
  book: 'book move',
  inaccuracy: 'inaccuracy',
  mistake: 'mistake',
  miss: 'miss',
  blunder: 'blunder',
}

/** Plural labels for the summary line. */
export const JUDGEMENT_PLURAL: Record<Judgement, string> = {
  brilliant: 'brilliant',
  great: 'great',
  best: 'best',
  excellent: 'excellent',
  good: 'good',
  book: 'book',
  inaccuracy: 'inaccuracies',
  mistake: 'mistakes',
  miss: 'misses',
  blunder: 'blunders',
}
