/**
 * Glicko-2 (Glickman, 2012), updated after every game as lichess does: each
 * game is its own rating period. Constants follow lichess where they differ
 * from the paper's examples.
 */

export interface Glicko {
  rating: number
  rd: number
  vol: number
  games: number
}

const SCALE = 173.7178
const TAU = 0.75
const EPS = 0.000001
const RD_MIN = 45
const RD_MAX = 350
export const PROVISIONAL_RD = 110

export const DEFAULT_GLICKO: Glicko = { rating: 1500, rd: RD_MAX, vol: 0.06, games: 0 }

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI))

/** One player's new rating after a game scored `score` (1, 0.5 or 0) against `opp`. */
export function update(me: Glicko, opp: Glicko, score: number): Glicko {
  const mu = (me.rating - 1500) / SCALE
  const phi = me.rd / SCALE
  const muJ = (opp.rating - 1500) / SCALE
  const phiJ = opp.rd / SCALE

  const gJ = g(phiJ)
  const e = 1 / (1 + Math.exp(-gJ * (mu - muJ)))
  const v = 1 / (gJ * gJ * e * (1 - e))
  const delta = v * gJ * (score - e)

  // New volatility by the Illinois algorithm (step 5 of the paper).
  const a = Math.log(me.vol * me.vol)
  const f = (x: number) => {
    const ex = Math.exp(x)
    const num = ex * (delta * delta - phi * phi - v - ex)
    const den = 2 * (phi * phi + v + ex) ** 2
    return num / den - (x - a) / (TAU * TAU)
  }
  let A = a
  let B: number
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v)
  else {
    let k = 1
    while (f(a - k * TAU) < 0) k++
    B = a - k * TAU
  }
  let fA = f(A)
  let fB = f(B)
  for (let i = 0; i < 100 && Math.abs(B - A) > EPS; i++) {
    const C = A + ((A - B) * fA) / (fB - fA)
    const fC = f(C)
    if (fC * fB <= 0) {
      A = B
      fA = fB
    } else fA /= 2
    B = C
    fB = fC
  }
  const vol = Math.exp(A / 2)

  const phiStar = Math.sqrt(phi * phi + vol * vol)
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v)
  const muNew = mu + phiNew * phiNew * gJ * (score - e)

  return {
    rating: Math.max(100, Math.min(3500, 1500 + muNew * SCALE)),
    rd: Math.max(RD_MIN, Math.min(RD_MAX, phiNew * SCALE)),
    vol: Math.min(vol, 0.1),
    games: me.games + 1,
  }
}
