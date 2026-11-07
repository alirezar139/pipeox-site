#!/usr/bin/env node
/**
 * npm run dev — API (watch mode, :3000) + Angular dev server (:4200, proxies /api to the API).
 * One terminal, prefixed output, Ctrl+C stops both.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const envFile = new URL('../.env', import.meta.url);
if (!existsSync(envFile)) {
  console.error('No .env found — run `npm run setup` first.');
  process.exit(1);
}

// The project's .env wins over machine-wide variables (e.g. a global MONGODB_URI of another project)
const dotenv = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const procs = [
  { name: 'api', color: 36, cwd: `${root}api`, args: ['run', 'start:dev'] },
  { name: 'web', color: 35, cwd: `${root}web`, args: ['run', 'start'] },
].map(({ name, color, cwd, args }) => {
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd,
    shell: process.platform === 'win32',
    env: { ...process.env, ...dotenv, NODE_ENV: 'development', FORCE_COLOR: '1' },
  });
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream, out) => stream.on('data', (d) => out.write(d.toString().replace(/^(?=.)/gm, tag)));
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${tag}exited (${code})`);
    shutdown(code ?? 0);
  });
  return child;
});

let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const p of procs) if (!p.killed) p.kill();
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
