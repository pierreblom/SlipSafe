# SlipSafe Pro - Technical Documentation

> **Version:** 1.1  
> **Last Updated:** 2026-01-14  
> **Target Market:** South African SMEs & Freelancers

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [How It Works](#how-it-works)
6. [Database Schema](#database-schema)
7. [Edge Function API](#edge-function-api)
8. [Setup & Deployment](#setup--deployment)
9. [Environment Variables](#environment-variables)
10. [Future Enhancements](#future-enhancements)

---

## Overview

SlipSafe Pro is a **SARS-compliant receipt management application** designed for South African businesses. It uses AI to extract data from receipts, automatically categorizes expenses, and stores them in a secure cloud database for the legally required 5-year retention period.

### Key Features

| Feature | Description |
|---------|-------------|
| **AI-Powered OCR** | Uses Google Gemini 2.5 Flash to read receipts |
| **Google Login** | Secure authentication for multi-user support |
| **VAT Compliance** | Identifies Tax Invoices vs. simple receipts |
| **Entertainment Block** | Auto-flags business lunches as non-claimable VAT |
| **Duplicate Detection** | Prevents claiming the same slip twice |
| **Cloud Storage** | Images stored in user-specific folders in Supabase |
| **Excel Export** | Audit-ready XLSX with embedded images |

---

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────────────┐
│                 │     │              Supabase (Cloud)                │
│   User App      │     │                                              │
│   (HTML/JS)     │────▶│  ┌──────────────────┐  ┌─────────────────┐  │
│                 │     │  │  Edge Function   │  │  Google Gemini  │  │
│  index.html     │     │  │  (analyze-slip)  │──│  AI (OCR)       │  │
│                 │     │  │  (Auth Required) │  └─────────────────┘  │
│  ┌───────────┐  │     │  └────────┬─────────┘                       │
│  │ Google    │  │     │           │                                  │
│  │ Auth      │──┼─────┼───────────┘                                  │
│  └───────────┘  │     │     ┌─────▼─────┐    ┌─────────────────┐    │
└─────────────────┘     │     │ Postgres  │    │ Storage Bucket  │    │
                        │     │ (slips)   │    │ (receipt-proofs)│    │
                        │     └───────────┘    └─────────────────┘    │
                        └──────────────────────────────────────────────┘
```

### Data Flow

1. **User logs in** → Authenticates via Google OAuth (Supabase Auth)
2. **User uploads receipt** → Frontend sends image + **JWT Token** to Edge Function
3. **Edge Function** → Verifies user identity and calls Gemini AI
4. **Gemini AI** → Returns extracted JSON (merchant, total, VAT, date)
5. **Edge Function** → Uploads image to **user-specific folder** in Storage
6. **Edge Function** → Saves metadata with `user_id` to Postgres Database
7. **Frontend** → Displays result and refreshes list (filtered by `user_id`)

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | HTML5 / Tailwind CSS / Vanilla JS | User Interface |
| **Backend** | Supabase Edge Functions (Deno) | Secure API & Logic |
| **AI/OCR** | Google Gemini 2.5 Flash | Receipt Analysis |
| **Database** | PostgreSQL (Supabase) | Data Persistence |
| **Storage** | Supabase Storage | Image Archive |
| **CDN** | jsDelivr | Supabase-js Client |

---

## Project Structure

```
SlipSafe/
├── index.html                    # Main application (frontend)
├── .env                          # Local environment variables (git-ignored)
├── .gitignore                    # Git ignore rules
├── netlify.toml                  # Netlify deployment config
├── build.sh                      # Build script
├── phase.md                      # Development phases
├── read.md                       # Original prototype + notes
├── documenting.md                # This file
│
├── imge/                         # Design assets
│   └── Gemini_Generated_Image... # Architecture diagram
│
└── supabase/
    └── functions/
        ├── deno.json             # Deno configuration
        └── analyze-slip/
            └── index.ts          # Edge Function code
```

---

## How It Works

### 1. Receipt Scanning

```javascript
// Frontend: Send image to Edge Function with Auth Header
const { data, error } = await supabaseClient.functions.invoke('analyze-slip', {
    body: formData,
    headers: {
        Authorization: `Bearer ${session.access_token}`
    }
});
```

### 2. AI Analysis (Edge Function)

```typescript
// Edge Function: Call Gemini AI
const prompt = `Analyze this South African receipt. Return JSON only: 
{ "merchant": "name", "total": 0.00, "vat": 0.00, "date": "YYYY-MM-DD", 
  "vatNumber": "string or null", "isTaxInvoice": boolean }`;

const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/...`, {
    body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }]
    })
});
```

### 3. Duplicate Detection

```typescript
// Check for existing slip for THIS user
const fingerprint = `${user.id}|${merchant}|${date}|${total}`;
const { data: existing } = await supabase
    .from('slips')
    .select('id')
    .eq('fingerprint', fingerprint)
    .single();

if (existing) {
    return new Response(JSON.stringify({ error: 'Duplicate Slip!' }), { status: 409 });
}
```

### 4. Data Storage

```typescript
// Upload image to user-specific folder
const fileName = `${user.id}/${Date.now()}_${merchant}.png`;
await supabase.storage.from('receipt-proofs').upload(fileName, file);

// Save to Database with user_id
await supabase.from('slips').insert([{
    user_id: user.id,
    merchant, total, vat, category, date, vat_number,
    is_tax_invoice, image_url, fingerprint
}]);
```

---

## Database Schema

### Table: `slips`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `user_id` | UUID | User reference (Supabase Auth) |
| `merchant` | TEXT | Store/vendor name |
| `total` | NUMERIC | Total amount (ZAR) |
| `vat` | NUMERIC | VAT amount (ZAR) |
| `category` | TEXT | "General Business" / "Entertainment" / "Travel" |
| `date` | DATE | Receipt date |
| `vat_number` | TEXT | Supplier VAT registration |
| `is_tax_invoice` | BOOLEAN | Valid for VAT claims? |
| `image_url` | TEXT | Link to stored image |
| `fingerprint` | TEXT | Duplicate detection hash |
| `created_at` | TIMESTAMPTZ | Record creation time |

### Storage Bucket: `receipt-proofs`

- **Type:** Public bucket
- **Purpose:** Store receipt images
- **Retention:** 5+ years (SARS requirement)

---

## Edge Function API

### Endpoint

```
POST https://fezppgnxhbxacuwcejma.supabase.co/functions/v1/analyze-slip
```

### Request

- **Content-Type:** `multipart/form-data`
- **Headers:** `Authorization: Bearer <user_jwt>`
- **Body:** `file` (image file)

### Response (Success - 200)

```json
{
    "message": "Success",
    "data": {
        "id": "uuid",
        "merchant": "Woolworths",
        "total": 250.00,
        "vat": 32.61,
        "category": "General Business",
        "date": "2026-01-14",
        "vat_number": "4000112233",
        "is_tax_invoice": true,
        "image_url": "https://...",
        "fingerprint": "Woolworths|2026-01-14|250.00"
    }
}
```

### Response (Duplicate - 409)

```json
{
    "error": "Duplicate Slip! You have already scanned this."
}
```

### Response (Error - 500)

```json
{
    "error": "Error message here"
}
```

---

## Setup & Deployment

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- [Supabase Project](https://supabase.com) created
- [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### Steps

```bash
# 1. Link to Supabase project
supabase link --project-ref fezppgnxhbxacuwcejma

# 2. Configure Google Auth in Supabase Dashboard
# - Enable Google Provider
# - Add Client ID and Secret
# - Set Redirect URL to http://localhost:3000

# 3. Set the Gemini API key as a secret
supabase secrets set GEMINI_API_KEY=AIzaSy...

# 4. Deploy the Edge Function
supabase functions deploy analyze-slip --no-verify-jwt

# 5. Run locally
npx serve .
```

### Netlify Deployment (Optional)

1. Push code to GitHub
2. Connect repo to Netlify
3. Deploy automatically

---

## Environment Variables

### Local Development (`.env`)

```bash
GEMINI_API_KEY=AIzaSy...
SUPABASE_URL=https://fezppgnxhbxacuwcejma.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
```

### Supabase Secrets (Production)

```bash
# These are set via CLI and used by Edge Functions
GEMINI_API_KEY      # Google Gemini API Key
SUPABASE_URL        # Auto-injected by Supabase
SUPABASE_SERVICE_ROLE_KEY  # Auto-injected by Supabase
```

---

## Future Enhancements

### Phase 2: Advanced Features

- [x] **User Authentication** - Multi-user support with Supabase Auth
- [ ] **Odometer Log** - Track business travel for SARS claims
- [ ] **Bank Statement Matching** - Reconcile swipes with receipts

### Phase 3: Integrations

- [ ] **WhatsApp Bot** - Send receipts via WhatsApp to auto-add
- [ ] **Accountant Portal** - Read-only access for tax practitioners
- [ ] **Xero/Sage Integration** - Sync with accounting software

### Phase 4: Mobile App

- [ ] **PWA** - Progressive Web App for offline support
- [ ] **Native Camera** - Better photo capture experience

---

## Support

For issues or feature requests, contact the development team.

---

*Built with ❤️ for South African businesses*
