import { BadRequestException, Controller, Get, Global, Header, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'node:crypto';
import svgCaptcha from 'svg-captcha';
import type { Env } from '../../config/env.js';

const TTL_MS = 10 * 60_000;
const MAX_PENDING = 20_000;

/**
 * Built-in image captcha (no third-party service — works from servers inside Iran).
 * Glyphs are drawn as SVG paths, so the answer is not in the markup. Each challenge is
 * single-use and expires after 10 minutes; challenges live in memory (one app process).
 */
@Injectable()
export class CaptchaService {
  private readonly pending = new Map<string, { answer: string; exp: number }>();
  private readonly testMode: boolean;

  constructor(config: ConfigService<Env, true>) {
    this.testMode = config.get('NODE_ENV', { infer: true }) === 'test';
  }

  create() {
    this.sweep();
    const { text, data } = svgCaptcha.create({
      size: 5,
      ignoreChars: '0oO1ilIjJ',
      noise: 3,
      color: true,
      background: '#1b1d20',
      width: 150,
      height: 48,
      fontSize: 52,
    });
    const id = randomBytes(16).toString('hex');
    this.pending.set(id, { answer: text.toLowerCase(), exp: Date.now() + TTL_MS });
    // Tests read the answer from the response; never outside NODE_ENV=test
    return { id, svg: data, ...(this.testMode ? { answer: text } : {}) };
  }

  /** Throws a field error unless the answer matches. The challenge is consumed either way. */
  verify(body: unknown): void {
    const { captchaId, captcha } = (body ?? {}) as { captchaId?: unknown; captcha?: unknown };
    const entry = typeof captchaId === 'string' ? this.pending.get(captchaId) : undefined;
    if (entry) this.pending.delete(captchaId as string);
    const ok = entry && entry.exp > Date.now() && typeof captcha === 'string' && captcha.trim().toLowerCase() === entry.answer;
    if (!ok) throw new BadRequestException({ message: 'کد امنیتی درست نیست. کد جدید را وارد کنید.', field: 'captcha' });
  }

  private sweep() {
    const now = Date.now();
    for (const [id, e] of this.pending) if (e.exp <= now) this.pending.delete(id);
    // Bound memory under a flood: drop the oldest challenges
    while (this.pending.size >= MAX_PENDING) this.pending.delete(this.pending.keys().next().value!);
  }
}

@Controller('captcha')
export class CaptchaController {
  constructor(private readonly captcha: CaptchaService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Get()
  create() {
    return this.captcha.create();
  }
}

@Global()
@Module({ controllers: [CaptchaController], providers: [CaptchaService], exports: [CaptchaService] })
export class CaptchaModule {}
