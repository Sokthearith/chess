import { GLYPH_FONT, type PieceSetId } from '../board/pieceSets'

/**
 * Site themes. Each one swaps the whole look at once: palette, type, corners,
 * board squares and the piece set. Colours and type live in
 * src/styles/themes.css under [data-theme="<id>"]; this file holds what the
 * script needs: the piece set, the web fonts to fetch, and the theme's copy.
 */
export interface Theme {
  id: ThemeId
  name: string
  /** One line for the picker. */
  blurb: string
  pieces: PieceSetId
  scheme: 'light' | 'dark'
  /** Browser chrome colour (meta theme-color): the page background. */
  chrome: string
  /** Google Fonts css2 family queries (one stylesheet each), or null when index.html already loads them. */
  fonts: string | string[] | null
  /** Landing headline, a three-beat line ending in "your move". */
  headline: string
  /** What the board looks like, in a sentence. */
  boardLine: string
  /** The small print under the landing statement. */
  motto: string
  /** Footer colophon: what it is set in. */
  colophon: string
}

export type ThemeId =
  | 'typography'
  | 'clubhouse'
  | 'nightshift'
  | 'bauhaus'
  | 'arcade'
  | 'terminal'
  | 'blueprint'
  | 'tournament'
  | 'marble'
  | 'gazette'
  | 'popart'
  | 'sunset'
  | 'contrast'

export const THEMES: Theme[] = [
  {
    id: 'typography',
    name: 'Typography',
    blurb: 'Cream paper, black ink, one red. The poster.',
    pieces: 'silhouette',
    scheme: 'light',
    chrome: '#E8E4DC',
    fonts: null,
    headline: 'Paper, ink, your move.',
    boardLine: 'Cream and ink squares, silhouette pieces, nothing in between.',
    motto: 'No wood, no gloss.',
    colophon: 'Set in Anton and IBM Plex Mono.',
  },
  {
    id: 'clubhouse',
    name: 'Clubhouse',
    blurb: 'Maple and walnut, ivory and ebony, a serif on the scoresheet.',
    pieces: 'carved',
    scheme: 'light',
    chrome: '#F1EADC',
    fonts: 'family=Fraunces:opsz,wght@9..144,500;9..144,650&family=Source+Sans+3:wght@400;600&family=Source+Code+Pro:wght@500',
    headline: 'Wood, felt, your move.',
    boardLine: 'Maple and walnut squares with ivory and ebony men, like the club set.',
    motto: 'Touch move. Shake hands after.',
    colophon: 'Set in Fraunces and Source Sans.',
  },
  {
    id: 'nightshift',
    name: 'Night Shift',
    blurb: 'Neon on midnight. Pieces that glow.',
    pieces: 'neon',
    scheme: 'dark',
    chrome: '#0B0A16',
    fonts: 'family=Chakra+Petch:wght@600;700&family=Space+Grotesk:wght@400;500&family=JetBrains+Mono:wght@500',
    headline: 'Neon, midnight, your move.',
    boardLine: 'Midnight squares, pieces lit from inside: cyan for White, magenta for Black.',
    motto: 'One more game. Then sleep.',
    colophon: 'Set in Chakra Petch and Space Grotesk.',
  },
  {
    id: 'bauhaus',
    name: 'Bauhaus',
    blurb: 'Circle, square, triangle. Primary colours only.',
    pieces: 'geometric',
    scheme: 'light',
    chrome: '#F3EFE4',
    fonts: 'family=Outfit:wght@400;600;800&family=DM+Mono:wght@500',
    headline: 'Circle, square, your move.',
    boardLine: 'Blue and bone squares. Each piece is one shape: the pawn a circle, the rook a square, the bishop a triangle.',
    motto: 'Form follows function.',
    colophon: 'Set in Outfit and DM Mono.',
  },
  {
    id: 'arcade',
    name: 'Arcade',
    blurb: 'Pixel pieces on a handheld-green board.',
    pieces: 'pixel',
    scheme: 'dark',
    chrome: '#17112E',
    fonts: 'family=Pixelify+Sans:wght@400;700&family=Space+Mono:wght@400;700',
    headline: 'Insert coin, your move.',
    boardLine: 'Handheld-green squares and twelve-pixel pieces. No anti-aliasing.',
    motto: 'Player one, ready.',
    colophon: 'Set in Pixelify Sans and Space Mono.',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    blurb: 'Phosphor green on black. Pieces as letters.',
    pieces: 'letter',
    scheme: 'dark',
    chrome: '#070B07',
    fonts: 'family=VT323&family=IBM+Plex+Mono:wght@400;500',
    headline: '> cursor, prompt, your move_',
    boardLine: 'The board as the engine sees it: capitals for White, small letters for Black, just like a FEN string.',
    motto: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
    colophon: 'Set in VT323 and IBM Plex Mono.',
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    blurb: 'White line on drafting blue, a ruled grid under everything.',
    pieces: 'outline',
    scheme: 'dark',
    chrome: '#0F3460',
    fonts: 'family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700',
    headline: 'Line, grid, your move.',
    boardLine: 'A ruled grid on drafting blue, dark squares hatched. White pieces inked solid, Black pieces drawn in outline.',
    motto: 'Scale 1:1. Do not measure from drawing.',
    colophon: 'Set in Space Grotesk and Space Mono.',
  },
  {
    id: 'tournament',
    name: 'Tournament',
    blurb: 'The green roll-up board from every club night. Plain, calm, easy on the eyes.',
    pieces: 'glyph',
    scheme: 'light',
    chrome: '#F6F6F2',
    fonts: ['family=Archivo:wght@500;800&family=Inter:wght@400;500;600&family=Roboto+Mono:wght@500', GLYPH_FONT],
    headline: 'Clocks set, your move.',
    boardLine: 'Buff and green squares like a vinyl tournament board, with classic Staunton pieces.',
    motto: 'Shake hands. Start the clock.',
    colophon: 'Set in Archivo and Inter. Pieces from Noto Sans Symbols.',
  },
  {
    id: 'marble',
    name: 'Marble',
    blurb: 'Carrara and grey veined marble, gold leaf, a Garamond.',
    pieces: 'carved',
    scheme: 'light',
    chrome: '#F3F0EA',
    fonts: 'family=Cormorant+Garamond:wght@500;600;700&family=Karla:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500',
    headline: 'Stone, gold, your move.',
    boardLine: 'Veined white and grey marble squares; alabaster and onyx pieces picked out in gold.',
    motto: 'Made to outlast the players.',
    colophon: 'Set in Cormorant Garamond and Karla.',
  },
  {
    id: 'gazette',
    name: 'Gazette',
    blurb: 'The chess column in the Sunday paper. Hatched squares, diagram pieces.',
    pieces: 'glyph',
    scheme: 'light',
    chrome: '#F3EEE3',
    fonts: ['family=Playfair+Display:wght@700;900&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Courier+Prime:wght@400;700', GLYPH_FONT],
    headline: 'White to play and win.',
    boardLine: 'A printed diagram: plain light squares, dark squares cross-hatched in ink, the pieces as they appear in chess books.',
    motto: 'Solution on page 34.',
    colophon: 'Set in Playfair Display and Source Serif.',
  },
  {
    id: 'popart',
    name: 'Pop Art',
    blurb: 'Comic-book yellow, halftone dots, thick black outlines.',
    pieces: 'pop',
    scheme: 'light',
    chrome: '#FFE14D',
    fonts: 'family=Bangers&family=Nunito:wght@500;700;800&family=Space+Mono:wght@400;700',
    headline: 'Pow! Check! Your move!',
    boardLine: 'White and electric-blue squares with a heavy black frame. Pieces in bold outline with a hard shadow.',
    motto: 'Whaam! Mate in two.',
    colophon: 'Set in Bangers and Nunito.',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    blurb: 'Seventies warmth: burnt orange, mustard, chocolate brown.',
    pieces: 'silhouette',
    scheme: 'dark',
    chrome: '#2A1A15',
    fonts: 'family=Shrikhand&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=DM+Mono:wght@500',
    headline: 'Groovy, mellow, your move.',
    boardLine: 'Mustard and burnt-orange squares, cream and chocolate pieces, rounded off like a record sleeve.',
    motto: 'Side B: the endgame.',
    colophon: 'Set in Shrikhand and DM Sans.',
  },
  {
    id: 'contrast',
    name: 'High Contrast',
    blurb: 'Black, white and yellow at maximum contrast, a typeface designed for low vision.',
    pieces: 'silhouette',
    scheme: 'dark',
    chrome: '#000000',
    fonts: 'family=Atkinson+Hyperlegible:wght@400;700&family=IBM+Plex+Mono:wght@500',
    headline: 'Clear board, your move.',
    boardLine: 'White and mid-grey squares, thick outlines on every piece, yellow marks for moves and selection.',
    motto: 'Built to be read.',
    colophon: 'Set in Atkinson Hyperlegible.',
  },
]

export const DEFAULT_THEME: ThemeId = 'typography'

export const themeById = (id: string | null | undefined): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0]
