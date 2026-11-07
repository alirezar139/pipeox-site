#!/usr/bin/env node
/**
 * Creates or updates /.env:
 *   npm run setup             → first-time setup (secrets + admin password + database address)
 *   npm run admin:password    → change only the admin password
 * Nothing secret is printed; .env is git-ignored.
 */
import { randomBytes, scrypt } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const ENV = fileURLToPath(new URL('../.env', import.meta.url));
const EXAMPLE = fileURLToPath(new URL('../.env.example', import.meta.url));
const onlyPassword = process.argv.includes('--admin-password');

const N = 1 << 15, R = 8, P = 1;
async function hash(pw) {
  const salt = randomBytes(16);
  const key = await promisify(scrypt)(pw.normalize('NFKC'), salt, 64, { N, r: R, p: P, maxmem: 128 * N * R * 2 });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : s.replace(/[^\r\n]/g, '*'));
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

/** Sets KEY=value in .env text, keeping comments and other keys. */
function setVar(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  return re.test(text) ? text.replace(re, () => line) : `${text.trimEnd()}\n${line}\n`;
}

let env = existsSync(ENV) ? readFileSync(ENV, 'utf8') : readFileSync(EXAMPLE, 'utf8');

// PIPEOX_ADMIN_PASSWORD / PIPEOX_MONGODB_URI allow unattended installs (CI, provisioning scripts)
let password = process.env.PIPEOX_ADMIN_PASSWORD ?? '';
while (password.length < 10) {
  password = await ask('Admin panel password (10+ characters): ', { hidden: true });
  if (password.length < 10) console.log('  Too short — use at least 10 characters.');
}
env = setVar(env, 'ADMIN_PASSWORD_HASH', await hash(password));

if (!onlyPassword) {
  if (!/^JWT_SECRET=.{32,}$/m.test(env)) env = setVar(env, 'JWT_SECRET', randomBytes(48).toString('base64url'));
  const current = env.match(/^MONGODB_URI=(.*)$/m)?.[1] || 'mongodb://127.0.0.1:27017/pipeox';
  const uri = process.env.PIPEOX_ADMIN_PASSWORD ? (process.env.PIPEOX_MONGODB_URI ?? '') : await ask(`MongoDB address [${current}]: `);
  env = setVar(env, 'MONGODB_URI', uri || current);
}

writeFileSync(ENV, env, { mode: 0o600 });
console.log(onlyPassword ? '✔ Admin password updated — restart the server to apply.' : '✔ .env is ready. Next: npm run dev  (or npm run build && npm start)');
