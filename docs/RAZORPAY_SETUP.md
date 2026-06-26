# Razorpay setup guide — Pandit G (WhatsApp consultations)

Complete checklist to configure Razorpay **before** we wire payments into the Pandit G WhatsApp bot.

**Business model (current):**

- ₹151 per **3 minutes** of personal guidance  
- **30-minute** consultation window per paid session  
- User chats on WhatsApp → funnel → paid deep consultation  

**Recommended integration for WhatsApp:** Razorpay **Payment Links** or **Orders + hosted Checkout** (user taps link in WhatsApp → pays on Razorpay page → webhook confirms → bot unlocks session).

Native WhatsApp Pay (Meta) is a separate, longer onboarding path; this guide focuses on **Razorpay**, which matches your privacy page and is fastest to ship.

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)  
2. [Razorpay account & KYC](#2-razorpay-account--kyc)  
3. [Dashboard: keys, modes, settlement](#3-dashboard-keys-modes-settlement)  
4. [Define products & pricing](#4-define-products--pricing)  
5. [Payment Links (recommended v1)](#5-payment-links-recommended-v1)  
6. [Webhooks (required)](#6-webhooks-required)  
7. [Environment variables (Vercel + local)](#7-environment-variables-vercel--local)  
8. [Meta / WhatsApp considerations](#8-meta--whatsapp-considerations)  
9. [MongoDB data we will store (code phase)](#9-mongodb-data-we-will-store-code-phase)  
10. [Test mode walkthrough](#10-test-mode-walkthrough)  
11. [Go live checklist](#11-go-live-checklist)  
12. [GST, invoices & compliance (India)](#12-gst-invoices--compliance-india)  
13. [Troubleshooting](#13-troubleshooting)  
14. [What we will build in code (next step)](#14-what-we-will-build-in-code-next-step)

---

## 1. Architecture overview

```
User on WhatsApp
    │
    ▼
Pandit G bot (after funnel / when user wants paid session)
    │
    ├─► Create Razorpay Payment Link or Order (server-side, ₹151 × blocks)
    │
    ├─► Send payment URL in WhatsApp text message
    │
    ▼
User pays on Razorpay (UPI / card / wallet)
    │
    ▼
Razorpay webhook → POST /api/webhooks/razorpay (we will add)
    │
    ├─► Verify signature
    ├─► Mark payment PAID in MongoDB
    ├─► Start 30-minute session timer for that phone number
    │
    ▼
Bot continues full AI consultation until session ends
```

**Why webhooks matter:** Never trust “payment success” only from the user’s browser. Razorpay must call your server with `payment.captured` / `payment_link.paid`.

---

## 2. Razorpay account & KYC

1. Log in: [https://dashboard.razorpay.com](https://dashboard.razorpay.com)  
2. Complete **Account & Settings → Account details**:
   - Business name (e.g. Pandit G / your legal entity name)
   - Business type (Proprietorship / LLP / Pvt Ltd — use what matches your bank account)
   - Category: **Astrology / spiritual services** or closest match
   - Website: your Vercel domain (e.g. `https://your-app.vercel.app`) — required even if payments happen on WhatsApp
3. Complete **KYC**:
   - PAN (business or proprietor)
   - GSTIN (if registered; optional for small sellers below threshold but recommended)
   - Bank account for settlements
   - Authorized signatory ID
4. Wait for account activation (test mode works immediately; **live payments** need activated account).

**Test vs Live**

| Mode | Keys prefix | Real money |
|------|-------------|------------|
| Test | `rzp_test_` | No |
| Live | `rzp_live_` | Yes |

Toggle: top-left of Razorpay Dashboard → **Test Mode** on/off.

---

## 3. Dashboard: keys, modes, settlement

### 3.1 API keys

1. **Settings → API Keys**  
   ([https://dashboard.razorpay.com/app/keys](https://dashboard.razorpay.com/app/keys))  
2. Generate keys for **Test** first, then **Live** when going production.  
3. You will get:
   - **Key ID** — public, safe in server env (sometimes exposed in client for Checkout; we prefer server-only Payment Links for WhatsApp)
   - **Key Secret** — **never** commit to git; Vercel env only

### 3.2 Payment methods

**Settings → Payment methods**

Enable for India users:

- [x] UPI  
- [x] Cards  
- [x] Netbanking  
- [x] Wallets (optional)  

WhatsApp users overwhelmingly pay via **UPI** — ensure UPI is on.

### 3.3 Settlement

**Transactions → Settlements**

- Note settlement cycle (T+2/T+3 business days typical)  
- Confirm bank account is verified  
- Set **Customer support email/phone** in Settings → Business settings (shown on checkout)

---

## 4. Define products & pricing

Align Razorpay config with Pandit G pricing.

### Option A — Single block (simplest v1)

| Item | Amount | Notes |
|------|--------|--------|
| 1 consultation block | **₹151** | 3 minutes of guidance |
| Session cap | 30 minutes | = max 10 blocks if billed per 3 min |

For v1 you can sell **one block (₹151)** to start a **30-minute window** (marketing: “₹151 session”), or sell **₹1,510** for full 30 min upfront — **decide with client** before code.

**Suggested v1 (simple UX):**  
**₹151 = unlock one 30-minute WhatsApp consultation session** (not per-minute metering in v1). Easier for users and webhook logic.

Document your decision here:

```
PRICING_MODEL=session_flat
SESSION_PRICE_INR=151
SESSION_DURATION_MINUTES=30
```

### Option B — Per 3-minute blocks

| Blocks | Amount |
|--------|--------|
| 1 block (3 min) | ₹151 |
| 10 blocks (30 min) | ₹1,510 |

Code will pass `amount` in paise: `15100` = ₹151.00.

---

## 5. Payment Links (recommended v1)

Best for WhatsApp: no app, no website checkout page required.

### 5.1 Create a test link manually (sanity check)

1. Dashboard → **Payment Links → Create payment link**  
2. Amount: **₹151**  
3. Description: `Pandit G — WhatsApp consultation (30 min)`  
4. Customer notification: your email (optional)  
5. **Reference ID**: use something unique you’ll recognize, e.g. `panditg_test_001`  
6. Save → copy short URL → open on phone → pay in **test mode**

### 5.2 What we’ll do in code (later)

Server will call Razorpay API:

```http
POST https://api.razorpay.com/v1/payment_links
```

With body including:

- `amount` (in **paise**, e.g. `15100`)  
- `currency`: `INR`  
- `description`  
- `customer`: `{ "contact": "+91...", "name": "..." }` if available from WhatsApp  
- `notes`: `{ "phone": "9198...", "session_type": "consultation" }` — **critical for webhook matching**  
- `callback_url` / `callback_method` (optional thank-you page on your site)  
- `expire_by` (optional link expiry unix timestamp)

Bot sends `short_url` in WhatsApp.

**Docs:** [Payment Links API](https://razorpay.com/docs/api/payments/payment-links/create-standard/)

### 5.3 Alternative: Orders + Checkout

Use if you need more control (coupons, multiple items):

1. Create **Order** (`POST /v1/orders`)  
2. Open Razorpay Checkout with `order_id` on a small web page  
3. Send that page URL in WhatsApp  

More moving parts; Payment Links are enough for v1.

---

## 6. Webhooks (required)

### 6.1 Create webhook in Razorpay

1. **Settings → Webhooks → Add New Webhook**  
2. **Webhook URL (production):**

   ```
   https://YOUR_VERCEL_DOMAIN/api/webhooks/razorpay
   ```

   Example: `https://pandit-g.vercel.app/api/webhooks/razorpay`

3. **Secret:** click **Generate** → copy and save as `RAZORPAY_WEBHOOK_SECRET` (you cannot view it again later; regenerate if lost)

4. **Alert email:** your email

5. **Active events** — enable at minimum:

   | Event | Why |
   |-------|-----|
   | `payment.captured` | Payment successful |
   | `payment.failed` | Log / notify user |
   | `payment_link.paid` | If using Payment Links |
   | `order.paid` | If using Orders |
   | `refund.processed` | If you issue refunds |

6. **Save**

### 6.2 Local testing webhooks

Razorpay cannot hit `localhost`. Options:

**A. ngrok (recommended)**

```bash
ngrok http 3000
```

Webhook URL:

```
https://YOUR_NGROK_ID.ngrok-free.app/api/webhooks/razorpay
```

**B. Razorpay Dashboard → Webhook → Send test webhook**  
After we deploy the route, use “Send test webhook” to verify 200 OK.

### 6.3 Security (we will implement)

- Verify `X-Razorpay-Signature` header using webhook secret  
- Idempotency: store `payment_id` / `event_id` in MongoDB; ignore duplicates  
- Never unlock session on client-side redirect alone  

**Docs:** [Webhook validation](https://razorpay.com/docs/webhooks/validate-test/)

---

## 7. Environment variables (Vercel + local)

Add these to **`.env.local`** (local) and **Vercel → Project → Settings → Environment Variables** (Production + Preview).

```env
# ─── Razorpay ─────────────────────────────────────────────
# Test keys first; swap to live when going production
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# "test" or "live" — helps logging / guards in code
RAZORPAY_MODE=test

# Pricing (paise = INR × 100)
CONSULTATION_PRICE_PAISE=15100
CONSULTATION_DURATION_MINUTES=30

# Public site URL (for callback/thank-you page later)
NEXT_PUBLIC_APP_URL=https://YOUR_VERCEL_DOMAIN
```

| Variable | Where to get it |
|----------|-----------------|
| `RAZORPAY_KEY_ID` | Dashboard → API Keys |
| `RAZORPAY_KEY_SECRET` | Same (shown once on generate) |
| `RAZORPAY_WEBHOOK_SECRET` | Dashboard → Webhooks → your webhook |
| `CONSULTATION_PRICE_PAISE` | Your pricing decision (15100 = ₹151) |

**Security rules**

- Do **not** put `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` in `NEXT_PUBLIC_*`  
- Do **not** commit `.env.local`  
- Rotate secrets if leaked  

After adding vars on Vercel → **Redeploy**.

---

## 8. Meta / WhatsApp considerations

### 8.1 Sending payment links in chat

WhatsApp allows plain URLs in text messages. Bot will send something like:

> आपका परामर्श सत्र शुरू करने के लिए यहाँ भुगतान करें: https://rzp.io/i/xxxx  

**Tips:**

- Use Razorpay **short_url** from Payment Links API  
- Optional: add a simple thank-you page on your site (`/payment/success`) as `callback_url`  
- Meta may flag spam if you send payment links too aggressively — only after user agrees to paid session  

### 8.2 WhatsApp native payments (optional, later)

Meta has **WhatsApp Pay / payments API** (India rollout varies). That is **not** Razorpay-in-chat-native; it’s a separate Meta onboarding. Razorpay link-in-message is the practical path now.

### 8.3 Webhook fields (already configured)

Your WhatsApp webhook stays at:

```
/api/webhooks/whatsapp
```

Razorpay gets its **own** route:

```
/api/webhooks/razorpay
```

No change to Meta setup for Razorpay v1.

---

## 9. MongoDB data we will store (code phase)

Prepare Atlas — we’ll extend the `conversations` collection or add `payments` / `sessions`:

```javascript
// payments collection (planned)
{
  phone: "919876543210",
  razorpayPaymentId: "pay_xxxxx",
  razorpayPaymentLinkId: "plink_xxxxx",
  orderId: "order_xxxxx",           // if using orders
  amountPaise: 15100,
  currency: "INR",
  status: "created" | "paid" | "failed" | "expired",
  createdAt: ISODate(),
  paidAt: ISODate(),
  webhookEventIds: ["evt_xxxxx"]    // idempotency
}

// sessions collection (planned)
{
  phone: "919876543210",
  paymentId: "pay_xxxxx",
  startsAt: ISODate(),
  endsAt: ISODate(),                // startsAt + 30 minutes
  status: "active" | "expired",
  messagesAllowed: true
}
```

**Index ideas:** `phone`, `status`, `razorpayPaymentId` (unique).

You don’t need to create these manually — we’ll add them in code.

---

## 10. Test mode walkthrough

### 10.1 Test API keys

1. Dashboard → **Test Mode ON**  
2. Copy **Test** Key ID + Secret → `.env.local`

### 10.2 Test UPI

In test checkout, Razorpay provides test UPI flows. Follow on-screen test instructions in the payment page.

### 10.3 Test cards (Razorpay standard)

| Field | Value |
|-------|--------|
| Card number | `4111 1111 1111 1111` |
| Expiry | any future date |
| CVV | any 3 digits |
| OTP | use Razorpay test OTP shown on screen |

**Docs:** [Test card details](https://razorpay.com/docs/payments/payments/test-card-details/)

### 10.4 Manual checklist

- [ ] Create payment link in Dashboard (test)  
- [ ] Pay successfully in test mode  
- [ ] See payment under **Transactions → Payments**  
- [ ] Webhook endpoint returns 200 (after we deploy route)  
- [ ] `payment.captured` appears in **Webhooks → Logs**  
- [ ] Wrong signature rejected (after code)  

---

## 11. Go live checklist

### Razorpay

- [ ] KYC fully approved  
- [ ] Switch to **Live Mode**  
- [ ] Generate **Live** API keys  
- [ ] Create **Live** webhook with production URL  
- [ ] Live webhook secret in Vercel  
- [ ] Payment methods enabled (UPI, cards)  
- [ ] Bank settlement account verified  
- [ ] Support contact visible on checkout  

### Vercel

- [ ] All `RAZORPAY_*` env vars set for **Production**  
- [ ] `RAZORPAY_MODE=live`  
- [ ] Redeploy production  
- [ ] `NEXT_PUBLIC_APP_URL` = real domain  

### App / legal

- [ ] Privacy policy mentions Razorpay (already on `/privacy`)  
- [ ] Refund policy decided (consultation services — document on site)  
- [ ] Terms for session duration (30 min) clear in WhatsApp copy  

### Smoke test (live)

- [ ] Real ₹1–₹151 test payment with your own UPI (live)  
- [ ] Confirm settlement appears in dashboard  
- [ ] Confirm bot unlocks session (after code)  

---

## 12. GST, invoices & compliance (India)

**Not legal advice — confirm with your CA.**

| Topic | Action |
|-------|--------|
| GST registration | Required if turnover crosses threshold; optional GSTIN in Razorpay if registered |
| Invoices | Razorpay can send payment receipts; issue GST invoice separately if registered |
| HSN/SAC | Consultation services often use relevant SAC code — ask CA |
| Refunds | Dashboard → Payments → Issue refund; enable `refund.processed` webhook |

Razorpay **Settings → Invoices** — configure business name, address, logo for customer receipts.

---

## 13. Troubleshooting

| Problem | Fix |
|---------|-----|
| `Authentication failed` | Wrong key id/secret; test vs live mismatch |
| Webhook 401/403 | Signature verification failed — check `RAZORPAY_WEBHOOK_SECRET` |
| Webhook not firing | URL must be HTTPS public; check Webhooks → Logs |
| Payment link expired | Increase `expire_by` or create new link |
| User paid but bot silent | Webhook not processed — check Vercel logs + MongoDB |
| UPI not showing | Enable UPI in Payment methods; complete KYC |
| Live payments blocked | Account activation pending |

**Razorpay support:** Dashboard → Help & Support  
**Status:** [https://status.razorpay.com](https://status.razorpay.com)

---

## 14. What we will build in code (next step)

After you finish this setup, tell us and we will implement:

| Piece | Path (planned) |
|-------|----------------|
| Razorpay client | `lib/razorpay/client.ts` |
| Create payment link | `lib/razorpay/create-consultation-link.ts` |
| Webhook handler | `app/api/webhooks/razorpay/route.ts` |
| Session unlock logic | `lib/payments/sessions.ts` |
| Bot: offer pay after funnel | `lib/whatsapp/handlers/ai.ts` |
| Pay command / keywords | “शुल्क”, “payment”, “परामर्श शुरू” |
| MongoDB payments + sessions | `lib/db/payments.ts` |

**User journey (planned):**

1. Free funnel (welcome → ask details → reading)  
2. Bot offers paid session → user says yes  
3. Bot creates Payment Link → sends URL on WhatsApp  
4. User pays → webhook marks `paid` → 30-min session active  
5. Full AI consultation; after expiry, prompt to pay again  

---

## Quick reference links

| Resource | URL |
|----------|-----|
| Razorpay Dashboard | https://dashboard.razorpay.com |
| API Keys | https://dashboard.razorpay.com/app/keys |
| Webhooks | https://dashboard.razorpay.com/app/webhooks |
| Payment Links API | https://razorpay.com/docs/api/payments/payment-links/ |
| Webhook docs | https://razorpay.com/docs/webhooks/ |
| Test payments | https://razorpay.com/docs/payments/payments/test-card-details/ |
| Node SDK (we may use) | https://github.com/razorpay/razorpay-node |

---

## Your action items (do these now)

1. [ ] Complete Razorpay KYC + bank account  
2. [ ] Copy **Test** `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` into `.env.local`  
3. [ ] Create one **test Payment Link** (₹151) and pay it yourself  
4. [ ] Create webhook pointing to `https://YOUR_DOMAIN/api/webhooks/razorpay` (can deploy placeholder first)  
5. [ ] Save `RAZORPAY_WEBHOOK_SECRET`  
6. [ ] Add all env vars to **Vercel Production**  
7. [ ] Decide pricing model: **flat ₹151 / 30 min** vs **₹151 per 3 min**  
8. [ ] Message here when done → we implement code  

---

*Pandit G — Razorpay setup guide. Update this file when keys, domains, or pricing change.*
