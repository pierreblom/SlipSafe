# Yoco Payment Integration - SlipSafe

## 🎯 Overview

SlipSafe now supports **Yoco** as the payment gateway for subscriptions. This integration allows users to subscribe to SlipSafe Pro with secure card payments.

---

## 📁 Files Created/Modified

### New Edge Functions

1. **`supabase/functions/yoco-checkout/index.ts`**
   - Creates checkout sessions with Yoco
   - Handles user authentication
   - Stores payment records in database

2. **`supabase/functions/yoco-webhook/index.ts`**
   - Receives payment status updates from Yoco
   - Updates payment status in database
   - Supports signature verification for security

### Database

3. **`payments` table** (created via migration)
   - Tracks all payment transactions
   - Fields: checkout_id, payment_id, amount, status, metadata

### Frontend

4. **`front_end/app.js`**
   - Updated `handleSubscribe()` function to integrate with Yoco
   - Added payment status handling on page load

---

## 🔧 Setup Instructions

### Step 1: Get Yoco API Keys

1. Log in to your [Yoco Business Portal](https://portal.yoco.co.za)
2. Navigate to **Settings** → **Developers** → **API Keys**
3. Copy your **Secret Key** (starts with `sk_live_` or `sk_test_`)

### Step 2: Add Yoco Secret to Supabase

```bash
# Set the Yoco secret key
supabase secrets set YOCO_SECRET_KEY=sk_live_your_key_here

# Optional: Set webhook secret for signature verification
supabase secrets set YOCO_WEBHOOK_SECRET=your_webhook_secret

# Optional: Set your app URL for redirects
supabase secrets set APP_URL=https://your-app.netlify.app
```

### Step 3: Deploy Edge Functions

```bash
# Deploy the checkout function
supabase functions deploy yoco-checkout --no-verify-jwt

# Deploy the webhook function
supabase functions deploy yoco-webhook --no-verify-jwt
```

### Step 4: Register Webhook in Yoco Dashboard

1. Go to [Yoco Business Portal](https://portal.yoco.co.za)
2. Navigate to **Settings** → **Developers** → **Webhooks**
3. Add a new webhook with URL:
   ```
   https://fezppgnxhbxacuwcejma.supabase.co/functions/v1/yoco-webhook
   ```
4. Subscribe to these events:
   - `checkout.completed`
   - `checkout.expired`
   - `checkout.failed`
   - `refund.completed`

---

## 🧪 Testing

### Test Mode

Use test API keys from Yoco to test without real charges:
- Test Secret Key: `sk_test_...`
- Test Card: `4000000000000001` (any expiry, any CVV)

### Test the Flow

1. Open SlipSafe in browser
2. Go to Profile → Subscription
3. Select Monthly or Yearly plan
4. Click "Subscribe Now"
5. Complete payment on Yoco page
6. You'll be redirected back with success message

---

## 📊 Pricing

| Plan | Price | Amount (cents) |
|------|-------|----------------|
| Monthly | R49/month | 4900 |
| Yearly | R529/year | 52900 |

---

## 🔐 Security

- ✅ JWT authentication required for checkout
- ✅ HTTPS for all API calls
- ✅ Webhook signature verification (optional)
- ✅ Payment records stored with user isolation (RLS)
- ✅ Secret keys stored as Supabase secrets

---

## 🔄 Payment Flow

```
User clicks "Subscribe"
        ↓
Frontend calls yoco-checkout Edge Function
        ↓
Edge Function creates checkout session with Yoco
        ↓
User is redirected to Yoco payment page
        ↓
User enters card details & pays
        ↓
Yoco redirects back to app with status
        ↓
App shows success/failure message
        ↓
Yoco sends webhook to update payment status
```

---

## 📝 API Reference

### POST /functions/v1/yoco-checkout

Creates a new checkout session.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "amount": 4900,
  "currency": "ZAR",
  "successUrl": "https://app.com?payment=success",
  "cancelUrl": "https://app.com?payment=cancelled",
  "failureUrl": "https://app.com?payment=failed",
  "metadata": {
    "plan_type": "monthly"
  }
}
```

**Response:**
```json
{
  "success": true,
  "checkoutId": "checkout_abc123",
  "redirectUrl": "https://c.yoco.com/checkout/abc123",
  "status": "created"
}
```

---

## 🐛 Troubleshooting

### "YOCO_SECRET_KEY is not set"
Run: `supabase secrets set YOCO_SECRET_KEY=your_key`

### "Please sign in to subscribe"
User session expired. Sign out and sign in again.

### Payment not updating in database
Check that the webhook is registered in Yoco dashboard.

### "Failed to create checkout session"
Check Supabase function logs: `supabase functions logs yoco-checkout`

---

## 🚀 Future Enhancements

- [ ] Recurring subscriptions
- [ ] Subscription management (cancel/upgrade)
- [ ] Invoice generation
- [ ] Payment history in profile
- [ ] Promo codes / discounts

---

**Status**: ✅ Ready for deployment!

*Last Updated: February 2026*
