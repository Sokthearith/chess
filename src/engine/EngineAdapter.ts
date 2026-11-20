/**
 * The engine boundary. The board and the game state never import anything
 * below this file except `createEngine()`.
 *
 * An adapter turns a FEN into an evaluation. The evaluation bar renders
 * whatever comes back; `null` means "no opinion" and the bar rests at even.
 */
export type Score =
  | { kind: 'cp'; value: number }
  /** `value` is plies to mate, positive when White mates. `value === 0` means the side in `mated` is already mated. */
  | { kind: 'mate'; value: number; mated?: 'w' | 'b' }

export type Evaluation = Score & {
  depth?: number
  bestMove?: string
  /** Principal variation in long algebraic, starting with `bestMove`. */
  pv?: string[]
  /** The engine's second choice, when asked for two lines (`multiPv: 2`). Null when there is only one legal move. */
  second?: (Score & { move?: string }) | null
}

export interface AnalyseOptions {
  depth?: number
  /** Milliseconds the engine may think. Ignored by adapters that cannot time-box. */
  movetime?: number
  /** How many lines to search. The second line's score lands in `Evaluation.second`. Default 1. */
  multiPv?: number
  /** Stockfish "Skill Level", 0 (weakest) to 20 (full strength). Default 20. */
  skill?: number
  signal?: AbortSignal
}

export interface EngineAdapter {
  readonly name: string
  /** Resolves once the engine is ready to accept positions. Safe to call twice. */
  init(): Promise<void>
  /** Evaluate a position from the side to move's point of view, normalised to White's. */
  analyse(fen: string, options?: AnalyseOptions): Promise<Evaluation | null>
  /** Abort the current search, if any. */
  stop(): void
  /** Release the worker. The adapter is unusable afterwards. */
  dispose(): void
}

/** Convert an evaluation to White's share of the bar, 0..1. */
export function evaluationToShare(ev: Evaluation | null): number {
  if (!ev) return 0.5
  if (ev.kind === 'mate') {
    if (ev.value === 0) return ev.mated === 'w' ? 0 : 1
    return ev.value > 0 ? 1 : 0
  }
  // Logistic curve: ±400cp ≈ 0.9 / 0.1. Matches what most GUIs draw.
  const share = 1 / (1 + Math.exp(-ev.value / 230))
  return Math.min(0.98, Math.max(0.02, share))
}

export function formatEvaluation(ev: Evaluation | null): string {
  if (!ev) return 'even'
  if (ev.kind === 'mate') return ev.value === 0 ? 'mate' : `M${Math.abs(ev.value)}`
  const pawns = ev.value / 100
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`
}
