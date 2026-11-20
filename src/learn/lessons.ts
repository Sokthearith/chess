/**
 * Step lessons: short guided positions that teach one idea at a time, from
 * how the pawn moves up to classic sacrifices. Each step is a position and a
 * task; the student plays their moves, the other side's replies are made for
 * them. `npm run check:learn` replays every line through chess.js, and the
 * tactical steps were checked with Stockfish 19 (the solution is the best
 * move, every alternative listed in `alt` is as good) before they went in.
 */
export interface LessonStep {
  /** The task, as an order: "Capture the knight with the rook". */
  task: string
  /** Why it works: shown while the student looks for the move. */
  text: string
  /** The position. Either a FEN, or SAN moves from the starting position. */
  fen?: string
  from?: string[]
  /** The line in SAN from the position: the student's move first, replies made for them. */
  moves: string[]
  /** Other moves that also complete a one-move step (SAN). */
  alt?: string[]
  /** Any checkmating move completes the last move. */
  anyMate?: boolean
  /** A word once the step is done. */
  done?: string
}

export interface StepLesson {
  id: string
  title: string
  blurb: string
  steps: LessonStep[]
  /** What to carry into your games. */
  takeaways: string[]
}

export const LESSONS: StepLesson[] = [
  // ------------------------------------------------------------- Foundations
  {
    id: 'pawns',
    title: 'The board and the pawn',
    blurb: 'Files, ranks and the humblest piece: how a pawn moves, captures and becomes a queen.',
    takeaways: ['Columns are files (a–h), rows are ranks (1–8). Every square has a name: e4, d5.', 'A pawn moves straight forward, one square, or two from its starting square.', 'It captures one square diagonally forward and cannot move back.', 'On the last rank it promotes, almost always to a queen.'],
    steps: [
      {
        task: 'Push the e-pawn two squares',
        text: 'The board has eight files (a to h) and eight ranks (1 to 8). The pawn in front of your king stands on e2. From its starting square a pawn may move one or two squares straight ahead.',
        from: [],
        moves: ['e4'],
        done: 'e2 to e4: the most popular first move in chess.',
      },
      {
        task: 'Now one square forward',
        text: 'After its first move a pawn steps one square at a time, always forward, never back.',
        fen: '4k3/8/8/8/4P3/8/8/4K3 w - - 0 1',
        moves: ['e5'],
      },
      {
        task: 'Capture the knight',
        text: 'Pawns capture one square diagonally forward. The pawn on d5 blocks this pawn’s path, and a pawn can never capture straight ahead.',
        fen: '4k3/8/8/3pn3/3P4/8/8/4K3 w - - 0 1',
        moves: ['dxe5'],
        done: 'Pawn takes knight: a great trade for White.',
      },
      {
        task: 'Promote the pawn to a queen',
        text: 'A pawn that reaches the far rank must become a queen, rook, bishop or knight. The queen is the strongest, so it is nearly always the choice.',
        fen: '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1',
        moves: ['b8=Q+'],
        done: 'A new queen, and it gives check along the back rank.',
      },
    ],
  },
  {
    id: 'line-pieces',
    title: 'Rook, bishop and queen',
    blurb: 'The long-range pieces: straight lines, diagonals, and both at once.',
    takeaways: ['The rook moves along ranks and files.', 'The bishop moves diagonally and stays on one colour all game.', 'The queen moves like a rook and a bishop together.', 'None of them can jump: a piece in the way stops them.'],
    steps: [
      {
        task: 'Capture the knight with the rook',
        text: 'The rook moves any number of squares along a rank or a file, as long as nothing stands in the way.',
        fen: '4k3/8/n7/8/8/8/8/R3K3 w - - 0 1',
        moves: ['Rxa6'],
      },
      {
        task: 'Capture the piece the rook can reach',
        text: 'Pieces cannot jump. Your own pawn on d5 blocks the file, so the bishop on d8 is out of reach. Along the rank the way is clear.',
        fen: '3bk3/8/8/3P4/8/3R3n/P7/4K3 w - - 0 1',
        moves: ['Rxh3'],
      },
      {
        task: 'Capture the rook with the bishop',
        text: 'A bishop moves diagonally. This one stands on a dark square, c1, and will stay on dark squares for the whole game.',
        fen: '4k3/8/7r/8/8/8/1P6/2B1K3 w - - 0 1',
        moves: ['Bxh6'],
      },
      {
        task: 'Capture the knight with the queen',
        text: 'The queen combines the rook and the bishop: any distance, straight or diagonal. That is why she is worth about nine pawns.',
        fen: '4k3/8/8/7n/8/8/8/3QK3 w - - 0 1',
        moves: ['Qxh5'],
      },
    ],
  },
  {
    id: 'knight-king',
    title: 'Knight and king',
    blurb: 'The piece that jumps, and the piece you must never lose.',
    takeaways: ['The knight moves in an L: two squares one way, one square to the side. It jumps over anything.', 'A knight always lands on a square of the other colour.', 'The king moves one square in any direction.', 'The king may never move onto a square the opponent attacks.'],
    steps: [
      {
        task: 'Capture the bishop with the knight',
        text: 'A knight moves in an L shape: two squares in one direction, then one to the side. It is the only piece that jumps over others.',
        fen: '4k3/8/8/8/8/7b/5PPP/4K1N1 w - - 0 1',
        moves: ['Nxh3'],
      },
      {
        task: 'Fork the king and the rook',
        text: 'Find the square where the knight checks the king and attacks the rook at the same time. The king must move, and the rook falls.',
        fen: 'r3k3/8/8/1N6/8/8/7P/4K3 w - - 0 1',
        moves: ['Nc7+', 'Kd7', 'Nxa8'],
        done: 'A fork: one piece, two targets.',
      },
      {
        task: 'Capture the pawn that is not defended',
        text: 'The king moves one square in any direction, but never into attack. The d4 pawn is guarded by the pawn on c5, so taking it would walk into check. The f4 pawn has no guard.',
        fen: '4k3/8/8/2p5/3pKp2/8/8/8 w - - 0 1',
        moves: ['Kxf4'],
      },
    ],
  },
  {
    id: 'special-moves',
    title: 'Castling and en passant',
    blurb: 'Two special moves every player needs: tucking the king away, and the pawn capture nobody expects.',
    takeaways: ['Castle by moving the king two squares toward a rook; the rook jumps over to the other side.', 'You cannot castle out of check, through an attacked square, or after the king or that rook has moved.', 'En passant: a pawn that jumps two squares past an enemy pawn can be captured as if it moved one, on the very next move only.'],
    steps: [
      {
        task: 'Castle kingside',
        text: 'Move the king two squares toward the h1 rook (drag it to g1). The rook jumps to f1. Castling brings the king to safety and the rook toward the centre in one move.',
        from: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6'],
        moves: ['O-O'],
      },
      {
        task: 'Castle on the side that is allowed',
        text: 'The bishop on a6 watches f1. A king may not pass through an attacked square, so kingside castling is illegal here. Castle queenside: king to c1, rook to d1.',
        fen: 'r3k2r/ppp1qppp/b1n2n2/4p3/4P3/2N1BN2/PPPQ1PPP/R3K2R w KQkq - 0 9',
        moves: ['O-O-O'],
      },
      {
        task: 'Capture en passant',
        text: 'Black has just pushed d7-d5, jumping past your e5 pawn. On this move only, your pawn may capture it as if it had stopped on d6: move your pawn to d6.',
        fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
        moves: ['exd6'],
        done: 'En passant, “in passing”. Wait one move and the chance is gone.',
      },
    ],
  },
  {
    id: 'check-mate',
    title: 'Check, mate and stalemate',
    blurb: 'How games end: escaping check, delivering checkmate, and the stalemate trap.',
    takeaways: ['Check: the king is attacked. You must deal with it at once.', 'Three ways out: move the king, block the line, or capture the checking piece.', 'Checkmate: in check with no way out. The game is over.', 'Stalemate: not in check but with no legal move. The game is a draw.'],
    steps: [
      {
        task: 'Escape the check by capturing',
        text: 'Your king is in check from the queen. The queen stands right next to your king and nothing defends her, so the king can take her.',
        fen: '4k3/8/8/8/8/8/4q3/4K3 w - - 0 1',
        moves: ['Kxe2'],
      },
      {
        task: 'Block the check with a protected piece',
        text: 'The rook checks along the first rank and your king has no square. Put the bishop in the way, on the square your king protects, so the rook cannot simply take it.',
        fen: '6k1/5ppp/8/8/8/3B4/5PPP/r5K1 w - - 0 1',
        moves: ['Bf1'],
      },
      {
        task: 'Give checkmate',
        text: 'Black’s king is boxed in by its own pawns. A rook on the back rank gives a check that cannot be blocked, captured or escaped.',
        fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
        moves: ['Rd8#'],
        anyMate: true,
        done: 'The back-rank mate. Remember it from both sides.',
      },
      {
        task: 'Mate the king, without stalemate',
        text: 'Careful: a move like Qc7 takes away every square but gives no check. That is stalemate, a draw. Find a move that checks and leaves no escape.',
        fen: 'k7/8/1K6/2Q5/8/8/8/8 w - - 0 1',
        moves: ['Qc8#'],
        anyMate: true,
      },
    ],
  },
  {
    id: 'piece-values',
    title: 'What the pieces are worth',
    blurb: 'Pawn 1, knight 3, bishop 3, rook 5, queen 9: count before you capture.',
    takeaways: ['Pawn 1, knight 3, bishop 3, rook 5, queen 9. The king is beyond price.', 'Before capturing, ask: is it defended? What do I lose if they take back?', 'Trading equal pieces is fine. Giving more than you get needs a reason.'],
    steps: [
      {
        task: 'Win the most valuable piece',
        text: 'Your bishop can take a pawn on b5 or a rook on h7. Neither is defended. A rook is worth five pawns.',
        fen: '4k3/7r/8/1p6/8/3B4/6P1/4K3 w - - 0 1',
        moves: ['Bxh7'],
      },
      {
        task: 'Take what is free, not what is guarded',
        text: 'The d5 pawn is protected by the e6 pawn: Qxd5 exd5 loses the queen (9) for a pawn (1). The knight on a4 has no defender.',
        fen: '4k3/8/4p3/3p4/n7/8/8/3QK3 w - - 0 1',
        moves: ['Qxa4'],
      },
      {
        task: 'Take back: an even trade',
        text: 'Black’s bishop has just taken your knight. Bishop for knight is three for three, so recapture straight away. Qxf3 keeps your pawns healthy and points the queen at f7.',
        from: ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'Nc6', 'h3', 'Bxf3'],
        moves: ['Qxf3'],
        alt: ['gxf3'],
      },
    ],
  },

  // ------------------------------------------------------------- Club player
  {
    id: 'opening-principles',
    title: 'Opening principles',
    blurb: 'Centre, development, king safety. Three rules that make any opening playable.',
    takeaways: ['Put a pawn or two in the centre.', 'Develop knights and bishops toward the centre before moving any piece twice.', 'Castle early.', 'Do not bring the queen out early: it gets chased and you lose time.'],
    steps: [
      {
        task: 'Take the centre with a pawn',
        text: 'A centre pawn controls the key squares d5 and e5 (or e5 and c5) and opens lines for your bishop and queen.',
        from: [],
        moves: ['e4'],
        alt: ['d4'],
      },
      {
        task: 'Develop a knight toward the centre',
        text: 'Knights before bishops, and toward the middle. A knight on f3 attacks e5 and guards d4. “A knight on the rim is dim.”',
        from: ['e4', 'e5'],
        moves: ['Nf3'],
        alt: ['Nc3'],
      },
      {
        task: 'Develop a bishop to an active square',
        text: 'Bring the bishop out where it does something: on c4 it aims at f7, on b5 it presses the knight that defends e5.',
        from: ['e4', 'e5', 'Nf3', 'Nc6'],
        moves: ['Bc4'],
        alt: ['Bb5'],
      },
      {
        task: 'Castle',
        text: 'Two pieces out and the way is clear: castle now, before the centre opens. The king is safe and the rook joins the game.',
        from: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
        moves: ['O-O'],
      },
      {
        task: 'Develop with a threat to the queen',
        text: 'Black’s queen came out on move two. Develop a knight that attacks her: you gain a piece, and Black spends another move running.',
        from: ['e4', 'd5', 'exd5', 'Qxd5'],
        moves: ['Nc3'],
        done: 'Development with tempo: the punishment for an early queen.',
      },
    ],
  },
  {
    id: 'blunder-check',
    title: 'The blunder check',
    blurb: 'Before every move: what does my opponent threaten? Stop the trick before it happens.',
    takeaways: ['After every opponent move, ask: what does it attack? What does it threaten next?', 'Then check your own move: does it leave anything hanging, or allow a check?', 'Defend the threat first. Counter-attack only if yours is faster.'],
    steps: [
      {
        task: 'Stop the mate on f7',
        text: 'White’s queen and bishop both hit f7, and only your king defends it: Qxf7 would be mate. Block the queen with g6, which attacks her too, or add a defender to f7.',
        from: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4'],
        moves: ['g6'],
        alt: ['Qe7', 'Qf6', 'Nh6'],
        done: 'Scholar’s mate stopped. Now the queen must move and you develop with gain of time.',
      },
      {
        task: 'Your queen is attacked: put her somewhere safe',
        text: 'The knight on c6 hits your queen on d4. She must move, to a square where no piece can hit her again with a gain of time. On d5, for example, …Nf6 would chase her once more.',
        from: ['e4', 'e5', 'd4', 'exd4', 'Qxd4', 'Nc6'],
        moves: ['Qe3'],
        alt: ['Qa4', 'Qd3', 'Qc4', 'Qd2', 'Qd1'],
        done: 'Safe. Now ask the same question after every move.',
      },
      {
        task: 'Stop the mate on h2',
        text: 'Black’s queen and bishop both aim at h2: …Qxh2 would be mate. Bring the knight to f3, where it guards h2 and attacks the queen. Pushing h3 or g3 also blocks the attack.',
        fen: 'r4rk1/ppp2ppp/3b1n2/3p4/7q/3P4/PPPN1PPP/R1BQ1RK1 w - - 0 9',
        moves: ['Nf3'],
        alt: ['h3', 'g3'],
      },
    ],
  },

  // ------------------------------------------------------------- Patterns & plans
  {
    id: 'mating-patterns',
    title: 'Mating patterns',
    blurb: 'Five pictures every attacker carries in their head: smothered, Arabian, Anastasia, Boden and the epaulette.',
    takeaways: ['A king hemmed in by its own pieces needs only one checking piece to be mated.', 'Learn the picture, not the moves: knight plus rook, two bishops, queen in front of a boxed king.', 'Look at which squares around the king are already taken before you search for checks.'],
    steps: [
      {
        task: 'Smothered mate',
        text: 'The king is surrounded by its own rook and pawns. A knight check needs no help when the king has nowhere to go.',
        fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
        moves: ['Nf7#'],
        anyMate: true,
      },
      {
        task: 'Arabian mate',
        text: 'Rook and knight in the corner: the knight on f6 guards h7 and g8, so the rook can check from right next to the king.',
        fen: '7k/1R6/5N2/8/8/8/8/6K1 w - - 0 1',
        moves: ['Rh7#'],
        anyMate: true,
      },
      {
        task: 'Anastasia’s mate',
        text: 'The knight on e7 covers g8 and g6; the g7 pawn blocks the rest. A rook on the h-file finishes.',
        fen: '8/4N1pk/8/8/8/8/5K2/R7 w - - 0 1',
        moves: ['Rh1#'],
        anyMate: true,
      },
      {
        task: 'Boden’s mate',
        text: 'Two bishops on crossing diagonals. The f4 bishop covers b8 and c7; the other bishop checks from a6.',
        fen: '2kr4/p2n4/2p5/8/5B2/8/4B3/6K1 w - - 0 1',
        moves: ['Ba6#'],
        anyMate: true,
      },
      {
        task: 'Epaulette mate',
        text: 'Black’s rooks sit on either side of the king like shoulder straps and take away its squares. A queen check from in front ends it.',
        fen: '3rkr2/8/8/8/8/8/Q7/6K1 w - - 0 1',
        moves: ['Qe6#'],
        anyMate: true,
      },
    ],
  },
  {
    id: 'opposition',
    title: 'Kings and pawns: the opposition',
    blurb: 'In pawn endings a single tempo decides. Learn to take the opposition, defending and attacking, and to judge a pawn race at a glance.',
    takeaways: ['Opposition: kings facing each other with one square between. The side that must move gives way.', 'The defender stays in front of the pawn and takes the opposition.', 'The attacker leads with the king and keeps the pawn back until the king has made way.', 'The square of the pawn tells you at a glance whether a king can catch it.'],
    steps: [
      {
        task: 'Take the opposition (defending)',
        text: 'If White’s king reaches c6, d6 or e6, the pawn queens. Step straight in front of White’s king, with one square between. Now White must give way, and you shadow every step.',
        fen: '3k4/8/8/3K4/3P4/8/8/8 b - - 0 1',
        moves: ['Kd7'],
        done: 'Any other move lets White’s king onto the sixth rank and the pawn queens.',
      },
      {
        task: 'Take the opposition (attacking)',
        text: 'Now you are the attacker. Lead with the king, not the pawn: step right in front of Black’s king with one square between. Black must give way and your king walks forward.',
        fen: '8/8/3k4/8/2K5/8/3P4/8 w - - 0 1',
        moves: ['Kd4'],
        done: 'The only winning move. Every other move, pawn pushes included, lets Black hold the draw.',
      },
      {
        task: 'Step into the square of the pawn',
        text: 'Draw a square from the pawn to its queening rank: a4-d4-d8-a8. If your king can step inside it, it catches the pawn.',
        fen: '8/8/8/4k3/P7/8/8/6K1 b - - 0 1',
        moves: ['Kd5'],
        alt: ['Kd6', 'Kd4'],
      },
    ],
  },

  // ------------------------------------------------------------- Advanced
  {
    id: 'classic-sacrifices',
    title: 'Classic sacrifices',
    blurb: 'Give material to win more: the queen sacrifice before a smothered mate, the discovered check, the Greek gift.',
    takeaways: ['Forcing moves first: checks, captures, threats, in that order.', 'A sacrifice is a calculation, not a hope. See the end of the line before you give anything.', 'Discovered checks win material: the moving piece can go anywhere, even into attack.'],
    steps: [
      {
        task: 'Sacrifice the queen, mate with the knight',
        text: 'Both your queen and knight hit g8. Check there: the king cannot take, so the rook must, and then it smothers its own king.',
        fen: 'r6k/6pp/7N/8/2Q5/8/8/6K1 w - - 0 1',
        moves: ['Qg8+', 'Rxg8', 'Nf7#'],
        done: 'Philidor’s legacy: the oldest smothered mate on record.',
      },
      {
        task: 'Win the queen with a discovered check',
        text: 'The bishop is the only thing between your rook and the black king. Move it anywhere and it is check, so let it take something on the way.',
        fen: '4k3/7q/8/8/4B3/8/8/4R1K1 w - - 0 1',
        moves: ['Bxh7'],
        alt: ['Bg6+'],
        done: 'Black must answer the check first, so the queen is lost.',
      },
      {
        task: 'The Greek gift',
        text: 'The classic bishop sacrifice on h7. Bishop takes with check, the knight jumps to g5, and the queen joins on h5. The pawn on e5 keeps a black knight off f6, and the bishop on b4 is too far away to help.',
        fen: 'r1bq1rk1/pppn1ppp/2n1p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R1BQ1RK1 w - - 0 8',
        moves: ['Bxh7+', 'Kxh7', 'Ng5+'],
        done: 'The queen comes to h5 next, and Black’s king has no safe square left.',
      },
    ],
  },
]

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)
