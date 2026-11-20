import type { AnalyseOptions, EngineAdapter, Evaluation, Score } from './EngineAdapter'

/**
 * Stockfish over UCI in a Web Worker.
 *
 * The worker file is any Stockfish.js build (`stockfish-19-lite-single.js`
 * by default, copied into /public/engine by `npm run engine:copy`) and its
 * .wasm must sit next to it. `VITE_ENGINE_WORKER` names the URL.
 *
 * Searches are serialised: a new `analyse` stops the running search and waits
 * for its `bestmove` before sending the next position, so an answer is never
 * matched to the wrong question. Nothing outside this file knows about UCI.
 */
export class StockfishWorkerEngine implements EngineAdapter {
  readonly name = 'stockfish'
  private worker: Worker | null = null
  private ready: Promise<void> | null = null
  private listeners = new Set<(line: string) => void>()
  /** Resolves when the search in flight has printed its bestmove. */
  private inFlight: Promise<unknown> = Promise.resolve()
  private multiPv = 1
  private skill = 20

  constructor(private readonly workerUrl: string) {}

  init(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = new Promise<void>((resolve, reject) => {
      try {
        this.worker = new Worker(this.workerUrl)
      } catch (err) {
        reject(err)
        return
      }
      this.worker.onmessage = (e: MessageEvent<string>) => {
        const line = typeof e.data === 'string' ? e.data : String(e.data)
        for (const l of this.listeners) l(line)
      }
      this.worker.onerror = (e) => reject(new Error(e.message || 'engine worker failed to load'))
      const onLine = (line: string) => {
        if (line === 'uciok') this.send('isready')
        if (line === 'readyok') {
          this.listeners.delete(onLine)
          resolve()
        }
      }
      this.listeners.add(onLine)
      this.send('uci')
    })
    return this.ready
  }

  analyse(fen: string, options: AnalyseOptions = {}): Promise<Evaluation | null> {
    const run = async (): Promise<Evaluation | null> => {
      await this.init()
      if (options.signal?.aborted) return null
      const multiPv = Math.max(1, options.multiPv ?? 1)
      if (multiPv !== this.multiPv) {
        this.send(`setoption name MultiPV value ${multiPv}`)
        this.multiPv = multiPv
      }
      const skill = Math.max(0, Math.min(20, Math.round(options.skill ?? 20)))
      if (skill !== this.skill) {
        this.send(`setoption name Skill Level value ${skill}`)
        this.skill = skill
      }
      return new Promise<Evaluation | null>((resolve) => {
        const whiteToMove = fen.split(' ')[1] !== 'b'
        const sign = whiteToMove ? 1 : -1
        // Latest complete line per multipv slot, White's point of view.
        const lines: { score: Score; depth: number; pv: string[] }[] = []
        const onLine = (line: string) => {
          if (line.startsWith('info ') && line.includes(' score ') && !line.includes('bound')) {
            const depth = Number(/ depth (\d+)/.exec(line)?.[1] ?? 0)
            const slot = Number(/ multipv (\d+)/.exec(line)?.[1] ?? 1) - 1
            const cp = / score cp (-?\d+)/.exec(line)
            const mate = / score mate (-?\d+)/.exec(line)
            const pv = / pv (.+)$/.exec(line)?.[1].trim().split(/\s+/) ?? []
            let score: Score | null = null
            if (mate) {
              const n = Number(mate[1])
              // "mate 0": the side to move is already mated.
              score = n === 0 ? { kind: 'mate', value: 0, mated: whiteToMove ? 'w' : 'b' } : { kind: 'mate', value: n * sign }
            } else if (cp) score = { kind: 'cp', value: Number(cp[1]) * sign }
            if (score) lines[slot] = { score, depth, pv }
          }
          if (line.startsWith('bestmove')) {
            this.listeners.delete(onLine)
            const best = line.split(' ')[1]
            const first = lines[0]
            if (!first) {
              resolve(null)
              return
            }
            const second = multiPv > 1 ? (lines[1] ? { ...lines[1].score, move: lines[1].pv[0] } : null) : undefined
            resolve({ ...first.score, depth: first.depth, bestMove: best, pv: first.pv, ...(second !== undefined ? { second } : {}) })
          }
        }
        this.listeners.add(onLine)
        options.signal?.addEventListener('abort', () => this.stop(), { once: true })
        this.send(`position fen ${fen}`)
        this.send(options.movetime ? `go movetime ${options.movetime}` : `go depth ${options.depth ?? 14}`)
      })
    }
    // Stop whatever is running, let it finish printing bestmove, then start.
    this.stop()
    const next = this.inFlight.then(run, run)
    this.inFlight = next.catch(() => undefined)
    return next
  }

  stop(): void {
    this.send('stop')
  }

  dispose(): void {
    this.send('quit')
    this.worker?.terminate()
    this.worker = null
    this.ready = null
    this.multiPv = 1
    this.skill = 20
    // Anyone still waiting gets an empty answer instead of hanging forever.
    for (const l of [...this.listeners]) l('bestmove (none)')
    this.listeners.clear()
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd)
  }
}
