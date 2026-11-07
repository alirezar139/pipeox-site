import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.js';

/**
 * Outbound messages: email (SMTP), Bale and Telegram bots.
 * Every channel is optional and failures are logged — they never fail the request.
 */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  private readonly mailer: Transporter | null;

  constructor(private readonly config: ConfigService<Env, true>) {
    const host = config.get('SMTP_HOST', { infer: true });
    this.mailer = host
      ? nodemailer.createTransport({
          host,
          port: config.get('SMTP_PORT', { infer: true }),
          secure: config.get('SMTP_SECURE', { infer: true }),
          auth: { user: config.get('SMTP_USER', { infer: true }), pass: config.get('SMTP_PASS', { infer: true }) },
        })
      : null;
  }

  get emailEnabled(): boolean {
    return !!this.mailer && !!this.config.get('MAIL_FROM', { infer: true });
  }

  /** Throws on failure — callers decide whether that matters. */
  async sendEmail(to: string, subject: string, text: string): Promise<void> {
    if (!this.emailEnabled) throw new Error('Email is not configured');
    await this.mailer!.sendMail({ from: this.config.get('MAIL_FROM', { infer: true }), to, subject, text });
  }

  /** Staff alert on every channel that is configured. */
  async notifyStaff(subject: string, text: string): Promise<void> {
    const jobs: Promise<unknown>[] = [];
    const to = this.config.get('NOTIFY_EMAIL_TO', { infer: true });
    if (to && this.emailEnabled) jobs.push(this.sendEmail(to, subject, text));
    const bale = this.config.get('BALE_BOT_TOKEN', { infer: true });
    if (bale) jobs.push(this.bot('https://tapi.bale.ai', bale, this.config.get('BALE_CHAT_ID', { infer: true }), text));
    const tg = this.config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    if (tg) jobs.push(this.bot('https://api.telegram.org', tg, this.config.get('TELEGRAM_CHAT_ID', { infer: true }), text));

    for (const r of await Promise.allSettled(jobs)) {
      if (r.status === 'rejected') this.log.warn(`Notification failed: ${String(r.reason)}`);
    }
  }

  private async bot(base: string, token: string, chatId: string, text: string): Promise<void> {
    const res = await fetch(`${base}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`${new URL(base).host} responded ${res.status}`);
  }
}
