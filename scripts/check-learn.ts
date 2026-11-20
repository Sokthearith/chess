/**
 * Replays every learning line through chess.js so a typo fails here, not in
 * front of a student: opening lines, step lessons (with their alternatives),
 * endgame FENs, and every id the roadmap points at.
 * Run with `npm run check:learn` (Node 23.6+ runs the TypeScript directly).
 */
import { readFileSync } from 'node:fs'
import { Chess } from 'chess.js'
import { OPENINGS } from '../src/learn/openings.ts'
import { LESSONS } from '../src/learn/lessons.ts'
import { ENDGAMES } from '../src/learn/endgames.ts'
import { MOTIFS, ENDGAME_THEMES } from '../src/learn/motifs.ts'

const errors: string[] = []
const fail = (where: string, why: string) => errors.push(`${where}: ${why}`)

for (const o of OPENINGS) {
  const c = new Chess()
  for (const [i, [san]] of o.line.entries()) {
    try {
      c.move(san)
    } catch {
      fail(`opening ${o.id}`, `move ${i + 1} ${san} is illegal`)
      break
    }
  }
}

for (const l of LESSONS) {
  for (const [i, s] of l.steps.entries()) {
    const where = `lesson ${l.id} step ${i + 1}`
    if (!s.fen === !s.from) fail(where, 'needs exactly one of fen or from')
    let c: Chess
    try {
      c = new Chess(s.fen)
      for (const m of s.from ?? []) c.move(m)
    } catch {
      fail(where, 'bad position')
      continue
    }
    const user = c.turn()
    let before = c.fen()
    for (const [j, san] of s.moves.entries()) {
      before = c.fen()
      try {
        c.move(san)
      } catch {
        fail(where, `line move ${san} is illegal`)
        break
      }
      if (j === 0 && c.history({ verbose: true }).at(-1)?.color !== user) fail(where, 'the line must start with the student’s move')
    }
    for (const alt of s.alt ?? []) {
      try {
        new Chess(before).move(alt)
      } catch {
        fail(where, `alternative ${alt} is illegal`)
      }
    }
    if (s.anyMate && !c.isCheckmate()) fail(where, 'anyMate is set but the line does not end in mate')
  }
}

for (const d of ENDGAMES) {
  try {
    const c = new Chess(d.fen)
    if (c.isGameOver()) fail(`endgame ${d.id}`, 'position is already over')
  } catch {
    fail(`endgame ${d.id}`, 'bad FEN')
  }
}

// The roadmap module imports React, so read its step calls as text.
const road = readFileSync(new URL('../src/learn/roadmap.ts', import.meta.url), 'utf8')
const themes = new Set([...MOTIFS.map((m) => m.theme), ...ENDGAME_THEMES.map((t) => t.theme)])
const known: Record<string, Set<string>> = {
  lesson: new Set(LESSONS.map((l) => l.id)),
  opening: new Set(OPENINGS.map((o) => o.id)),
  endgame: new Set(ENDGAMES.map((d) => d.id)),
  puzzles: themes,
}
let steps = 0
for (const [, kind, id] of road.matchAll(/\b(lesson|opening|endgame|puzzles)\('([^']+)'/g)) {
  steps++
  if (!known[kind].has(id)) fail('roadmap', `${kind} ${id} does not exist`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`ok: ${OPENINGS.length} openings, ${LESSONS.length} lessons (${LESSONS.reduce((n, l) => n + l.steps.length, 0)} steps), ${ENDGAMES.length} endgames, ${steps} roadmap steps`)
