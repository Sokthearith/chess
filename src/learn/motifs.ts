/**
 * Middlegame lessons: the tactical motifs and attacking patterns that decide
 * most games, each explained in a sentence or two and trained on real
 * positions from the lichess puzzle database tagged with that theme.
 */
export interface Motif {
  /** lichess theme tag. */
  theme: string
  title: string
  group: 'tactics' | 'mates' | 'attack' | 'technique'
  idea: string
  look: string
}

export const MOTIF_GROUPS: { id: Motif['group']; title: string }[] = [
  { id: 'tactics', title: 'Tactical motifs' },
  { id: 'mates', title: 'Mating patterns' },
  { id: 'attack', title: 'Attacking the king' },
  { id: 'technique', title: 'Calculation and technique' },
]

export const MOTIFS: Motif[] = [
  { theme: 'fork', title: 'Fork', group: 'tactics', idea: 'One piece attacks two things at once. Only one can be saved.', look: 'Knights fork best: look for a square that touches the king and the queen or a rook.' },
  { theme: 'pin', title: 'Pin', group: 'tactics', idea: 'A piece cannot move without exposing something more valuable behind it.', look: 'Pile up on the pinned piece; it cannot run.' },
  { theme: 'skewer', title: 'Skewer', group: 'tactics', idea: 'A pin in reverse: the valuable piece in front must move and the one behind falls.', look: 'Kings and queens on the same line as a rook or bishop of yours.' },
  { theme: 'discoveredAttack', title: 'Discovered attack', group: 'tactics', idea: 'Move one piece out of the way and the piece behind it attacks.', look: 'The piece that moves can make its own threat, so there are two at once.' },
  { theme: 'doubleCheck', title: 'Double check', group: 'tactics', idea: 'Two pieces give check at once. Only a king move can answer it.', look: 'A discovered check where the moving piece also checks.' },
  { theme: 'hangingPiece', title: 'Hanging piece', group: 'tactics', idea: 'Something is simply undefended. Take it.', look: 'Before every move, ask what your opponent’s last move left unprotected.' },
  { theme: 'trappedPiece', title: 'Trapped piece', group: 'tactics', idea: 'A piece with no safe squares can be attacked and won.', look: 'Bishops and knights deep in enemy territory, queens grabbing pawns.' },
  { theme: 'deflection', title: 'Deflection', group: 'tactics', idea: 'Force a defender away from the square or piece it guards.', look: 'One piece doing two jobs is overloaded.' },
  { theme: 'attraction', title: 'Attraction', group: 'tactics', idea: 'Lure a piece, often the king, onto a square where it can be hit.', look: 'A sacrifice that drags the king forward into a fork or a mate.' },
  { theme: 'capturingDefender', title: 'Remove the defender', group: 'tactics', idea: 'Capture the piece that holds everything together.', look: 'Trade off the knight or bishop guarding a key square.' },
  { theme: 'clearance', title: 'Clearance', group: 'tactics', idea: 'Move your own piece off a square or line so another piece can use it.', look: 'A piece in the way of your rook, queen or bishop.' },
  { theme: 'interference', title: 'Interference', group: 'tactics', idea: 'Put a piece between an enemy piece and what it defends.', look: 'Two enemy pieces guarding each other along a line.' },
  { theme: 'xRayAttack', title: 'X-ray', group: 'tactics', idea: 'A piece attacks or defends through another piece on the same line.', look: 'Lines with several pieces on them, especially rooks on a file.' },
  { theme: 'discoveredCheck', title: 'Discovered check', group: 'tactics', idea: 'The piece that moves away uncovers a check, so it is free to grab anything on its way.', look: 'Your piece standing between your rook, bishop or queen and the enemy king.' },
  { theme: 'intermezzo', title: 'In-between move', group: 'tactics', idea: 'Before the expected recapture, play a stronger move first, often a check or a threat.', look: 'Do not recapture on autopilot.' },
  { theme: 'mateIn1', title: 'Mate in one', group: 'mates', idea: 'Find the move that ends the game.', look: 'Checks first: every check, every time.' },
  { theme: 'mateIn2', title: 'Mate in two', group: 'mates', idea: 'A forcing move, then mate.', look: 'Checks and captures that leave the king no squares.' },
  { theme: 'mateIn3', title: 'Mate in three', group: 'mates', idea: 'Three forcing moves to mate.', look: 'Often a sacrifice opens the king first.' },
  { theme: 'mateIn4', title: 'Mate in four', group: 'mates', idea: 'A longer forcing sequence: every move a check or a threat that cannot be ignored.', look: 'Count the defender’s replies after each move; the fewer, the better.' },
  { theme: 'backRankMate', title: 'Back-rank mate', group: 'mates', idea: 'A king boxed in by its own pawns falls to a rook or queen on the back rank.', look: 'No luft (no h3/h6 escape square) and an undefended back rank.' },
  { theme: 'smotheredMate', title: 'Smothered mate', group: 'mates', idea: 'A knight mates a king surrounded by its own pieces.', look: 'Queen sacrifice on g8 or g1, then the knight on f7 or f2.' },
  { theme: 'arabianMate', title: 'Arabian mate', group: 'mates', idea: 'Rook and knight in the corner: the knight guards the rook and the escape square.', look: 'A king on h8 with a knight able to reach f6.' },
  { theme: 'operaMate', title: 'Opera mate', group: 'mates', idea: 'A rook mates on the back rank while a bishop guards the square next to it.', look: 'A bishop on the long diagonal or on g5 covering d8.' },
  { theme: 'pillsburysMate', title: 'Pillsbury’s mate', group: 'mates', idea: 'A rook on the g-file and a bishop on the long diagonal mate a king stuck on h8.', look: 'An open g-file and a bishop on b2 or c3.' },
  { theme: 'epauletteMate', title: 'Epaulette mate', group: 'mates', idea: 'The king’s own pieces sit on both sides of it like shoulder straps; one check from the front mates.', look: 'Rooks or pieces on both sides of a king on its back rank.' },
  { theme: 'kingsideAttack', title: 'Kingside attack', group: 'attack', idea: 'Bring more attackers than defenders to the castled king.', look: 'Open lines with pawn breaks and sacrifices on h7, g7 or f7.' },
  { theme: 'exposedKing', title: 'Exposed king', group: 'attack', idea: 'A king without pawn cover is a target for checks and forks.', look: 'Checks that drive the king into the open.' },
  { theme: 'sacrifice', title: 'Sacrifice', group: 'attack', idea: 'Give material for something bigger: mate, more material, or a winning attack.', look: 'When the opponent’s king is weak, count attackers, not pawns.' },
  { theme: 'attackingF2F7', title: 'Attacking f7', group: 'attack', idea: 'Early in the game f7 and f2 are guarded only by the king. That makes them the first target.', look: 'A bishop on c4 and a knight or queen that can reach f7.' },
  { theme: 'queensideAttack', title: 'Queenside attack', group: 'attack', idea: 'Attack where the opponent’s king or weaknesses live: on the queenside.', look: 'Open files and long diagonals toward a queenside-castled king.' },
  { theme: 'quietMove', title: 'Quiet move', group: 'technique', idea: 'The winning move is not a check or a capture: it prepares an unstoppable threat.', look: 'If nothing forcing works, ask what the opponent cannot stop.' },
  { theme: 'defensiveMove', title: 'Defensive move', group: 'technique', idea: 'Find the only move that saves the position.', look: 'Stop the threat first; counter-attack only if it is faster.' },
  { theme: 'zugzwang', title: 'Zugzwang', group: 'technique', idea: 'Every move makes things worse. Make your opponent move.', look: 'Most common in king and pawn endings.' },
  { theme: 'promotion', title: 'Promotion', group: 'technique', idea: 'A pawn queens and changes the game.', look: 'Deflect or block the piece that stops the pawn.' },
  { theme: 'advancedPawn', title: 'Advanced pawn', group: 'technique', idea: 'A pawn on the sixth or seventh rank ties the opponent down.', look: 'Use the threat to queen to win material elsewhere.' },
]

/** Endgame puzzle sets, by lichess theme. */
export const ENDGAME_THEMES: { theme: string; title: string }[] = [
  { theme: 'pawnEndgame', title: 'Pawn endings' },
  { theme: 'rookEndgame', title: 'Rook endings' },
  { theme: 'bishopEndgame', title: 'Bishop endings' },
  { theme: 'knightEndgame', title: 'Knight endings' },
  { theme: 'queenEndgame', title: 'Queen endings' },
  { theme: 'queenRookEndgame', title: 'Queen and rook endings' },
]
