/**
 * Payment provider abstraction (FR-DM-17).
 *
 * The digital menu MVP offers two payment intents:
 *   - pay_at_counter: guest orders, pays at the counter (no gateway).
 *   - cash_on_delivery: guest orders delivery, pays cash on arrival.
 *
 * Neither flows through a real gateway today, but the order must record
 * WHICH intent was chosen so the POS/ktichen treat it correctly. Defining
 * the interface now lets a future PalPay / Jawwal Pay backend slot in
 * without touching order logic.
 *
 * All methods are intentionally async and return a discriminated result
 * so a future gateway can surface redirect/payment-failure states.
 */

export type PaymentIntent = "pay_at_counter" | "cash_on_delivery";

export interface PaymentCaptureResult {
  ok: boolean;
  /** Provider reference (e.g. gateway transaction id, or "counter"/"cod"). */
  reference: string;
  error?: string;
}

export interface InitiatePaymentParams {
  amount: string; // numeric-as-string, agorot-safe canonical form
  currency: string;
  orderId: string;
  orderNumber: string;
  intent: PaymentIntent;
  customerPhone?: string;
}

export interface PaymentProvider {
  readonly id: string;
  /** Whether this provider can service the given intent. */
  supports(intent: PaymentIntent): boolean;
  /**
   * Record the payment intent + capture. For counter/COD this immediately
   * succeeds (no gateway); a real gateway would return a redirect URL.
   */
  initiate(params: InitiatePaymentParams): Promise<PaymentCaptureResult>;
}

/** Pay at the counter — captured by the cashier when the order is handed over. */
export class PayAtCounterProvider implements PaymentProvider {
  readonly id = "pay_at_counter";
  supports(intent: PaymentIntent): boolean {
    return intent === "pay_at_counter";
  }
  async initiate(params: InitiatePaymentParams): Promise<PaymentCaptureResult> {
    return { ok: true, reference: `counter:${params.orderNumber}` };
  }
}

/** Cash on delivery — captured on arrival. */
export class CashOnDeliveryProvider implements PaymentProvider {
  readonly id = "cash_on_delivery";
  supports(intent: PaymentIntent): boolean {
    return intent === "cash_on_delivery";
  }
  async initiate(params: InitiatePaymentParams): Promise<PaymentCaptureResult> {
    return { ok: true, reference: `cod:${params.orderNumber}` };
  }
}

/** Resolve the provider for a given intent. Throw if unsupported. */
export function resolveProvider(intent: PaymentIntent): PaymentProvider {
  if (intent === "pay_at_counter") return new PayAtCounterProvider();
  if (intent === "cash_on_delivery") return new CashOnDeliveryProvider();
  throw new Error(`Unsupported payment intent: ${intent}`);
}
