import type { Color } from '../game/types'

/**
 * Endgame drills: a position, a goal, and Stockfish playing the other side
 * at full strength. Every position was checked with Stockfish 19 at depth 24
 * (win or draw as stated) before it went in.
 */
export type DrillGoal =
  | { kind: 'mate'; moves: number }
  | { kind: 'promote'; moves: number }
  | { kind: 'hold'; moves: number }

export interface EndgameDrill {
  id: string
  title: string
  side: Color
  fen: string
  goal: DrillGoal
  level: 'basic' | 'core' | 'advanced'
  lesson: string
  tips: string[]
}

export const ENDGAMES: EndgameDrill[] = [
  {
    id: 'queen-mate',
    title: 'Queen and king mate',
    side: 'w',
    fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
    goal: { kind: 'mate', moves: 20 },
    level: 'basic',
    lesson: 'Use the queen like a fence to squeeze the king to an edge, then bring your own king up to help deliver mate.',
    tips: ['Put the queen a knight’s move away from the enemy king to shrink its box.', 'Never leave the king with no moves unless it is in check: that is stalemate.', 'When the king is on the edge, walk your king over and mate.'],
  },
  {
    id: 'rook-mate',
    title: 'Rook and king mate',
    side: 'w',
    fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
    goal: { kind: 'mate', moves: 30 },
    level: 'basic',
    lesson: 'The rook cuts the king off along a rank or file; your king takes the opposition and the rook pushes the box one line smaller each time.',
    tips: ['Cut the king off with the rook first.', 'Bring your king in front of the enemy king (opposition), then check with the rook.', 'If the rook is attacked, move it to the far side along the same line.'],
  },
  {
    id: 'two-rooks',
    title: 'Two-rook ladder',
    side: 'w',
    fen: '8/8/3k4/8/8/8/8/R3K2R w - - 0 1',
    goal: { kind: 'mate', moves: 15 },
    level: 'basic',
    lesson: 'The rooks take turns checking, each one climbing a rank, until the king falls off the edge. Your king is not needed.',
    tips: ['One rook guards a rank, the other checks on the next rank.', 'If the king comes close to a rook, move that rook to the far side of the board.'],
  },
  {
    id: 'pawn-sixth',
    title: 'King on the sixth',
    side: 'w',
    fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
    goal: { kind: 'promote', moves: 12 },
    level: 'core',
    lesson: 'With your king on the sixth rank in front of its pawn, the pawn queens no matter whose move it is.',
    tips: ['Step the king to the side (f6 or d6) to gain the key square.', 'Push the pawn only when the king guards the square in front of it.', 'Watch for stalemate when the pawn reaches the seventh.'],
  },
  {
    id: 'key-squares',
    title: 'Key squares',
    side: 'w',
    fen: '8/5k2/8/8/3K4/3P4/8/8 w - - 0 1',
    goal: { kind: 'promote', moves: 20 },
    level: 'core',
    lesson: 'Lead with the king, not the pawn. Reach a key square two ranks in front of the pawn and the queen is guaranteed.',
    tips: ['The key squares for a d3 pawn are c5, d5 and e5.', 'King first: the pawn is safest when it walks behind its king.', 'Use the opposition to shoulder the enemy king away.'],
  },
  {
    id: 'lucena',
    title: 'Lucena: building the bridge',
    side: 'w',
    fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
    goal: { kind: 'promote', moves: 20 },
    level: 'advanced',
    lesson: 'The most important winning rook ending. Drive the king one more file away, then bring your rook to the fourth rank to block the checks: the bridge.',
    tips: ['Check the king away first: Rd1+.', 'Rook to the fourth rank (Rd4) before the king comes out.', 'Walk the king out toward the rook; when the checks stop, the rook interposes.'],
  },
  {
    id: 'opposition-defence',
    title: 'Defend with the opposition',
    side: 'b',
    fen: '8/8/8/3k4/8/3K4/3P4/8 w - - 0 1',
    goal: { kind: 'hold', moves: 20 },
    level: 'core',
    lesson: 'King and pawn against king is a draw when the defender keeps the opposition: kings facing each other with one square between, and the attacker to move.',
    tips: ['When White’s king steps sideways, step the same way.', 'Stay in front of the pawn.', 'On the back rank, go straight back in front of the pawn, not to the side.'],
  },
  {
    id: 'blockade',
    title: 'Blockade the pawn',
    side: 'b',
    fen: '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1',
    goal: { kind: 'hold', moves: 20 },
    level: 'basic',
    lesson: 'Your king stands in front of the pawn first. Keep it there and the pawn cannot pass.',
    tips: ['Block the square in front of the pawn.', 'Take the opposition whenever White’s king comes level with yours.'],
  },
  {
    id: 'catch-pawn',
    title: 'The square of the pawn',
    side: 'b',
    fen: '8/8/1k6/8/8/8/7P/6K1 b - - 0 1',
    goal: { kind: 'hold', moves: 15 },
    level: 'basic',
    lesson: 'Draw a square from the pawn to its queening rank. If your king can step inside it, you catch the pawn.',
    tips: ['Head straight for the queening corner on the diagonal.', 'Remember a pawn on its first rank can jump two squares.'],
  },
  {
    id: 'philidor',
    title: 'Philidor: the third-rank defence',
    side: 'b',
    fen: '4k3/R7/1r6/3KP3/8/8/8/8 b - - 0 1',
    goal: { kind: 'hold', moves: 25 },
    level: 'advanced',
    lesson: 'Keep your rook on your third rank so White’s king cannot advance. When the pawn steps forward, swing the rook to the back and check from behind.',
    tips: ['Rook stays on the sixth rank (your third) while the pawn is on the fifth.', 'When the pawn reaches the sixth, go to the first rank and check from behind.', 'Keep your king on the queening square.'],
  },
  {
    id: 'breakthrough',
    title: 'The pawn breakthrough',
    side: 'w',
    fen: '7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1',
    goal: { kind: 'promote', moves: 5 },
    level: 'core',
    lesson: 'Three pawns against three, kings far away. A sacrifice in the middle breaks through: whichever pawn takes, a neighbour runs to queen.',
    tips: ['Start with the middle pawn: b6!', 'If …axb6, play c6; if …cxb6, play a6. Sacrifice again so the last pawn is free.', 'The black king is too far to catch a pawn that has broken through.'],
  },
  {
    id: 'queen-pawn',
    title: 'Queen against a pawn on the seventh',
    side: 'w',
    fen: '8/1Q6/8/8/8/8/3pk3/7K w - - 0 1',
    goal: { kind: 'mate', moves: 25 },
    level: 'advanced',
    lesson: 'Check and pin until the black king has to step in front of its own pawn. That buys one free move: use it to bring your king a step closer, then repeat.',
    tips: ['Each time the king blocks d1, your king takes a step toward the pawn.', 'Checks from the side or on the diagonal force the king onto d1.', 'Once your king is close, win the pawn and mate with king and queen.'],
  },
  {
    id: 'two-bishops',
    title: 'Two-bishop mate',
    side: 'w',
    fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1',
    goal: { kind: 'mate', moves: 30 },
    level: 'advanced',
    lesson: 'Side by side, the bishops build a wall the king cannot cross. Push it to a corner with king and bishops together, then mate there.',
    tips: ['Keep the bishops next to each other, on adjacent diagonals.', 'Your king helps by taking squares in front of the enemy king.', 'Mate only comes in a corner; watch for stalemate when the king is almost trapped.'],
  },
  {
    id: 'bishop-knight',
    title: 'Bishop and knight mate',
    side: 'w',
    fen: '8/8/8/4k3/8/8/8/1N2KB2 w - - 0 1',
    goal: { kind: 'mate', moves: 50 },
    level: 'advanced',
    lesson: 'The hardest basic mate. Drive the king to the edge, then walk it along the edge to a corner of your bishop’s colour. The knight follows a W-shaped route to keep it from escaping.',
    tips: ['You can only mate in a corner the bishop controls: a light-squared bishop needs h1 or a8.', 'Use your king and knight together to push the king to an edge first.', 'Expect around thirty moves against good defence. Fifty is the hard limit.'],
  },
]
