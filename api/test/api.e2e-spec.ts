/**
 * End-to-end API tests against the compiled app (dist-test/) and a throwaway database.
 * Run: npm run test:e2e   (needs MongoDB on MONGODB_URI_TEST or localhost)
 */
import express from 'express';
import mongoose from 'mongoose';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';

const DB = process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017/pipeox_e2e';
const ADMIN_PW = 'e2e-admin-password';
const dataDir = mkdtempSync(path.join(tmpdir(), 'pipeox-e2e-'));

// Same format as scripts/setup.mjs
const salt = randomBytes(16);
const key = scryptSync(ADMIN_PW, salt, 64, { N: 1 << 15, r: 8, p: 1, maxmem: 128 * (1 << 15) * 8 * 2 });
Object.assign(process.env, {
  PIPEOX_ENV_FILE: 'none', // never read the real .env (its database) during tests
  NODE_ENV: 'test',
  MONGODB_URI: DB,
  JWT_SECRET: randomBytes(32).toString('hex'),
  ADMIN_PASSWORD_HASH: ['scrypt', 1 << 15, 8, 1, salt.toString('base64'), key.toString('base64')].join('$'),
  DATA_DIR: dataDir,
  SMTP_HOST: '',
  PAYMENT_SANDBOX: 'true',
  BALE_BOT_TOKEN: '',
  TELEGRAM_BOT_TOKEN: '',
});

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]);
const H = { 'X-Requested-With': 'pipeox' };

let host: express.Express;
let close: () => Promise<void>;

beforeAll(async () => {
  await mongoose.connect(DB);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  // Own build folder (dist-test/), so running the tests never disturbs a running dev server (dist/)
  const { mountApi } = await import('../dist-test/bootstrap.js');
  host = express();
  const app = await mountApi(host);
  close = () => app.close();
}, 60_000);

afterAll(async () => {
  await close?.();
  await mongoose.connect(DB);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  rmSync(dataDir, { recursive: true, force: true });
});

/** Agent that keeps cookies, like a browser. */
const agent = () => request.agent(host);

/** A solved captcha — the API includes the answer only when NODE_ENV=test. */
async function cap() {
  const r = await request(host).get('/api/captcha').expect(200);
  return { captchaId: r.body.id as string, captcha: r.body.answer as string };
}

/** One admin session for the whole run — admin login is limited to 5 attempts per 15 minutes per IP. */
let admin: ReturnType<typeof agent> | null = null;
async function adminAgent() {
  if (!admin) {
    admin = agent();
    await admin.post('/api/admin/login').set(H).send({ username: 'admin', password: ADMIN_PW, ...(await cap()) }).expect(200);
  }
  return admin;
}

describe('public content (seeded on first start)', () => {
  it('serves settings, products, articles', async () => {
    const site = await request(host).get('/api/site').expect(200);
    expect(site.body.site.name).toBe('PIPEOX');
    const products = await request(host).get('/api/products').expect(200);
    expect(products.body.length).toBeGreaterThanOrEqual(4);
    expect(products.body[0].published).toBeUndefined();
    const articles = await request(host).get('/api/articles?limit=1').expect(200);
    expect(articles.body).toHaveLength(1);
    await request(host).get(`/api/articles/${articles.body[0].slug}`).expect(200);
  });

  it('serves sitemap.xml and robots.txt', async () => {
    const map = await request(host).get('/sitemap.xml').expect(200);
    expect(map.text).toContain('/products/steel-pipes</loc>');
    const robots = await request(host).get('/robots.txt').expect(200);
    expect(robots.text).toContain('Disallow: /admin');
  });

  it('answers 404 in Persian', async () => {
    const r = await request(host).get('/api/products/does-not-exist').expect(404);
    expect(r.body.message).toMatch(/[؀-ۿ]/);
  });
});

describe('panel users and roles', () => {
  it('adds users, keeps the System page developer-only, and ends sessions on role change', async () => {
    const a = await adminAgent();
    await a.get('/api/admin/system').expect(403); // "admin" role
    await a.post('/api/admin/users').set(H).send({ username: 'Dev.One', name: 'برنامه‌نویس', role: 'developer', password: 'short' }).expect(400);
    const dev = (await a.post('/api/admin/users').set(H).send({ username: 'Dev.One', name: 'برنامه‌نویس', role: 'developer', password: 'developer-pass-1' }).expect(201)).body;
    expect(dev).toMatchObject({ username: 'dev.one', role: 'developer', active: true });
    await a.post('/api/admin/users').set(H).send({ username: 'dev.one', name: 'تکراری', role: 'admin', password: 'developer-pass-1' }).expect(400);

    const d = agent();
    await d.post('/api/admin/login').set(H).send({ username: 'dev.one', password: 'developer-pass-1', ...(await cap()) }).expect(200);
    const sys = (await d.get('/api/admin/system').expect(200)).body;
    expect(sys.database.name).toBeTruthy();
    expect(JSON.stringify(sys)).not.toMatch(/JWT_SECRET|passwordHash|scrypt\$/);

    await a.patch(`/api/admin/users/${dev.id}`).set(H).send({ role: 'admin' }).expect(200);
    await d.get('/api/admin/dashboard').expect(401); // role change ended the developer's session

    const me = (await a.get('/api/admin/me').expect(200)).body.admin;
    await a.delete(`/api/admin/users/${me.id}`).set(H).expect(400); // cannot delete yourself
    await a.delete(`/api/admin/users/${dev.id}`).set(H).expect(200);
  });
});

describe('support role', () => {
  it('answers inquiries and chats, but cannot reach the rest of the panel', async () => {
    const a = await adminAgent();
    const sup = (await a.post('/api/admin/users').set(H).send({ username: 'support.one', name: 'پشتیبان', role: 'support', password: 'support-pass-1' }).expect(201)).body;
    expect(sup.role).toBe('support');

    const s = agent();
    await s.post('/api/admin/login').set(H).send({ username: 'support.one', password: 'support-pass-1', ...(await cap()) }).expect(200);

    // Allowed: inquiries, chats, own password
    await s.get('/api/admin/inquiries').expect(200);
    const chat = (await request(host).post('/api/chat').set(H).send({ text: 'Need a quote' }).expect(200)).body as { id: string };
    await s.get('/api/admin/chats').expect(200);
    await s.post(`/api/admin/chats/${chat.id}/messages`).set(H).send({ text: 'Sure, sending it now.' }).expect(200);
    await s.patch(`/api/admin/chats/${chat.id}`).set(H).send({ status: 'closed' }).expect(200);
    await s.post('/api/admin/password').set(H).send({ current: 'support-pass-1', password: 'support-pass-2' }).expect(200);

    // Refused: management, exports, deleting
    for (const path of ['/api/admin/dashboard', '/api/admin/products', '/api/admin/settings', '/api/admin/users', '/api/admin/customers', '/api/admin/inquiries/export.csv']) {
      await s.get(path).expect(403);
    }
    await s.delete(`/api/admin/chats/${chat.id}`).set(H).expect(403);
    await s.post('/api/admin/users').set(H).send({ username: 'evil', name: 'x', role: 'admin', password: 'evil-pass-123' }).expect(403);

    await a.delete(`/api/admin/chats/${chat.id}`).set(H).expect(200);
    await a.delete(`/api/admin/users/${sup.id}`).set(H).expect(200);
  });
});

describe('security', () => {
  it('rejects state-changing requests without the CSRF header', async () => {
    await request(host).post('/api/admin/login').send({ username: 'admin', password: ADMIN_PW }).expect(403);
  });

  it('rejects cross-site Origin', async () => {
    await request(host).post('/api/subscribers').set(H).set('Origin', 'https://evil.example').send({ email: 'a@b.co', ...(await cap()) }).expect(403);
  });

  it('protects admin routes', async () => {
    await request(host).get('/api/admin/dashboard').expect(401);
    await request(host).get('/api/admin/inquiries').expect(401);
    await request(host).post('/api/admin/products').set(H).send({}).expect(401);
  });

  it('rejects a wrong admin password and accepts the right one', async () => {
    await agent().post('/api/admin/login').set(H).send({ username: 'admin', password: 'wrong', ...(await cap()) }).expect(401);
    const a = await adminAgent();
    await a.get('/api/admin/dashboard').expect(200);
    const me = (await a.get('/api/admin/me').expect(200)).body;
    expect(me.admin).toMatchObject({ username: 'admin', role: 'admin' });
    expect(me.admin.passwordHash).toBeUndefined();
  });

  it('requires a correct, single-use captcha on forms', async () => {
    const missing = await agent().post('/api/auth/login').set(H).send({ email: 'x@y.co', password: 'whatever1' }).expect(400);
    expect(missing.body.field).toBe('captcha');
    const c = await cap();
    await agent().post('/api/auth/login').set(H).send({ email: 'x@y.co', password: 'whatever1', ...c, captcha: 'wrong' }).expect(400);
    await agent().post('/api/auth/login').set(H).send({ email: 'x@y.co', password: 'whatever1', ...c }).expect(400); // already used
    const fresh = await cap();
    await agent().post('/api/auth/login').set(H).send({ email: 'x@y.co', password: 'whatever1', ...fresh, captcha: fresh.captcha.toUpperCase() }).expect(401); // case-insensitive
    const img = await request(host).get('/api/captcha').expect(200);
    expect(img.body.svg).toMatch(/^<svg/);
    expect(img.body.svg).not.toContain('<text'); // glyphs are paths, not readable text
  });

  it('ends sessions after 30 idle minutes (cookie lifetime)', async () => {
    const r = await agent().post('/api/auth/register').set(H).send({ name: 'زمان', email: 'idle@example.com', phone: '09120000008', password: 'goodpass123', ...(await cap()) }).expect(201);
    expect(String(r.headers['set-cookie'])).toMatch(/Max-Age=1800;/);
  });

  it('locks out admin password guessing', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await agent().post('/api/admin/login').set(H).send({ username: 'admin', password: 'guess' + i, ...(await cap()) })).status);
    expect(statuses).toContain(429);
  });

  it('is not fooled by NoSQL operator injection on login', async () => {
    const r = await agent().post('/api/auth/login').set(H).send({ email: { $gt: '' }, password: { $gt: '' }, ...(await cap()) });
    expect(r.status).toBe(400);
  });

  it('sets httpOnly session cookies', async () => {
    const r = await agent().post('/api/auth/login').set(H).send({ email: 'nobody@example.com', password: 'whatever1', ...(await cap()) });
    expect(r.status).toBe(401);
    const reg = await agent().post('/api/auth/register').set(H).send({ name: 'کوکی', email: 'cookie@example.com', phone: '09120000009', password: 'goodpass123', ...(await cap()) });
    expect(String(reg.headers['set-cookie'])).toMatch(/pipeox_session=.*HttpOnly.*SameSite=Lax/i);
  });
});

describe('admin content management', () => {
  it('creates, updates and deletes a product; one product per homepage slot', async () => {
    const a = await adminAgent();
    const created = await a
      .post('/api/admin/products')
      .set(H)
      .send({ slug: 'test-pipe', title: 'لوله تست', orbit: 'a', specs: [{ label: 'استاندارد', value: 'API 5L' }] })
      .expect(201);
    await request(host).get('/api/products/test-pipe').expect(200);
    const others = (await request(host).get('/api/products').expect(200)).body.filter((p: { orbit: string }) => p.orbit === 'a');
    expect(others).toHaveLength(1);
    await a.post('/api/admin/products').set(H).send({ slug: 'test-pipe', title: 'تکراری' }).expect(409);
    await a.post('/api/admin/products').set(H).send({ slug: 'Bad Slug!', title: 'x x' }).expect(400);
    await a.delete(`/api/admin/products/${created.body._id}`).set(H).expect(200);
    await request(host).get('/api/products/test-pipe').expect(404);
  });

  it('sanitizes article HTML and hides scheduled articles', async () => {
    const a = await adminAgent();
    await a
      .post('/api/admin/articles')
      .set(H)
      .send({
        slug: 'xss-test',
        title: 'آزمون امنیت',
        body: '<h2 onclick="alert(1)">تیتر</h2><script>alert(1)</script><a href="javascript:alert(1)">بد</a><a href="https://x.co">خوب</a><img src="x" onerror="alert(1)"><iframe src="https://evil"></iframe>',
      })
      .expect(201);
    const body = (await request(host).get('/api/articles/xss-test').expect(200)).body.body as string;
    expect(body).not.toMatch(/onclick|onerror|<script|javascript:|<iframe/);
    expect(body).toContain('<h2>تیتر</h2>');
    expect(body).toContain('rel="noopener nofollow"');

    await a.post('/api/admin/articles').set(H).send({ slug: 'future', title: 'زمان‌بندی‌شده', publishedAt: '2099-01-01' }).expect(201);
    await request(host).get('/api/articles/future').expect(404);
  });

  it('accepts real images and rejects disguised files', async () => {
    const a = await adminAgent();
    const ok = await a.post('/api/admin/uploads').set(H).attach('image', JPEG, 'photo.jpg').expect(201);
    expect(ok.body.url).toMatch(/^\/api\/media\/[a-f0-9]{24}\.jpg$/);
    const served = await request(host).get(ok.body.url).expect(200);
    expect(served.headers['content-type']).toBe('image/jpeg');
    await a.post('/api/admin/uploads').set(H).attach('image', Buffer.from('<?php echo 1; ?>'), 'shell.jpg').expect(415);
    await request(host).get('/api/media/..%2F..%2Fetc%2Fpasswd').expect(404);
  });

  it('validates settings', async () => {
    const a = await adminAgent();
    const { settings } = (await a.get('/api/admin/settings').expect(200)).body;
    await a.put('/api/admin/settings').set(H).send({ ...settings, site: { ...settings.site, url: 'not a url' } }).expect(400);
    await a.put('/api/admin/settings').set(H).send({ ...settings, hero: { ...settings.hero, title: 'عنوان جدید' } }).expect(200);
    expect((await request(host).get('/api/site').expect(200)).body.hero.title).toBe('عنوان جدید');
  });
});

describe('customer accounts and inquiries', () => {
  const customer = { name: 'مشتری تست', email: 'Buyer@Example.com', phone: '۰۹۱۲۱۲۳۴۵۶۷', password: 'goodpass123' };

  it('registers, links inquiries to the account, and shows status without internal notes', async () => {
    const c = agent();
    await c.post('/api/auth/register').set(H).send({ ...customer, password: 'short', ...(await cap()) }).expect(400);
    const reg = await c.post('/api/auth/register').set(H).send({ ...customer, ...(await cap()) }).expect(201);
    expect(reg.body.user.email).toBe('buyer@example.com');
    expect(reg.body.user.phone).toBe('09121234567');
    await agent().post('/api/auth/register').set(H).send({ ...customer, ...(await cap()) }).expect(400); // duplicate (case-insensitive)

    const k = await cap();
    await c.post('/api/inquiries').set(H).field('captchaId', k.captchaId).field('captcha', k.captcha).field('name', customer.name).field('phone', '09121234567').field('details', '۱۰۰ متر لوله').expect(200);
    const mine = (await c.get('/api/account/inquiries').expect(200)).body;
    expect(mine).toHaveLength(1);

    const a = await adminAgent();
    const list = (await a.get('/api/admin/inquiries').expect(200)).body.items;
    const inq = list.find((i: { details: string }) => i.details === '۱۰۰ متر لوله');
    expect(inq.user.email).toBe('buyer@example.com');
    await a.patch(`/api/admin/inquiries/${inq._id}`).set(H).send({ status: 'quoted', notes: 'یادداشت محرمانه' }).expect(200);

    const after = (await c.get('/api/account/inquiries').expect(200)).body[0];
    expect(after.status).toBe('quoted');
    expect(after.notes).toBeUndefined();
  });

  it('logs in, rejects wrong passwords, and revokes sessions on password change', async () => {
    const c = agent();
    await c.post('/api/auth/login').set(H).send({ email: customer.email, password: 'wrong-pass', ...(await cap()) }).expect(401);
    await c.post('/api/auth/login').set(H).send({ email: customer.email, password: customer.password, ...(await cap()) }).expect(200);
    const other = agent();
    await other.post('/api/auth/login').set(H).send({ email: customer.email, password: customer.password, ...(await cap()) }).expect(200);

    await c.post('/api/account/password').set(H).send({ current: customer.password, password: 'newpass456' }).expect(200);
    await c.get('/api/account/inquiries').expect(200); // this device stays signed in
    await other.get('/api/account/inquiries').expect(401); // other sessions are revoked
  });

  it('rejects disguised attachments and honours the honeypot', async () => {
    const k = await cap();
    await request(host).post('/api/inquiries').set(H).field('captchaId', k.captchaId).field('captcha', k.captcha).field('name', 'آزمون').field('phone', '09120000000')
      .attach('attachment', Buffer.from('MZ fake exe'), 'list.pdf').expect(415);
    await request(host).post('/api/inquiries').set(H).field('name', 'ربات').field('phone', '09120000000').field('website', 'spam').expect(200);
    const a = await adminAgent();
    const list = (await a.get('/api/admin/inquiries').expect(200)).body.items;
    expect(list.some((i: { name: string }) => i.name === 'ربات')).toBe(false);
  });
});

describe('languages (fa / en / de)', () => {
  it('serves seeded translations, falls back to Persian, and localizes errors', async () => {
    const fa = (await request(host).get('/api/products/steel-pipes').expect(200)).body;
    const en = (await request(host).get('/api/products/steel-pipes?lang=en').expect(200)).body;
    const de = (await request(host).get('/api/products/steel-pipes').set('X-Lang', 'de').expect(200)).body;
    expect(fa.title).toBe('لوله‌های فولادی');
    expect(en.title).toBe('Steel Pipes');
    expect(de.title).toBe('Stahlrohre');
    expect(en.specs[0].label).toBe('Common standards');
    expect(en.i18n).toBeUndefined(); // the public API never leaks the translation block
    expect(en.image).toBe(fa.image); // shared fields stay

    const article = (await request(host).get('/api/articles/flange-class-vs-pressure?lang=de').expect(200)).body;
    expect(article.title).toMatch(/Flanschklasse/);
    expect(article.body).toContain('<h2>');

    const site = (await request(host).get('/api/site?lang=en').expect(200)).body;
    expect(site.hero.title).toBe('Sustainable Solutions');
    expect(site.stats[0].value).toBe(25); // number from the Persian base, label from the translation
    expect(site.stats[0].label).toBe('Years of experience');

    const missing = await request(host).get('/api/products/nope?lang=de').expect(404);
    expect(missing.body.message).toBe('Produkt nicht gefunden.');
  });

  it('saves translations from the panel (sanitized) without touching the Persian text', async () => {
    const a = await adminAgent();
    const p = (await a.get('/api/admin/products').expect(200)).body.find((x: { slug: string }) => x.slug === 'fittings');
    const { _id, createdAt, updatedAt, __v, ...rest } = p;
    void createdAt; void updatedAt; void __v;
    await a.put(`/api/admin/products/${_id}`).set(H).send({ ...rest, i18n: { ...rest.i18n, en: { ...rest.i18n.en, title: 'Fittings (edited)', summary: '' } } }).expect(200);
    const en = (await request(host).get('/api/products/fittings?lang=en').expect(200)).body;
    expect(en.title).toBe('Fittings (edited)');
    expect(en.summary).toBe(rest.summary); // empty translation → Persian text
    expect((await request(host).get('/api/products/fittings').expect(200)).body.title).toBe(rest.title);

    const created = (await a.post('/api/admin/articles').set(H).send({
      slug: 'i18n-xss', title: 'آزمون', body: '<p>متن</p>',
      i18n: { en: { title: 'Test', body: '<p onclick="x()">Hi</p><script>alert(1)</script>' } },
    }).expect(201)).body;
    const art = (await request(host).get('/api/articles/i18n-xss?lang=en').expect(200)).body;
    expect(art.title).toBe('Test');
    expect(art.body).toBe('<p>Hi</p>');
    await a.delete(`/api/admin/articles/${created._id}`).set(H).expect(200);
  });

  it('lists every language in the sitemap', async () => {
    const map = (await request(host).get('/sitemap.xml').expect(200)).text;
    expect(map).toContain('/en/products/steel-pipes</loc>');
    expect(map).toContain('/de/products/steel-pipes</loc>');
    expect(map).toContain('hreflang="x-default"');
  });
});

describe('support chat', () => {
  it('visitor starts a chat, the team answers from the panel, the visitor sees the reply', async () => {
    const start = await request(host).post('/api/chat').set(H).send({ text: 'Do you stock 6 inch API 5L pipe?', name: 'Visitor', contact: '09120000000' }).expect(200);
    const { id, token } = start.body as { id: string; token: string };
    expect(token).toBeTruthy();

    // Without (or with a wrong) token the conversation is invisible
    await request(host).get(`/api/chat/${id}`).expect(404);
    await request(host).get(`/api/chat/${id}`).set('x-chat-token', 'wrong').expect(404);

    await request(host).post(`/api/chat/${id}/messages`).set(H).set('x-chat-token', token).send({ text: 'Grade B please' }).expect(200);
    await request(host).post(`/api/chat/${id}/messages`).set(H).set('x-chat-token', token).send({ text: '   ' }).expect(400);

    const a = await adminAgent();
    const list = await a.get('/api/admin/chats').expect(200);
    expect(list.body.unread).toBeGreaterThanOrEqual(1);
    const item = list.body.items.find((c: { _id: string }) => c._id === id);
    expect(item).toMatchObject({ name: 'Visitor', unread: 2, count: 2 });

    const full = await a.get(`/api/admin/chats/${id}`).expect(200);
    expect(full.body.messages).toHaveLength(2);
    expect(full.body.tokenHash).toBeUndefined();
    await a.post(`/api/admin/chats/${id}/messages`).set(H).send({ text: 'Yes, in stock.' }).expect(200);
    expect((await a.get('/api/admin/chats/unread').expect(200)).body.unread).toBe(0);

    const seen = await request(host).get(`/api/chat/${id}`).set('x-chat-token', token).expect(200);
    expect(seen.body.messages.at(-1)).toMatchObject({ from: 'staff', text: 'Yes, in stock.' });

    // Visitors cannot reach the panel endpoints
    await request(host).get('/api/admin/chats').expect(401);
    await a.delete(`/api/admin/chats/${id}`).set(H).expect(200);
    await request(host).get(`/api/chat/${id}`).set('x-chat-token', token).expect(404);
  });
});


describe('online shop', () => {
  /** Registration is limited to 5 per hour per IP (used up above): shop customers go straight into the database. */
  async function customer(email: string, password: string) {
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 64, { N: 1 << 15, r: 8, p: 1, maxmem: 128 * (1 << 15) * 8 * 2 });
    // A separate connection: mongoose.disconnect() would also close the app's connection
    const conn = await mongoose.createConnection(DB).asPromise();
    await conn.collection('users').insertOne({
      email, name: 'خریدار', phone: '09121112233', company: '', active: true, tokenVersion: 0, createdAt: new Date(), updatedAt: new Date(),
      passwordHash: ['scrypt', 1 << 15, 8, 1, salt.toString('base64'), hash.toString('base64')].join('$'),
    });
    await conn.close();
    const ag = agent();
    await ag.post('/api/auth/login').set(H).send({ email, password, ...(await cap()) }).expect(200);
    return ag;
  }
  let buyer: ReturnType<typeof agent>;

  it('prices the cart, takes stock, finalises shipping and VAT, and accepts a sandbox payment', async () => {
    const a = await adminAgent();
    const settings = (await a.get('/api/admin/settings').expect(200)).body.settings;
    await a.put('/api/admin/settings').set(H).send({ ...settings, shop: { vatPercent: 10 } }).expect(200);
    const product = (
      await a
        .post('/api/admin/products')
        .set(H)
        .send({
          slug: 'shop-pipe',
          title: 'لوله آزمایشی',
          variants: [
            { sku: 'P-6-40', title: '6" SCH40', unit: 'length', price: 2_500_000, stock: 10 },
            { sku: 'P-8-80', title: '8" SCH80', unit: 'meter', price: 900_000, stock: null, minQty: 2 },
            { sku: 'OLD', title: 'retired', unit: 'piece', price: 5000, active: false },
          ],
        })
        .expect(201)
    ).body as { _id: string };
    await a
      .post('/api/admin/products')
      .set(H)
      .send({ slug: 'dup-sku', title: 'تکراری', variants: [{ sku: 'X', title: 'a', price: 5000 }, { sku: 'x', title: 'b', price: 5000 }] })
      .expect(400);

    // Visitors see the variants on sale only
    const pub = (await request(host).get('/api/products/shop-pipe').expect(200)).body as { variants: { sku: string }[] };
    expect(pub.variants.map((v) => v.sku)).toEqual(['P-6-40', 'P-8-80']);

    // Cart pricing explains what cannot be ordered
    const priced = (
      await request(host)
        .post('/api/cart/price')
        .set(H)
        .set('x-lang', 'en')
        .send({ items: [{ slug: 'shop-pipe', sku: 'P-6-40', qty: 11 }, { slug: 'shop-pipe', sku: 'P-8-80', qty: 1 }, { slug: 'shop-pipe', sku: 'OLD', qty: 1 }] })
        .expect(200)
    ).body as { lines: { sku: string; error: string }[]; gateways: { id: string }[] };
    expect(priced.lines.map((l) => l.error)).toEqual([
      'The quantity exceeds the available stock.',
      'The quantity is below the minimum order.',
      'This item is no longer available online.',
    ]);
    expect(priced.gateways.map((g) => g.id)).toEqual(['sandbox']);

    const checkout = {
      items: [{ slug: 'shop-pipe', sku: 'P-6-40', qty: 4 }, { slug: 'shop-pipe', sku: 'P-8-80', qty: 3 }],
      payMethod: 'online',
      address: { name: 'خریدار', phone: '09121112233', province: 'تهران', city: 'تهران', address: 'خیابان آزمایش، پلاک ۱', postalCode: '۱۲۳۴۵۶۷۸۹۰' },
      invoice: { type: 'company', name: 'شرکت آزمون', nationalId: '10101010101', economicCode: '411111111111' },
    };
    await request(host).post('/api/orders').set(H).send(checkout).expect(401);

    const c = (buyer = await customer('shop-buyer@example.com', 'goodpass123'));
    await c.post('/api/orders').set(H).send({ ...checkout, invoice: { ...checkout.invoice, nationalId: '123' } }).expect(400);
    const order = (await c.post('/api/orders').set(H).send(checkout).expect(201)).body as { _id: string; number: number; status: string; subtotal: number; total: null };
    const subtotal = 4 * 2_500_000 + 3 * 900_000;
    expect(order).toMatchObject({ status: 'review', subtotal, total: null });
    expect(order.number).toBeGreaterThan(1000);
    const stockOf = async () =>
      ((await a.get(`/api/admin/products/${product._id}`).expect(200)).body.variants as { sku: string; stock: number | null }[]).find((v) => v.sku === 'P-6-40')!.stock;
    expect(await stockOf()).toBe(6);

    // No payment before the team sets the shipping cost
    await c.post(`/api/orders/${order._id}/pay`).set(H).send({ gateway: 'sandbox' }).expect(400);

    const updated = (await a.patch(`/api/admin/orders/${order._id}`).set(H).send({ shipping: 500_000, shippingNote: 'باربری' }).expect(200)).body;
    const vat = Math.round(((subtotal + 500_000) * 10) / 100);
    expect(updated).toMatchObject({ status: 'awaiting_payment', shipping: 500_000, vat, total: subtotal + 500_000 + vat });

    // Pay through the sandbox "bank"
    const redirect = (await c.post(`/api/orders/${order._id}/pay`).set(H).send({ gateway: 'sandbox' }).expect(200)).body as { url: string; fields: { token: string } };
    const page = await request(host).get(redirect.url).query(redirect.fields).expect(200);
    const action = /action="([^"]+)"/.exec(page.text)![1].replace(/&#(\d+);/g, (_m, d: string) => String.fromCharCode(Number(d)));
    const payNo = /name="payNo" value="(\d+)"/.exec(page.text)![1];
    const callback = new URL(action).pathname;
    // The bank posts a plain form: no CSRF header, no session
    const cb = await request(host).post(callback).type('form').send({ payNo, token: redirect.fields.token, result: 'ok' }).expect(303);
    expect(cb.headers['location']).toBe(`/account/orders/${order._id}?pay=ok`);
    const again = await request(host).post(callback).type('form').send({ payNo, token: redirect.fields.token, result: 'ok' }).expect(303);
    expect(again.headers['location']).toContain('pay=ok');

    const mine = (await c.get(`/api/account/orders/${order._id}`).expect(200)).body as { status: string; payments: { status: string; rrn: string }[]; staffNote?: string };
    expect(mine.status).toBe('paid');
    expect(mine.payments[0].status).toBe('paid');
    expect(mine.payments[0].rrn).toBeTruthy();
    expect(mine.staffNote).toBeUndefined();
    await c.post(`/api/orders/${order._id}/cancel`).set(H).expect(400); // paid orders are cancelled by the team

    // Orders of other customers stay invisible
    const conn = await mongoose.createConnection(DB).asPromise();
    const foreign = await conn.collection('orders').insertOne({
      number: 99999, user: new mongoose.Types.ObjectId(), status: 'review', payMethod: 'online', items: [], subtotal: 1, vatPercent: 10,
      address: { name: 'x', phone: '0', province: 'x', city: 'x', address: 'x' }, invoice: { type: 'personal', name: 'x' }, payments: [], history: [],
    });
    await conn.close();
    await c.get(`/api/account/orders/${String(foreign.insertedId)}`).expect(404);
    await c.post(`/api/orders/${String(foreign.insertedId)}/cancel`).set(H).expect(404);
    const list = (await c.get('/api/account/orders').expect(200)).body as { number: number }[];
    expect(list.map((o) => o.number)).toEqual([order.number]);
  });

  it('bank transfer: customer reports it, the team confirms; cancelling gives stock back', async () => {
    const a = await adminAgent();
    const c = buyer;
    const base = {
      payMethod: 'transfer',
      address: { name: 'خریدار', phone: '09121112233', province: 'اصفهان', city: 'اصفهان', address: 'نشانی کامل آزمایشی' },
      invoice: { type: 'personal', name: 'خریدار', nationalId: '0012345678' },
    };
    const o = (await c.post('/api/orders').set(H).send({ ...base, items: [{ slug: 'shop-pipe', sku: 'P-6-40', qty: 2 }] }).expect(201)).body as { _id: string };
    await c.post(`/api/orders/${o._id}/transfer`).set(H).send({ ref: '123456' }).expect(400); // not priced yet
    await a.patch(`/api/admin/orders/${o._id}`).set(H).send({ shipping: 0 }).expect(200);
    const reported = (await c.post(`/api/orders/${o._id}/transfer`).set(H).send({ ref: '987654', paidOn: '1405/08/17' }).expect(200)).body;
    expect(reported.transfer.ref).toBe('987654');
    const list = (await a.get('/api/admin/orders?status=awaiting_payment').expect(200)).body as { items: { _id: string }[] };
    expect(list.items.some((x) => x._id === o._id)).toBe(true);
    expect((await a.patch(`/api/admin/orders/${o._id}`).set(H).send({ status: 'paid' }).expect(200)).body.status).toBe('paid');

    // Cancelling an unpaid order returns its stock
    const stock = async () =>
      ((await a.get('/api/admin/products').expect(200)).body as { slug: string; variants: { sku: string; stock: number }[] }[]).find((p) => p.slug === 'shop-pipe')!.variants[0].stock;
    const before = await stock();
    const o2 = (await c.post('/api/orders').set(H).send({ ...base, items: [{ slug: 'shop-pipe', sku: 'P-6-40', qty: 3 }] }).expect(201)).body as { _id: string };
    expect(await stock()).toBe(before - 3);
    expect((await c.post(`/api/orders/${o2._id}/cancel`).set(H).expect(200)).body.status).toBe('cancelled');
    expect(await stock()).toBe(before);
    await a.patch(`/api/admin/orders/${o2._id}`).set(H).send({ status: 'paid' }).expect(400);

    // Visitors cannot reach the panel side; the export is for managers
    await request(host).get('/api/admin/orders').expect(401);
    await a.get('/api/admin/orders/export.csv').expect(200);
  });
});
