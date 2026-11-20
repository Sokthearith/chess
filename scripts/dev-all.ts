/**
 * Runs the game server (with --watch) and Vite together; Ctrl+C stops both.
 * Run: npm run dev:all, then open http://localhost:5173
 */
import { spawn } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const kids = [spawn(npm, ['run', 'dev:server'], { stdio: 'inherit' }), spawn(npm, ['run', 'dev'], { stdio: 'inherit' })]
const stop = () => {
  for (const k of kids) k.kill('SIGTERM')
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
for (const k of kids) k.on('exit', stop)
