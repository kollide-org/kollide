# Payments: deferred to milestone P1

**Status:** v1 is free-only. No money moves through Kollide. Events are free, pay at venue, cost-split, or partner tickets bought on the partner's own site.

**Why this file exists:** turning payments on later should mean *adding* code, not reworking it. v1 keeps the seams below, and P1 fills them in.

---

## 1. Seams kept in v1 (must stay working)

| Seam | Where | v1 behaviour | P1 change |
| --- | --- | --- | --- |
| Feature switch | `app_config` table, key `payments_enabled` (boolean) | `false`. Readable by everyone. **Nobody can change it through the API, admins included** (policies exclude this key; test 10 and 260). | Set to `true` in a migration (or with the service role), after go-live checks |
| Price fields | `events.price_paise` (integer, ≥ 0), `pricing_mode` enum includes `paid` | A check refuses `pricing_mode = 'paid'` or `price_paise > 0` while the switch is off | Relax the check when the switch is on, for `type = 'kollide'` events only |
| Booking states | `booking_status` enum includes `pending_payment`, `paid`, `expired`, `refunded` | Never written | Used by the paid branch |
| Single join path | `join_event(event_id, …)` (or `request_to_join`), with the event row locked `FOR UPDATE` | Free and community branches only | Add a branch: paid event → create a `pending_payment` booking with `hold_expires_at = now() + 15 min` |
| Seat counting | `event_cards.spots_left` and capacity checks count active states | Counts `requested`, `approved`, `confirmed`, `attended` | Also count `pending_payment` (holds) and `paid` |
| Worker provider interface | `workers/api/src/payments/provider.ts` | Types only. No implementation, no routes, no secrets. | Add `RazorpayProvider` plus the routes |
| Email templates | `workers/api/src/emails/` | None for payments | Add payment confirmed, refund started, refund done, store credit issued |
| Analytics names | `docs/backend/ANALYTICS.md` | `checkout_started`, `payment_captured` marked "reserved" | Emitted from the Worker |
| Frontend | The services layer has a `payments` service stub | The Book button and the "Paid" filter are hidden when `payments_enabled = false` | Real service: order → Checkout → poll status |

### Provider interface (v1 ships this file, types only)

```ts
// workers/api/src/payments/provider.ts
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
```

---

## 2. P1 design: what gets added

### Tables (new migrations in P1)
- **`payments`:**
  - id;
  - booking_id;
  - provider (`razorpay`);
  - provider_order_id (unique);
  - provider_payment_id;
  - amount_paise;
  - currency;
  - status (`created` / `captured` / `failed` / `refunded` / `partially_refunded`);
  - created_at, updated_at.
- **`webhook_events`:** provider, provider_event_id (**unique**), type, raw_body, received_at, processed_at, error.
- **`refunds`:** payment_id, provider_refund_id, amount_paise, reason, status, requested_by, created_at.
- **`credit_ledger`:** user_id, amount_paise (+/−), reason, booking_id, created_at.
- **`my_credit_balance` view:** a sum, never a stored number.

### Flow
1. The browser calls Worker `POST /payments/order`.
2. The Worker verifies the user's JWT and calls `join_event` through the service role. That creates the 15-minute hold. **The price is read from the database.**
3. The Worker calls `provider.createOrder`, stores the payment row, and returns the order to the browser. The browser opens Checkout.
4. Worker `POST /webhooks/razorpay`:
   1. Read the **raw** body.
   2. `verifyWebhook`: HMAC-SHA256 with WebCrypto, constant-time compare.
   3. Insert into `webhook_events`. A duplicate `provider_event_id` returns 200 and does nothing.
   4. Dispatch by event type:
      - `payment.captured` → `confirm_payment` (booking → `paid`, email, notification).
      - `payment.failed` → release the hold.
      - `refund.processed` → finish the refund.
   5. A capture that arrives after the hold expired, when the event is full, gets an automatic refund.
5. **The browser success callback is never trusted.** The UI polls the booking status instead.
6. **Refund policy:**
   - Full refund up to 72 hours before the event.
   - Store credit after that.
   - Nothing for no-shows.
   - An automatic full refund if Kollide cancels the event.
7. **pg_cron, every 5 minutes:** expire holds, then promote the waitlist.
8. **Go-live:**
   - Razorpay account (category Media & Entertainment → Ticketing);
   - test keys first;
   - webhook secret in Wrangler secrets;
   - add Razorpay to the CSP;
   - one real ₹1 payment and its refund;
   - then set `payments_enabled = true` in a migration (the admin API cannot flip it).

### Tests P1 must add
- **Webhook:** valid, invalid and tampered signatures; duplicate events; late capture.
- **Holds:** hold expiry; you can't pay for a full event.
- **Policy:** the refund windows; a credit balance can never go negative.
- **Switch:** with `payments_enabled = false`, every paid path is refused.
