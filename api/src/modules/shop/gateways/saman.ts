import { GatewayError, postJson, str, type CallbackResult, type PaymentGateway, type StartInput, type StartResult, type VerifyResult } from './gateway.js';

const TOKEN_URL = 'https://sep.shaparak.ir/onlinepg/onlinepg';
const PAY_URL = 'https://sep.shaparak.ir/OnlinePG/SendToken';
const VERIFY_URL = 'https://sep.shaparak.ir/verifyTxnRandomSessionkey/ipg/VerifyTransaction';
const REVERSE_URL = 'https://sep.shaparak.ir/verifyTxnRandomSessionkey/ipg/ReverseTransaction';

interface TokenAnswer {
  status: number;
  token?: string;
  errorCode?: string;
  errorDesc?: string;
}
interface VerifyAnswer {
  ResultCode: number;
  ResultDescription?: string;
  Success: boolean;
  TransactionDetail?: { RRN?: string; RefNum?: string; MaskedPan?: string; StraceNo?: number | string; OrginalAmount?: number; AffectiveAmount?: number };
}

/**
 * Bank Saman (SEP) — REST.
 * token → GET SendToken?token= → callback (State, Status, RefNum, ResNum, RRN, TraceNo, SecurePan)
 * → VerifyTransaction (amount checked against ours; reversed if it does not match).
 */
export class SamanGateway implements PaymentGateway {
  readonly id = 'saman' as const;
  readonly label = { fa: 'بانک سامان (سپ)', en: 'Bank Saman', de: 'Bank Saman' };

  constructor(private readonly creds: { terminalId: string }) {}

  async start(input: StartInput): Promise<StartResult> {
    const r = await postJson<TokenAnswer>(TOKEN_URL, {
      action: 'token',
      TerminalId: this.creds.terminalId,
      Amount: input.amountRial,
      ResNum: String(input.payNo),
      RedirectUrl: input.callbackUrl,
      ...(input.mobile ? { CellNumber: input.mobile.replace(/\D/g, '') } : {}),
    });
    if (r.status !== 1 || !r.token) throw new GatewayError(`Saman token error ${r.errorCode ?? ''} ${r.errorDesc ?? ''}`.trim());
    return { token: r.token, redirect: { method: 'GET', url: PAY_URL, fields: { token: r.token } } };
  }

  parseCallback(b: Record<string, string>): CallbackResult {
    const ok = str(b['State']).toUpperCase() === 'OK' || str(b['Status']) === '2';
    return { payNo: Number(b['ResNum']), ok, ref: str(b['RefNum']), message: `${str(b['State'])} ${str(b['Status'])}`.trim() };
  }

  async verify({ amountRial, callback }: Parameters<PaymentGateway['verify']>[0]): Promise<VerifyResult> {
    const body = { RefNum: callback.ref, TerminalNumber: Number(this.creds.terminalId) };
    const r = await postJson<VerifyAnswer>(VERIFY_URL, body);
    const d = r.TransactionDetail ?? {};
    if (!r.Success || r.ResultCode !== 0) return { ok: false, rrn: '', trace: '', card: '', message: `Verify ${r.ResultCode} ${r.ResultDescription ?? ''}`.trim() };
    const paid = Number(d.AffectiveAmount ?? d.OrginalAmount);
    if (paid !== amountRial) {
      await postJson(REVERSE_URL, body).catch(() => undefined);
      return { ok: false, rrn: '', trace: '', card: '', message: `Amount mismatch ${paid} ≠ ${amountRial}` };
    }
    return { ok: true, rrn: str(d.RRN), trace: str(d.StraceNo), card: str(d.MaskedPan), amountRial: paid };
  }
}
