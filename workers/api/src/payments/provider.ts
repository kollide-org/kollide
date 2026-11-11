// Payments are OFF in v1. Types only: no implementation, no routes, not imported anywhere.
// P1 adds RazorpayProvider and the routes. See docs/backend/PAYMENTS_LATER.md.
export interface CreateOrderInput { bookingId: string; eventId: string; amountPaise: number; currency: 'INR'; customerId: string; }
export interface CreatedOrder { providerOrderId: string; amountPaise: number; currency: 'INR'; publicKey: string; }
export type WebhookResult =
  | { kind: 'payment_captured'; providerEventId: string; providerOrderId: string; providerPaymentId: string; amountPaise: number }
  | { kind: 'payment_failed'; providerEventId: string; providerOrderId: string }
  | { kind: 'refund_processed'; providerEventId: string; providerRefundId: string; providerPaymentId: string; amountPaise: number }
  | { kind: 'ignored'; providerEventId: string };
export interface PaymentProvider {
  createOrder(input: CreateOrderInput): Promise<CreatedOrder>;
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookResult>; // throws on bad signature
  refund(providerPaymentId: string, amountPaise: number, reason: string): Promise<{ providerRefundId: string }>;
}
