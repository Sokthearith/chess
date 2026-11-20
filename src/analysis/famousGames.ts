/**
 * Famous games to review: the classics every player meets sooner or later.
 * Moves are checked by `npm run check:famous` (chess.js replays each game
 * and confirms the mates that are claimed).
 */
export interface FamousGame {
  id: string
  /** The name the game is known by. */
  title: string
  white: string
  black: string
  /** Surnames used for the player filter. */
  players: string[]
  year: number
  event: string
  result: '1-0' | '0-1' | '1/2-1/2'
  era: 'romantic' | 'classical' | 'modern' | 'computer'
  story: string
  moves: string
  /** The last move delivers mate. */
  mate?: boolean
}

export const ERAS: { id: FamousGame['era']; title: string }[] = [
  { id: 'romantic', title: 'Romantic era, to 1880' },
  { id: 'classical', title: 'Classical, 1880–1945' },
  { id: 'modern', title: 'Modern, 1945–1995' },
  { id: 'computer', title: 'Engine age, 1995 on' },
]

export const FAMOUS_GAMES: FamousGame[] = [
  {
    id: 'legal-mate',
    title: 'Légal’s Mate',
    white: 'Kermur de Légal',
    black: 'Saint Brie',
    players: ['Légal'],
    year: 1750,
    event: 'Paris',
    result: '1-0',
    era: 'romantic',
    story: 'The oldest trap in the book: White gives up the queen to the pinning bishop and mates with three minor pieces.',
    moves: '1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5#',
    mate: true,
  },
  {
    id: 'immortal',
    title: 'The Immortal Game',
    white: 'Adolf Anderssen',
    black: 'Lionel Kieseritzky',
    players: ['Anderssen'],
    year: 1851,
    event: 'London, casual game',
    result: '1-0',
    era: 'romantic',
    story: 'Anderssen gives away a bishop, both rooks and his queen, then mates with the three minor pieces he has left.',
    moves:
      '1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7#',
    mate: true,
  },
  {
    id: 'evergreen',
    title: 'The Evergreen Game',
    white: 'Adolf Anderssen',
    black: 'Jean Dufresne',
    players: ['Anderssen'],
    year: 1852,
    event: 'Berlin, casual game',
    result: '1-0',
    era: 'romantic',
    story: 'An Evans Gambit that ends in a queen sacrifice and a mate with two bishops, still taught as the model attack.',
    moves:
      '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3 8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6 14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 Qxf3 20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8 24. Bxe7#',
    mate: true,
  },
  {
    id: 'opera',
    title: 'The Opera Game',
    white: 'Paul Morphy',
    black: 'Duke Karl / Count Isouard',
    players: ['Morphy'],
    year: 1858,
    event: 'Paris, Italian Opera House',
    result: '1-0',
    era: 'romantic',
    story: 'Played in a box at the opera. Morphy develops, opens lines and mates in 17 moves: the cleanest lesson in development ever played.',
    moves:
      '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#',
    mate: true,
  },
  {
    id: 'steinitz-bardeleben',
    title: 'Steinitz’s rook dance',
    white: 'Wilhelm Steinitz',
    black: 'Curt von Bardeleben',
    players: ['Steinitz'],
    year: 1895,
    event: 'Hastings',
    result: '1-0',
    era: 'classical',
    story: 'The first world champion keeps a rook on the seventh rank checking forever; Black, facing mate in ten, walked out of the hall.',
    moves:
      '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 d5 8. exd5 Nxd5 9. O-O Be6 10. Bg5 Be7 11. Bxd5 Bxd5 12. Nxd5 Qxd5 13. Bxe7 Nxe7 14. Re1 f6 15. Qe2 Qd7 16. Rac1 c6 17. d5 cxd5 18. Nd4 Kf7 19. Ne6 Rhc8 20. Qg4 g6 21. Ng5+ Ke8 22. Rxe7+ Kf8 23. Rf7+ Kg8 24. Rg7+ Kh8 25. Rxh7+',
  },
  {
    id: 'rubinstein-immortal',
    title: 'Rubinstein’s Immortal',
    white: 'Georg Rotlewi',
    black: 'Akiba Rubinstein',
    players: ['Rubinstein'],
    year: 1907,
    event: 'Lodz',
    result: '0-1',
    era: 'classical',
    story: 'Rubinstein leaves his queen to be taken and throws in both rooks; his bishops raking g2 and h2 decide everything.',
    moves:
      '1. d4 d5 2. Nf3 e6 3. e3 c5 4. c4 Nc6 5. Nc3 Nf6 6. dxc5 Bxc5 7. a3 a6 8. b4 Bd6 9. Bb2 O-O 10. Qd2 Qe7 11. Bd3 dxc4 12. Bxc4 b5 13. Bd3 Rd8 14. Qe2 Bb7 15. O-O Ne5 16. Nxe5 Bxe5 17. f4 Bc7 18. e4 Rac8 19. e5 Bb6+ 20. Kh1 Ng4 21. Be4 Qh4 22. g3 Rxc3 23. gxh4 Rd2 24. Qxd2 Bxe4+ 25. Qg2 Rh3',
  },
  {
    id: 'reti-tartakower',
    title: 'Réti’s queen sacrifice',
    white: 'Richard Réti',
    black: 'Savielly Tartakower',
    players: ['Réti', 'Tartakower'],
    year: 1910,
    event: 'Vienna, casual game',
    result: '1-0',
    era: 'classical',
    story: 'Eleven moves: White castles long, gives the queen on d8 and mates with a bishop.',
    moves: '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nf6 5. Qd3 e5 6. dxe5 Qa5+ 7. Bd2 Qxe5 8. O-O-O Nxe4 9. Qd8+ Kxd8 10. Bg5+ Kc7 11. Bd8#',
    mate: true,
  },
  {
    id: 'gold-coins',
    title: 'The Gold Coins Game',
    white: 'Stepan Levitsky',
    black: 'Frank Marshall',
    players: ['Marshall'],
    year: 1912,
    event: 'Breslau',
    result: '0-1',
    era: 'classical',
    story: 'Marshall puts his queen where three pieces can take it. Legend says the crowd showered the board with gold coins.',
    moves:
      '1. d4 e6 2. e4 d5 3. Nc3 c5 4. Nf3 Nc6 5. exd5 exd5 6. Be2 Nf6 7. O-O Be7 8. Bg5 O-O 9. dxc5 Be6 10. Nd4 Bxc5 11. Nxe6 fxe6 12. Bg4 Qd6 13. Bh3 Rae8 14. Qd2 Bb4 15. Bxf6 Rxf6 16. Rad1 Qc5 17. Qe2 Bxc3 18. bxc3 Qxc3 19. Rxd5 Nd4 20. Qh5 Ref8 21. Re5 Rh6 22. Qg5 Rxh3 23. Rc5 Qg3',
  },
  {
    id: 'lasker-thomas',
    title: 'The king hunt',
    white: 'Edward Lasker',
    black: 'George Alan Thomas',
    players: ['Lasker'],
    year: 1912,
    event: 'London, casual game',
    result: '1-0',
    era: 'classical',
    story: 'A queen sacrifice on h7 drags Black’s king all the way to g1, where a king move uncovers the rook for mate.',
    moves:
      '1. d4 e6 2. Nf3 f5 3. Nc3 Nf6 4. Bg5 Be7 5. Bxf6 Bxf6 6. e4 fxe4 7. Nxe4 b6 8. Ne5 O-O 9. Bd3 Bb7 10. Qh5 Qe7 11. Qxh7+ Kxh7 12. Nxf6+ Kh6 13. Neg4+ Kg5 14. h4+ Kf4 15. g3+ Kf3 16. Be2+ Kg2 17. Rh2+ Kg1 18. Kd2#',
    mate: true,
  },
  {
    id: 'avro-1938',
    title: 'Botvinnik at AVRO',
    white: 'Mikhail Botvinnik',
    black: 'José Raúl Capablanca',
    players: ['Botvinnik', 'Capablanca'],
    year: 1938,
    event: 'AVRO tournament, Rotterdam',
    result: '1-0',
    era: 'classical',
    story: 'A future champion beats a former one: a passed e-pawn, a bishop sacrifice on a3 and a knight sacrifice on h5.',
    moves:
      '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 d5 5. a3 Bxc3+ 6. bxc3 c5 7. cxd5 exd5 8. Bd3 O-O 9. Ne2 b6 10. O-O Ba6 11. Bxa6 Nxa6 12. Bb2 Qd7 13. a4 Rfe8 14. Qd3 c4 15. Qc2 Nb8 16. Rae1 Nc6 17. Ng3 Na5 18. f3 Nb3 19. e4 Qxa4 20. e5 Nd7 21. Qf2 g6 22. f4 f5 23. exf6 Nxf6 24. f5 Rxe1 25. Rxe1 Re8 26. Re6 Rxe6 27. fxe6 Kg7 28. Qf4 Qe8 29. Qe5 Qe7 30. Ba3 Qxa3 31. Nh5+ gxh5 32. Qg5+ Kf8 33. Qxf6+ Kg8 34. e7 Qc1+ 35. Kf2 Qc2+ 36. Kg3 Qd3+ 37. Kh4 Qe4+ 38. Kxh5 Qe2+ 39. Kh4 Qe4+ 40. g4 Qe1+ 41. Kh5',
  },
  {
    id: 'game-of-the-century',
    title: 'The Game of the Century',
    white: 'Donald Byrne',
    black: 'Bobby Fischer',
    players: ['Fischer', 'Byrne'],
    year: 1956,
    event: 'Rosenwald Memorial, New York',
    result: '0-1',
    era: 'modern',
    story: 'Thirteen-year-old Fischer gives up his queen with 17...Be6 and hunts the white king with a windmill of checks.',
    moves:
      '1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6 8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 Na4 12. Qa3 Nxc3 13. bxc3 Nxe4 14. Bxe7 Qb6 15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 18. Bxb6 Bxc4+ 19. Kg1 Ne2+ 20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1 26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1 Bd5 31. Nf3 Ne4 32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ 36. Kf1 Ng3+ 37. Ke1 Bb4+ 38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2#',
    mate: true,
  },
  {
    id: 'spassky-bronstein',
    title: 'From Russia with Love',
    white: 'Boris Spassky',
    black: 'David Bronstein',
    players: ['Spassky', 'Bronstein'],
    year: 1960,
    event: 'USSR Championship, Leningrad',
    result: '1-0',
    era: 'modern',
    story: 'A King’s Gambit with a knight sacrifice on f7. Its final position was used, slightly changed, in the James Bond film.',
    moves:
      '1. e4 e5 2. f4 exf4 3. Nf3 d5 4. exd5 Bd6 5. Nc3 Ne7 6. d4 O-O 7. Bd3 Nd7 8. O-O h6 9. Ne4 Nxd5 10. c4 Ne3 11. Bxe3 fxe3 12. c5 Be7 13. Bc2 Re8 14. Qd3 e2 15. Nd6 Nf8 16. Nxf7 exf1=Q+ 17. Rxf1 Bf5 18. Qxf5 Qd7 19. Qf4 Bf6 20. N3e5 Qe7 21. Bb3 Bxe5 22. Nxe5+ Kh7 23. Qe4+',
  },
  {
    id: 'fischer-benko',
    title: 'Fischer’s rook lift',
    white: 'Bobby Fischer',
    black: 'Pal Benko',
    players: ['Fischer', 'Benko'],
    year: 1963,
    event: 'US Championship, New York',
    result: '1-0',
    era: 'modern',
    story: '19.Rf6!!, a rook move into the heart of Black’s position. Two moves later Benko resigned.',
    moves:
      '1. e4 g6 2. d4 Bg7 3. Nc3 d6 4. f4 Nf6 5. Nf3 O-O 6. Bd3 Bg4 7. h3 Bxf3 8. Qxf3 Nc6 9. Be3 e5 10. dxe5 dxe5 11. f5 gxf5 12. Qxf5 Nd4 13. Qf2 Ne8 14. O-O Nd6 15. Qg3 Kh8 16. Qg4 c6 17. Qh5 Qe8 18. Bxd4 exd4 19. Rf6 Kg8 20. e5 h6 21. Ne2',
  },
  {
    id: 'fischer-spassky-6',
    title: 'Match of the Century, game 6',
    white: 'Bobby Fischer',
    black: 'Boris Spassky',
    players: ['Fischer', 'Spassky'],
    year: 1972,
    event: 'World Championship, Reykjavik',
    result: '1-0',
    era: 'modern',
    story: 'Fischer opens 1.c4 for almost the first time in his life and plays a Queen’s Gambit so pure that Spassky applauded.',
    moves:
      '1. c4 e6 2. Nf3 d5 3. d4 Nf6 4. Nc3 Be7 5. Bg5 O-O 6. e3 h6 7. Bh4 b6 8. cxd5 Nxd5 9. Bxe7 Qxe7 10. Nxd5 exd5 11. Rc1 Be6 12. Qa4 c5 13. Qa3 Rc8 14. Bb5 a6 15. dxc5 bxc5 16. O-O Ra7 17. Be2 Nd7 18. Nd4 Qf8 19. Nxe6 fxe6 20. e4 d4 21. f4 Qe7 22. e5 Rb8 23. Bc4 Kh8 24. Qh3 Nf8 25. b3 a5 26. f5 exf5 27. Rxf5 Nh7 28. Rcf1 Qd8 29. Qg3 Re7 30. h4 Rbb7 31. e6 Rbc7 32. Qe5 Qe8 33. a4 Qd8 34. R1f2 Qe8 35. R2f3 Qd8 36. Bd3 Qe8 37. Qe4 Nf6 38. Rxf6 gxf6 39. Rxf6 Kg8 40. Bc4 Kh8 41. Qf4',
  },
  {
    id: 'karpov-kasparov-16',
    title: 'The octopus knight',
    white: 'Anatoly Karpov',
    black: 'Garry Kasparov',
    players: ['Kasparov', 'Karpov'],
    year: 1985,
    event: 'World Championship, Moscow, game 16',
    result: '0-1',
    era: 'modern',
    story: 'A knight on d3 paralyses White for twenty moves. Kasparov won the title a few weeks later.',
    moves:
      '1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 5. Nb5 d6 6. c4 Nf6 7. N1c3 a6 8. Na3 d5 9. cxd5 exd5 10. exd5 Nb4 11. Be2 Bc5 12. O-O O-O 13. Bf3 Bf5 14. Bg5 Re8 15. Qd2 b5 16. Rad1 Nd3 17. Nab1 h6 18. Bh4 b4 19. Na4 Bd6 20. Bg3 Rc8 21. b3 g5 22. Bxd6 Qxd6 23. g3 Nd7 24. Bg2 Qf6 25. a3 a5 26. axb4 axb4 27. Qa2 Bg6 28. d6 g4 29. Qd2 Kg7 30. f3 Qxd6 31. fxg4 Qd4+ 32. Kh1 Nf6 33. Rf4 Ne4 34. Qxd3 Nf2+ 35. Rxf2 Bxd3 36. Rfd2 Qe3 37. Rxd3 Rc1 38. Nb2 Qf2 39. Nd2 Rxd1+ 40. Nxd1 Re1+',
  },
  {
    id: 'short-timman',
    title: 'Short’s king walk',
    white: 'Nigel Short',
    black: 'Jan Timman',
    players: ['Short', 'Timman'],
    year: 1991,
    event: 'Tilburg',
    result: '1-0',
    era: 'modern',
    story: 'With queens still on the board, White’s king marches h2–g3–f4–g5 to support a mating attack. Black resigns.',
    moves:
      '1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. Nf3 g6 5. Bc4 Nb6 6. Bb3 Bg7 7. Qe2 Nc6 8. O-O O-O 9. h3 a5 10. a4 dxe5 11. dxe5 Nd4 12. Nxd4 Qxd4 13. Re1 e6 14. Nd2 Nd5 15. Nf3 Qc5 16. Qe4 Qb4 17. Bc4 Nb6 18. b3 Nxc4 19. bxc4 Re8 20. Rd1 Qc5 21. Qh4 b6 22. Be3 Qc6 23. Bh6 Bh8 24. Rd8 Bb7 25. Rad1 Bg7 26. R8d7 Rf8 27. Bxg7 Kxg7 28. R1d4 Rae8 29. Qf6+ Kg8 30. h4 h5 31. Kh2 Rc8 32. Kg3 Rce8 33. Kf4 Bc8 34. Kg5',
  },
  {
    id: 'deep-blue-kasparov-6',
    title: 'Deep Blue’s decider',
    white: 'Deep Blue',
    black: 'Garry Kasparov',
    players: ['Kasparov', 'Deep Blue'],
    year: 1997,
    event: 'IBM rematch, New York, game 6',
    result: '1-0',
    era: 'computer',
    story: 'The first time a computer beat the world champion in a match. A knight sacrifice on e6 Kasparov knew was dangerous.',
    moves:
      '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nd7 5. Ng5 Ngf6 6. Bd3 e6 7. N1f3 h6 8. Nxe6 Qe7 9. O-O fxe6 10. Bg6+ Kd8 11. Bf4 b5 12. a4 Bb7 13. Re1 Nd5 14. Bg3 Kc8 15. axb5 cxb5 16. Qd3 Bc6 17. Bf5 exf5 18. Rxe7 Bxe7 19. c4',
  },
  {
    id: 'kasparov-topalov',
    title: 'Kasparov’s Immortal',
    white: 'Garry Kasparov',
    black: 'Veselin Topalov',
    players: ['Kasparov', 'Topalov'],
    year: 1999,
    event: 'Hoogovens, Wijk aan Zee',
    result: '1-0',
    era: 'computer',
    story: '24.Rxd4!! starts a combination that chases Black’s king from b6 to d1 across the whole board.',
    moves:
      '1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7',
  },
  {
    id: 'carlsen-ernst',
    title: 'Carlsen at thirteen',
    white: 'Magnus Carlsen',
    black: 'Sipke Ernst',
    players: ['Carlsen'],
    year: 2004,
    event: 'Corus C, Wijk aan Zee',
    result: '1-0',
    era: 'computer',
    story: 'A 13-year-old sacrifices a knight, a bishop and a rook to mate on d7. The game that made the world look twice.',
    moves:
      '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7 8. h5 Bh7 9. Bd3 Bxd3 10. Qxd3 e6 11. Bf4 Ngf6 12. O-O-O Be7 13. Ne4 Qa5 14. Kb1 O-O 15. Nxf6+ Nxf6 16. Ne5 Rad8 17. Qe2 c5 18. Ng6 fxg6 19. Qxe6+ Kh8 20. hxg6 Ng8 21. Bxh6 gxh6 22. Rxh6+ Nxh6 23. Qxe7 Nf7 24. gxf7 Kg7 25. Rd3 Rd6 26. Rg3+ Rg6 27. Qe5+ Kxf7 28. Qf5+ Rf6 29. Qd7#',
    mate: true,
  },
  {
    id: 'aronian-anand',
    title: 'Anand’s Wijk masterpiece',
    white: 'Levon Aronian',
    black: 'Viswanathan Anand',
    players: ['Anand', 'Aronian'],
    year: 2013,
    event: 'Tata Steel, Wijk aan Zee',
    result: '0-1',
    era: 'computer',
    story: 'Anand starts sacrificing on move 13 and keeps finding the only move until 23...Be3 leaves White without a defence.',
    moves:
      '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 e6 5. e3 Nbd7 6. Bd3 dxc4 7. Bxc4 b5 8. Bd3 Bd6 9. O-O O-O 10. Qc2 Bb7 11. a3 Rc8 12. Ng5 c5 13. Nxh7 Ng4 14. f4 cxd4 15. exd4 Bc5 16. Be2 Nde5 17. Bxg4 Bxd4+ 18. Kh1 Nxg4 19. Nxf8 f5 20. Ng6 Qf6 21. h3 Qxg6 22. Qe2 Qh5 23. Qd3 Be3',
  },
]

/** The game as a PGN, with the headers the review page reads. */
export function famousPgn(g: FamousGame): string {
  return [
    `[Event "${g.event}"]`,
    `[Date "${g.year}.??.??"]`,
    `[White "${g.white}"]`,
    `[Black "${g.black}"]`,
    `[Result "${g.result}"]`,
    '',
    `${g.moves} ${g.result}`,
  ].join('\n')
}

/** Players with their own filter chip: the world champions in the set, plus Morphy and Anderssen. Search finds everyone else. */
const HEADLINERS = ['Morphy', 'Anderssen', 'Steinitz', 'Capablanca', 'Botvinnik', 'Spassky', 'Fischer', 'Karpov', 'Kasparov', 'Anand', 'Carlsen']

/** The filter chips, in historical order, with how many games each has. */
export function famousPlayers(): { name: string; count: number }[] {
  return HEADLINERS.map((name) => ({ name, count: FAMOUS_GAMES.filter((g) => g.players.includes(name)).length })).filter((p) => p.count > 0)
}
