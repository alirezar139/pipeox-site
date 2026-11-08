import { GatewayError, str, type CallbackResult, type PaymentGateway, type StartInput, type StartResult, type VerifyResult } from './gateway.js';

const WS = 'https://bpm.shaparak.ir/pgwchannel/services/pgw';
const PAY_PAGE = 'https://bpm.shaparak.ir/pgwchannel/startpay.mellat';

const esc = (v: string | number) => String(v).replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Tehran local date/time as Mellat expects: yyyyMMdd and HHmmss. */
function tehranNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts['year']}${parts['month']}${parts['day']}`, time: `${parts['hour']}${parts['minute']}${parts['second']}`.replace(/^24/, '00') };
}

/**
 * Bank Mellat (Behpardakht) — SOAP web service.
 * bpPayRequest → "0,RefId" → POST RefId to startpay.mellat → callback (ResCode, SaleOrderId, SaleReferenceId)
 * → bpVerifyRequest → bpSettleRequest (money is only transferred after settle).
 */
export class MellatGateway implements PaymentGateway {
  readonly id = 'mellat' as const;
  readonly label = { fa: 'بانک ملت (به‌پرداخت)', en: 'Bank Mellat', de: 'Bank Mellat' };

  constructor(private readonly creds: { terminalId: string; username: string; password: string }) {}

  private async call(method: string, params: Record<string, string | number>): Promise<string> {
    const body = Object.entries(params).map(([k, v]) => `<${k}>${esc(v)}</${k}>`).join('');
    const envelope =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:int="http://interfaces.core.sw.bps.com/">' +
      `<soapenv:Body><int:${method}>${body}</int:${method}></soapenv:Body></soapenv:Envelope>`;
    const res = await fetch(WS, {
      method: 'POST',
      headers: { 'content-type': 'text/xml; charset=utf-8', soapaction: '' },
      body: envelope,
      signal: AbortSignal.timeout(20_000),
    });
    const xml = await res.text();
    const m = xml.match(/<return>([^<]*)<\/return>/);
    if (!m) throw new GatewayError(`Mellat ${method}: unexpected answer (${res.status})`);
    return m[1].trim();
  }

  private get auth() {
    return { terminalId: this.creds.terminalId, userName: this.creds.username, userPassword: this.creds.password };
  }

  async start(input: StartInput): Promise<StartResult> {
    const now = tehranNow();
    const answer = await this.call('bpPayRequest', {
      ...this.auth,
      orderId: input.payNo,
      amount: input.amountRial,
      localDate: now.date,
      localTime: now.time,
      additionalData: '',
      callBackUrl: input.callbackUrl,
      payerId: 0,
    });
    const [code, refId] = answer.split(',');
    if (code !== '0' || !refId) throw new GatewayError(`Mellat bpPayRequest error ${code}`);
    const fields: Record<string, string> = { RefId: refId };
    if (input.mobile) fields['MobileNo'] = input.mobile.replace(/\D/g, '').replace(/^0/, '98');
    return { token: refId, redirect: { method: 'POST', url: PAY_PAGE, fields } };
  }

  parseCallback(b: Record<string, string>): CallbackResult {
    return { payNo: Number(b['SaleOrderId']), ok: str(b['ResCode']) === '0', ref: str(b['SaleReferenceId']), message: `ResCode ${str(b['ResCode'])}` };
  }

  async verify({ payNo, callback, body }: Parameters<PaymentGateway['verify']>[0]): Promise<VerifyResult> {
    const params = { ...this.auth, orderId: payNo, saleOrderId: payNo, saleReferenceId: callback.ref };
    const verified = await this.call('bpVerifyRequest', params);
    if (verified !== '0') return { ok: false, rrn: '', trace: '', card: '', message: `bpVerifyRequest ${verified}` };
    const settled = await this.call('bpSettleRequest', params);
    if (settled !== '0' && settled !== '45') {
      // Verified but not settled: give the money back rather than leave it hanging
      await this.call('bpReversalRequest', params).catch(() => undefined);
      return { ok: false, rrn: '', trace: '', card: '', message: `bpSettleRequest ${settled}` };
    }
    return { ok: true, rrn: callback.ref, trace: callback.ref, card: str(body['CardHolderPan']) };
  }
}
