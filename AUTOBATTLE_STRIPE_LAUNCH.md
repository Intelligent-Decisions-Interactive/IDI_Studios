# AutoBattle Stripe launch runbook

## Accepted implementation plan

Stripe's implementation planner accepted guide `iguide_61VNDXC40TWfHDe2p41P20duDHpBz` for the **Intelligent Decisions Interactive sandbox**.

- Primary flow: Stripe-hosted Checkout for web purchases, using dynamic payment methods.
- Tax: Stripe Automatic Tax with a business-approved product tax code.
- Invoicing: Dashboard-created invoices and Stripe's Hosted Invoice Page for exceptional or assisted sales; these remain a supplemental, manually reconciled path at launch.
- Android: no purchase link is added to the app until Managed Payments eligibility, country support, and the applicable store policy are confirmed.
- Fulfillment: only a verified Stripe webhook may create a Stripe order and grant tokens. The browser success redirect never grants value.

The private owner Android application in the AutoBattle repository remains offline. Commerce belongs to this website and the separate public Android project; no payment code or token boundary should be copied into the private application.

## Product catalog

The Supabase `autobattle_products` table remains authoritative. Checkout uses inline Stripe price data so Stripe product or price IDs never become the permanent product model.

| SKU | Purchased tokens | Bonus tokens | Listed price |
| --- | ---: | ---: | ---: |
| `tokens_5` | 5 | 0 | $0.99 |
| `tokens_25` | 25 | 5 | $4.99 |
| `tokens_50` | 50 | 10 | $9.99 |
| `tokens_100` | 100 | 25 | $19.99 |
| `tokens_250` | 250 | 50 | $49.99 |
| `tokens_500` | 500 | 100 | $99.99 |

A verified `founding-clan` redemption with an active, unlimited entitlement receives 50% off every pack. Prices round up to the next cent; bonuses do not change.

## Required environment values

Configure these as deployment secrets or environment values. Do not put real values in `.dev.vars`, a committed file, chat, logs, or issue text.

| Name | Secret | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Yes | Stripe restricted/test secret used to create Checkout Sessions. Start with a test key. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Signing secret for this endpoint and environment. |
| `STRIPE_AUTOBATTLE_TAX_CODE` | No | Stripe Tax code approved for AutoBattle's software/digital-service classification. |
| `AUTOBATTLE_PUBLIC_ORIGIN` | No | Exact HTTPS origin that hosts this site, with no path or trailing slash. |
| `STRIPE_ALLOW_LIVE_MODE` | No | Leave absent or `false` during testing. Set to `true` only during an approved live launch. |

The code rejects live secret keys and live webhook events unless `STRIPE_ALLOW_LIVE_MODE=true`. This flag is a deliberate final-approval gate, not a substitute for separating Stripe test and live credentials.

## Test-mode setup

1. Apply `supabase/migrations/20260909180159_autobattle_stripe_checkout.sql` to the intended non-production Supabase environment.
2. In Stripe test mode, enable Stripe Tax and confirm the business's origin address, registrations, default tax behavior, and chosen AutoBattle tax code. Do not guess the tax classification; have the business owner or tax adviser approve it.
3. Configure the four test values above, keeping `STRIPE_ALLOW_LIVE_MODE` absent or false.
4. Register `https://<AUTOBATTLE_PUBLIC_ORIGIN>/api/autobattle/stripe/webhook` for:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `charge.refunded`
   - `credit_note.created`
5. Complete one full-price and one founding-clan test checkout. Confirm the order, tax total, event record, separate purchased/bonus ledger deltas, account activation, and exactly-once behavior after replaying the event.
6. Exercise a failed or delayed payment and confirm no tokens are granted before `payment_status=paid`.

Do not publish or switch to live keys until the migration, test-mode webhooks, Tax configuration, refund procedure, support copy, and final business approval are complete.

## Invoicing and manual fallback

For an assisted purchase, create the invoice in the Stripe Dashboard, use a line description containing the pack SKU and purchased/bonus token counts, and place the AutoBattle account/order reference in invoice metadata. Use Stripe's Hosted Invoice Page for collection.

At launch, invoice, refund, and credit-note events are recorded as `needs_review`; they do not automatically grant or remove tokens. An administrator reconciles them and uses the existing manual purchase form with the Stripe invoice, payment, or receipt ID as the payment reference. The manual RPC and token-ledger idempotency rules prevent the same reference from being fulfilled twice.

Refunds are also reviewed manually. Do not automatically create a negative balance or claw back tokens that may already have been consumed. Record the business decision through the existing adjustment/refund process and retain the Stripe reference in the audit metadata.

## Security and operations

- Checkout requires a signed-in AutoBattle account and a same-origin POST.
- The server fetches the pack and permanent founding discount from Supabase; client-supplied prices are ignored.
- Checkout retries carry a per-attempt UUID into Stripe's idempotency key.
- Automatic Tax is enabled and tax is added to, not removed from, the advertised pack price.
- The webhook verifies the signature against the unmodified raw body with a five-minute tolerance.
- Fulfillment rechecks SKU, currency, pre-tax charged amount, founding entitlement, and tax arithmetic in one database transaction.
- Stripe event IDs, Checkout IDs, order constraints, and the token-ledger key make delivery exactly once across webhook retries.
- Only minimal reconciliation metadata is stored. Full Stripe payloads and customer payment details are not persisted.
- If Stripe or webhook fulfillment is unavailable, leave the purchase uncredited and use the documented manual fallback after verifying payment in Stripe.
