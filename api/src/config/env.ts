import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/**
 * The project root (holds .env, seed/, api/, web/). The API runs from api/ in
 * development and from the root in production, so paths are resolved from here.
 */
export const PROJECT_ROOT = [process.cwd(), path.resolve('..')].find((d) => existsSync(path.join(d, '.env.example'))) ?? process.cwd();
export const fromRoot = (p: string) => path.resolve(PROJECT_ROOT, p);

/**
 * Loads the project's .env into process.env, OVERRIDING inherited variables.
 * Generic names like MONGODB_URI or PORT are often set machine-wide for other projects;
 * this app must never pick those up by accident (it would read/write another database).
 * Tests (and special setups) set PIPEOX_ENV_FILE=none to supply variables themselves.
 */
export function loadEnvFile(): void {
  const file = process.env.PIPEOX_ENV_FILE ?? fromRoot('.env');
  if (file === 'none' || !existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

/**
 * Environment contract. Validated once at startup — the app refuses to boot with
 * missing or weak secrets instead of running insecurely. See /.env.example.
 */
const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PORT: z.coerce.number().int().positive().default(3000),
  /** Public address, e.g. https://pipeox.ir — canonical URLs, sitemap, emails. */
  SITE_URL: z.url().or(z.literal('')).default(''),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/pipeox'),
  /** Signs session cookies. 32+ random characters (npm run secret). */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /** scrypt hash of the admin password (npm run admin:password). */
  ADMIN_PASSWORD_HASH: z.string().startsWith('scrypt$', 'ADMIN_PASSWORD_HASH must come from npm run admin:password'),
  /** Uploads + inquiry attachments; keep outside the app folder and back it up. */
  DATA_DIR: z.string().default('../pipeox-data'),
  /** Number of reverse proxies in front of the app (nginx, panel) — for the real client IP. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default(''),
  /** Where new-inquiry emails go (comma-separated). */
  NOTIFY_EMAIL_TO: z.string().default(''),

  BALE_BOT_TOKEN: z.string().default(''),
  BALE_CHAT_ID: z.string().default(''),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_CHAT_ID: z.string().default(''),

  /* Online payment (Shaparak). A bank gateway is offered once its credentials are set. */
  MELLAT_TERMINAL_ID: z.string().default(''),
  MELLAT_USERNAME: z.string().default(''),
  MELLAT_PASSWORD: z.string().default(''),
  SAMAN_TERMINAL_ID: z.string().default(''),
  SADAD_MERCHANT_ID: z.string().default(''),
  SADAD_TERMINAL_ID: z.string().default(''),
  /** Base64 merchant key from Bank Melli (Sadad). */
  SADAD_KEY: z.string().default(''),
  /** Test gateway that approves or cancels without a bank. Never available in production. */
  PAYMENT_SANDBOX: bool,
}).refine((e) => !(e.PAYMENT_SANDBOX && e.NODE_ENV === 'production'), {
  message: 'PAYMENT_SANDBOX must be off in production',
  path: ['PAYMENT_SANDBOX'],
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration (.env):\n${lines.join('\n')}`);
  }
  return parsed.data;
}
