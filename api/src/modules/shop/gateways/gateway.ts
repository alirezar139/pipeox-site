/**
 * A Shaparak payment gateway. The flow is the same for every bank:
 *   1. start()  — ask the bank for a payment token, send the customer's browser to the bank
 *   2. the bank sends the browser back to our callback (form POST) with the result
 *   3. verify() — confirm the payment server-to-server before trusting it (and settle it)
 * Amounts are in Rial (1 Toman = 10 Rial).
 */
export type GatewayId = 'mellat' | 'saman' | 'sadad' | 'sandbox';

export interface StartInput {
  /** Our unique numeric payment number (the bank's "order id"). */
  payNo: number;
  amountRial: number;
  callbackUrl: string;
  mobile?: string;
}

/** Where to send the customer's browser: a GET link or an auto-submitted POST form. */
export interface Redirect {
  method: 'GET' | 'POST';
  url: string;
  fields: Record<string, string>;
}

export interface StartResult {
  /** The bank's token / reference for this attempt (stored with the payment). */
  token: string;
  redirect: Redirect;
}

/** What the bank's callback says, before verification. */
export interface CallbackResult {
  payNo: number;
  /** The bank reports the customer completed the payment (still to be verified). */
  ok: boolean;
  /** Bank's payment reference (e.g. Mellat SaleReferenceId, Saman RefNum, Sadad token). */
  ref: string;
  message?: string;
}

export interface VerifyResult {
  ok: boolean;
  /** Retrieval reference number shown to the customer / used for reconciliation. */
  rrn: string;
  trace: string;
  card: string;
  amountRial?: number;
  message?: string;
}

export interface PaymentGateway {
  readonly id: GatewayId;
  /** Shown to customers on the payment choice. */
  readonly label: { fa: string; en: string; de: string };
  start(input: StartInput): Promise<StartResult>;
  parseCallback(body: Record<string, string>): CallbackResult;
  /** Server-to-server confirmation (and settlement where the bank needs it). */
  verify(input: { payNo: number; amountRial: number; token: string; callback: CallbackResult; body: Record<string, string> }): Promise<VerifyResult>;
}

export class GatewayError extends Error {}

/** JSON POST with a timeout; bank answers are parsed defensively. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new GatewayError(`${new URL(url).host} responded ${res.status}`);
  return (await res.json()) as T;
}

export const str = (v: unknown): string => (v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v as string | number | boolean));
