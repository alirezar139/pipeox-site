/**
 * End-to-end API tests against the compiled app (dist/) and a throwaway database.
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
  const { mountApi } = await import('../dist/bootstrap.js');
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
