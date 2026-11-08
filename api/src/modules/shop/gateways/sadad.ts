import { createCipheriv } from 'node:crypto';
import { GatewayError, postJson, str, type CallbackResult, type PaymentGateway, type StartInput, type StartResult, type VerifyResult } from './gateway.js';

const REQUEST_URL = 'https://sadad.shaparak.ir/vpg/api/v0/Request/PaymentRequest';
const PAY_URL = 'https://sadad.shaparak.ir/VPG/Purchase';
const VERIFY_URL = 'https://sadad.shaparak.ir/vpg/api/v0/Advice/Verify';

interface RequestAnswer {
  ResCode: number | string;
  Token?: string;
  Description?: string;
}
interface VerifyAnswer {
  ResCode: number | string;
  Amount?: number | string;
  Description?: string;
  RetrivalRefNo?: string;
  SystemTraceNo?: string;
  OrderId?: number | string;
}

/**
 * Bank Melli (Sadad) — REST with a TripleDES signature (SignData) made with the merchant key.
 * PaymentRequest → GET Purchase?Token= → callback (OrderId, token, ResCode) → Advice/Verify.
 */
export class SadadGateway implements PaymentGateway {
  readonly id = 'sadad' as const;
  readonly label = { fa: 'بانک ملی (سداد)', en: 'Bank Melli', de: 'Bank Melli' };

  constructor(private readonly creds: { merchantId: string; terminalId: string; key: string }) {}

  /** TripleDES-ECB, PKCS7, Base64 — Sadad's SignData. */
  private sign(data: string): string {
    const cipher = createCipheriv('des-ede3', Buffer.from(this.creds.key, 'base64'), null);
    return Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]).toString('base64');
  }

  async start(input: StartInput): Promise<StartResult> {
    const r = await postJson<RequestAnswer>(REQUEST_URL, {
      MerchantId: this.creds.merchantId,
      TerminalId: this.creds.terminalId,
      Amount: input.amountRial,
      OrderId: input.payNo,
      LocalDateTime: new Date().toISOString(),
      ReturnUrl: input.callbackUrl,
      SignData: this.sign(`${this.creds.terminalId};${input.payNo};${input.amountRial}`),
      ...(input.mobile ? { UserId: input.mobile.replace(/\D/g, '') } : {}),
    });
    if (String(r.ResCode) !== '0' || !r.Token) throw new GatewayError(`Sadad request error ${r.ResCode} ${r.Description ?? ''}`.trim());
    return { token: r.Token, redirect: { method: 'GET', url: PAY_URL, fields: { Token: r.Token } } };
  }

  parseCallback(b: Record<string, string>): CallbackResult {
    return { payNo: Number(b['OrderId']), ok: str(b['ResCode']) === '0', ref: str(b['token'] || b['Token']), message: `ResCode ${str(b['ResCode'])}` };
  }

  async verify({ amountRial, token, callback, body }: Parameters<PaymentGateway['verify']>[0]): Promise<VerifyResult> {
    const t = callback.ref || token;
    const r = await postJson<VerifyAnswer>(VERIFY_URL, { Token: t, SignData: this.sign(t) });
    if (String(r.ResCode) !== '0') return { ok: false, rrn: '', trace: '', card: '', message: `Verify ${r.ResCode} ${r.Description ?? ''}`.trim() };
    const paid = Number(r.Amount);
    if (paid !== amountRial) return { ok: false, rrn: '', trace: '', card: '', message: `Amount mismatch ${paid} ≠ ${amountRial}` };
    return { ok: true, rrn: str(r.RetrivalRefNo), trace: str(r.SystemTraceNo), card: str(body['PrimaryAccNo']), amountRial: paid };
  }
}
