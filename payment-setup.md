# Native WhatsApp Pay (In-Chat) + Razorpay setup (Meta)

**Chosen product decision for Pandit G:**  
**Native WhatsApp Pay flow (in-chat)** — not Razorpay payment links, not an external browser checkout as the primary path.

**What “Native / In-Chat” means:**
- Bot sends a WhatsApp interactive **`order_details`** invoice bubble
- User sees **Pay Now** inside WhatsApp (`order.type = "quick_pay"`)
- User pays with UPI / card / etc. **without leaving WhatsApp**
- Money is collected via **Razorpay** linked as Meta Payment Gateway
- Pandit G unlocks the paid session only after WhatsApp payment confirmation

**Product (Pandit G):**

- Amount: **₹151** (configurable)
- Session: **30 minutes** WhatsApp consultation after payment
- Flow: free reading → native **Pay Now** bubble → pay in WhatsApp → webhook confirms → unlock paid session

This document is **setup only** (Meta + Razorpay). Coding comes after these steps are done.

Official references:

- Meta Payments (India PG): [Payment Gateway deep integration](https://developers.facebook.com/docs/whatsapp/cloud-api/payments-api/payments-in/pg/)
- Meta Payments overview: [Payments API — India](https://developers.facebook.com/docs/whatsapp/cloud-api/payments-api/payments-in/)
- Meta payment configuration APIs: [Onboarding APIs](https://developers.facebook.com/docs/whatsapp/cloud-api/payments-api/payments-in/onboarding-apis/)
- Razorpay WhatsApp integrate: [Link Razorpay to WABA](https://razorpay.com/docs/payments/whatsapp/integrate/)

---



## Table of contents

1. [What changes vs payment links](#1-what-changes-vs-payment-links)
2. [Prerequisites checklist](#2-prerequisites-checklist)
3. [Architecture (target)](#3-architecture-target)
4. [Step A — Razorpay account ready](#4-step-a--razorpay-account-ready)
5. [Step B — Meta / WhatsApp Business Account ready](#5-step-b--meta--whatsapp-business-account-ready)
6. [Step C — Create payment configuration (link Razorpay ↔ WhatsApp)](#6-step-c--create-payment-configuration-link-razorpay--whatsapp)
7. [Step D — Verify configuration is Active](#7-step-d--verify-configuration-is-active)
8. [Step E — Subscribe to payment webhooks](#8-step-e--subscribe-to-payment-webhooks)
9. [Step F — Manual test of Pay Now (before coding)](#9-step-f--manual-test-of-pay-now-before-coding)
10. [Values we will need in code /](#10-values-we-will-need-in-code--env) `.env`
11. [Pandit G message shape (for later coding)](#11-pandit-g-message-shape-for-later-coding)
12. [Go-live checklist](#12-go-live-checklist)
13. [Common blockers](#13-common-blockers)
14. [When setup is done — tell the developer](#14-when-setup-is-done--tell-the-developer)

---



## 1. Native in-chat Pay vs old payment links

| Old (Payment Link) | **Chosen: Native WhatsApp Pay (In-Chat)** |
| --- | --- |
| Bot sends `https://rzp.io/...` text | Bot sends interactive `order_details` bubble |
| User leaves WhatsApp → browser | User taps **Pay Now** inside WhatsApp |
| Checkout is Razorpay hosted page | Checkout is WhatsApp-native (Razorpay PG behind Meta) |
| Confirm mainly via Razorpay webhook | Confirm via **WhatsApp payment webhook** + payment lookup |
| No Meta payment config | Must link Razorpay in Meta as **payment configuration** |

**Mode on Meta:** Payment Gateway Deep Integration → **Razorpay**  
**Button UX:** `order.type = "quick_pay"` → only **Pay Now** (hide “Review and Pay”)  
**Primary UX:** Native in-chat only. Payment links are **not** the product path (optional emergency fallback only if Meta payments are down).

---



## 2. Prerequisites checklist

Before linking, confirm all of these:

### Razorpay

- [ ] Live Razorpay account activated (KYC + bank done)
- [ ] Business website / app URL present (e.g. `https://panditg.live`)
- [ ] UPI + Cards enabled in Razorpay payment methods
- [ ] You can log in as the Razorpay account **owner / admin** (needed for OAuth allow)



### Meta / WhatsApp

- [ ] WhatsApp Business Account (WABA) live
- [ ] Phone number live (Pandit G number, currently used for Cloud API)
- [ ] Cloud API access token works (you already send messages)
- [ ] Business Manager access to the **same** WABA that owns the phone number
- [ ] WABA is **self-owned** (most Cloud API setups) **or** you know your BSP owns it (OBO)



### Business

- [ ] Legal / brand name ready (shown on checkout)
- [ ] Consultation amount finalized (₹151 → `15100` paise in API)

If any item is missing, finish that first. Payment config linking will fail otherwise.

---



## 3. Architecture (target)

```
User finishes free reading on WhatsApp
            │
            ▼
Pandit G server
  - creates unique reference_id (e.g. pg-9188...-1712345678)
  - sends interactive order_details (Pay Now / quick_pay)
  - payment_settings → type: razorpay + configuration_name
            │
            ▼
User taps Pay Now inside WhatsApp
  - pays via UPI / card / etc. through Razorpay checkout in WA
            │
            ▼
Meta WhatsApp webhook (statuses type: payment)
  → POST https://panditg.live/api/webhooks/whatsapp
  - status: captured / pending / failed
  - payment.reference_id
  - payment.transaction.id (Razorpay order id)
  - payment.transaction.pg_transaction_id (Razorpay payment id)
            │
            ▼
Pandit G server
  - verify / look up payment (Meta payment lookup API recommended)
  - mark payment paid in MongoDB
  - start 30-min consultation session
  - send confirmation + unlock paid replies
```

**Important security note (from Meta):** do **not** unlock the session using webhook alone. Always confirm with Meta’s payment lookup API (and/or Razorpay) before starting the consultation.

---



## 4. Step A — Razorpay account ready

1. Open [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Confirm account is **Live** (not only Test) if you want real payments.
3. **Settings → Business details**
  - Business name matches what customers should see
  - Website: `https://panditg.live` (or your live domain)
4. **Settings → Payment methods**
  - Enable **UPI** (mandatory for WhatsApp India)
  - Enable Cards / Netbanking as needed
5. Keep **Key ID / Key Secret** available (still useful for lookup / refunds / reconciliation).
6. Optional but useful: note your Razorpay **Merchant ID** / account email used for login.

No special “WhatsApp product” toggle is required inside Razorpay first — linking is initiated from **Meta**, then Razorpay asks you to **Allow**.

---



## 5. Step B — Meta / WhatsApp Business Account ready

1. Open [Meta Business Suite](https://business.facebook.com/) with the admin that owns Pandit G.
2. Confirm you can see:
  - Business Manager
  - WhatsApp Accounts → your WABA
  - Phone number used by Cloud API
3. Note these IDs (Meta → WhatsApp → API Setup / Business settings):


| Value           | Where                         | Example        |
| --------------- | ----------------------------- | -------------- |
| WABA ID         | WhatsApp Business Account ID  | `10229...`     |
| Phone number ID | Cloud API → Phone number ID   | `10987...`     |
| Display number  | Business WhatsApp number      | `+91 88154...` |
| App ID          | Meta App that holds the token | —              |


1. Confirm your current webhook URL still works:
  - `https://panditg.live/api/webhooks/whatsapp`
2. You will later need webhook fields that include **payment statuses** (see Step E).

---



## 6. Step C — Create payment configuration (link Razorpay ↔ WhatsApp)

You need a **payment configuration** with a unique `configuration_name`.  
That name is what the bot will send inside every Pay Now message.

There are **two ways**. Prefer UI first; use API if UI is missing.

### Option 1 — Meta Business Suite / WhatsApp Manager (recommended)

Exact menu labels can vary slightly; look for **Payment methods** / **Payments** under the WABA.

1. Log in to **Meta Business Suite** / **WhatsApp Manager**.
2. Open your **WhatsApp Business Account** (Pandit G WABA).
3. Go to **Payment methods** (sometimes under **Account tools** / **Settings**).
4. Click **Add direct payment method** / **Create payment configuration**.
5. Fill the form:
  - **Configuration name** — choose something stable and short, e.g.  
   `panditg-razorpay-live`  
   (max 60 chars; this exact string goes into code later)
  - **Payment type / provider** — **Payment Gateway**
  - **Gateway** — **Razorpay**
  - **MCC / Purpose code** — use values Meta suggests for your category  
  (services / professional services style MCC if astrology-specific is unavailable; keep defaults if UI pre-fills)
6. Submit.
7. You will be redirected to **Razorpay**.
8. Log in with the **correct Razorpay account**.
9. Click **Allow / Authorize** so Meta can request payments on your behalf.
10. Return to Meta. Status should move from **Needs connecting** → **Active**.



#### If your WABA is BSP-owned (OBO)

1. Ask your BSP to create the Direct Pay Method and choose Razorpay.
2. BSP shares the Razorpay authorization link with you.
3. You open that link, log into Razorpay, Allow Meta.
4. BSP / Meta shows configuration Active.
5. BSP must share the exact `configuration_name` with you.

For Pandit G Cloud API on Hostinger, you are usually on a **self-owned WABA** — Option 1 applies.

### Option 2 — Graph API (if UI is unavailable)

Use a System User / permanent token with permissions to manage the WABA.

```bash
curl -X POST \
  "https://graph.facebook.com/v22.0/<WABA_ID>/payment_configuration" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "configuration_name": "panditg-razorpay-live",
    "provider_name": "razorpay",
    "purpose_code": "00",
    "merchant_category_code": "0000",
    "redirect_url": "https://panditg.live"
  }'
```

Notes:

- `provider_name` must be `"razorpay"`.
- Response / follow-up will include a connect URL if status is **Needs_Connecting**.
- Open that URL, log into Razorpay, Allow Meta.
- Then list configurations to confirm **Active**.

List configs:

```bash
curl -X GET \
  "https://graph.facebook.com/v22.0/<WABA_ID>/payment_configurations" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---



## 7. Step D — Verify configuration is Active

In Meta payment methods screen (or via list API), confirm:


| Field              | Expected                     |
| ------------------ | ---------------------------- |
| Configuration name | e.g. `panditg-razorpay-live` |
| Provider           | Razorpay                     |
| Status             | **Active**                   |


If status is:

- **Needs_Connecting** → finish Razorpay Allow step
- **Needs_Verification** / pending → wait / contact Meta Direct Support (case type: **WaBiz: Business Payments API**)
- Invalid / missing → recreate with a new configuration name

**Save this name exactly.** Typo = customer cannot pay.

---



## 8. Step E — Subscribe to payment webhooks

Your existing WhatsApp webhook already receives message statuses. For Pay Now you also need **payment** updates on the same webhook.

1. Meta App → **WhatsApp → Configuration → Webhook**.
2. Callback URL (keep as today):
  `https://panditg.live/api/webhooks/whatsapp`
3. Ensure the app is subscribed to the WABA **messages** field (already used).
4. Payment updates arrive as `statuses` entries with `"type": "payment"`.
5. After coding, we will handle:
  - `status: captured` → unlock session
  - `status: pending` → wait / soft confirm
  - `failed` → tell user to retry / send new Pay Now

Also keep Razorpay webhooks enabled as a **backup reconciliation** path (optional but recommended).

---



## 9. Step F — Manual test of Pay Now (before coding)

Do this once with Postman / curl using your live Cloud API token.  
Purpose: prove Meta ↔ Razorpay linking works **before** we change Pandit G code.

### F.1 Prepare values

- `PHONE_NUMBER_ID` — from Meta API Setup  
- `ACCESS_TOKEN` — permanent token  
- `TO` — your personal WhatsApp number in international format without `+` (e.g. `91xxxxxxxxxx`)  
- `CONFIGURATION_NAME` — exact Active name from Step D  
- `REFERENCE_ID` — unique, e.g. `test-pg-001` (letters/numbers/`_`/`-`/`.` only, ≤ 35 chars)



### F.2 Send order_details with Pay Now (`quick_pay`)

```bash
curl -X POST "https://graph.facebook.com/v22.0/<PHONE_NUMBER_ID>/messages" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "<TO>",
    "type": "interactive",
    "interactive": {
      "type": "order_details",
      "body": {
        "text": "आपका 30 मिनट का परामर्श सत्र शुरू करने के लिए भुगतान करें।"
      },
      "footer": {
        "text": "Pandit G"
      },
      "action": {
        "name": "review_and_pay",
        "parameters": {
          "reference_id": "test-pg-001",
          "type": "digital-goods",
          "payment_settings": [
            {
              "type": "payment_gateway",
              "payment_gateway": {
                "type": "razorpay",
                "configuration_name": "panditg-razorpay-live",
                "razorpay": {
                  "receipt": "test-pg-001",
                  "notes": {
                    "phone": "<TO>",
                    "purpose": "consultation"
                  }
                }
              }
            }
          ],
          "currency": "INR",
          "total_amount": {
            "value": 15100,
            "offset": 100
          },
          "order": {
            "status": "pending",
            "type": "quick_pay",
            "items": [
              {
                "name": "30 min WhatsApp consultation",
                "amount": {
                  "value": 15100,
                  "offset": 100
                },
                "quantity": 1,
                "country_of_origin": "India",
                "importer_name": "Pandit G",
                "importer_address": {
                  "address_line1": "Lucknow",
                  "city": "Lucknow",
                  "zone_code": "UP",
                  "postal_code": "226001",
                  "country_code": "IN"
                }
              }
            ],
            "subtotal": {
              "value": 15100,
              "offset": 100
            },
            "tax": {
              "value": 0,
              "offset": 100,
              "description": "Included"
            }
          }
        }
      }
    }
  }'
```



### F.3 What you should see on WhatsApp

1. An order / invoice bubble from Pandit G.
2. A **Pay Now** button (because of `"type": "quick_pay"`).
3. Tapping opens WhatsApp/Razorpay checkout (UPI etc.).
4. After successful pay, Razorpay shows success and Meta emits a payment webhook.



### F.4 If Pay Now does not appear / pay fails


| Symptom                                 | Likely cause                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| Message send error about payment config | Wrong / inactive `configuration_name`                                        |
| Message sends but no Pay button         | Missing `"type": "quick_pay"` on `order`                                     |
| Opens then fails at Razorpay            | Razorpay not Allowed / wrong Razorpay account linked                         |
| Works in one number only                | Recipient must be able to message the business (24h window / user-initiated) |
| Amount mismatch error                   | `total_amount` must equal subtotal + tax + shipping − discount               |


---



## 10. Values we will need in code / `.env`

After setup, collect and store (do **not** commit secrets):

```env
# Already exist today
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
CONSULTATION_PRICE_PAISE=15100
CONSULTATION_DURATION_MINUTES=30
APP_URL=https://panditg.live

# Native WhatsApp Pay (In-Chat) — filled after Meta linking
WHATSAPP_PAYMENTS_ENABLED=true
WHATSAPP_PAYMENT_CONFIGURATION_NAME=panditg-razorpay-live
WHATSAPP_WABA_ID=3542053639266394
RAZORPAY_MERCHANT_ID=acc_T6d76cvf3bfmQT
WHATSAPP_PAYMENT_LINK_FALLBACK=false
```

**Pandit G values (from Meta payment config screen — Active + test passed):**

| Env | Value |
|-----|--------|
| `WHATSAPP_PAYMENT_CONFIGURATION_NAME` | `panditg-razorpay-live` |
| `WHATSAPP_WABA_ID` | `3542053639266394` |
| `RAZORPAY_MERCHANT_ID` | `acc_T6d76cvf3bfmQT` |
| MCC | `8999` Professional services |
| Purpose code | `00` |

These are already written into `.env.local` / `.env.example`.

---



## 11. Pandit G message shape (for later coding)

When we code, the bot will stop sending `rzp.io` text links for the main CTA and instead send:

1. Short Hindi body (offer / expired session ask)
2. Interactive `order_details` with:
  - `type: digital-goods`
  - `payment_gateway.type: razorpay`
  - `configuration_name: <from env>`
  - `order.type: quick_pay` → **Pay Now**
  - `razorpay.notes.phone` = WhatsApp user phone
  - unique `reference_id` stored in MongoDB
3. On WhatsApp payment webhook `captured`:
  - mark paid
  - start session
  - send “दक्षिणा प्राप्त हुई…” confirmation
4. Optionally send `order_status` update message (`captured`) so the bubble shows paid

**Product default = Native Pay Now only.**  
Optional emergency fallback to old `rzp.io` links can be kept behind a feature flag, but users should normally only see the in-chat **Pay Now** bubble.

---



## 12. Go-live checklist

- [ ] Razorpay Live KYC complete; UPI on
- [ ] Meta payment configuration **Active**
- [ ] Exact `configuration_name` saved
- [ ] Manual curl/Postman Pay Now test succeeds on a real phone
- [ ] Webhook URL reachable over HTTPS
- [ ] Payment webhook payload observed in logs / Meta test tools
- [ ] Amount matches product (`15100` = ₹151.00)
- [ ] Business name on checkout looks correct
- [ ] Refund path known (Razorpay dashboard) for failed sessions / disputes
- [ ] Ready for code change (feature flag recommended)

---



## 13. Common blockers

1. **Payments API not available on the WABA**
  India Payments on WhatsApp may need Meta enablement. If “Payment methods” is missing, open Meta Direct Support → case type **WaBiz: Business Payments API**.
2. **Linked the wrong Razorpay account**
  Unlink config, recreate, Allow with the correct Razorpay login.
3. **configuration_name mismatch**
  Name in API must match Meta exactly (case-sensitive).
4. **Trying to use payment links + Pay Now interchangeably without unique reference_id**
  Always generate a new `reference_id` per attempt.
5. **Unlocking chat only on user saying “I paid”**
  Never do this. Wait for webhook + lookup confirmation.
6. **Catalog required confusion**
  For consultation (digital service), catalog is **not** required if you send `country_of_origin` / importer fields on items (as in the sample above).

---



## 14. When setup is done — tell the developer

Send back these things, then we start coding the **Native WhatsApp Pay** path:

1. `configuration_name` (exact string, status **Active**)
2. Screenshot / confirmation that manual **Pay Now** test worked in WhatsApp
3. WABA ID + Phone number ID (if changed)
4. Any Meta support ticket ID if Payments API enablement was required

**Already decided:** Native in-chat Pay Now only (not payment-link-first).

---

## Quick decision for Pandit G (LOCKED)

| Choice | Decision |
| --- | --- |
| Flow | **Native WhatsApp Pay (In-Chat)** |
| Integration mode | **Payment Gateway deep integration → Razorpay** |
| Button UX | `order.type = "quick_pay"` → **Pay Now** |
| Goods type | `digital-goods` (consultation) |
| Confirmation | WhatsApp payment webhook + payment lookup API |
| Old `rzp.io` links | Not primary; optional emergency fallback only |

### What you do now
1. Complete Steps A–F in this doc (Razorpay link + Meta payment config Active)
2. Send a manual Pay Now test to your phone
3. Reply **“setup done”** with the `configuration_name`

Then we implement Native Pay Now in code.