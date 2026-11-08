#!/usr/bin/env node
/**
 * npm run admin:user — create a panel user or reset its password, straight in the database.
 * Use it to recover access (forgotten password) or to add the first developer account.
 *
 * Unattended: PIPEOX_ADMIN_USER, PIPEOX_ADMIN_PASSWORD, PIPEOX_ADMIN_ROLE (admin|developer|support), PIPEOX_ADMIN_NAME.
 * The user's other sessions end when its password is reset.
 */
import { randomBytes, scrypt } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const ENV = fileURLToPath(new URL('../.env', import.meta.url));
if (!existsSync(ENV)) {
  console.error('No .env found — run `npm run setup` first.');
  process.exit(1);
}
const uri = readFileSync(ENV, 'utf8').match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim() || 'mongodb://127.0.0.1:27017/pipeox';
const { MongoClient } = createRequire(new URL('../api/package.json', import.meta.url))('mongodb');

const N = 1 << 15, R = 8, P = 1;
async function hash(pw) {
  const salt = randomBytes(16);
  const key = await promisify(scrypt)(pw.normalize('NFKC'), salt, 64, { N, r: R, p: P, maxmem: 128 * N * R * 2 });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : s.replace(/[^\r\n]/g, '*'));
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

const env = process.env;
let username = (env.PIPEOX_ADMIN_USER ?? (await ask('Username [admin]: ')) ?? '').toLowerCase() || 'admin';
if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
  console.error('Username: 3–40 lowercase letters, digits, . _ -');
  process.exit(1);
}

const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 8000 });
const admins = client.db().collection('admins');
const existing = await admins.findOne({ username });

let password = env.PIPEOX_ADMIN_PASSWORD ?? '';
while (password.length < 10) {
  password = await ask(`${existing ? 'New password' : 'Password'} for "${username}" (10+ characters): `, { hidden: true });
  if (password.length < 10) console.log('  Too short — use at least 10 characters.');
}

if (existing) {
  await admins.updateOne({ _id: existing._id }, { $set: { passwordHash: await hash(password), active: true, updatedAt: new Date() }, $inc: { tokenVersion: 1 } });
  console.log(`✔ Password of "${username}" (${existing.role}) updated; the account is active.`);
} else {
  let role = env.PIPEOX_ADMIN_ROLE ?? (await ask('Role — admin, developer or support [admin]: ')) ?? '';
  role = role || 'admin';
  if (!['admin', 'developer', 'support'].includes(role)) {
    console.error('Role must be admin, developer or support.');
    process.exit(1);
  }
  const name = env.PIPEOX_ADMIN_NAME ?? ((await ask('Display name: ')) || username);
  const now = new Date();
  await admins.insertOne({ username, name, role, passwordHash: await hash(password), active: true, tokenVersion: 0, createdAt: now, updatedAt: now });
  console.log(`✔ Created "${username}" (${role}).`);
}
await client.close();
