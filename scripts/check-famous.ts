/**
 * Replays every famous game with chess.js: each move must be legal, and a
 * game marked `mate` must end in checkmate. Run: npm run check:famous
 */
import { Chess } from 'chess.js'
import { FAMOUS_GAMES } from '../src/analysis/famousGames.ts'

let bad = 0
const ids = new Set<string>()
for (const g of FAMOUS_GAMES) {
  if (ids.has(g.id)) {
    console.error(`${g.id}: duplicate id`)
    bad++
  }
  ids.add(g.id)
  const c = new Chess()
  const sans = g.moves.replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter(Boolean)
  let ok = true
  for (const [i, san] of sans.entries()) {
    try {
      c.move(san)
    } catch {
      console.error(`${g.id}: illegal move ${i + 1} (${san}) in ${c.fen()}`)
      ok = false
      bad++
      break
    }
  }
  if (!ok) continue
  if (g.mate && !c.isCheckmate()) {
    console.error(`${g.id}: marked mate but the last position is not checkmate`)
    bad++
  }
  if (!g.mate && c.isCheckmate()) console.warn(`${g.id}: ends in mate but is not marked`)
  const lastMover = sans.length % 2 === 1 ? 'w' : 'b'
  if (g.mate && ((lastMover === 'w') !== (g.result === '1-0'))) {
    console.error(`${g.id}: mate by the wrong side for result ${g.result}`)
    bad++
  }
}
if (bad) {
  console.error(`${bad} problem(s)`)
  process.exit(1)
}
console.log(`ok: ${FAMOUS_GAMES.length} famous games replay cleanly`)
