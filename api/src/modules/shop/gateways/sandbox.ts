import { randomBytes } from 'node:crypto';
import { str, type CallbackResult, type PaymentGateway, type StartInput, type StartResult, type VerifyResult } from './gateway.js';

/**
 * Test gateway for development and the e2e tests: a page on this server with "pay" and
 * "cancel" buttons that posts back to the normal callback. Disabled in production (env check).
 */
export class SandboxGateway implements PaymentGateway {
  readonly id = 'sandbox' as const;
  readonly label = { fa: 'درگاه آزمایشی', en: 'Test gateway', de: 'Testzahlung' };
  /** Attempts started in this process: token → amount (the page needs it). */
  private readonly open = new Map<string, { payNo: number; amountRial: number; callbackUrl: string }>();

  async start(input: StartInput): Promise<StartResult> {
    const token = randomBytes(12).toString('hex');
    this.open.set(token, input);
    return { token, redirect: { method: 'GET', url: '/api/payments/sandbox/pay', fields: { token } } };
  }

  /** For the test page. */
  attempt(token: string) {
    return this.open.get(token);
  }

  parseCallback(b: Record<string, string>): CallbackResult {
    return { payNo: Number(b['payNo']), ok: str(b['result']) === 'ok', ref: str(b['token']), message: str(b['result']) };
  }

  async verify({ token, callback }: Parameters<PaymentGateway['verify']>[0]): Promise<VerifyResult> {
    const ok = callback.ok && this.open.has(token) && callback.ref === token;
    this.open.delete(token);
    return ok ? { ok, rrn: `TEST${Date.now()}`, trace: token.slice(0, 8), card: '6037-99**-****-0000' } : { ok: false, rrn: '', trace: '', card: '', message: 'cancelled' };
  }
}
