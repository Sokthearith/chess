/**
 * Premove targets: the movement pattern of each piece, ignoring blockers.
 * Run with `npm run check:premove`.
 */
import { premoveTargets } from '../src/game/premove.ts'

let failed = 0
function check(name: string, fen: string, from: string, side: 'w' | 'b', expect: string[]) {
  const got = premoveTargets(fen, from, side)
    .map((t) => t.to)
    .sort()
  const want = [...expect].sort()
  const ok = got.join(' ') === want.join(' ')
  if (!ok) failed++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n       got  ${got.join(' ')}\n       want ${want.join(' ')}`}`)
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

check('knight on g1', START, 'g1', 'w', ['e2', 'f3', 'h3'])
check('pawn on e2: steps and both diagonals', START, 'e2', 'w', ['d3', 'e3', 'e4', 'f3'])
check('pawn on a2: one diagonal', START, 'a2', 'w', ['a3', 'a4', 'b3'])
check('black pawn on d7 while White is to move', AFTER_E4.replace(' b ', ' w '), 'd7', 'b', ['c6', 'd6', 'd5', 'e6'])
check('pawn off its start square: one step', AFTER_E4, 'e4', 'w', ['d5', 'e5', 'f5'])
check(
  'bishop on f1 sees through its own pawns',
  START,
  'f1',
  'w',
  ['e2', 'd3', 'c4', 'b5', 'a6', 'g2', 'h3'],
)
check(
  'rook on a1 sees the whole file and rank',
  START,
  'a1',
  'w',
  ['a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'],
)
check('king with both castling rights', START, 'e1', 'w', ['d1', 'd2', 'e2', 'f2', 'f1', 'g1', 'c1'])
check('king without castling rights', START.replace('KQkq', 'kq'), 'e1', 'w', ['d1', 'd2', 'e2', 'f2', 'f1'])
check("black king, only kingside right", START.replace('KQkq', 'Kk'), 'e8', 'b', ['d8', 'd7', 'e7', 'f7', 'f8', 'g8'])
check("the other side's piece: nothing", START, 'e7', 'w', [])
check('an empty square: nothing', START, 'e4', 'w', [])
check(
  'queen in the middle',
  '4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1',
  'd4',
  'w',
  [
    'a4', 'b4', 'c4', 'e4', 'f4', 'g4', 'h4',
    'd1', 'd2', 'd3', 'd5', 'd6', 'd7', 'd8',
    'a1', 'b2', 'c3', 'e5', 'f6', 'g7', 'h8',
    'a7', 'b6', 'c5', 'e3', 'f2', 'g1',
  ],
)

const caps = premoveTargets(START, 'b1', 'w')
if (caps.some((t) => t.capture)) {
  failed++
  console.log('  FAIL own pieces are not captures')
} else console.log('  ok   own pieces are not marked as captures')

console.log(failed ? `\n${failed} premove check(s) failed` : '\nall premove checks passed')
process.exit(failed ? 1 : 0)
